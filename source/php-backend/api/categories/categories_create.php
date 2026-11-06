<?php
/**
 * POST /api/categories
 * Body: { name, subcategory? }
 * Requires admin.
 */

$user = Middleware::authenticate();
$body = json_decode(file_get_contents('php://input'), true) ?: [];

$name = trim($body['name'] ?? '');
$subcategory = trim($body['subcategory'] ?? '');

if (!$name) { http_response_code(400); echo json_encode(['error' => 'Category name is required']); exit; }

$catId = 'cat-' . uniqid();

Database::beginTransaction();
try {
    Database::query(
        "INSERT INTO categories (id, name, subcategory, status) VALUES (?, ?, ?, 'Active')",
        [$catId, $name, $subcategory]
    );

    Database::query(
        "INSERT INTO audit_logs (id, timestamp, actorName, actorRole, action, targetId, details) VALUES (?, ?, ?, ?, ?, ?, ?)",
        ['aud-' . uniqid(), date('Y-m-d H:i:s'), $user['name'], $user['role'], 'CREATE_CATEGORY', $catId, "Added category $name"]
    );

    Database::commit();

    $created = Database::fetchOne("SELECT * FROM categories WHERE id = ?", [$catId]);
    echo json_encode(['category' => $created]);
} catch (\Throwable $e) {
    Database::rollback();
    throw $e;
}
