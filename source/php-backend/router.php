<?php
/**
 * Router for PHP built-in dev server.
 * Usage: php -S localhost:3002 router.php
 *
 * Routes ALL requests through index.php so the API router handles everything.
 * In production on HostGator (Apache), .htaccess handles this instead.
 */

$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

// Serve actual static files (CSS, JS, images) from dist/ if they exist
$distPath = __DIR__ . '/../dist' . $uri;
if ($uri !== '/' && file_exists($distPath) && is_file($distPath)) {
    return false; // Let PHP's built-in server handle static files
}

// Everything else goes through index.php
require __DIR__ . '/index.php';
