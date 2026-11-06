<?php
/**
 * DELETE /api/branches/:id
 * Requires admin.
 */

$user = Middleware::authenticate();
$branchId = $_GET['id'];

$branch = Database::fetchOne("SELECT * FROM branches WHERE id = ?", [$branchId]);
if (!$branch) {
    http_response_code(404);
    echo json_encode(['error' => 'Branch not found']);
    exit;
}

Database::beginTransaction();
try {
    Database::query("DELETE FROM branches WHERE id = ?", [$branchId]);

    Database::query(
        "INSERT INTO audit_logs (id, timestamp, actorName, actorRole, action, targetId, details) VALUES (?, ?, ?, ?, ?, ?, ?)",
        ['aud-' . uniqid(), date('Y-m-d H:i:s'), $user['name'], $user['role'], 'DELETE_BRANCH', $branchId, "Removed branch {$branch['name']}"]
    );

    Database::commit();
    echo json_encode(['ok' => true]);
} catch (\Throwable $e) {
    Database::rollback();
    throw $e;
}
