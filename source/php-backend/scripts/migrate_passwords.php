<?php
/**
 * Legacy scrypt -> bcrypt reset.
 *
 *   php scripts/migrate_passwords.php <targetPassword> --force
 *
 * IMPORTANT: this is a RESET, not a migration. PasswordHelper cannot verify
 * "scrypt$..." hashes, so the original password is unknown and unrecoverable —
 * the only way to make such an account usable is to overwrite it with a known
 * password and require the user to change it at next login.
 *
 * Because that hands every affected account the same credential, the script
 * refuses to run without an explicit target password and --force, and it sets
 * must_change_password = 1 so nobody keeps using the shared password.
 *
 * Prefer scripts/force-password-reset.php, which issues a distinct random
 * one-time password per user.
 */

require_once dirname(__DIR__) . '/config/env.php';
require_once dirname(__DIR__) . '/config/database.php';
require_once dirname(__DIR__) . '/core/Database.php';
require_once dirname(__DIR__) . '/core/Auth.php';

$targetPassword = $argv[1] ?? '';
$force          = in_array('--force', $argv, true);

if (!$targetPassword || !$force) {
    fwrite(STDERR, "Refusing to reset passwords.\n\n");
    fwrite(STDERR, "This overwrites the password of every account still using a\n");
    fwrite(STDERR, "legacy scrypt hash. Run:\n\n");
    fwrite(STDERR, "  php scripts/migrate_passwords.php <targetPassword> --force\n\n");
    fwrite(STDERR, "or, preferably, the safer per-user rotation:\n\n");
    fwrite(STDERR, "  php scripts/force-password-reset.php\n");
    exit(1);
}

$affected = Database::fetchAll(
    "SELECT id, username FROM users WHERE password_hash LIKE 'scrypt$%'"
);

if (!$affected) {
    echo "No legacy scrypt hashes found — nothing to do.\n";
    exit(0);
}

printf("About to reset %d account(s) to a single shared password:\n\n", count($affected));
foreach ($affected as $u) {
    printf("  %s (%s)\n", $u['username'], $u['id']);
}
echo "\nEach will be flagged to change it at next login.\n";

if (!$force) {
    echo "\nRe-run with --force to proceed.\n";
    exit(1);
}

$hash = PasswordHelper::hash($targetPassword);
$stmt = Database::getConnection()->prepare(
    'UPDATE users SET password_hash = ?, must_change_password = 1 WHERE id = ?'
);

foreach ($affected as $u) {
    $stmt->execute([$hash, $u['id']]);
    printf("  [reset] %s\n", $u['username']);
}

printf("\nDone. %d account(s) reset and flagged to change password.\n", count($affected));
