<?php
/**
 * Bayanihan Bank IT Service Desk — PHP API Entry Point.
 *
 * All /api/* requests are routed here via .htaccess.
 * The frontend is served as static files from ../dist/.
 */

// Load environment and helpers
require_once __DIR__ . '/config/env.php';
require_once __DIR__ . '/core/Database.php';
require_once __DIR__ . '/core/JWT.php';
require_once __DIR__ . '/core/Auth.php';
require_once __DIR__ . '/core/Middleware.php';
require_once __DIR__ . '/core/Validator.php';

// CORS headers
$appCfg = require __DIR__ . '/config/app.php';

// Support both the main frontend origin and the support subdomain
$requestOrigin = $_SERVER['HTTP_ORIGIN'] ?? '';
$allowedOrigins = [];
$envCors = getenv('CORS_ORIGIN') ?: '';
$envSupport = getenv('SUPPORT_ORIGIN') ?: '';

if ($envCors) {
    $allowedOrigins[] = $envCors;
}
if ($envSupport) {
    $allowedOrigins[] = $envSupport;
}
// Allow all in development if no specific origin configured
if (empty($allowedOrigins)) {
    $allowedOrigins = ['*'];
}

// Check if request origin is in allowed list
$originIsAllowed = in_array($requestOrigin, $allowedOrigins, true) || in_array('*', $allowedOrigins, true);
if ($originIsAllowed) {
    header("Access-Control-Allow-Origin: $requestOrigin");
}

// Continue with method/headers always
header("Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, x-csrf-token");
header("Access-Control-Allow-Credentials: true");
header("Content-Type: application/json; charset=utf-8");
// Refuse to serve unless a real JWT_SECRET is configured. Without it every
// token would be signed with the well-known fallback key, so anyone could
// forge an administrator session. Catches unset, empty and placeholder values.
$jwtSecret = getenv('JWT_SECRET');
if ($jwtSecret === false || $jwtSecret === '' || stripos($jwtSecret, 'CHANGE_ME') !== false) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'Server not configured: set JWT_SECRET in .env (see .env.example).']);
    exit;
}

$origin = $appCfg['cors_origin'];
header("Access-Control-Allow-Origin: $origin");
header("Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, x-csrf-token");
header("Access-Control-Allow-Credentials: true");
header("Content-Type: application/json; charset=utf-8");

// Handle preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// Parse the request
$method = $_SERVER['REQUEST_METHOD'];
$uri = $_SERVER['REQUEST_URI'];
// Strip query string
$uri = strtok($uri, '?');
// Remove /api prefix if present (for subdirectory hosting)
$uri = preg_replace('#^/api#', '', $uri);
$uri = '/' . trim($uri, '/');

// Read JSON body for POST/PATCH/PUT/DELETE
$body = [];
if (in_array($method, ['POST', 'PATCH', 'PUT', 'DELETE'])) {
    $raw = file_get_contents('php://input');
    if ($raw) {
        $body = json_decode($raw, true) ?: [];
    }
}

