<?php
/**
 * Daily branch-health snapshot.
 *
 * `branch_health` only ever holds the CURRENT state of a branch/system, so
 * every update overwrites the previous one. This job freezes that state into
 * `branch_health_daily` once per day, which is what makes historical daily
 * reports possible.
 *
 * Run via cron shortly after midnight, when `branch_health` still holds the
 * previous day's closing state:
 *
 *   0 5 * * *  php /path/to/api/monitoring/daily_snapshot.php
 *
 * Usage:
 *   php daily_snapshot.php              capture yesterday (default)
 *   php daily_snapshot.php today         capture today
 *   php daily_snapshot.php 2026-08-07    capture a specific date
 *   php daily_snapshot.php --retention   apply retention only
 */

require_once __DIR__ . '/../_bootstrap.php';

class DailySnapshot {
    /** Daily snapshots are kept for 5 years, matching internet_speed_daily. */
    const RETENTION_DAYS = 5 * 365;

    private static ?PDO $pdo = null;

    public static function getPdo(): PDO {
        if (self::$pdo === null) {
            $cfg = dbConfig();
            $dsn = "mysql:host={$cfg['host']};port={$cfg['port']};dbname={$cfg['database']}"
                . (!empty($cfg['charset']) ? ";charset={$cfg['charset']}" : '');
            self::$pdo = new PDO($dsn, $cfg['username'], $cfg['password'], [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            ]);
        }
        return self::$pdo;
    }

    /**
     * `branch_health.updatedAt` is a pre-formatted display string
     * ("Aug 07, 2026, 10:30 AM"), not a DATETIME. Parse it in PHP rather
     * than with MySQL STR_TO_DATE so the format and the stored value cannot
     * drift apart.
     */
    public static function parseDisplayDateTime(?string $value): ?DateTime {
        if ($value === null || trim($value) === '') {
            return null;
        }
        $dt = DateTime::createFromFormat('M d, Y, h:i A', trim($value));
        return $dt === false ? null : $dt;
    }

    public static function normalizeDate(string $input): ?string {
        $input = trim($input);
        if ($input === '') {
            return null;
        }
        if (strtolower($input) === 'today') {
            return date('Y-m-d');
        }
        if (strtolower($input) === 'yesterday') {
            return date('Y-m-d', strtotime('-1 day'));
        }
        $dt = DateTime::createFromFormat('Y-m-d', $input);
        if ($dt === false || $dt->format('Y-m-d') !== $input) {
            return null;
        }
        return $input;
    }

