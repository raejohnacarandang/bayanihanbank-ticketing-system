<?php
/**
 * Alert management API
 * GET    /api/monitoring/alerts          - List alerts
 * POST   /api/monitoring/alerts          - Create alert
 * PATCH  /api/monitoring/alerts/:id      - Update alert
 * DELETE /api/monitoring/alerts/:id      - Delete alert
 * POST   /api/monitoring/alerts/check    - Manually trigger check
 */

require_once __DIR__ . '/../_bootstrap.php';
require_once __DIR__ . '/alert_engine.php';

$user = Middleware::authenticate();
$method = $_SERVER['REQUEST_METHOD'];
$uri = $_SERVER['REQUEST_URI'];
$uri = strtok($uri, '?');

$body = json_decode(file_get_contents('php://input'), true) ?: [];

if ($uri === '/api/monitoring/alerts' && $method === 'GET') {
    $pdo = Database::getConnection();
    $stmt = $pdo->query("SELECT * FROM monitoring_alerts ORDER BY createdAt DESC");
    echo json_encode(['alerts' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
    exit;
}

if ($uri === '/api/monitoring/alerts' && $method === 'POST') {
    $pdo = Database::getConnection();
    $id = 'al-' . uniqid();
    $createdAt = date('M d, Y, h:i A');
    $channels = json_encode($body['channels'] ?? ['log']);
    $stmt = $pdo->prepare("
        INSERT INTO monitoring_alerts (id, branchId, `system`, `condition`, threshold, severity, channels, enabled, createdBy, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ");
    $stmt->execute([
        $id,
        $body['branchId'],
        $body['system'],
        $body['condition'],
        $body['threshold'],
        $body['severity'] ?? 'warning',
        $channels,
        $body['enabled'] ?? 1,
        $user['id'],
        $createdAt,
    ]);
    echo json_encode(['id' => $id]);
    exit;
}

if (preg_match('#^/api/monitoring/alerts/([^/]+)$#', $uri, $m) && $method === 'PATCH') {
    $pdo = Database::getConnection();
    $alertId = $m[1];
    $updates = [];
    $params = [];
    foreach (['branchId', 'system', 'condition', 'threshold', 'severity', 'channels', 'enabled'] as $field) {
        if (array_key_exists($field, $body)) {
            $updates[] = "`$field` = ?";
            $params[] = $field === 'channels' ? json_encode($body[$field]) : $body[$field];
        }
    }
    if (!empty($updates)) {
        $params[] = $alertId;
        $pdo->prepare("UPDATE monitoring_alerts SET " . implode(', ', $updates) . " WHERE id = ?")->execute($params);
    }
    echo json_encode(['ok' => true]);
    exit;
}

if (preg_match('#^/api/monitoring/alerts/([^/]+)$#', $uri, $m) && $method === 'DELETE') {
    $pdo = Database::getConnection();
    $pdo->prepare("DELETE FROM monitoring_alerts WHERE id = ?")->execute([$m[1]]);
    echo json_encode(['ok' => true]);
    exit;
}

if ($uri === '/api/monitoring/alerts/check' && $method === 'POST') {
    $results = AlertEngine::checkAll();
    echo json_encode(['triggered' => count($results), 'results' => $results]);
    exit;
}

http_response_code(404);
echo json_encode(['error' => 'Not found']);