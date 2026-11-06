<?php
/**
 * PATCH /api/tickets/:id/assign
 * Body: { staffUserId }
 * Requires auth.
 */

$user = Middleware::authenticate();
$ticketId = $_GET['id'];
$body = json_decode(file_get_contents('php://input'), true) ?: [];
$staffUserId = $body['staffUserId'] ?? '';

if (!$staffUserId) {
    http_response_code(400);
    echo json_encode(['error' => 'A valid IT specialist member is required']);
    exit;
}

$staffUser = Database::fetchOne("SELECT * FROM users WHERE id = ? AND role IN ('IT_STAFF', 'ADMINISTRATOR')", [$staffUserId]);
if (!$staffUser) {
    http_response_code(400);
    echo json_encode(['error' => 'A valid IT specialist member is required']);
    exit;
}

if ($user['role'] === 'AUDITOR') {
    http_response_code(403);
    echo json_encode(['error' => 'Auditors have read-only access']);
    exit;
}
if ($user['role'] === 'BRANCH_USER') {
    http_response_code(403);
    echo json_encode(['error' => 'Only IT staff can assign tickets']);
    exit;
}
if ($user['role'] === 'IT_STAFF' && $staffUserId !== $user['id']) {
    http_response_code(403);
    echo json_encode(['error' => 'IT specialists can only claim tickets for themselves']);
    exit;
}

$ticket = Database::fetchOne("SELECT * FROM tickets WHERE id = ?", [$ticketId]);
if (!$ticket) {
    http_response_code(404);
    echo json_encode(['error' => 'Ticket not found']);
    exit;
}
if ($ticket['status'] === 'Resolved') {
    http_response_code(409);
    echo json_encode(['error' => 'Resolved tickets cannot be reassigned']);
    exit;
}

$nowDisplay = date('M d, Y, h:i A');

Database::beginTransaction();
try {
    Database::query(
        "UPDATE tickets SET assignedToId = ?, assignedToName = ?, updatedAt = ? WHERE id = ?",
        [$staffUser['id'], $staffUser['name'], $nowDisplay, $ticketId]
    );

    Database::query(
        "INSERT INTO timeline (id, ticketId, timestamp, actorName, actorRole, action, details, type) VALUES (?, ?, ?, ?, ?, ?, ?, 'assignment')",
        ['tl-' . uniqid(), $ticketId, $nowDisplay, $user['name'], $user['role'], 'Ticket assigned', "Assigned to {$staffUser['name']} (" . ($staffUser['department'] ?: 'Main IT') . ")"]
    );

    Database::query(
        "INSERT INTO audit_logs (id, timestamp, actorName, actorRole, action, targetId, details) VALUES (?, ?, ?, ?, ?, ?, ?)",
        ['aud-' . uniqid(), date('Y-m-d H:i:s'), $user['name'], $user['role'], 'ASSIGN_TICKET', $ticketId, "Assigned #$ticketId to {$staffUser['name']}"]
    );

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
