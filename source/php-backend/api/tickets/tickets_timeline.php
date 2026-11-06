<?php
/**
 * GET /api/tickets/:id/timeline
 * Requires auth.
 */

$user = Middleware::authenticate();
$ticketId = $_GET['id'];

$ticket = Database::fetchOne("SELECT * FROM tickets WHERE id = ?", [$ticketId]);
if (!$ticket) {
    http_response_code(404);
    echo json_encode(['error' => 'Ticket not found']);
    exit;
}

// Viewer permission check
if ($user['role'] === 'BRANCH_USER' && $ticket['branchId'] !== $user['branchId'] && $ticket['requesterId'] !== $user['id']) {
    http_response_code(404);
    echo json_encode(['error' => 'Ticket not found']);
    exit;
}
if ($user['role'] === 'IT_STAFF' && $ticket['assignedToId'] !== $user['id'] && $ticket['requesterId'] !== $user['id']) {
    http_response_code(404);
    echo json_encode(['error' => 'Ticket not found']);
    exit;
}

$timeline = Database::fetchAll("SELECT * FROM timeline WHERE ticketId = ?", [$ticketId]);
echo json_encode(['timeline' => $timeline]);
