<?php
/**
 * POST /api/tickets/:id/comments
 * Body: { content, isInternal? }
 * Requires auth.
 */

$user = Middleware::authenticate();
$ticketId = $_GET['id'];
$body = json_decode(file_get_contents('php://input'), true) ?: [];
$content = trim($body['content'] ?? '');
$isInternal = !empty($body['isInternal']);

if (!$content) {
    http_response_code(400);
    echo json_encode(['error' => 'Content is required']);
    exit;
}

// Verify ticket
$ticket = Database::fetchOne("SELECT * FROM tickets WHERE id = ?", [$ticketId]);
if (!$ticket) {
    http_response_code(404);
    echo json_encode(['error' => 'Ticket not found']);
    exit;
}

$commentId = 'cmt-' . uniqid();
$nowDisplay = date('M d, Y, h:i A');

Database::beginTransaction();
try {
    Database::query(
        "INSERT INTO comments (id, ticketId, authorId, authorName, authorRole, content, timestamp, isInternal) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [$commentId, $ticketId, $user['id'], $user['name'], $user['role'], $content, $nowDisplay, $isInternal ? 1 : 0]
    );

    $action = $isInternal ? 'Added Internal IT Note' : 'Added Comment';
    $details = $isInternal ? '(Internal Note - Hidden from Branch)' : $content;
    Database::query(
        "INSERT INTO timeline (id, ticketId, timestamp, actorName, actorRole, action, details, type) VALUES (?, ?, ?, ?, ?, ?, ?, 'comment')",
        ['tl-' . uniqid(), $ticketId, $nowDisplay, $user['name'], $user['role'], $action, $details]
    );

    Database::commit();

    $comment = Database::fetchOne("SELECT * FROM comments WHERE id = ?", [$commentId]);
    $comment['isInternal'] = !empty($comment['isInternal']);
    echo json_encode(['comment' => $comment]);
} catch (\Throwable $e) {
    Database::rollback();
    throw $e;
}
