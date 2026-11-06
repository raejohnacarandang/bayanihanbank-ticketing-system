<?php
/**
 * Shared bootstrap for route handlers under api/.
 *
 * These handlers must work in two layouts at once:
 *
 *   dev       php-backend/api/monitoring/alerts.php   → backend root is php-backend/
 *   packaged  <docroot>/api/monitoring/alerts.php     → backend root is <docroot>/api/
 *
 * build-hostgator.mjs flattens php-backend/api/* directly into the package's
 * api/, so the packaged tree is one level shallower and any hardcoded relative
 * path (the old __DIR__ . '/../../config/...') resolves outside the backend and
 * fatals. Walking up to the directory that actually contains config/env.php is
 * correct in both, and keeps these files runnable straight from the CLI, which
 * the monitoring cron jobs in deploy/cron.example depend on.
 *
 * Route handlers that are only ever reached through index.php do not need this —
 * index.php already loads config/ and core/ before dispatching.
 */

if (!defined('BACKEND_ROOT')) {
    $bbDir = __DIR__;
    while (!is_file($bbDir . '/config/env.php')) {
        $bbParent = dirname($bbDir);
        if ($bbParent === $bbDir) {
            // Walked off the filesystem root without finding config/env.php.
            fwrite(STDERR, "Cannot locate config/env.php above " . __DIR__ . "\n");
            exit(1);
        }
        $bbDir = $bbParent;
    }
    define('BACKEND_ROOT', $bbDir);

    require_once BACKEND_ROOT . '/config/env.php';
    require_once BACKEND_ROOT . '/config/app.php';
    require_once BACKEND_ROOT . '/config/database.php';
    require_once BACKEND_ROOT . '/core/Database.php';
    require_once BACKEND_ROOT . '/core/JWT.php';
    require_once BACKEND_ROOT . '/core/Auth.php';
    require_once BACKEND_ROOT . '/core/Middleware.php';
    require_once BACKEND_ROOT . '/core/Validator.php';
}

/**
 * Database settings, resolved once per process.
 *
 * Use this instead of `require <path>/config/database.php` so callers never
 * hardcode a path that is only valid in one of the two layouts.
 *
 * @return array{host:string,port:string,database:string,username:string,password:string,charset:string}
 */
function dbConfig(): array {
    static $cfg = null;
    if ($cfg === null) {
        $cfg = require BACKEND_ROOT . '/config/database.php';
    }
    return $cfg;
}
