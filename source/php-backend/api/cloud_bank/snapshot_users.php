<?php
/**
 * Admin-only rows for one Cloud Bank daily snapshot.
 * Included by the PHP API dispatcher after JWT authentication and requireAdmin().
 */

$snapshotId = $_GET['snapshotId'] ?? '';
if (!is_string($snapshotId) || $snapshotId === '' || strlen($snapshotId) > 191) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid snapshot ID']);
    return;
}

$snapshot = Database::fetchOne(
    'SELECT id FROM cloud_bank_snapshots WHERE id = ?',
    [$snapshotId]
);

if (!$snapshot) {
    http_response_code(404);
    echo json_encode(['error' => 'Snapshot not found']);
    return;
}

$users = Database::fetchAll(
    'SELECT user_id, username, first_name, last_name, role,
            branch_before, branch_after, date_change, created_val,
            active_status, action, source_row_number
       FROM cloud_bank_users_daily
      WHERE snapshot_id = ?
      ORDER BY source_row_number ASC
      LIMIT 5000',
    [$snapshotId]
);

echo json_encode(
    ['users' => $users],
    JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
);
