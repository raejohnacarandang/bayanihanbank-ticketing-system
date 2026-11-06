<?php
/**
 * GET /api/tickets
 * Query params: status, branchId, assignedToId, requesterId, category
 * Requires auth.
 */

$user = Middleware::authenticate();
$filters = [
    'status'       => $_GET['status'] ?? null,
    'branchId'     => $_GET['branchId'] ?? null,
    'assignedToId' => $_GET['assignedToId'] ?? null,
    'requesterId'  => $_GET['requesterId'] ?? null,
    'category'     => $_GET['category'] ?? null,
];
$filters = array_filter($filters);

$sql = "SELECT * FROM tickets";
$params = [];
$conditions = [];

$role = $user['role'];
if ($role === 'BRANCH_USER') {
    $conditions[] = "(branchId = ? OR requesterId = ?)";
    $params[] = $user['branchId'];
    $params[] = $user['id'];
} elseif ($role === 'IT_STAFF') {
    $conditions[] = "(assignedToId = ? OR requesterId = ?)";
    $params[] = $user['id'];
    $params[] = $user['id'];
}

foreach ($filters as $col => $val) {
    $conditions[] = "$col = ?";
    $params[] = $val;
}

if (!empty($conditions)) {
    $sql .= " WHERE " . implode(" AND ", $conditions);
}
$sql .= " ORDER BY id DESC";

$tickets = Database::fetchAll($sql, $params);

// Parse JSON fields
foreach ($tickets as &$t) {
    if (isset($t['attachments']) && is_string($t['attachments'])) {
        $t['attachments'] = json_decode($t['attachments'], true) ?: null;
    }
}
unset($t);

echo json_encode(['tickets' => $tickets]);
