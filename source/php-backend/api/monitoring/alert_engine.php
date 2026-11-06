<?php
/**
 * Alert configuration and checking for branch monitoring.
 * 
 * Table: monitoring_alerts
 * - id, branchId, system, condition, threshold, severity, channels, enabled, createdBy, createdAt
 * 
 * Table: alert_notifications
 * - id, alertId, branchId, system, message, severity, sentAt, channel, status
 */

require_once __DIR__ . '/../_bootstrap.php';

class AlertEngine {
    private static function getDb(): PDO {
        $cfg = dbConfig();
        $dsn = "mysql:host={$cfg['host']};port={$cfg['port']};dbname={$cfg['database']}" . (!empty($cfg['charset']) ? ";charset={$cfg['charset']}" : '');
        return new PDO($dsn, $cfg['username'], $cfg['password'], [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    }

    /**
     * Check all enabled alerts against current branch health.
     * Call from cron or after each health update.
     */
    public static function checkAll(): array {
        $pdo = self::getDb();
        $alerts = $pdo->query("
            SELECT a.*, b.name as branchName 
            FROM monitoring_alerts a
            JOIN branches b ON a.branchId = b.id
            WHERE a.enabled = 1
        ")->fetchAll(PDO::FETCH_ASSOC);

        $results = [];
        foreach ($alerts as $alert) {
            $triggered = self::evaluateAlert($pdo, $alert);
            if ($triggered) {
                $results[] = self::sendNotification($pdo, $alert, $triggered);
            }
        }
        return $results;
    }

    private static function evaluateAlert(PDO $pdo, array $alert): ?array {
        $health = $pdo->prepare("SELECT * FROM branch_health WHERE branchId = ? AND `system` = ?");
        $health->execute([$alert['branchId'], $alert['system']]);
        $row = $health->fetch(PDO::FETCH_ASSOC);
        if (!$row) return null;

        $threshold = (float)$alert['threshold'];
        $condition = $alert['condition'];
        $value = null;

        switch ($condition) {
            case 'working_units_below':
                $value = $row['workingUnits'] ?? 0;
                return $value < $threshold ? ['value' => $value] : null;
            case 'working_percent_below':
                $total = $row['totalUnits'] ?? 0;
                $working = $row['workingUnits'] ?? 0;
                if ($total <= 0) return null;
                $value = ($working / $total) * 100;
                return $value < $threshold ? ['value' => round($value, 1)] : null;
            case 'status_offline':
                return $row['status'] === 'Offline' ? ['value' => 'Offline'] : null;
            case 'status_not_working':
                return $row['status'] === 'Not Working' ? ['value' => 'Not Working'] : null;
            case 'internet_speed_below':
                if ($alert['system'] !== 'Internet') return null;
                $speedStr = $row['internetSpeed'] ?? '';
                preg_match('/(\d+(\.\d+)?)\s*(Mbps|Kbps|Gbps)?/i', $speedStr, $m);
                if (!$m) return null;
                $val = (float)$m[1];
                $unit = strtolower($m[3] ?? 'mbps');
                if ($unit === 'kbps') $val /= 1000;
                elseif ($unit === 'gbps') $val *= 1000;
                $value = $val;
                return $value < $threshold ? ['value' => $value] : null;
            default:
                return null;
        }
    }

    private static function sendNotification(PDO $pdo, array $alert, array $context): array {
        $msg = sprintf(
            '[%s] %s - %s: %s (threshold: %s, current: %s)',
            $alert['severity'],
            $alert['branchName'],
            $alert['system'],
            $alert['condition'],
            $alert['threshold'],
            $context['value']
        );

        $channels = json_decode($alert['channels'] ?? '["log"]', true);
        $results = [];

        foreach ($channels as $channel) {
            switch ($channel) {
                case 'log':
                    $results['log'] = self::logAlert($pdo, $alert, $msg);
                    break;
                case 'email':
                    $results['email'] = self::sendEmail($alert, $msg);
                    break;
                case 'teams':
                    $results['teams'] = self::sendTeams($alert, $msg);
                    break;
            }
        }

        // Record notification
        $pdo->prepare("
            INSERT INTO alert_notifications (id, alertId, branchId, `system`, message, severity, sentAt, channel, status)
            VALUES (?, ?, ?, ?, ?, ?, NOW(), ?, 'sent')
        ")->execute([
            'an-' . uniqid(),
            $alert['id'],
            $alert['branchId'],
            $alert['system'],
            $msg,
            $alert['severity'],
            implode(',', $channels),
        ]);

        return ['alertId' => $alert['id'], 'message' => $msg, 'channels' => $results];
    }

    private static function logAlert(PDO $pdo, array $alert, string $msg): bool {
        $pdo->prepare("
            INSERT INTO audit_logs (id, timestamp, actorName, actorRole, action, targetId, details)
            VALUES (?, NOW(), 'ALERT ENGINE', 'SYSTEM', 'ALERT_TRIGGERED', ?, ?)
        ")->execute([
            'aud-' . uniqid(),
            $alert['branchId'],
            $msg,
        ]);
        return true;
    }

    private static function sendEmail(array $alert, string $msg): bool {
        $to = getenv('ALERT_EMAIL_TO') ?: 'admin@bayanihanbank.demo';
        $subject = "[Bayanihan Bank] Alert: {$alert['system']} at {$alert['branchName']}";
        $headers = "From: alerts@bayanihanbank.demo\r\nContent-Type: text/plain; charset=UTF-8";
        try {
            return @mail($to, $subject, $msg, $headers);
        } catch (\Throwable $e) {
            error_log("[ALERT EMAIL FAILED] " . $e->getMessage());
            return false;
        }
    }

    private static function sendTeams(array $alert, string $msg): bool {
        $webhook = getenv('TEAMS_WEBHOOK_URL');
        if (!$webhook) return false;
        $payload = json_encode(['text' => $msg]);
        try {
            $ctx = stream_context_create([
                'http' => ['method' => 'POST', 'header' => 'Content-Type: application/json', 'content' => $payload, 'timeout' => 5]
            ]);
            @file_get_contents($webhook, false, $ctx);
            return true;
        } catch (\Throwable $e) {
            error_log("[ALERT TEAMS FAILED] " . $e->getMessage());
            return false;
        }
    }
}

// CLI entry point
if (php_sapi_name() === 'cli') {
    $results = AlertEngine::checkAll();
    echo "Alerts checked: " . count($results) . " triggered\n";
    foreach ($results as $r) {
        echo "  - {$r['message']}\n";
    }
}