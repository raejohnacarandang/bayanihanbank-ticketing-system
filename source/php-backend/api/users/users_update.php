<?php
/**
 * PATCH /api/users/:id
 * Body: { username?, name?, role?, email?, branchId?, branchName?, department?, password?, mustChangePassword?, passwordResetRequested? }
 * Requires admin.
 */

$user = Middleware::authenticate();
$userId = $_GET['id'];
$body = json_decode(file_get_contents('php://input'), true) ?: [];

$existing = Database::fetchOne("SELECT * FROM users WHERE id = ?", [$userId]);
if (!$existing) {
    http_response_code(404);
    echo json_encode(['error' => 'User not found or cannot be updated']);
    exit;
}

// Build update
$fields = [];
$params = [];

foreach (['username', 'name', 'role', 'email', 'branchId', 'branchName', 'department'] as $key) {
    if (array_key_exists($key, $body) && $body[$key] !== null) {
        $fields[] = "$key = ?";
        $params[] = is_string($body[$key]) ? trim($body[$key]) : $body[$key];
    }
}

// Password
if (!empty($body['password'])) {
    $fields[] = "password_hash = ?";
    $params[] = PasswordHelper::hash($body['password']);
    $fields[] = "must_change_password = 1";
    $fields[] = "password_reset_requested = 0";
}

// Boolean flags
if (array_key_exists('mustChangePassword', $body)) {
    $fields[] = "must_change_password = ?";
    $params[] = $body['must_change_password'] ? 1 : 0;
}
if (array_key_exists('passwordResetRequested', $body)) {
    $fields[] = "password_reset_requested = ?";
    $params[] = $body['passwordResetRequested'] ? 1 : 0;
}

// Role-based cleanup
$newRole = $body['role'] ?? $existing['role'];
if ($newRole !== 'BRANCH_USER') {
    $fields[] = "branchId = NULL";
    $fields[] = "branchName = NULL";
} else {
    $fields[] = "department = NULL";
}

if (empty($fields)) {
    echo json_encode(['user' => $existing]);
    exit;
}

$params[] = $userId;
Database::query("UPDATE users SET " . implode(', ', $fields) . " WHERE id = ?", $params);

Database::query(
    "INSERT INTO audit_logs (id, timestamp, actorName, actorRole, action, targetId, details) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ['aud-' . uniqid(), date('Y-m-d H:i:s'), $user['name'], $user['role'], 'UPDATE_USER', $userId, "Updated account for {$existing['name']}"]
);

$updated = Database::fetchOne("SELECT * FROM users WHERE id = ?", [$userId]);
unset($updated['password_hash']);
if (isset($updated['assignments']) && is_string($updated['assignments'])) {
    $updated['assignments'] = json_decode($updated['assignments'], true) ?? [];
}
if (!isset($updated['assignments']) || !is_array($updated['assignments'])) {
    $updated['assignments'] = [];
}
$updated['mustChangePassword'] = !empty($updated['must_change_password']);
$updated['passwordResetRequested'] = !empty($updated['password_reset_requested']);
unset($updated['must_change_password'], $updated['password_reset_requested']);

echo json_encode(['user' => $updated]);
