<?php
/**
 * POST /api/tickets
 * Body: { subject, description, category, subcategory?, attachmentName?, requesterName? }
 * Requires auth.
 */

$user = Middleware::authenticate();
$body = json_decode(file_get_contents('php://input'), true) ?: [];

$subject = trim($body['subject'] ?? '');
$description = trim($body['description'] ?? '');
$category = trim($body['category'] ?? '');
$subcategory = trim($body['subcategory'] ?? '');
$attachmentName = $body['attachmentName'] ?? null;
$requesterName = trim($body['requesterName'] ?? '');

if (!$subject) { http_response_code(400); echo json_encode(['error' => 'Subject is required']); exit; }
if (!$description) { http_response_code(400); echo json_encode(['error' => 'Description is required']); exit; }
if (strlen($description) < 20) {
    http_response_code(400);
    echo json_encode(['error' => 'Description must be at least 20 characters long']);
    exit;
}
if (!preg_match('/[a-zA-Z]/', $description)) {
    http_response_code(400);
    echo json_encode(['error' => 'Description must contain at least one letter']);
    exit;
}
if (!$category) { http_response_code(400); echo json_encode(['error' => 'Category is required']); exit; }

// Get current ticket counter
$meta = Database::fetchOne("SELECT meta_value FROM app_meta WHERE meta_key = 'ticketCounter'");
$counter = $meta ? (int)$meta['meta_value'] : 126;
$ticketId = 'IT-' . str_pad($counter, 6, '0', STR_PAD_LEFT);
$nextCounter = $counter + 1;

$nowDisplay = date('M d, Y, h:i A');
$nowISO = date('c');

// Auto-assign to IT specialist covering this branch
$assignedStaff = null;
if (!empty($user['branchId'])) {
    $assignedStaff = findAssignableStaff($user['branchId']);
}

$branchId = $user['branchId'] ?: 'br-001';
$branchName = $user['branchName'] ?: 'Alabang';

$status = 'In Progress';

// Calculate priority based on category
function getPriorityFromCategory($category) {
    $critical = ['Network', 'Account & Access'];
    $high = ['Hardware', 'Installation / Configuration', 'IT Equipment'];
    $medium = ['Software'];
    
    if (in_array($category, $critical)) return 'Critical';
    if (in_array($category, $high)) return 'High';
    if (in_array($category, $medium)) return 'Medium';
    return 'Low';
}

function getSLADuration($priority) {
    switch ($priority) {
        case 'Critical': return 4 * 60 * 60; // 4 hours
        case 'High': return 8 * 60 * 60; // 8 hours
        case 'Medium': return 24 * 60 * 60; // 24 hours
        case 'Low': return 48 * 60 * 60; // 48 hours
    }
}

$priority = getPriorityFromCategory($category);
$slaDuration = getSLADuration($priority);
$slaDeadline = date('c', time() + $slaDuration);

// Build attachments JSON
$attachmentsJson = null;
if ($attachmentName) {
    $attachmentsJson = json_encode([[
        'id' => 'att-' . uniqid(),
        'filename' => $attachmentName,
        'filesize' => '1.4 MB',
        'filetype' => 'document',
    ]]);
}

$displayName = $requesterName ?: $user['name'];

