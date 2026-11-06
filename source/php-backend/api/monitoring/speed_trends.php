<?php
/**
 * Historical trends: rollup internet_speed_log to hourly/daily aggregates
 * with retention policies.
 * 
 * Run via cron: hourly for hourly rollup, daily for daily rollup + retention.
 */

require_once __DIR__ . '/../_bootstrap.php';

class SpeedTrends {
    private static function getPdo(): PDO {
        $cfg = dbConfig();
        $dsn = "mysql:host={$cfg['host']};port={$cfg['port']};dbname={$cfg['database']}" . (!empty($cfg['charset']) ? ";charset={$cfg['charset']}" : '');
        return new PDO($dsn, $cfg['username'], $cfg['password'], [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    }

    public static function getPdoForInit(): PDO {
        return self::getPdo();
    }

    /**
     * Parse speed string to Mbps float
     */
    private static function parseSpeed(string $speed): ?float {
        preg_match('/(\d+(\.\d+)?)\s*(Mbps|Kbps|Gbps)?/i', $speed, $m);
        if (!$m) return null;
        $val = (float)$m[1];
        $unit = strtolower($m[3] ?? 'mbps');
        if ($unit === 'kbps') $val /= 1000;
        elseif ($unit === 'gbps') $val *= 1000;
        return $val;
    }

    /**
     * Roll up raw logs to hourly aggregates.
     * Run every hour via cron.
     */
    public static function rollupHourly(): int {
        $pdo = self::getPdo();
        
        // Get last processed hour
        $last = $pdo->query("SELECT MAX(hour_bucket) FROM internet_speed_hourly")->fetchColumn();
        $from = $last ? date('Y-m-d H:00:00', strtotime($last . ' +1 hour')) : date('Y-m-d 00:00:00', strtotime('-7 days'));
        $to = date('Y-m-d H:00:00');

        $logs = $pdo->prepare("
            SELECT branchId, speed, recordedAt 
            FROM internet_speed_log 
            WHERE STR_TO_DATE(recordedAt, '%b %d, %Y, %h:%i %p') >= ? 
              AND STR_TO_DATE(recordedAt, '%b %d, %Y, %h:%i %p') < ?
        ");
        $logs->execute([$from, $to]);
        $rows = $logs->fetchAll(PDO::FETCH_ASSOC);

        $buckets = [];
        foreach ($rows as $r) {
            $dt = new DateTime($r['recordedAt'].str_replace(',', '', ''));
            $bucket = $dt->format('Y-m-d H:00:00');
            $speed = self::parseSpeed($r['speed']);
            if ($speed === null) continue;
            if (!isset($buckets[$r['branchId']][$bucket])) {
                $buckets[$r['branchId']][$bucket] = ['sum' => 0, 'count' => 0, 'min' => PHP_FLOAT_MAX, 'max' => 0];
            }
            $b = &$buckets[$r['branchId']][$bucket];
            $b['sum'] += $speed;
            $b['count']++;
            $b['min'] = min($b['min'], $speed);
            $b['max'] = max($b['max'], $speed);
        }

        $inserted = 0;
        $stmt = $pdo->prepare("
            INSERT INTO internet_speed_hourly (id, branchId, hour_bucket, avg_speed, min_speed, max_speed, sample_count)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE 
                avg_speed = VALUES(avg_speed),
                min_speed = VALUES(min_speed),
                max_speed = VALUES(max_speed),
                sample_count = VALUES(sample_count)
        ");

        foreach ($buckets as $branchId => $data) {
            foreach ($data as $bucket => $v) {
                $stmt->execute([
                    'ish-' . uniqid(),
                    $branchId,
                    $bucket,
                    round($v['sum'] / $v['count'], 2),
                    round($v['min'], 2),
                    round($v['max'], 2),
                    $v['count'],
                ]);
                $inserted++;
            }
        }
        return $inserted;
    }

    /**
     * Roll up hourly to daily aggregates.
     * Run daily via cron.
     */
    public static function rollupDaily(): int {
        $pdo = self::getPdo();
        
        $last = $pdo->query("SELECT MAX(day_bucket) FROM internet_speed_daily")->fetchColumn();
        $from = $last ? date('Y-m-d', strtotime($last . ' +1 day')) : date('Y-m-d', strtotime('-30 days'));
        $to = date('Y-m-d');

        $buckets = $pdo->prepare("
            SELECT branchId, DATE(hour_bucket) as day_bucket, 
                   AVG(avg_speed) as avg_speed, 
                   MIN(min_speed) as min_speed, 
                   MAX(max_speed) as max_speed,
                   SUM(sample_count) as sample_count
            FROM internet_speed_hourly
            WHERE hour_bucket >= ? AND hour_bucket <= ?
            GROUP BY branchId, day_bucket
        ");
        $buckets->execute(["$from 00:00:00", "$to 23:00:00"]);
        $rows = $buckets->fetchAll(PDO::FETCH_ASSOC);

        $inserted = 0;
        $stmt = $pdo->prepare("
            INSERT INTO internet_speed_daily (id, branchId, day_bucket, avg_speed, min_speed, max_speed, sample_count)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE 
                avg_speed = VALUES(avg_speed),
                min_speed = VALUES(min_speed),
                max_speed = VALUES(max_speed),
                sample_count = VALUES(sample_count)
        ");

        foreach ($rows as $r) {
            $stmt->execute([
                'isd-' . uniqid(),
                $r['branchId'],
                $r['day_bucket'],
                round($r['avg_speed'], 2),
                round($r['min_speed'], 2),
                round($r['max_speed'], 2),
                $r['sample_count'],
            ]);
            $inserted++;
        }
        return $inserted;
    }

    /**
     * Apply retention policies.
     * Run daily via cron.
     * - Raw logs: keep 90 days
     * - Hourly: keep 1 year
     * - Daily: keep 5 years
     */
    public static function applyRetention(): array {
        $pdo = self::getPdo();
        $results = [];

        // Raw logs: 90 days - use STR_TO_DATE for parsing
        $stmt = $pdo->prepare("DELETE FROM internet_speed_log WHERE STR_TO_DATE(recordedAt, '%b %d, %Y, %h:%i %p') < DATE_SUB(NOW(), INTERVAL 90 DAY)");
        $stmt->execute();
        $results['raw_deleted'] = $stmt->rowCount();

        // Hourly: 1 year
        $stmt = $pdo->prepare("DELETE FROM internet_speed_hourly WHERE hour_bucket < DATE_SUB(NOW(), INTERVAL 1 YEAR)");
        $stmt->execute();
        $results['hourly_deleted'] = $stmt->rowCount();

        // Daily: 5 years
        $stmt = $pdo->prepare("DELETE FROM internet_speed_daily WHERE day_bucket < DATE_SUB(NOW(), INTERVAL 5 YEAR)");
        $stmt->execute();
        $results['daily_deleted'] = $stmt->rowCount();

        return $results;
    }
}

// Create rollup tables if not exist
if (php_sapi_name() === 'cli') {
    $pdo = SpeedTrends::getPdoForInit();
    $pdo->exec("
CREATE TABLE IF NOT EXISTS internet_speed_hourly (
  id varchar(50) NOT NULL,
  branchId varchar(50) NOT NULL,
  hour_bucket datetime NOT NULL,
  avg_speed decimal(10,2) NOT NULL,
  min_speed decimal(10,2) NOT NULL,
  max_speed decimal(10,2) NOT NULL,
  sample_count int NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_hourly (branchId, hour_bucket),
  KEY idx_hourly_branch (branchId, hour_bucket)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
");

$pdo->exec("
CREATE TABLE IF NOT EXISTS internet_speed_daily (
  id varchar(50) NOT NULL,
  branchId varchar(50) NOT NULL,
  day_bucket date NOT NULL,
  avg_speed decimal(10,2) NOT NULL,
  min_speed decimal(10,2) NOT NULL,
  max_speed decimal(10,2) NOT NULL,
  sample_count int NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_daily (branchId, day_bucket),
  KEY idx_daily_branch (branchId, day_bucket)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
");
}

echo "Rollup tables ready\n";

// CLI
if (php_sapi_name() === 'cli') {
    $mode = $argv[1] ?? 'all';
    switch ($mode) {
        case 'hourly':
            $n = SpeedTrends::rollupHourly();
            echo "Hourly rollup: $n buckets\n";
            break;
        case 'daily':
            $n = SpeedTrends::rollupDaily();
            echo "Daily rollup: $n buckets\n";
            break;
        case 'retention':
            $r = SpeedTrends::applyRetention();
            echo "Retention: " . json_encode($r) . "\n";
            break;
        default:
            $n1 = SpeedTrends::rollupHourly();
            $n2 = SpeedTrends::rollupDaily();
            $r = SpeedTrends::applyRetention();
            echo "Hourly: $n1, Daily: $n2, Retention: " . json_encode($r) . "\n";
    }
}