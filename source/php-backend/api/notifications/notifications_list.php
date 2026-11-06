<?php
/**
 * GET /api/notifications
 * Requires auth. Returns current user's notifications.
 */

$user = Middleware::authenticate();
$notifications = Database::fetchAll(
    "SELECT * FROM notifications WHERE userId = ? ORDER BY id DESC",
    [$user['id']]
);

foreach ($notifications as &$n) {
    $n['read'] = !empty($n['read']);
}
unset($n);

echo json_encode(['notifications' => $notifications]);
