<?php
/**
 * Load .env file into getenv() if available.
 * Call this FIRST in index.php before anything else.
 */

function loadEnv(string $path): void {
    if (!file_exists($path)) return;
    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '' || $line[0] === '#') continue;
        if (strpos($line, '=') === false) continue;
        [$key, $value] = explode('=', $line, 2);
        $key = trim($key);
        $value = trim($value);
        // Remove surrounding quotes
        if (strlen($value) >= 2 && $value[0] === '"' && $value[strlen($value)-1] === '"') {
            $value = substr($value, 1, -1);
        } elseif (strlen($value) >= 2 && $value[0] === "'" && $value[strlen($value)-1] === "'") {
            $value = substr($value, 1, -1);
        }
        // An empty-but-present variable (some hosts pre-define DB_*) must not
        // shadow the value in .env, so treat "" the same as "not set".
        if (getenv($key) === false || getenv($key) === '') {
            putenv("$key=$value");
        }
    }
}

// Try project root .env first, then php-backend/.env
$root = dirname(__DIR__, 2);
loadEnv($root . '/.env');
loadEnv(__DIR__ . '/../.env');

// Also try the repository root (source/php-backend/ → <repo>/.env) for local dev.
loadEnv(dirname(__DIR__, 3) . '/.env');

/**
 * Root directory of the PHP backend. Works in BOTH layouts:
 *   - dev:      <project>/php-backend           (config/ sits at <root>/config)
 *   - packaged: <docroot>/api                   (config/ sits at <root>/config)
 * Because env.php itself always lives inside <root>/config, __DIR__/.. is <root>.
 */
function appBase(): string {
    static $base = null;
    if ($base === null) {
        $base = realpath(__DIR__ . '/..') ?: __DIR__;
    }
    return $base;
}

/**
 * Directory that holds the route handler files (auth/, tickets/, ...).
 * Works in both layouts as well (dev keeps an extra /api nesting level).
 */
function apiBase(): string {
    static $api = null;
    if ($api === null) {
        $root = appBase();
        $api = is_dir($root . '/api') ? $root . '/api' : $root;
    }
    return $api;
}
