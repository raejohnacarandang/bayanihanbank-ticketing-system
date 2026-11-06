<?php
/**
 * POST /api/users
 * Body: { username, name, role, email, branchId?, branchName?, department?, password? }
 * Requires admin.
 */

$user = Middleware::authenticate();
$body = json_decode(file_get_contents('php://input'), true) ?: [];

$username = trim($body['username'] ?? '');
$name = trim($body['name'] ?? '');
$role = $body['role'] ?? '';
$email = trim($body['email'] ?? '');
$branchId = $body['branchId'] ?? null;
$branchName = $body['branchName'] ?? null;
$department = $body['department'] ?? null;
$password = $body['password'] ?? null;

// Validation
if (strlen($username) < 3) { http_response_code(400); echo json_encode(['error' => 'Username must be at least 3 characters']); exit; }
if (!$name) { http_response_code(400); echo json_encode(['error' => 'Name is required']); exit; }
if (!in_array($role, ['BRANCH_USER', 'IT_STAFF', 'ADMINISTRATOR', 'AUDITOR'], true)) {
    http_response_code(400); echo json_encode(['error' => 'Invalid role']); exit;
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400); echo json_encode(['error' => 'Invalid email format']); exit;
}

$userId = 'usr-' . uniqid();
$hash = PasswordHelper::hash($password ?: 'password123');

// Clean up fields based on role
if ($role !== 'BRANCH_USER') {
    $branchId = null;
    $branchName = null;
} else {
    $department = null;
}

Database::beginTransaction();
try {
    Database::query(
        "INSERT INTO users (id, username, name, role, branchId, branchName, department, email, password_hash, must_change_password, password_reset_requested) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0)",
        [$userId, $username, $name, $role, $branchId, $branchName, $department, $email, $hash]
    );

    Database::query(
        "INSERT INTO audit_logs (id, timestamp, actorName, actorRole, action, targetId, details) VALUES (?, ?, ?, ?, ?, ?, ?)",
        ['aud-' . uniqid(), date('Y-m-d H:i:s'), $user['name'], $user['role'], 'CREATE_USER', $userId, "Created account for $name ($username) as $role"]
    );

    Database::commit();

    $created = Database::fetchOne("SELECT * FROM users WHERE id = ?", [$userId]);
    unset($created['password_hash']);
    echo json_encode(['user' => $created]);
} catch (\Throwable $e) {
    Database::rollback();
    throw $e;
}
