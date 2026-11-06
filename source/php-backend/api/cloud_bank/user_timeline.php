<?php
/**
 * Admin-only history for a Cloud Bank user across imported snapshots.
 * Included by the PHP API dispatcher after JWT authentication and requireAdmin().
 */

$userId = $_GET['userId'] ?? '';
if (!is_string($userId) || $userId === '' || strlen($userId) > 191) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid user ID']);
    return;
}

$timeline = Database::fetchAll(
    'SELECT u.snapshot_id,
            s.snapshot_date,
            s.sheet_name,
            u.user_id,
            u.username,
            u.first_name,
            u.last_name,
            u.role,
            u.branch_before,
            u.branch_after,
            u.date_change,
            u.created_val,
            u.active_status,
            u.action,
            u.source_row_number
       FROM cloud_bank_users_daily AS u
       INNER JOIN cloud_bank_snapshots AS s ON s.id = u.snapshot_id
      WHERE u.user_id = ?
      ORDER BY s.snapshot_date DESC, u.source_row_number ASC
      LIMIT 5000',
    [$userId]
);

echo json_encode(
    ['timeline' => $timeline],
    JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
);
