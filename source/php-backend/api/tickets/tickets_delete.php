<?php
/**
 * DELETE /api/tickets/:id
 * Requires admin.
 *
 * Permanently removes a ticket and everything hanging off it. There are no
 * foreign keys with ON DELETE CASCADE in the schema, so the child rows are
 * removed explicitly inside the same transaction.
 */

$user = Middleware::authenticate();
Middleware::requireAdmin($user);

$ticketId = $_GET['id'];

$ticket = Database::fetchOne("SELECT * FROM tickets WHERE id = ?", [$ticketId]);
if (!$ticket) {
    http_response_code(404);
    echo json_encode(['error' => 'Ticket not found']);
    exit;
}

Database::beginTransaction();
try {
    // Child records first — the ticket row is the one they point at.
    Database::query("DELETE FROM comments WHERE ticketId = ?", [$ticketId]);
    Database::query("DELETE FROM timeline WHERE ticketId = ?", [$ticketId]);
    Database::query("DELETE FROM notifications WHERE ticketId = ?", [$ticketId]);
    Database::query("DELETE FROM tickets WHERE id = ?", [$ticketId]);

    // The audit entry deliberately survives the ticket it describes.
    Database::query(
        "INSERT INTO audit_logs (id, timestamp, actorName, actorRole, action, targetId, details) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
            'aud-' . uniqid(),
            date('Y-m-d H:i:s'),
            $user['name'],
            $user['role'],
            'DELETE_TICKET',
            $ticketId,
            "Deleted ticket #$ticketId \"{$ticket['subject']}\" ({$ticket['branchName']})",
        ]
    );

    Database::commit();
    echo json_encode(['ok' => true, 'id' => $ticketId]);
} catch (\Throwable $e) {
    Database::rollback();
    throw $e;
}
