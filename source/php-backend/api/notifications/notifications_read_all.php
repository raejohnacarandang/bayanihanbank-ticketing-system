<?php
/**
 * POST /api/notifications/read-all
 * Requires auth. Marks all of current user's notifications as read.
 */

$user = Middleware::authenticate();
Database::query("UPDATE notifications SET `read` = 1 WHERE userId = ?", [$user['id']]);
echo json_encode(['ok' => true]);
