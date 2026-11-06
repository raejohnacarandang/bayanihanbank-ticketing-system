<?php
/**
 * PATCH /api/categories/:id
 * Body: { name?, subcategory?, status? }
 * Requires admin.
 */

$user = Middleware::authenticate();
$catId = $_GET['id'];
$body = json_decode(file_get_contents('php://input'), true) ?: [];

$existing = Database::fetchOne("SELECT * FROM categories WHERE id = ?", [$catId]);
if (!$existing) {
    http_response_code(404);
    echo json_encode(['error' => 'Category not found']);
    exit;
}

$fields = [];
$params = [];

if (array_key_exists('name', $body) && $body['name'] !== null) {
    $fields[] = "name = ?";
    $params[] = trim($body['name']);
}
if (array_key_exists('subcategory', $body) && $body['subcategory'] !== null) {
    $fields[] = "subcategory = ?";
    $params[] = trim($body['subcategory']);
}
if (array_key_exists('status', $body) && $body['status'] !== null) {
    $fields[] = "status = ?";
    $params[] = $body['status'];
}

if (empty($fields)) {
    echo json_encode(['category' => $existing]);
    exit;
}

$params[] = $catId;
Database::query("UPDATE categories SET " . implode(', ', $fields) . " WHERE id = ?", $params);

Database::query(
    "INSERT INTO audit_logs (id, timestamp, actorName, actorRole, action, targetId, details) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ['aud-' . uniqid(), date('Y-m-d H:i:s'), $user['name'], $user['role'], 'UPDATE_CATEGORY', $catId, "Updated category {$existing['name']}"]
);

$updated = Database::fetchOne("SELECT * FROM categories WHERE id = ?", [$catId]);
echo json_encode(['category' => $updated]);
