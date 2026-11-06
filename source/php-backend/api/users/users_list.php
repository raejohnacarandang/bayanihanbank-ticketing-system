<?php
/**
 * GET /api/users
 * Requires auth.
 */

$user = Middleware::authenticate();

if ($user['role'] === 'BRANCH_USER') {
    $supportIds = Database::fetchAll("SELECT id FROM users WHERE role IN ('IT_STAFF', 'ADMINISTRATOR')");
    $ids = array_column($supportIds, 'id');
    $ids[] = $user['id'];
    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    $users = Database::fetchAll("SELECT * FROM users WHERE id IN ($placeholders)", $ids);
} else {
    $users = Database::fetchAll("SELECT * FROM users");
}

// Sanitize and parse
$users = array_map(function($u) {
    unset($u['password_hash']);
    if (isset($u['assignments']) && is_string($u['assignments'])) {
        $u['assignments'] = json_decode($u['assignments'], true) ?? [];
    }
    if (!isset($u['assignments'])) {
        $u['assignments'] = [];
    }
    $u['mustChangePassword'] = !empty($u['must_change_password']);
    $u['passwordResetRequested'] = !empty($u['password_reset_requested']);
    unset($u['must_change_password'], $u['password_reset_requested']);
    return $u;
}, $users);

echo json_encode(['users' => $users]);
