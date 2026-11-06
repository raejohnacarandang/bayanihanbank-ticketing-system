<?php
/**
 * Bulk update monitoring: POST /api/monitoring/bulk
 * Body: { system, status?, totalUnits?, workingUnits?, internetSpeed?, notes?, branchIds?: string[] }
 * - Administrators: update all specified branches (or all active if branchIds omitted)
 * - IT_STAFF: update only their actively assigned branches (respects assignment expiry)
 */

require_once __DIR__ . '/../_bootstrap.php';

$user = Middleware::authenticate();
$role = $user['role'];

// Resolve target branches based on role
if ($role === 'ADMINISTRATOR') {
    // Admin: original behavior — all branches if no branchIds, or specified branches
    $allowedBulk = true;
} elseif ($role === 'IT_STAFF') {
    // IT_STAFF: only their actively assigned branches (same scoping as monitoring list)
    $assignments = json_decode($user['assignments'] ?? '[]', true) ?: [];
    $activeBranchIds = array_filter(
        array_map(function ($a) {
            $expires = strtotime($a['expiresAt'] ?? '');
            return ($expires === false || $expires > time()) ? ($a['branchId'] ?? null) : null;
        }, $assignments)
    );
    $activeBranchIds = array_values(array_filter($activeBranchIds));
    
    if (empty($activeBranchIds)) {
        http_response_code(400);
        echo json_encode(['error' => 'No active branch assignments found for IT_STAFF']);
        exit;
    }
    
    // If branchIds provided, intersect with their assigned branches
    $body = json_decode(file_get_contents('php://input'), true) ?: [];
    $branchIds = $body['branchIds'] ?? [];
    
    if (!empty($branchIds)) {
        $intersect = array_intersect($branchIds, $activeBranchIds);
        if (empty($intersect)) {
            http_response_code(422);
            echo json_encode(['error' => 'No overlapping branches between request and your assignments']);
            exit;
        }
        $branchIds = $intersect;
    } else {
        // No branchIds supplied → use only their assigned branches
        $branchIds = $activeBranchIds;
    }
} else {
    // Other roles (BRANCH_USER, etc.) — not allowed for bulk
    http_response_code(403);
    echo json_encode(['error' => 'Only administrators and IT_STAFF can perform bulk updates']);
    exit;
}

$body = json_decode(file_get_contents('php://input'), true) ?: [];

$system = trim($body['system'] ?? '');
$status = trim($body['status'] ?? '');
$totalUnits = isset($body['totalUnits']) ? filter_var($body['totalUnits'], FILTER_VALIDATE_INT) : null;
$workingUnits = isset($body['workingUnits']) ? filter_var($body['workingUnits'], FILTER_VALIDATE_INT) : null;
$internetSpeed = isset($body['internetSpeed']) ? trim((string)$body['internetSpeed']) : null;
$notes = isset($body['notes']) ? trim((string)$body['notes']) : null;
// NOTE: $branchIds is already set by the role block above (lines 39/48/51)
// for IT_STAFF — do not overwrite it here. For admin, it falls through from below.

$allowedSystems = ['Internet', 'CCTV', 'ATM', 'PC', 'Printer', 'GenSet'];
$allowedStatuses = ['Working', 'Not Working', 'Offline'];
$unitSystems = ['CCTV', 'PC', 'Printer'];

if (!in_array($system, $allowedSystems, true)) {
    http_response_code(422);
    echo json_encode(['error' => 'Invalid system']);
    exit;
}

$hasUnits = $totalUnits !== null || $workingUnits !== null;
if ($hasUnits) {
    if (!in_array($system, $unitSystems, true)) {
        http_response_code(422);
        echo json_encode(['error' => 'Unit counts are only supported for CCTV, PC, and Printer']);
        exit;
    }
    if ($totalUnits === null || $workingUnits === null || $totalUnits < 1 || $workingUnits < 0 || $workingUnits > $totalUnits) {
        http_response_code(422);
        echo json_encode(['error' => 'totalUnits must be >= 1 and workingUnits must be between 0 and totalUnits']);
        exit;
    }
    $status = $workingUnits >= $totalUnits ? 'Working' : ($workingUnits > 0 ? 'Not Working' : 'Offline');
}

