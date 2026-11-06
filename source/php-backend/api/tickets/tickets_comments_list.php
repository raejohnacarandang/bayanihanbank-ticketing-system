<?php
/**
 * GET /api/tickets/:id/comments
 * Requires auth.
 */

$user = Middleware::authenticate();
$ticketId = $_GET['id'];

// Verify ticket exists and user can see it
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

$comments = Database::fetchAll("SELECT * FROM comments WHERE ticketId = ?", [$ticketId]);

// Branch users don't see internal notes
if ($user['role'] === 'BRANCH_USER') {
    $comments = array_filter($comments, fn($c) => empty($c['isInternal']) || $c['isInternal'] == 0);
}

// Convert boolean
foreach ($comments as &$c) {
    $c['isInternal'] = !empty($c['isInternal']);
}
unset($c);

echo json_encode(['comments' => array_values($comments)]);
