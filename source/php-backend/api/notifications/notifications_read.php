<?php
/**
 * POST /api/notifications/:id/read
 * Requires auth.
 */

$user = Middleware::authenticate();
$notifId = $_GET['id'];

Database::query("UPDATE notifications SET `read` = 1 WHERE id = ? AND userId = ?", [$notifId, $user['id']]);
echo json_encode(['ok' => true]);
