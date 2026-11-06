<?php
/**
 * PATCH /api/auth/password
 * Body: { currentPassword, newPassword }
 * Requires auth.
 */

$user = Middleware::authenticate();
$body = json_decode(file_get_contents('php://input'), true) ?: [];
$currentPassword = $body['currentPassword'] ?? '';
$newPassword = $body['newPassword'] ?? '';

if (!$currentPassword) {
    http_response_code(400);
    echo json_encode(['error' => 'Current password is required']);
    exit;
}
if (!$newPassword || strlen($newPassword) < 6) {
    http_response_code(400);
    echo json_encode(['error' => 'New password must be at least 6 characters long']);
    exit;
}
if (!PasswordHelper::verify($currentPassword, $user['password_hash'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Current password is incorrect']);
    exit;
}

$newHash = PasswordHelper::hash($newPassword);
Database::query(
    "UPDATE users SET password_hash = ?, must_change_password = 0, password_reset_requested = 0 WHERE id = ?",
    [$newHash, $user['id']]
);

$updated = Database::fetchOne("SELECT * FROM users WHERE id = ?", [$user['id']]);
echo json_encode(['ok' => true, 'user' => Middleware::sanitizeUser($updated)]);
