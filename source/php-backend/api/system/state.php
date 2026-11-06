<?php
/**
 * GET /api/state
 * Returns the role-filtered application state snapshot.
 * Requires auth.
 */

$user = Middleware::authenticate();
$viewerRole = $user['role'];

// Users — sanitize password hashes
if ($viewerRole === 'BRANCH_USER') {
    // Branch users see only themselves + support staff
    $supportIds = Database::fetchAll("SELECT id FROM users WHERE role IN ('IT_STAFF', 'ADMINISTRATOR')");
    $ids = array_column($supportIds, 'id');
    $ids[] = $user['id'];
    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    $users = Database::fetchAll("SELECT * FROM users WHERE id IN ($placeholders)", $ids);
} else {
    $users = Database::fetchAll("SELECT * FROM users");
}
$users = array_map([Middleware::class, 'sanitizeUser'], $users);

// Branches
$branches = Database::fetchAll("SELECT * FROM branches");

// Branch infrastructure health — role-filtered
if ($viewerRole === 'IT_STAFF') {
    $assignments = json_decode($user['assignments'] ?? '[]', true) ?: [];
    $coveredBranchIds = array();
    foreach ($assignments as $a) {
        $expires = strtotime($a['expiresAt'] ?? '');
        if (($expires === false || $expires > time()) && isset($a['branchId'])) {
            $coveredBranchIds[] = $a['branchId'];
        }
    }
    if (empty($coveredBranchIds)) {
        $branchHealth = array();
    } else {
        $placeholders = implode(',', array_fill(0, count($coveredBranchIds), '?'));
        $branchHealth = Database::fetchAll(
            "SELECT * FROM branch_health WHERE branchId IN ($placeholders)",
            array_values($coveredBranchIds)
        );
    }
} elseif ($viewerRole === 'BRANCH_USER') {
    $branchHealth = Database::fetchAll("SELECT * FROM branch_health WHERE branchId = ?", [$user['branchId']]);
} else {
    $branchHealth = Database::fetchAll("SELECT * FROM branch_health");
}

// Internet speed logs — role-filtered
if ($viewerRole === 'IT_STAFF') {
    $assignments = json_decode($user['assignments'] ?? '[]', true) ?: [];
    $coveredBranchIds = array();
    foreach ($assignments as $a) {
        $expires = strtotime($a['expiresAt'] ?? '');
        if (($expires === false || $expires > time()) && isset($a['branchId'])) {
            $coveredBranchIds[] = $a['branchId'];
        }
    }
    if (empty($coveredBranchIds)) {
        $internetSpeedLogs = array();
    } else {
        $placeholders = implode(',', array_fill(0, count($coveredBranchIds), '?'));
        $internetSpeedLogs = Database::fetchAll(
            "SELECT * FROM internet_speed_log WHERE branchId IN ($placeholders) ORDER BY recordedAt DESC",
            array_values($coveredBranchIds)
        );
    }
} elseif ($viewerRole === 'BRANCH_USER') {
    $internetSpeedLogs = Database::fetchAll("SELECT * FROM internet_speed_log WHERE branchId = ? ORDER BY recordedAt DESC", [$user['branchId']]);
} else {
    $internetSpeedLogs = Database::fetchAll("SELECT * FROM internet_speed_log ORDER BY recordedAt DESC");
}

// Categories
$categories = Database::fetchAll("SELECT * FROM categories");

// Monitored endpoints (health-checker targets) — role-filtered like branch health
$monitoredEndpoints = [];
try {
    if ($viewerRole === 'IT_STAFF') {
        $assignments = json_decode($user['assignments'] ?? '[]', true) ?: [];
        $coveredBranchIds = array();
        foreach ($assignments as $a) {
            $expires = strtotime($a['expiresAt'] ?? '');
            if (($expires === false || $expires > time()) && isset($a['branchId'])) {
                $coveredBranchIds[] = $a['branchId'];
            }
        }
        if (empty($coveredBranchIds)) {
            $monitoredEndpoints = array();
        } else {
            $placeholders = implode(',', array_fill(0, count($coveredBranchIds), '?'));
            $monitoredEndpoints = Database::fetchAll(
                "SELECT * FROM monitored_endpoints WHERE branchId IN ($placeholders) ORDER BY branchId, `system`",
                array_values($coveredBranchIds)
            );
        }
    } elseif ($viewerRole === 'BRANCH_USER') {
        $monitoredEndpoints = Database::fetchAll("SELECT * FROM monitored_endpoints WHERE branchId = ? ORDER BY branchId, `system`", [$user['branchId']]);
    } else {
        $monitoredEndpoints = Database::fetchAll("SELECT * FROM monitored_endpoints ORDER BY branchId, `system`");
    }
} catch (\Throwable $e) {
    // monitored_endpoints table may not exist on fresh installs — report none.
    $monitoredEndpoints = [];
}

