<?php
/**
 * GET /api/monitoring
 * Requires auth. Returns the health status of every monitored system
 * (Internet, CCTV, ATM, PC, Printer, GenSet) per branch.
 *
 * Filtering by role:
 *   - IT_STAFF      → only branches the specialist is actively assigned to
 *   - BRANCH_USER   → only their own branch
 *   - ADMIN/AUDITOR → all branches
 */

$user = Middleware::authenticate();
$role = $user['role'];

$sql = "SELECT * FROM branch_health";
$params = [];

if ($role === 'IT_STAFF') {
    $assignments = json_decode($user['assignments'] ?? '[]', true) ?: [];
    $activeBranchIds = array_filter(
        array_map(function ($a) {
            $expires = strtotime($a['expiresAt'] ?? '');
            return ($expires === false || $expires > time()) ? ($a['branchId'] ?? null) : null;
        }, $assignments)
    );
    if (empty($activeBranchIds)) {
        echo json_encode(['branchHealth' => []]);
        exit;
    }
    $placeholders = implode(',', array_fill(0, count($activeBranchIds), '?'));
    $sql .= " WHERE branchId IN ($placeholders)";
    $params = array_values($activeBranchIds);
} elseif ($role === 'BRANCH_USER') {
    $sql .= " WHERE branchId = ?";
    $params = [$user['branchId']];
}

$sql .= " ORDER BY branchId, `system`";
$rows = Database::fetchAll($sql, $params) ?: [];
echo json_encode(['branchHealth' => $rows]);