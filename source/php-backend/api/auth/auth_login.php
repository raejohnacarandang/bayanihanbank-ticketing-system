<?php
/**
 * POST /api/auth/login
 * Body: { username, password }
 * Returns: { token, user }
 */

$body = json_decode(file_get_contents('php://input'), true) ?: [];
$username = trim($body['username'] ?? '');
$password = $body['password'] ?? '';

if (!$username || !$password) {
    http_response_code(400);
    echo json_encode(['error' => 'username and password are required']);
    exit;
}

$user = Database::fetchOne("SELECT * FROM users WHERE LOWER(username) = LOWER(?)", [$username]);

if (!$user || !PasswordHelper::verify($password, $user['password_hash'])) {
    http_response_code(401);
    echo json_encode(['error' => 'Invalid username or password']);
    exit;
}

// Transparently rehash legacy scrypt → bcrypt on successful login
if (PasswordHelper::needsRehash($user['password_hash'])) {
    $newHash = PasswordHelper::hash($password);
    Database::query("UPDATE users SET password_hash = ? WHERE id = ?", [$newHash, $user['id']]);
    $user['password_hash'] = $newHash;
}

$token = JWT::sign($user);
echo json_encode([
    'token' => $token,
    'user'  => Middleware::sanitizeUser($user),
]);