// Tickets — role-filtered
$tickets = getAllTicketsForViewer($user, []);

// Comments
$ticketIds = array_column($tickets, 'id');
if (!empty($ticketIds)) {
    $placeholders = implode(',', array_fill(0, count($ticketIds), '?'));
    $allComments = Database::fetchAll("SELECT * FROM comments WHERE ticketId IN ($placeholders)", $ticketIds);
    if ($viewerRole === 'BRANCH_USER') {
        $allComments = array_filter($allComments, fn($c) => !$c['isInternal'] || $c['isInternal'] == 0);
    }
} else {
    $allComments = [];
}

// Timeline
if (!empty($ticketIds)) {
    $placeholders = implode(',', array_fill(0, count($ticketIds), '?'));
    $timeline = Database::fetchAll("SELECT * FROM timeline WHERE ticketId IN ($placeholders)", $ticketIds);
} else {
    $timeline = [];
}

// Notifications — current user only
$notifications = Database::fetchAll(
    "SELECT * FROM notifications WHERE userId = ? ORDER BY id DESC",
    [$user['id']]
);

// Audit logs — empty for branch users
$auditLogs = $viewerRole === 'BRANCH_USER'
    ? []
    : Database::fetchAll("SELECT * FROM audit_logs ORDER BY id DESC");

// Ticket counter
$meta = Database::fetchOne("SELECT meta_value FROM app_meta WHERE meta_key = 'ticketCounter'");
$ticketCounter = $meta ? (int)$meta['meta_value'] : 126;

// Parse JSON fields
foreach ($users as &$u) {
    if (isset($u['assignments']) && is_string($u['assignments'])) {
        $u['assignments'] = json_decode($u['assignments'], true) ?? [];
    }
    if (!isset($u['assignments'])) {
        $u['assignments'] = [];
    }
    // Convert booleans
    $u['mustChangePassword'] = !empty($u['must_change_password']);
    $u['passwordResetRequested'] = !empty($u['password_reset_requested']);
    unset($u['must_change_password'], $u['password_reset_requested'], $u['password_hash']);
}
unset($u);

foreach ($tickets as &$t) {
    if (isset($t['attachments']) && is_string($t['attachments'])) {
        $t['attachments'] = json_decode($t['attachments'], true) ?: null;
    }
}
unset($t);

foreach ($allComments as &$c) {
    $c['isInternal'] = !empty($c['isInternal']);
}
unset($c);

foreach ($notifications as &$n) {
    $n['read'] = !empty($n['read']);
}
unset($n);

// Convert boolean fields on tickets
foreach ($tickets as &$t) {
    $t['escalated'] = !empty($t['escalated']);
}
unset($t);

echo json_encode([
    'tickets'           => array_values($tickets),
    'comments'          => array_values($allComments),
    'timeline'          => array_values($timeline),
    'notifications'     => array_values($notifications),
    'auditLogs'         => array_values($auditLogs),
    'users'             => array_values($users),
    'branches'          => $branches,
    'categories'        => $categories,
    'branchHealth'      => array_values($branchHealth),
    'internetSpeedLogs' => array_values($internetSpeedLogs),
    'monitoredEndpoints' => array_values($monitoredEndpoints),
    'currentUser'       => Middleware::sanitizeUser($user),
    'ticketCounter'     => $ticketCounter,
]);

// --- Helper ---
function getAllTicketsForViewer(array $viewer, array $filters): array {
    $role = $viewer['role'];
    $sql = "SELECT * FROM tickets";
    $params = [];
    $conditions = [];

    if ($role === 'BRANCH_USER') {
        $conditions[] = "(branchId = ? OR requesterId = ?)";
        $params[] = $viewer['branchId'];
        $params[] = $viewer['id'];
    } elseif ($role === 'IT_STAFF') {
        $conditions[] = "(assignedToId = ? OR requesterId = ?)";
        $params[] = $viewer['id'];
        $params[] = $viewer['id'];
    }

    if (!empty($filters['status'])) {
        $conditions[] = "status = ?";
        $params[] = $filters['status'];
    }
    if (!empty($filters['branchId'])) {
        $conditions[] = "branchId = ?";
        $params[] = $filters['branchId'];
    }
    if (!empty($filters['assignedToId'])) {
        $conditions[] = "assignedToId = ?";
        $params[] = $filters['assignedToId'];
    }
    if (!empty($filters['requesterId'])) {
        $conditions[] = "requesterId = ?";
        $params[] = $filters['requesterId'];
    }
    if (!empty($filters['category'])) {
        $conditions[] = "category = ?";
        $params[] = $filters['category'];
    }

    if (!empty($conditions)) {
        $sql .= " WHERE " . implode(" AND ", $conditions);
    }

    $sql .= " ORDER BY id DESC";
    return Database::fetchAll($sql, $params);
}
