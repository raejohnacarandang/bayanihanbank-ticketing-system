<?php
/**
 * Set a user's password directly in the database (admin utility).
 *
 * Usage:
 *   php scripts/set-password.php <username> [newPassword]
 *
 * If newPassword is omitted, "password123" is used.
 */

require_once dirname(__DIR__) . '/config/env.php';
require_once dirname(__DIR__) . '/core/Auth.php';

if ($argc < 2) {
    echo "Usage: php scripts/set-password.php <username> [newPassword]\n";
    exit(1);
}

$username = $argv[1];
$newPassword = $argv[2] ?? 'password123';

$host = getenv('DB_HOST') ?: '127.0.0.1';
$port = getenv('DB_PORT') ?: '3306';
$user = getenv('DB_USER') ?: 'root';
$password = getenv('DB_PASSWORD') ?: '';
$db = getenv('DB_NAME') ?: 'bayanihan_bank';

$pdo = new PDO(
    "mysql:host=$host;port=$port;dbname=$db;charset=utf8mb4",
    $user,
    $password,
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
);

$stmt = $pdo->prepare(
    'UPDATE users SET password_hash = ?, must_change_password = 0, password_reset_requested = 0 WHERE username = ?'
);
$stmt->execute([PasswordHelper::hash($newPassword), $username]);

if ($stmt->rowCount() === 0) {
    echo "No user found with username '{$username}'.\n";
    exit(1);
}

echo "Password updated for '{$username}' (new hash written to database).\n";