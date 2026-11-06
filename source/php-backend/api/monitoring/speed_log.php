<?php
/**
 * GET /api/monitoring/speed-log?branchId=...
 * Returns internet speed log entries for the given branch (or all branches if no branchId).
 * Requires auth. Role-filtered: IT_STAFF assigned branches, BRANCH_USER own branch, ADMIN/AUDITOR all.
 */

$user = Middleware::authenticate();
$role = $user['role'];
$branchId = $_GET['branchId'] ?? null;

$where = [];
$params = [];

if ($branchId !== null) {
    $where[] = "branchId = ?";
    $params[] = $branchId;
} else {
    // Role-based branch filtering when no branchId provided
    if ($role === 'IT_STAFF') {
        $assignments = json_decode($user['assignments'] ?? '[]', true) ?: [];
        $coveredBranchIds = [];
        foreach ($assignments as $a) {
            $expires = strtotime($a['expiresAt'] ?? '');
            if (($expires === false || $expires > time()) && isset($a['branchId'])) {
                $coveredBranchIds[] = $a['branchId'];
            }
        }
        if (empty($coveredBranchIds)) {
            echo json_encode(['entries' => []]);
            exit;
        }
        $placeholders = implode(',', array_fill(0, count($coveredBranchIds), '?'));
        $where[] = "branchId IN ($placeholders)";
        $params = array_merge($params, array_values($coveredBranchIds));
    } elseif ($role === 'BRANCH_USER') {
        $where[] = "branchId = ?";
        $params[] = $user['branchId'] ?? '';
    }
    // ADMINISTRATOR and AUDITOR see all
}

$sql = "SELECT * FROM internet_speed_log";
if (!empty($where)) {
    $sql .= " WHERE " . implode(" AND ", $where);
}
$sql .= " ORDER BY recordedAt DESC LIMIT 50";

$entries = Database::fetchAll($sql, $params);

echo json_encode(['entries' => $entries]);