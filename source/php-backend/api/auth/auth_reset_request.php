<?php
/**
 * POST /api/auth/reset-request
 * Body: { username }
 * Public — no session required.
 */

$body = json_decode(file_get_contents('php://input'), true) ?: [];
$username = trim($body['username'] ?? '');

if (!$username) {
    http_response_code(400);
    echo json_encode(['error' => 'Username is required']);
    exit;
}

$user = Database::fetchOne("SELECT * FROM users WHERE LOWER(username) = LOWER(?)", [$username]);

if (!$user) {
    http_response_code(404);
    echo json_encode(['error' => 'No account found with that username']);
    exit;
}

// Administrator accounts need recovery key flow
if ($user['role'] === 'ADMINISTRATOR') {
    echo json_encode([
        'ok' => true,
        'requiresRecoveryKey' => true,
        'message' => 'This is an administrator account. Enter the recovery key to reset it.',
    ]);
    exit;
}

// Mark account and notify admins
Database::beginTransaction();
try {
    Database::query("UPDATE users SET password_reset_requested = 1 WHERE id = ?", [$user['id']]);

    // Notify all admins
    $admins = Database::fetchAll("SELECT id FROM users WHERE role = 'ADMINISTRATOR'");
    $now = date('M d, Y, h:i A');
    foreach ($admins as $admin) {
        Database::query(
            "INSERT INTO notifications (id, userId, ticketId, title, message, timestamp, `read`, type) VALUES (?, ?, ?, ?, ?, ?, 0, 'warning')",
            [
                'notif-' . uniqid(),
                $admin['id'],
                $user['id'],
                'Password reset requested',
                "{$user['name']} ({$user['username']}) requested a password reset. Set a new one from Admin → Users.",
                $now,
            ]
        );
    }

    // Audit log
    Database::query(
        "INSERT INTO audit_logs (id, timestamp, actorName, actorRole, action, targetId, details) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
            'aud-' . uniqid(),
            date('Y-m-d H:i:s'),
            $user['name'],
            $user['role'],
            'REQUEST_PASSWORD_RESET',
            $user['id'],
            "Password reset requested for {$user['name']} ({$user['username']})",
        ]
    );

    Database::commit();
    echo json_encode(['ok' => true, 'message' => 'Reset request submitted. Your administrator will contact you.']);
} catch (\Throwable $e) {
    Database::rollback();
    throw $e;
}