Database::beginTransaction();
try {
    // Insert ticket
    Database::query(
        "INSERT INTO tickets (id, subject, description, category, subcategory, status, priority, requesterId, requesterName, branchId, branchName, assignedToId, assignedToName, createdAt, createdAtISO, updatedAt, slaDeadline, escalated, attachments) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
            $ticketId, $subject, $description, $category,
            $subcategory ?: null, $status, $priority,
            $user['id'], $displayName, $branchId, $branchName,
            $assignedStaff['id'] ?? null, $assignedStaff['name'] ?? null,
            $nowDisplay, $nowISO, $nowDisplay, $slaDeadline, 0, $attachmentsJson,
        ]
    );

    // Timeline: ticket submitted
    insertTimeline($ticketId, $user['name'], $user['role'], 'Ticket submitted',
        "Category: $category" . ($subcategory ? " / Subcategory: $subcategory" : ''), 'creation');

    // Audit log
    insertAudit($user['name'], $user['role'], 'CREATE_TICKET', $ticketId,
        "Created Ticket #$ticketId for $branchName");

    if ($assignedStaff) {
        insertTimeline($ticketId, 'System', 'ADMINISTRATOR', 'Ticket auto-assigned',
            "Auto-assigned to {$assignedStaff['name']} (branch coverage: $branchName)", 'assignment');

        insertAudit($assignedStaff['name'], $assignedStaff['role'], 'ASSIGN_TICKET_AUTO', $ticketId,
            "Auto-assigned #$ticketId to {$assignedStaff['name']} (branch coverage: $branchName)");

        insertNotification($assignedStaff['id'], $ticketId, 'Ticket Auto-Assigned to You',
            "Ticket #$ticketId was automatically assigned to you ($branchName)", 'info');
    }

    // Notify admins
    $admins = Database::fetchAll("SELECT id FROM users WHERE role = 'ADMINISTRATOR'");
    foreach ($admins as $admin) {
        if ($assignedStaff && $admin['id'] === $assignedStaff['id']) continue;
        insertNotification($admin['id'], $ticketId, 'New IT Request',
            "New ticket #$ticketId submitted by $branchName ($displayName)", 'info');
    }

    // Update counter
    Database::query(
        "INSERT INTO app_meta (meta_key, meta_value) VALUES ('ticketCounter', ?) ON DUPLICATE KEY UPDATE meta_value = ?",
        [(string)$nextCounter, (string)$nextCounter]
    );

    Database::commit();

    $ticket = Database::fetchOne("SELECT * FROM tickets WHERE id = ?", [$ticketId]);
    if ($ticket && isset($ticket['attachments']) && is_string($ticket['attachments'])) {
        $ticket['attachments'] = json_decode($ticket['attachments'], true) ?: null;
    }
    echo json_encode(['ticket' => $ticket]);
} catch (\Throwable $e) {
    Database::rollback();
    throw $e;
}

// --- Helpers ---
function findAssignableStaff(string $branchId): ?array {
    $users = Database::fetchAll("SELECT * FROM users WHERE role = 'IT_STAFF'");
    $candidates = [];
    foreach ($users as $u) {
        $assignments = json_decode($u['assignments'] ?? '[]', true) ?: [];
        foreach ($assignments as $a) {
            if ($a['branchId'] === $branchId) {
                $expires = strtotime($a['expiresAt'] ?? '');
                if (!$expires || $expires > time()) {
                    $candidates[] = $u;
                    break;
                }
            }
        }
    }
    if (empty($candidates)) return null;

    // Least-loaded: fewest open tickets
    usort($candidates, function($a, $b) {
        $countA = Database::fetchOne("SELECT COUNT(*) as cnt FROM tickets WHERE assignedToId = ? AND status = 'In Progress'", [$a['id']]);
        $countB = Database::fetchOne("SELECT COUNT(*) as cnt FROM tickets WHERE assignedToId = ? AND status = 'In Progress'", [$b['id']]);
        return ($countA['cnt'] ?? 0) - ($countB['cnt'] ?? 0);
    });
    return $candidates[0];
}

function insertTimeline(string $ticketId, string $actorName, string $actorRole, string $action, ?string $details, string $type): void {
    Database::query(
        "INSERT INTO timeline (id, ticketId, timestamp, actorName, actorRole, action, details, type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        ['tl-' . uniqid(), $ticketId, date('M d, Y, h:i A'), $actorName, $actorRole, $action, $details, $type]
    );
}

function insertAudit(string $actorName, string $actorRole, string $action, ?string $targetId, string $details): void {
    Database::query(
        "INSERT INTO audit_logs (id, timestamp, actorName, actorRole, action, targetId, details) VALUES (?, ?, ?, ?, ?, ?, ?)",
        ['aud-' . uniqid(), date('Y-m-d H:i:s'), $actorName, $actorRole, $action, $targetId, $details]
    );
}

function insertNotification(string $userId, string $ticketId, string $title, string $message, string $type): void {
    Database::query(
        "INSERT INTO notifications (id, userId, ticketId, title, message, timestamp, `read`, type) VALUES (?, ?, ?, ?, ?, ?, 0, ?)",
        ['notif-' . uniqid(), $userId, $ticketId, $title, $message, date('M d, Y, h:i A'), $type]
    );
}
