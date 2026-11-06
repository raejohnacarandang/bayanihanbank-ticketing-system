<?php
/**
 * Monitored endpoints management API
 * GET    /api/monitoring/endpoints          - List endpoints
 * POST   /api/monitoring/endpoints          - Create endpoint
 * PATCH  /api/monitoring/endpoints/:id      - Update endpoint
 * DELETE /api/monitoring/endpoints/:id      - Delete endpoint
 * POST   /api/monitoring/endpoints/check    - Trigger check all
 */

require_once __DIR__ . '/../_bootstrap.php';
require_once __DIR__ . '/health_checker.php';

HealthChecker::ensureTables();

$user = Middleware::authenticate();
if ($user['role'] !== 'ADMINISTRATOR') {
    http_response_code(403);
    echo json_encode(['error' => 'Only administrators can manage endpoints']);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];
$uri = $_SERVER['REQUEST_URI'];
$uri = strtok($uri, '?');

$body = json_decode(file_get_contents('php://input'), true) ?: [];

if ($uri === '/api/monitoring/endpoints' && $method === 'GET') {
    $pdo = Database::getConnection();
    $stmt = $pdo->query("SELECT * FROM monitored_endpoints ORDER BY branchId, `system`, `checkType`");
    echo json_encode(['endpoints' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
    exit;
}

if ($uri === '/api/monitoring/endpoints' && $method === 'POST') {
    $pdo = Database::getConnection();
    $id = 'me-' . uniqid();
    $createdAt = date('M d, Y, h:i A');
    $stmt = $pdo->prepare("
        INSERT INTO monitored_endpoints (id, branchId, `system`, checkType, target, enabled, intervalMinutes, createdBy, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ");
    $stmt->execute([
        $id,
        $body['branchId'],
        $body['system'],
        $body['checkType'],
        $body['target'],
        $body['enabled'] ?? 1,
        $body['intervalMinutes'] ?? 5,
        $user['id'],
        $createdAt,
    ]);
    echo json_encode(['id' => $id]);
    exit;
}

if (preg_match('#^/api/monitoring/endpoints/([^/]+)$#', $uri, $m) && $method === 'PATCH') {
    $pdo = Database::getConnection();
    $endpointId = $m[1];
    $updates = [];
    $params = [];
    foreach (['branchId', 'system', 'checkType', 'target', 'enabled', 'intervalMinutes'] as $field) {
        if (array_key_exists($field, $body)) {
            $updates[] = "`$field` = ?";
            $params[] = $body[$field];
        }
    }
    if (!empty($updates)) {
        $params[] = $endpointId;
        $pdo->prepare("UPDATE monitored_endpoints SET " . implode(', ', $updates) . " WHERE id = ?")->execute($params);
    }
    echo json_encode(['ok' => true]);
    exit;
}

if (preg_match('#^/api/monitoring/endpoints/([^/]+)$#', $uri, $m) && $method === 'DELETE') {
    $pdo = Database::getConnection();
    $pdo->prepare("DELETE FROM monitored_endpoints WHERE id = ?")->execute([$m[1]]);
    echo json_encode(['ok' => true]);
    exit;
}

if ($uri === '/api/monitoring/endpoints/check' && $method === 'POST') {
    $results = HealthChecker::checkAll();
    echo json_encode(['checked' => count($results), 'results' => $results]);
    exit;
}

http_response_code(404);
echo json_encode(['error' => 'Not found']);