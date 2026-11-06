<?php
/**
 * Rotate every user's password to a fresh random one-time password and mark
 * the account as "must change password on next login".
 *
 * Run right before go-live on the PRODUCTION database:
 *   php scripts/force-password-reset.php
 *
 * The one-time passwords are printed to the console once. Hand them to the
 * users; everyone is forced to pick a new password at first login.
 */

require_once dirname(__DIR__) . '/config/env.php';
require_once dirname(__DIR__) . '/core/Auth.php';

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

$rows = $pdo->query('SELECT id, username, name, role FROM users ORDER BY username')->fetchAll();
printf("Rotating passwords for %d user(s)...\n\n", count($rows));

$stmt = $pdo->prepare('UPDATE users SET password_hash = ?, must_change_password = 1 WHERE id = ?');

foreach ($rows as $user) {
    $tempPassword = PasswordHelper::generateRandom();
    $stmt->execute([PasswordHelper::hash($tempPassword), $user['id']]);
    printf("  %-16s (%-15s) one-time password: %s\n", $user['username'], $user['role'], $tempPassword);
}

echo "\nDone. All users must change their password on next login.\n";