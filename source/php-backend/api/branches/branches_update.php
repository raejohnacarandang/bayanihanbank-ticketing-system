<?php
/**
 * PATCH /api/branches/:id
 * Body: { name?, location?, status?, userCount? }
 * Requires admin.
 */

$user = Middleware::authenticate();
$branchId = $_GET['id'];
$body = json_decode(file_get_contents('php://input'), true) ?: [];

$existing = Database::fetchOne("SELECT * FROM branches WHERE id = ?", [$branchId]);
if (!$existing) {
    http_response_code(404);
    echo json_encode(['error' => 'Branch not found']);
    exit;
}

$fields = [];
$params = [];

foreach (['name', 'location', 'status'] as $key) {
    if (array_key_exists($key, $body) && $body[$key] !== null) {
        $fields[] = "$key = ?";
        $params[] = is_string($body[$key]) ? trim($body[$key]) : $body[$key];
    }
}
if (array_key_exists('userCount', $body)) {
    $fields[] = "userCount = ?";
    $params[] = (int)$body['userCount'];
}

if (empty($fields)) {
    echo json_encode(['branch' => $existing]);
    exit;
}

$params[] = $branchId;
Database::query("UPDATE branches SET " . implode(', ', $fields) . " WHERE id = ?", $params);

Database::query(
    "INSERT INTO audit_logs (id, timestamp, actorName, actorRole, action, targetId, details) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ['aud-' . uniqid(), date('Y-m-d H:i:s'), $user['name'], $user['role'], 'UPDATE_BRANCH', $branchId, "Updated branch {$existing['name']}"]
);

$updated = Database::fetchOne("SELECT * FROM branches WHERE id = ?", [$branchId]);
echo json_encode(['branch' => $updated]);
