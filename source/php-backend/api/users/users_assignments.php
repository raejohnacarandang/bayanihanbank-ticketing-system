<?php
/**
 * PATCH /api/users/:id/assignments
 * Body: { assignments: [...] }
 * Requires admin.
 */

$user = Middleware::authenticate();
$userId = $_GET['id'];
$body = json_decode(file_get_contents('php://input'), true) ?: [];
$assignments = $body['assignments'] ?? [];

$existing = Database::fetchOne("SELECT * FROM users WHERE id = ? AND role = 'IT_STAFF'", [$userId]);
if (!$existing) {
    http_response_code(404);
    echo json_encode(['error' => 'IT specialist user not found']);
    exit;
}

$assignmentsJson = json_encode($assignments);

Database::beginTransaction();
try {
    Database::query("UPDATE users SET assignments = ? WHERE id = ?", [$assignmentsJson, $userId]);

    // Auto-assign unowned in-progress tickets for newly covered branches
    if (!empty($assignments)) {
        $coveredBranchIds = array_column($assignments, 'branchId');
        if (!empty($coveredBranchIds)) {
            $placeholders = implode(',', array_fill(0, count($coveredBranchIds), '?'));
            $pendingTickets = Database::fetchAll(
                "SELECT * FROM tickets WHERE assignedToId IS NULL AND status = 'In Progress' AND branchId IN ($placeholders)",
                $coveredBranchIds
            );
            $nowDisplay = date('M d, Y, h:i A');
            foreach ($pendingTickets as $pt) {
                Database::query(
                    "UPDATE tickets SET assignedToId = ?, assignedToName = ?, updatedAt = ? WHERE id = ?",
                    [$existing['id'], $existing['name'], $nowDisplay, $pt['id']]
                );
            }
        }
    }

    // Audit
    $branchNames = array_column($assignments, 'branchName');
    $details = !empty($assignments)
        ? "Assigned {$existing['name']} to " . count($assignments) . " branch(es): " . implode(', ', $branchNames)
        : "Cleared all branch assignments for {$existing['name']}";
    Database::query(
        "INSERT INTO audit_logs (id, timestamp, actorName, actorRole, action, targetId, details) VALUES (?, ?, ?, ?, ?, ?, ?)",
        ['aud-' . uniqid(), date('Y-m-d H:i:s'), $user['name'], $user['role'], 'UPDATE_STAFF_ASSIGNMENTS', $userId, $details]
    );

    Database::commit();

    $updated = Database::fetchOne("SELECT * FROM users WHERE id = ?", [$userId]);
    unset($updated['password_hash']);
    $updated['assignments'] = json_decode($updated['assignments'] ?? '[]', true);
    $updated['mustChangePassword'] = !empty($updated['must_change_password']);
    $updated['passwordResetRequested'] = !empty($updated['password_reset_requested']);
    unset($updated['must_change_password'], $updated['password_reset_requested']);

    echo json_encode(['user' => $updated]);
} catch (\Throwable $e) {
    Database::rollback();
    throw $e;
}
