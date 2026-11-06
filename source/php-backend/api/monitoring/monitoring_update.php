<?php
/**
 * PATCH /api/monitoring/:branchId
 * Body: { system, status, notes? } or { system, totalUnits, workingUnits, notes? }
 * Updates the health status of one monitored system at a branch.
 * Unit counts are supported for CCTV, PC, and Printer only; when provided,
 * the status is derived from the counts.
 *
 * Permissions:
 *   - IT_STAFF      → branch must be actively assigned to the specialist
 *   - BRANCH_USER   → only their own branch
 *   - ADMINISTRATOR → any branch
 *   - AUDITOR       → read-only
 *
 * Missing rows are created (upsert on branchId + system).
 */

$user = Middleware::authenticate();
$role = $user['role'];
$branchId = $_GET['id'];
$body = json_decode(file_get_contents('php://input'), true) ?: [];

$system = trim($body['system'] ?? '');
$status = trim($body['status'] ?? '');
$notes = isset($body['notes']) ? trim((string)$body['notes']) : null;
$internetSpeed = isset($body['internetSpeed']) ? trim((string)$body['internetSpeed']) : null;

$allowedSystems = ['Internet', 'CCTV', 'ATM', 'PC', 'Printer', 'GenSet'];
$allowedStatuses = ['Working', 'Not Working', 'Offline'];
$unitSystems = ['CCTV', 'PC', 'Printer'];

if (!in_array($system, $allowedSystems, true)) {
    http_response_code(422);
    echo json_encode(['error' => 'Invalid system']);
    exit;
}

$hasUnits = array_key_exists('totalUnits', $body) || array_key_exists('workingUnits', $body);
$totalUnits = null;
$workingUnits = null;
if ($hasUnits) {
    if (!in_array($system, $unitSystems, true)) {
        http_response_code(422);
        echo json_encode(['error' => 'Unit counts are only supported for CCTV, PC, and Printer']);
        exit;
    }
    $totalUnits = isset($body['totalUnits']) ? filter_var($body['totalUnits'], FILTER_VALIDATE_INT) : null;
    $workingUnits = isset($body['workingUnits']) ? filter_var($body['workingUnits'], FILTER_VALIDATE_INT) : null;
    if ($totalUnits === null || $workingUnits === null || $totalUnits < 1 || $workingUnits < 0 || $workingUnits > $totalUnits) {
        http_response_code(422);
        echo json_encode(['error' => 'totalUnits must be >= 1 and workingUnits must be between 0 and totalUnits']);
        exit;
    }
    // Derive status from the unit counts so stored data stays consistent.
    $status = $workingUnits >= $totalUnits ? 'Working' : ($workingUnits > 0 ? 'Not Working' : 'Offline');
}

// Internet speed: only allowed for Internet system
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

if (!in_array($status, $allowedStatuses, true)) {
    http_response_code(422);
    echo json_encode(['error' => 'Invalid status']);
    exit;
}

if ($role === 'AUDITOR') {
    http_response_code(403);
    echo json_encode(['error' => 'Read-only access for this role']);
    exit;
}

$branch = Database::fetchOne("SELECT * FROM branches WHERE id = ?", [$branchId]);
if (!$branch) {
    http_response_code(404);
    echo json_encode(['error' => 'Branch not found']);
    exit;
}

if ($role === 'BRANCH_USER' && ($user['branchId'] ?? null) !== $branchId) {
    http_response_code(403);
    echo json_encode(['error' => 'You can only update your own branch']);
    exit;
}
if ($role === 'IT_STAFF') {
    $assignments = json_decode($user['assignments'] ?? '[]', true) ?: [];
    $covered = false;
    foreach ($assignments as $a) {
        $expires = strtotime($a['expiresAt'] ?? '');
        if (($a['branchId'] ?? null) === $branchId && ($expires === false || $expires > time())) {
            $covered = true;
            break;
        }
    }
    if (!$covered) {
        http_response_code(403);
        echo json_encode(['error' => 'Branch is not assigned to you']);
        exit;
    }
}

$updatedAt = date('M d, Y, h:i A');
$hasSpeed = $internetSpeed !== null && $internetSpeed !== '';

Database::beginTransaction();
try {
    // Build dynamic ON DUPLICATE KEY UPDATE to only update internetSpeed when provided
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
            $branchId,
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

    // Insert into speed log if internetSpeed was provided
    if ($hasSpeed) {
        Database::query(
            "INSERT INTO internet_speed_log (id, branchId, speed, recordedBy, recordedByName, recordedAt, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?)",
            [
                'sl-' . uniqid(),
                $branchId,
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
            'UPDATE_BRANCH_HEALTH',
            $branchId,
            "Set {$branch['name']} {$system} to {$status}" . ($hasUnits ? " ({$workingUnits}/{$totalUnits})" : '') . ($hasSpeed ? " — Speed: {$internetSpeed}" : '') . ($notes !== null ? " — $notes" : ''),
        ]
    );

    // Notify all administrators
    if ($status === 'Not Working' || $status === 'Offline') {
        $admins = Database::fetchAll("SELECT id FROM users WHERE role = 'ADMINISTRATOR'");
        $alertTitle = 'Branch System Alert';
        $alertMsg = "{$branch['name']} — {$system} is now " . ($status === 'Offline' ? 'Offline' : 'Not Working');
        $alertType = $status === 'Offline' ? 'warning' : 'info';
        foreach ($admins as $admin) {
            Database::query(
                "INSERT INTO notifications (id, userId, ticketId, branchId, title, message, timestamp, `read`, type) VALUES (?, ?, NULL, ?, ?, ?, ?, 0, ?)",
                [
                    'notif-' . uniqid(),
                    $admin['id'],
                    $branchId,
                    $alertTitle,
                    $alertMsg,
                    date('Y-m-d H:i:s'),
                    $alertType,
                ]
            );
        }
    }

    Database::commit();
} catch (\Throwable $e) {
    Database::rollback();
    throw $e;
}

$updated = Database::fetchOne(
    "SELECT * FROM branch_health WHERE branchId = ? AND `system` = ?",
    [$branchId, $system]
);
echo json_encode(['branchHealth' => $updated]);