if ($internetSpeed !== null) {
    if ($system !== 'Internet') {
        http_response_code(422);
        echo json_encode(['error' => 'Internet speed is only supported for Internet system']);
        exit;
    }
    if (mb_strlen($internetSpeed) > 100) {
        http_response_code(422);
        echo json_encode(['error' => 'Internet speed must be 100 characters or less']);
        exit;
    }
}

if ($status && !in_array($status, $allowedStatuses, true)) {
    http_response_code(422);
    echo json_encode(['error' => 'Invalid status']);
    exit;
}

if (!$status && !$hasUnits && $internetSpeed === null) {
    http_response_code(422);
    echo json_encode(['error' => 'At least one of status, totalUnits/workingUnits, or internetSpeed must be provided']);
    exit;
}

// Resolve target branches
if ($branchIds !== null) {
    if (!is_array($branchIds) || empty($branchIds)) {
        http_response_code(422);
        echo json_encode(['error' => 'branchIds must be a non-empty array']);
        exit;
    }
    $placeholders = implode(',', array_fill(0, count($branchIds), '?'));
    $branches = Database::fetchAll("SELECT id, name FROM branches WHERE id IN ($placeholders) AND status = 'Active'", $branchIds);
} else {
    $branches = Database::fetchAll("SELECT id, name FROM branches WHERE status = 'Active'");
}

if (empty($branches)) {
    echo json_encode(['updated' => 0, 'results' => []]);
    exit;
}

$updatedAt = date('M d, Y, h:i A');
$hasSpeed = $internetSpeed !== null && $internetSpeed !== '';
$results = [];

Database::beginTransaction();
try {
    foreach ($branches as $branch) {
        $bid = $branch['id'];
        $bname = $branch['name'];

        $updateFields = "`status` = VALUES(`status`), totalUnits = VALUES(totalUnits), workingUnits = VALUES(workingUnits), notes = VALUES(notes), updatedBy = VALUES(updatedBy), updatedByName = VALUES(updatedByName), updatedAt = VALUES(updatedAt)";
        if ($hasSpeed) {
            $updateFields .= ", internetSpeed = VALUES(internetSpeed)";
        }

        Database::query(
            "INSERT INTO branch_health (id, branchId, `system`, `status`, totalUnits, workingUnits, internetSpeed, notes, updatedBy, updatedByName, updatedAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE $updateFields",
            [
                'bh-' . uniqid(),
                $bid,
                $system,
                $status,
                $totalUnits,
                $workingUnits,
                $hasSpeed ? $internetSpeed : null,
                $notes,
                $user['id'],
                $user['name'],
                $updatedAt,
            ]
        );

        if ($hasSpeed) {
            Database::query(
                "INSERT INTO internet_speed_log (id, branchId, speed, recordedBy, recordedByName, recordedAt, notes)
                 VALUES (?, ?, ?, ?, ?, ?, ?)",
                [
                    'sl-' . uniqid(),
                    $bid,
                    $internetSpeed,
                    $user['id'],
                    $user['name'],
                    $updatedAt,
                    $notes,
                ]
            );
        }

        Database::query(
            "INSERT INTO audit_logs (id, timestamp, actorName, actorRole, action, targetId, details) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [
                'aud-' . uniqid(),
                date('Y-m-d H:i:s'),
                $user['name'],
                $user['role'],
                'BULK_UPDATE_BRANCH_HEALTH',
                $bid,
                "Bulk set $system to $status" . ($hasUnits ? " ({$workingUnits}/{$totalUnits})" : '') . ($hasSpeed ? " — Speed: {$internetSpeed}" : '') . ($notes !== null ? " — $notes" : ''),
            ]
        );

        $updated = Database::fetchOne("SELECT * FROM branch_health WHERE branchId = ? AND `system` = ?", [$bid, $system]);
        $results[] = $updated;
    }

    Database::commit();
} catch (\Throwable $e) {
    Database::rollback();
    throw $e;
}

echo json_encode(['updated' => count($results), 'results' => $results]);