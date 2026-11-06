<?php
/**
 * POST /api/branches
 * Body: { name, location, code?, status, userCount? }
 * Requires admin.
 */

$user = Middleware::authenticate();
$body = json_decode(file_get_contents('php://input'), true) ?: [];

$name = trim($body['name'] ?? '');
$location = trim($body['location'] ?? '');
$status = $body['status'] ?? 'Active';
$userCount = isset($body['userCount']) ? (int)$body['userCount'] : 0;

if (!$name) { http_response_code(400); echo json_encode(['error' => 'Branch name is required']); exit; }
if (!$location) { http_response_code(400); echo json_encode(['error' => 'Location is required']); exit; }

$branchId = 'br-' . uniqid();

Database::beginTransaction();
try {
    Database::query(
        "INSERT INTO branches (id, name, location, status, userCount) VALUES (?, ?, ?, ?, ?)",
        [$branchId, $name, $location, $status, $userCount]
    );

    Database::query(
        "INSERT INTO audit_logs (id, timestamp, actorName, actorRole, action, targetId, details) VALUES (?, ?, ?, ?, ?, ?, ?)",
        ['aud-' . uniqid(), date('Y-m-d H:i:s'), $user['name'], $user['role'], 'CREATE_BRANCH', $branchId, "Added branch $name"]
    );

    Database::commit();

    $created = Database::fetchOne("SELECT * FROM branches WHERE id = ?", [$branchId]);
    echo json_encode(['branch' => $created]);
} catch (\Throwable $e) {
    Database::rollback();
    throw $e;
}
