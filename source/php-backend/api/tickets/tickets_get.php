<?php
/**
 * GET /api/tickets/:id
 * Requires auth.
 */

$user = Middleware::authenticate();
$ticketId = $_GET['id'];

// Get ticket with viewer permissions
$tickets = getTicketsForViewer($user);
$ticket = null;
foreach ($tickets as $t) {
    if ($t['id'] === $ticketId) {
        $ticket = $t;
        break;
    }
}

if (!$ticket) {
    http_response_code(404);
    echo json_encode(['error' => 'Ticket not found']);
    exit;
}

if (isset($ticket['attachments']) && is_string($ticket['attachments'])) {
    $ticket['attachments'] = json_decode($ticket['attachments'], true) ?: null;
}

echo json_encode(['ticket' => $ticket]);

function getTicketsForViewer(array $viewer): array {
    $sql = "SELECT * FROM tickets";
    $params = [];
    if ($viewer['role'] === 'BRANCH_USER') {
        $sql .= " WHERE branchId = ? OR requesterId = ?";
        $params = [$viewer['branchId'], $viewer['id']];
    } elseif ($viewer['role'] === 'IT_STAFF') {
        $sql .= " WHERE assignedToId = ? OR requesterId = ?";
        $params = [$viewer['id'], $viewer['id']];
    }
    return Database::fetchAll($sql, $params);
}
