<?php
/**
 * GET /api/audit-logs
 * Requires auth. Empty for branch users.
 */

$user = Middleware::authenticate();

if ($user['role'] === 'BRANCH_USER') {
    echo json_encode(['auditLogs' => []]);
    exit;
}

$logs = Database::fetchAll("SELECT * FROM audit_logs ORDER BY id DESC");
echo json_encode(['auditLogs' => $logs]);
