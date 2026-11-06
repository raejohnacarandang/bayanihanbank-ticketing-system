<?php
/**
 * GET /api/categories
 * Requires auth.
 */

Middleware::authenticate();
$categories = Database::fetchAll("SELECT * FROM categories ORDER BY name");
echo json_encode(['categories' => $categories]);
