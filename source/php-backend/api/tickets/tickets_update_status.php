<?php
/**
 * PATCH /api/tickets/:id/status
 * Body: { newStatus, notes? }
 * Requires auth.
 */

$user = Middleware::authenticate();
$ticketId = $_GET['id'];
$body = json_decode(file_get_contents('php://input'), true) ?: [];
$newStatus = $body['newStatus'] ?? '';
$notes = $body['notes'] ?? null;

$validStatuses = ['In Progress', 'Resolved'];
if (!in_array($newStatus, $validStatuses, true)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid status']);
    exit;
}

$ticket = Database::fetchOne("SELECT * FROM tickets WHERE id = ?", [$ticketId]);
if (!$ticket) {
    http_response_code(404);
    echo json_encode(['error' => 'Ticket not found']);
    exit;
}

// Permission checks
if ($user['role'] === 'AUDITOR') {
    http_response_code(403);
    echo json_encode(['error' => 'Auditors have read-only access']);
    exit;
}
if ($user['role'] === 'BRANCH_USER' && $ticket['requesterId'] !== $user['id'] && $ticket['branchId'] !== $user['branchId']) {
    http_response_code(403);
    echo json_encode(['error' => 'You can only update tickets from your branch']);
    exit;
}
if ($user['role'] === 'IT_STAFF' && $ticket['assignedToId'] !== $user['id'] && $ticket['requesterId'] !== $user['id']) {
    http_response_code(403);
    echo json_encode(['error' => 'Only the assigned IT specialist can update this ticket']);
    exit;
}

if ($ticket['status'] === 'Resolved') {
    http_response_code(409);
    echo json_encode(['error' => 'Resolved tickets are final and cannot be reopened']);
    exit;
}

$oldStatus = $ticket['status'];
$nowDisplay = date('M d, Y, h:i A');
$nowISO = date('Y-m-d H:i:s');

Database::beginTransaction();
try {
    $updateColumns = ['status', 'updatedAt'];
    $updateParams = [$newStatus, $nowDisplay];

    if ($newStatus === 'Resolved') {
        $updateColumns[] = 'resolutionNotes';
        $updateParams[] = $notes ?: 'Request handled and issue resolved.';
        $updateColumns[] = 'resolvedAt';
        $updateParams[] = $nowDisplay;
    }
    $setClauses = array_map(fn($c) => "$c = ?", $updateColumns);
    $updateParams[] = $ticketId;
    Database::query("UPDATE tickets SET " . implode(', ', $setClauses) . " WHERE id = ?", $updateParams);

    // Timeline
    $tlType = $newStatus === 'Resolved' ? 'resolution' : 'status_change';
    $details = $notes ? "Notes: $notes" : "Status changed from $oldStatus to $newStatus";
    Database::query(
        "INSERT INTO timeline (id, ticketId, timestamp, actorName, actorRole, action, details, type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        ['tl-' . uniqid(), $ticketId, $nowDisplay, $user['name'], $user['role'], "Status changed to $newStatus", $details, $tlType]
    );

    // Audit
    Database::query(
        "INSERT INTO audit_logs (id, timestamp, actorName, actorRole, action, targetId, details) VALUES (?, ?, ?, ?, ?, ?, ?)",
        ['aud-' . uniqid(), $nowISO, $user['name'], $user['role'], 'UPDATE_STATUS', $ticketId, "Status changed from $oldStatus to $newStatus for #$ticketId"]
    );

    // Notify requester
    $isSupport = in_array($user['role'], ['IT_STAFF', 'ADMINISTRATOR']);
    if ($isSupport && $ticket['requesterId'] !== $user['id']) {
        $nType = $newStatus === 'Resolved' ? 'success' : 'info';
        Database::query(
            "INSERT INTO notifications (id, userId, ticketId, title, message, timestamp, `read`, type) VALUES (?, ?, ?, ?, ?, ?, 0, ?)",
            ['notif-' . uniqid(), $ticket['requesterId'], $ticketId, "Ticket Status: $newStatus", "Ticket #$ticketId status was changed to $newStatus by {$user['name']}", $nowDisplay, $nType]
        );
    }

    // Branch user update notifies assigned IT
    if (!$isSupport && $ticket['assignedToId']) {
        Database::query(
            "INSERT INTO notifications (id, userId, ticketId, title, message, timestamp, `read`, type) VALUES (?, ?, ?, ?, ?, ?, 0, 'info')",
            ['notif-' . uniqid(), $ticket['assignedToId'], $ticketId, "Branch Update on Ticket $ticketId", "{$user['name']} updated ticket #$ticketId — status is now $newStatus", $nowDisplay]
        );
    }

    Database::commit();

    $updated = Database::fetchOne("SELECT * FROM tickets WHERE id = ?", [$ticketId]);
    if ($updated && isset($updated['attachments']) && is_string($updated['attachments'])) {
        $updated['attachments'] = json_decode($updated['attachments'], true) ?: null;
    }
    echo json_encode(['ticket' => $updated]);
} catch (\Throwable $e) {
    Database::rollback();
    throw $e;
}
