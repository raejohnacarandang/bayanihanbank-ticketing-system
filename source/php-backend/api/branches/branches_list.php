<?php
/**
 * GET /api/branches
 * Requires auth.
 */

Middleware::authenticate();
$branches = Database::fetchAll("SELECT * FROM branches ORDER BY name");
echo json_encode(['branches' => $branches]);
