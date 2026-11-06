<?php
/**
 * DELETE /api/users/:id
 * Requires admin.
 */

$user = Middleware::authenticate();
$userId = $_GET['id'];

if ($userId === $user['id']) {
    http_response_code(400);
    echo json_encode(['error' => 'Cannot delete your own account']);
    exit;
}

$target = Database::fetchOne("SELECT * FROM users WHERE id = ?", [$userId]);
if (!$target) {
    http_response_code(404);
    echo json_encode(['error' => 'User not found or cannot be deleted']);
    exit;
}

Database::beginTransaction();
try {
    Database::query("DELETE FROM users WHERE id = ?", [$userId]);

    Database::query(
        "INSERT INTO audit_logs (id, timestamp, actorName, actorRole, action, targetId, details) VALUES (?, ?, ?, ?, ?, ?, ?)",
        ['aud-' . uniqid(), date('Y-m-d H:i:s'), $user['name'], $user['role'], 'DELETE_USER', $userId, "Removed account {$target['name']} ({$target['username']})"]
    );

    Database::commit();
    echo json_encode(['ok' => true]);
} catch (\Throwable $e) {
    Database::rollback();
    throw $e;
}
