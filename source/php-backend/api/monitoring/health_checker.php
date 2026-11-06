<?php
/**
 * Scheduled health checks: cron job that pings endpoints and auto-sets Offline.
 * Run via cron every 5-15 minutes.
 * 
 * Table: monitored_endpoints
 * - id, branchId, system, checkType, target, enabled, intervalMinutes, lastCheck, lastStatus, failureCount
 */

require_once __DIR__ . '/../_bootstrap.php';

class HealthChecker {
    private static function getPdo(): PDO {
        $cfg = dbConfig();
        $dsn = "mysql:host={$cfg['host']};port={$cfg['port']};dbname={$cfg['database']}" . (!empty($cfg['charset']) ? ";charset={$cfg['charset']}" : '');
        return new PDO($dsn, $cfg['username'], $cfg['password'], [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    }

    public static function getPdoForInit(): PDO {
        return self::getPdo();
    }

    public static function ensureTables(): void {
        $pdo = self::getPdoForInit();
        $pdo->exec("
CREATE TABLE IF NOT EXISTS monitored_endpoints (
  id varchar(50) NOT NULL,
  branchId varchar(50) NOT NULL,
  `system` varchar(30) NOT NULL,
  checkType enum('http','ping','tcp','dns') NOT NULL,
  target varchar(255) NOT NULL,
  enabled tinyint(1) NOT NULL DEFAULT 1,
  intervalMinutes int NOT NULL DEFAULT 5,
  lastCheck datetime DEFAULT NULL,
  lastStatus varchar(30) DEFAULT NULL,
  failureCount int NOT NULL DEFAULT 0,
  lastDetails text,
  createdBy varchar(50) DEFAULT NULL,
  createdAt varchar(100) DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_me_branch (branchId),
  KEY idx_me_system (`system`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
");
    }

    /**
     * Check all enabled endpoints
     */
    public static function checkAll(): array {
        $pdo = self::getPdo();
        $endpoints = $pdo->query("
            SELECT * FROM monitored_endpoints WHERE enabled = 1
        ")->fetchAll(PDO::FETCH_ASSOC);

        $results = [];
        foreach ($endpoints as $ep) {
            $result = self::checkEndpoint($pdo, $ep);
            $results[] = $result;
        }
        return $results;
    }

    private static function checkEndpoint(PDO $pdo, array $ep): array {
        $start = microtime(true);
        $success = false;
        $details = '';

        try {
            switch ($ep['checkType']) {
                case 'http':
                    $success = self::checkHttp($ep['target'], $details);
                    break;
                case 'ping':
                    $success = self::checkPing($ep['target'], $details);
                    break;
                case 'tcp':
                    $success = self::checkTcp($ep['target'], $details);
                    break;
                case 'dns':
                    $success = self::checkDns($ep['target'], $details);
                    break;
                default:
                    $details = "Unknown check type: {$ep['checkType']}";
            }
        } catch (\Throwable $e) {
            $success = false;
            $details = $e->getMessage();
        }

        $duration = round((microtime(true) - $start) * 1000);
        $newStatus = $success ? 'Working' : 'Not Working';
        $failureCount = $success ? 0 : ($ep['failureCount'] + 1);

        // Determine if we should mark branch system as Offline
        $shouldSetOffline = !$success && $failureCount >= 3; // 3 consecutive failures

        // Update endpoint record
        $pdo->prepare("
            UPDATE monitored_endpoints 
            SET lastCheck = NOW(), lastStatus = ?, failureCount = ?, lastDetails = ?
            WHERE id = ?
        ")->execute([$newStatus, $failureCount, $details, $ep['id']]);

        // If 3+ consecutive failures, set branch system to Offline
        if ($shouldSetOffline) {
            $updatedAt = date('M d, Y, h:i A');
            $pdo->prepare("
                INSERT INTO branch_health (id, branchId, `system`, `status`, notes, updatedBy, updatedByName, updatedAt)
                VALUES (?, ?, ?, 'Offline', ?, 'system', 'Health Checker', ?)
                ON DUPLICATE KEY UPDATE `status` = 'Offline', notes = VALUES(notes), updatedAt = VALUES(updatedAt)
            ")->execute([
                'bh-' . uniqid(),
                $ep['branchId'],
                $ep['system'],
                "Auto-set Offline after 3 consecutive failures: $details",
                $updatedAt,
            ]);

            // Log audit
            $pdo->prepare("
                INSERT INTO audit_logs (id, timestamp, actorName, actorRole, action, targetId, details)
                VALUES (?, NOW(), 'HEALTH CHECKER', 'SYSTEM', 'AUTO_OFFLINE', ?, ?)
            ")->execute([
                'aud-' . uniqid(),
                $ep['branchId'],
                "Auto-set {$ep['system']} to Offline after 3 consecutive failures ($details)"
            ]);
        }

        return [
            'endpointId' => $ep['id'],
            'branchId' => $ep['branchId'],
            'system' => $ep['system'],
            'checkType' => $ep['checkType'],
            'target' => $ep['target'],
            'success' => $success,
            'durationMs' => $duration,
            'status' => $newStatus,
            'failureCount' => $failureCount,
            'setOffline' => $shouldSetOffline,
        ];
    }

    private static function checkHttp(string $url, string &$details): bool {
        $ctx = stream_context_create([
            'http' => ['timeout' => 10, 'method' => 'HEAD', 'follow_location' => 1]
        ]);
        $fp = @fopen($url, 'r', false, $ctx);
        if ($fp) {
            $meta = stream_get_meta_data($fp);
            fclose($fp);
            $httpCode = $meta['wrapper_data'][0] ?? '';
            $success = preg_match('/HTTP\/\d\.\d\s+2\d\d/', $httpCode);
            $details = $success ? "HTTP $httpCode" : "HTTP error: $httpCode";
            return $success;
        }
        $details = 'Connection failed';
        return false;
    }

    private static function checkPing(string $host, string &$details): bool {
        $output = [];
        $result = 0;
        exec("ping -c 3 -W 2 " . escapeshellarg($host), $output, $result);
        $success = $result === 0;
        $details = $success ? 'Ping OK' : 'Ping failed: ' . implode('; ', $output);
        return $success;
    }

    private static function checkTcp(string $target, string &$details): bool {
        // target format: "host:port"
        if (!preg_match('/^(.+):(\d+)$/', $target, $m)) {
            $details = 'Invalid TCP target format (use host:port)';
            return false;
        }
        $host = $m[1];
        $port = (int)$m[2];
        $fp = @fsockopen($host, $port, $errno, $errstr, 5);
        if ($fp) {
            fclose($fp);
            $details = "TCP $host:$port OK";
            return true;
        }
        $details = "TCP $host:$port failed: $errstr ($errno)";
        return false;
    }

    private static function checkDns(string $domain, string &$details): bool {
        $records = @dns_get_record($domain, DNS_A);
        $success = !empty($records);
        $details = $success ? 'DNS resolves to ' . implode(', ', array_column($records, 'ip')) : 'DNS resolution failed';
        return $success;
    }

    public static function runCli(): void {
        if (php_sapi_name() !== 'cli') return;
        self::ensureTables();
        echo "Health checker table ready\n";
        $results = self::checkAll();
        echo "Checked " . count($results) . " endpoints\n";
        foreach ($results as $r) {
            echo "  {$r['branchId']} {$r['system']} ({$r['checkType']}): " . ($r['success'] ? 'OK' : 'FAIL') . " ({$r['durationMs']}ms) failureCount={$r['failureCount']}" . ($r['setOffline'] ? ' -> OFFLINE' : '') . "\n";
        }
    }
}