    /**
     * Freeze the current `branch_health` rows under $snapshotDate.
     *
     * The day is cleared before it is rewritten rather than upserted, so
     * re-running the job is authoritative: a branch_health row that has since
     * been deleted cannot survive as an orphan in the snapshot.
     */
    public static function capture(string $snapshotDate): array {
        $pdo = self::getPdo();

        $rows = $pdo->query("SELECT * FROM branch_health ORDER BY branchId, `system`")
            ->fetchAll(PDO::FETCH_ASSOC);

        $capturedAt = date('Y-m-d H:i:s');
        $inserted = 0;

        $pdo->beginTransaction();
        try {
            $pdo->prepare("DELETE FROM branch_health_daily WHERE snapshotDate = ?")
                ->execute([$snapshotDate]);

            $stmt = $pdo->prepare("
                INSERT INTO branch_health_daily
                    (id, snapshotDate, branchId, `system`, `status`, totalUnits, workingUnits,
                     internetSpeed, notes, updatedBy, updatedByName, updatedAt, lastUpdatedOn, capturedAt)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    `status` = VALUES(`status`),
                    totalUnits = VALUES(totalUnits),
                    workingUnits = VALUES(workingUnits),
                    internetSpeed = VALUES(internetSpeed),
                    notes = VALUES(notes),
                    updatedBy = VALUES(updatedBy),
                    updatedByName = VALUES(updatedByName),
                    updatedAt = VALUES(updatedAt),
                    lastUpdatedOn = VALUES(lastUpdatedOn),
                    capturedAt = VALUES(capturedAt)
            ");

            foreach ($rows as $r) {
                $lastUpdated = self::parseDisplayDateTime($r['updatedAt'] ?? null);
                $stmt->execute([
                    'bhd-' . uniqid(),
                    $snapshotDate,
                    $r['branchId'],
                    $r['system'],
                    $r['status'],
                    $r['totalUnits'] ?? null,
                    $r['workingUnits'] ?? null,
                    $r['internetSpeed'] ?? null,
                    $r['notes'] ?? null,
                    $r['updatedBy'] ?? null,
                    $r['updatedByName'] ?? null,
                    $r['updatedAt'] ?? null,
                    $lastUpdated ? $lastUpdated->format('Y-m-d') : null,
                    $capturedAt,
                ]);
                $inserted++;
            }

            $pdo->commit();
        } catch (\Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }

        return ['snapshotDate' => $snapshotDate, 'rows' => $inserted, 'capturedAt' => $capturedAt];
    }

    /** Drop snapshots older than the retention window. */
    public static function applyRetention(): int {
        $pdo = self::getPdo();
        $stmt = $pdo->prepare("DELETE FROM branch_health_daily WHERE snapshotDate < DATE_SUB(?, INTERVAL ? DAY)");
        $stmt->execute([date('Y-m-d'), self::RETENTION_DAYS]);
        return $stmt->rowCount();
    }

    /** Every date that has at least one captured snapshot, newest first. */
    public static function availableDates(int $limit = 400): array {
        $pdo = self::getPdo();
        $stmt = $pdo->prepare("
            SELECT snapshotDate, COUNT(*) AS rowCount
            FROM branch_health_daily
            GROUP BY snapshotDate
            ORDER BY snapshotDate DESC
            LIMIT ?
        ");
        $stmt->bindValue(1, $limit, PDO::PARAM_INT);
        $stmt->execute();
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
}

function runCli(): int {
    global $argv;

    $isCli = PHP_SAPI === 'cli';

    if (!$isCli) {
        http_response_code(404);
        echo json_encode(['error' => 'Not found']);
        return 0;
    }

    // Creating the table from the script keeps it in step with the code that
    // reads it; the mysqldump mirrors in deploy/sql are generated artefacts.
    DailySnapshot::getPdo()->exec("
        CREATE TABLE IF NOT EXISTS branch_health_daily (
          id varchar(50) NOT NULL,
          snapshotDate date NOT NULL,
          branchId varchar(50) NOT NULL,
          `system` varchar(30) NOT NULL,
          `status` varchar(30) NOT NULL,
          totalUnits int(11) DEFAULT NULL,
          workingUnits int(11) DEFAULT NULL,
          internetSpeed varchar(100) DEFAULT NULL,
          notes text,
          updatedBy varchar(50) DEFAULT NULL,
          updatedByName varchar(150) DEFAULT NULL,
          updatedAt varchar(100) DEFAULT NULL,
          lastUpdatedOn date DEFAULT NULL,
          capturedAt datetime DEFAULT NULL,
          PRIMARY KEY (id),
          UNIQUE KEY uq_bhd_date_branch_system (snapshotDate, branchId, `system`),
          KEY idx_bhd_branch_date (branchId, snapshotDate)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    ");
    echo "Snapshot table ready\n";

    $arg = $argv[1] ?? 'yesterday';

    if ($arg === '--retention') {
        $deleted = DailySnapshot::applyRetention();
        echo "Retention: $deleted snapshot rows deleted\n";
        return 0;
    }

    $snapshotDate = DailySnapshot::normalizeDate($arg);
    if ($snapshotDate === null) {
        fwrite(STDERR, "Invalid date '$arg'. Expected yesterday, today, or YYYY-MM-DD.\n");
        return 1;
    }

    $result = DailySnapshot::capture($snapshotDate);
    $deleted = DailySnapshot::applyRetention();

    echo "Snapshot {$result['snapshotDate']}: {$result['rows']} branch/system rows captured\n";
    echo "Retention: $deleted snapshot rows deleted\n";
    return 0;
}

if (PHP_SAPI === 'cli') {
    exit(runCli());
}
