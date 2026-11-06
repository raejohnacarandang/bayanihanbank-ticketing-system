<?php
/**
 * POST /api/auth/admin-recovery
 * Body: { username, key }
 * Public — no session required.
 */

$body = json_decode(file_get_contents('php://input'), true) ?: [];
$username = trim($body['username'] ?? '');
$key = $body['key'] ?? '';

$appCfg = $appCfg ?? require appBase() . '/config/app.php';

if (!$appCfg['admin_recovery_key']) {
    http_response_code(503);
    echo json_encode(['error' => 'Admin recovery is not configured']);
    exit;
}

if (!$username) {
    http_response_code(400);
    echo json_encode(['error' => 'Username is required']);
    exit;
}
if (!$key) {
    http_response_code(400);
    echo json_encode(['error' => 'Recovery key is required']);
    exit;
}

$user = Database::fetchOne("SELECT * FROM users WHERE LOWER(username) = LOWER(?) AND role = 'ADMINISTRATOR'", [$username]);
if (!$user) {
    http_response_code(403);
    echo json_encode(['error' => 'Invalid credentials for admin recovery']);
    exit;
}

// Timing-safe key comparison
if (!hash_equals($appCfg['admin_recovery_key'], $key)) {
    http_response_code(403);
    echo json_encode(['error' => 'Invalid recovery key']);
    exit;
}

// Generate one-time password and update the user
$oneTimePassword = bin2hex(random_bytes(9));
$newHash = PasswordHelper::hash($oneTimePassword);
$now = date('M d, Y, h:i A');

Database::beginTransaction();
try {
    Database::query(
        "UPDATE users SET password_hash = ?, must_change_password = 1, password_reset_requested = 0 WHERE id = ?",
        [$newHash, $user['id']]
    );

    Database::query(
        "INSERT INTO audit_logs (id, timestamp, actorName, actorRole, action, targetId, details) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
            'aud-' . uniqid(),
            date('Y-m-d H:i:s'),
            $user['name'],
            $user['role'],
            'ADMIN_RECOVERY',
            $user['id'],
            'Admin password recovered via recovery key (one-time password issued)',
        ]
    );

    Database::commit();
    echo json_encode([
        'ok' => true,
        'oneTimePassword' => $oneTimePassword,
        'message' => 'Password reset. Use the one-time password to log in, then set a new one.',
    ]);
} catch (\Throwable $e) {
    Database::rollback();
    throw $e;
}
