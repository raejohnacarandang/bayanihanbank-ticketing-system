<?php
/**
 * Admin-only Cloud Bank snapshot list.
 * Included by the PHP API dispatcher after JWT authentication and requireAdmin().
 */

$snapshots = Database::fetchAll(
    'SELECT id, snapshot_date, sheet_name, imported_at
       FROM cloud_bank_snapshots
      ORDER BY snapshot_date DESC, sheet_name DESC'
);

echo json_encode(
    ['snapshots' => $snapshots],
    JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
);