// Simple router
try {
    // --- Public routes (no auth) ---
    if ($uri === '/health') {
        echo json_encode(['ok' => true]);
        exit;
    }

    if ($uri === '/auth/login' && $method === 'POST') {
        require apiBase() . '/auth/auth_login.php';
        exit;
    }

    if ($uri === '/auth/reset-request' && $method === 'POST') {
        require apiBase() . '/auth/auth_reset_request.php';
        exit;
    }

    if ($uri === '/auth/admin-recovery' && $method === 'POST') {
        require apiBase() . '/auth/auth_admin_recovery.php';
        exit;
    }

    // SSE events — public but token-verified inside (EventSource cannot send
    // headers, so the JWT is passed as a query parameter). Must be routed
    // BEFORE Middleware::authenticate() which requires an Authorization header.
    if ($uri === '/events' && $method === 'GET') {
        require apiBase() . '/system/events.php';
        exit;
    }
    // SSE stream — token passed as query param (EventSource cannot send headers)
    if ($uri === '/monitoring/stream' && $method === 'GET') {
        require apiBase() . '/monitoring/stream.php';
        exit;
    }

    // --- Authenticated routes ---
    $user = Middleware::authenticate();

    // Auth session
    if ($uri === '/auth/logout' && $method === 'POST') {
        echo json_encode(['ok' => true]);
        exit;
    }

    if ($uri === '/auth/me' && $method === 'GET') {
        echo json_encode(['user' => Middleware::sanitizeUser($user)]);
        exit;
    }

    if ($uri === '/auth/password' && $method === 'PATCH') {
        require apiBase() . '/auth/auth_change_password.php';
        exit;
    }

    // State
    if ($uri === '/state' && $method === 'GET') {
        require apiBase() . '/system/state.php';
        exit;
    }

    // Tickets
    if ($uri === '/tickets' && $method === 'GET') {
        require apiBase() . '/tickets/tickets_list.php';
        exit;
    }
    if ($uri === '/tickets' && $method === 'POST') {
        require apiBase() . '/tickets/tickets_create.php';
        exit;
    }
    if (preg_match('#^/tickets/([^/]+)$#', $uri, $m) && $method === 'GET') {
        $_GET['id'] = $m[1];
        require apiBase() . '/tickets/tickets_get.php';
        exit;
    }
    if (preg_match('#^/tickets/([^/]+)/status$#', $uri, $m) && $method === 'PATCH') {
        $_GET['id'] = $m[1];
        require apiBase() . '/tickets/tickets_update_status.php';
        exit;
    }
    if (preg_match('#^/tickets/([^/]+)$#', $uri, $m) && $method === 'DELETE') {
        $_GET['id'] = $m[1];
        require apiBase() . '/tickets/tickets_delete.php';
        exit;
    }
    if (preg_match('#^/tickets/([^/]+)/assign$#', $uri, $m) && $method === 'PATCH') {
        $_GET['id'] = $m[1];
        require apiBase() . '/tickets/tickets_assign.php';
        exit;
    }
    if (preg_match('#^/tickets/([^/]+)/comments$#', $uri, $m) && $method === 'GET') {
        $_GET['id'] = $m[1];
        require apiBase() . '/tickets/tickets_comments_list.php';
        exit;
    }
    if (preg_match('#^/tickets/([^/]+)/comments$#', $uri, $m) && $method === 'POST') {
        $_GET['id'] = $m[1];
        require apiBase() . '/tickets/tickets_comments_create.php';
        exit;
    }
    if (preg_match('#^/tickets/([^/]+)/timeline$#', $uri, $m) && $method === 'GET') {
        $_GET['id'] = $m[1];
        require apiBase() . '/tickets/tickets_timeline.php';
        exit;
    }

    // Users
    if ($uri === '/users' && $method === 'GET') {
        require apiBase() . '/users/users_list.php';
        exit;
    }
    if ($uri === '/users' && $method === 'POST') {
        Middleware::requireAdmin($user);
        require apiBase() . '/users/users_create.php';
        exit;
    }
    if (preg_match('#^/users/([^/]+)$#', $uri, $m) && $method === 'PATCH') {
        Middleware::requireAdmin($user);
        $_GET['id'] = $m[1];
        require apiBase() . '/users/users_update.php';
        exit;
    }
    if (preg_match('#^/users/([^/]+)$#', $uri, $m) && $method === 'DELETE') {
        Middleware::requireAdmin($user);
        $_GET['id'] = $m[1];
        require apiBase() . '/users/users_delete.php';
        exit;
    }
    if (preg_match('#^/users/([^/]+)/assignments$#', $uri, $m) && $method === 'PATCH') {
        Middleware::requireAdmin($user);
        $_GET['id'] = $m[1];
        require apiBase() . '/users/users_assignments.php';
        exit;
    }

    // Branches
    if ($uri === '/branches' && $method === 'GET') {
        require apiBase() . '/branches/branches_list.php';
        exit;
    }
    if ($uri === '/branches' && $method === 'POST') {
        Middleware::requireAdmin($user);
        require apiBase() . '/branches/branches_create.php';
        exit;
    }
    if (preg_match('#^/branches/([^/]+)$#', $uri, $m) && $method === 'PATCH') {
        Middleware::requireAdmin($user);
        $_GET['id'] = $m[1];
        require apiBase() . '/branches/branches_update.php';
        exit;
    }
    if (preg_match('#^/branches/([^/]+)$#', $uri, $m) && $method === 'DELETE') {
        Middleware::requireAdmin($user);
        $_GET['id'] = $m[1];
        require apiBase() . '/branches/branches_delete.php';
        exit;
    }

    // Branch infrastructure monitoring
    if ($uri === '/monitoring' && $method === 'GET') {
        require apiBase() . '/monitoring/monitoring_list.php';
        exit;
    }
    if (preg_match('#^/monitoring/([^/]+)$#', $uri, $m) && $method === 'PATCH') {
        $_GET['id'] = $m[1];
        require apiBase() . '/monitoring/monitoring_update.php';
        exit;
    }
    if ($uri === '/monitoring/speed-log' && $method === 'GET') {
        require apiBase() . '/monitoring/speed_log.php';
        exit;
    }
    if ($uri === '/monitoring/daily' && $method === 'GET') {
        require apiBase() . '/monitoring/daily_report.php';
        exit;
    }
    if ($uri === '/monitoring/alerts' && $method === 'GET') {
        require apiBase() . '/monitoring/alerts.php';
        exit;
    }
    if ($uri === '/monitoring/alerts' && $method === 'POST') {
        require apiBase() . '/monitoring/alerts.php';
        exit;
    }
    if (preg_match('#^/monitoring/alerts/([^/]+)$#', $uri, $m) && in_array($method, ['PATCH', 'DELETE'])) {
        require apiBase() . '/monitoring/alerts.php';
        exit;
    }
    if ($uri === '/monitoring/alerts/check' && $method === 'POST') {
        require apiBase() . '/monitoring/alerts.php';
        exit;
    }
    if ($uri === '/monitoring/bulk' && $method === 'POST') {
        require apiBase() . '/monitoring/bulk_update.php';
        exit;
    }
    if ($uri === '/monitoring/endpoints' && $method === 'GET') {
        require apiBase() . '/monitoring/endpoints.php';
        exit;
    }
    if ($uri === '/monitoring/endpoints' && $method === 'POST') {
        require apiBase() . '/monitoring/endpoints.php';
        exit;
    }
    if (preg_match('#^/monitoring/endpoints/([^/]+)$#', $uri, $m) && in_array($method, ['PATCH', 'DELETE'])) {
        require apiBase() . '/monitoring/endpoints.php';
        exit;
    }
    if ($uri === '/monitoring/endpoints/check' && $method === 'POST') {
        require apiBase() . '/monitoring/endpoints.php';
        exit;
    }

    // Categories
    if ($uri === '/categories' && $method === 'GET') {
        require apiBase() . '/categories/categories_list.php';
        exit;
    }
    if ($uri === '/categories' && $method === 'POST') {
        Middleware::requireAdmin($user);
        require apiBase() . '/categories/categories_create.php';
        exit;
    }
    if (preg_match('#^/categories/([^/]+)$#', $uri, $m) && $method === 'PATCH') {
        Middleware::requireAdmin($user);
        $_GET['id'] = $m[1];
        require apiBase() . '/categories/categories_update.php';
        exit;
    }

    // Notifications
    if ($uri === '/notifications' && $method === 'GET') {
        require apiBase() . '/notifications/notifications_list.php';
        exit;
    }
    if (preg_match('#^/notifications/([^/]+)/read$#', $uri, $m) && $method === 'POST') {
        $_GET['id'] = $m[1];
        require apiBase() . '/notifications/notifications_read.php';
        exit;
    }
    if ($uri === '/notifications/read-all' && $method === 'POST') {
        require apiBase() . '/notifications/notifications_read_all.php';
        exit;
    }

    // Audit logs
    if ($uri === '/audit-logs' && $method === 'GET') {
        require apiBase() . '/system/audit_logs.php';
        exit;
    }

    // Cloud Bank Users Daily Monitoring (Admin-only, read-only endpoints)
    if ($uri === '/cloud-bank/snapshots' && $method === 'GET') {
        Middleware::requireAdmin($user);
        require apiBase() . '/cloud_bank/snapshots_list.php';
        exit;
    }
    if (preg_match('#^/cloud-bank/snapshots/([^/]+)/users$#', $uri, $m) && $method === 'GET') {
        Middleware::requireAdmin($user);
        $_GET['snapshotId'] = rawurldecode($m[1]);
        require apiBase() . '/cloud_bank/snapshot_users.php';
        exit;
    }
    if (preg_match('#^/cloud-bank/users/([^/]+)/timeline$#', $uri, $m) && $method === 'GET') {
        Middleware::requireAdmin($user);
        $_GET['userId'] = rawurldecode($m[1]);
        require apiBase() . '/cloud_bank/user_timeline.php';
        exit;
    }
    // Unknown route
    http_response_code(404);
    echo json_encode(['error' => 'Not found']);

} catch (\Throwable $e) {
    error_log('[API] Unhandled error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Internal server error']);
}
