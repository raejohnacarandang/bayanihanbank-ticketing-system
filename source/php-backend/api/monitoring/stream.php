<?php
/**
 * SSE endpoint: GET /api/monitoring/stream
 * Streams branch health updates in real-time.
 * Optional query params: branchId (filter to one branch), token (Bearer token for auth)
 * Requires auth. Role-filtered same as monitoring_list.
 *
 * NOTE: PHP's built-in dev server (`php -S`) is single-threaded. A long-lived
 * SSE connection blocks ALL other requests — including the very PATCH calls
 * this stream is meant to observe — so under that SAPI we send the current
 * snapshot once and close, and the client reconnects on a short interval.
 * Under a real web server the connection stays open and pushes on change.
 */

require_once __DIR__ . '/../_bootstrap.php';

// Support token via query param for EventSource (which can't send custom headers)
$token = $_GET['token'] ?? null;
if ($token) {
    $_SERVER['HTTP_AUTHORIZATION'] = 'Bearer ' . $token;
}

header('Content-Type: text/event-stream');
header('Cache-Control: no-cache');
header('Connection: keep-alive');
header('X-Accel-Buffering: no');

$user = Middleware::authenticate();
$role = $user['role'];
$branchId = $_GET['branchId'] ?? null;

// Build WHERE clause for role filtering
$where = [];
$params = [];

if ($branchId !== null) {
    $where[] = "branchId = ?";
    $params[] = $branchId;
} else {
    if ($role === 'IT_STAFF') {
        $assignments = json_decode($user['assignments'] ?? '[]', true) ?: [];
        $coveredBranchIds = [];
        foreach ($assignments as $a) {
            $expires = strtotime($a['expiresAt'] ?? '');
            if (($expires === false || $expires > time()) && isset($a['branchId'])) {
                $coveredBranchIds[] = $a['branchId'];
            }
        }
        if (!empty($coveredBranchIds)) {
            $placeholders = implode(',', array_fill(0, count($coveredBranchIds), '?'));
            $where[] = "branchId IN ($placeholders)";
            $params = array_merge($params, array_values($coveredBranchIds));
        } else {
            // No active assignments — stream an empty set instead of everything.
            $where[] = "1 = 0";
        }
    } elseif ($role === 'BRANCH_USER') {
        $where[] = "branchId = ?";
        $params[] = $user['branchId'] ?? '';
    }
    // ADMIN/AUDITOR see all
}

$sql = "SELECT * FROM branch_health";
if (!empty($where)) {
    $sql .= " WHERE " . implode(" AND ", $where);
}
$sql .= " ORDER BY branchId, `system`";

// Single-threaded built-in dev server: emit one snapshot and close so the
// PATCH/GET requests this stream observes are not blocked. The client hook
// reconnects every 5s, which behaves like a 5s live refresh.
if (php_sapi_name() === 'cli-server') {
    echo "retry: 3000\n\n";
    $payload = json_encode(['branchHealth' => Database::fetchAll($sql, $params), 'timestamp' => time()]);
    echo "data: $payload\n\n";
    @ob_flush();
    flush();
    exit;
}

$lastEtag = '';

while (true) {
    // Check if client disconnected
    if (connection_aborted()) {
        break;
    }

    $health = Database::fetchAll($sql, $params);

    // Generate simple etag to avoid sending unchanged data
    $etag = md5(json_encode($health));
    if ($etag !== $lastEtag) {
        $payload = json_encode(['branchHealth' => $health, 'timestamp' => time()]);
        echo "data: $payload\n\n";
        $lastEtag = $etag;
    } else {
        // Always emit something so proxies keep the connection open and
        // connection_aborted() is detected when the client goes away.
        echo ": keepalive\n\n";
    }
    ob_flush(); flush();

    sleep(5); // Poll interval
}
