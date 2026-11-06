<?php
/**
 * GET /api/events
 * Server-Sent Events stream — simplified for shared hosting.
 * Token passed as query parameter (same as Node.js).
 *
 * NOTE: PHP's built-in dev server is single-threaded. Long-lived SSE
 * connections block ALL other requests. We send a quick heartbeat and
 * close immediately, relying on the frontend's 15s polling for updates.
 */

header('Content-Type: text/event-stream');
header('Cache-Control: no-cache');
header('Connection: keep-alive');
header('X-Accel-Buffering: no');

ignore_user_abort(true);

$token = $_GET['token'] ?? '';
$payload = JWT::verify($token);
if (!$payload) {
    http_response_code(401);
    echo "data: " . json_encode(['error' => 'Invalid or expired token']) . "\n\n";
    exit;
}

$user = Database::fetchOne("SELECT * FROM users WHERE id = ?", [$payload['sub']]);
if (!$user) {
    http_response_code(401);
    echo "data: " . json_encode(['error' => 'Account no longer exists']) . "\n\n";
    exit;
}

// Send ready + heartbeat, then close immediately.
// The frontend polls /api/state every 15s — this is just a "wake up" signal.
echo "retry: 10000\n\n";
echo "data: " . json_encode(['type' => 'ready', 'at' => time() * 1000]) . "\n\n";
echo "data: " . json_encode(['type' => 'heartbeat', 'at' => time() * 1000]) . "\n\n";
@ob_flush();
flush();
