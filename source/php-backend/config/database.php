<?php
/**
 * Database configuration.
 *
 * Returns a settings array read from the environment (config/env.php loads the
 * repo-root .env into getenv()). Callers use:
 *
 *   $cfg = require __DIR__ . '/../config/database.php';s
 *   $dsn = "mysql:host={$cfg['host']};port={$cfg['port']};dbname={$cfg['database']}"
 *        . (!empty($cfg['charset']) ? ";charset={$cfg['charset']}" : '');
 *
 * This file deliberately performs NO connection: every consumer builds its own
 * PDO handle and a failed connect must raise a catchable PDOException rather
 * than killing the request with a plain-text body.
 */

require_once __DIR__ . '/env.php';

if (!defined('BASE_URL')) {
    define('BASE_URL', getenv('APP_URL') ?: 'http://support.bayanihanbank.com');
}

date_default_timezone_set('Asia/Manila');

return [
    'host'     => getenv('DB_HOST') ?: '127.0.0.1',
    'port'     => getenv('DB_PORT') ?: '3306',
    'database' => getenv('DB_NAME') ?: 'bilbopal_bayanihan_bank',
    'username' => getenv('DB_USER') ?: 'root',
    'password' => getenv('DB_PASSWORD') ?: '',
    'charset'  => 'utf8mb4',
];
