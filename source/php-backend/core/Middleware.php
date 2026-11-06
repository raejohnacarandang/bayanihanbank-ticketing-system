<?php
/**
 * Middleware: authenticate JWT, require admin, etc.
 */

require_once __DIR__ . '/Database.php';
require_once __DIR__ . '/JWT.php';

class Middleware {
    /**
     * Authenticate the request. Returns the user array on success.
     * Sends 401 JSON response and exits on failure.
     */
    public static function authenticate(): array {
        $token = JWT::extractFromHeader();
        if (!$token) {
            http_response_code(401);
            echo json_encode(['error' => 'Authentication required']);
            exit;
        }

        $payload = JWT::verify($token);
        if (!$payload) {
            http_response_code(401);
            echo json_encode(['error' => 'Invalid or expired token']);
            exit;
        }

        $user = Database::fetchOne("SELECT * FROM users WHERE id = ?", [$payload['sub']]);
        if (!$user) {
            http_response_code(401);
            echo json_encode(['error' => 'Account no longer exists']);
            exit;
        }

        return $user;
    }

    /**
     * Require admin role. Sends 403 and exits if not admin.
     */
    public static function requireAdmin(array $user): void {
        if ($user['role'] !== 'ADMINISTRATOR') {
            http_response_code(403);
            echo json_encode(['error' => 'Only administrators can perform this action']);
            exit;
        }
    }

    /**
     * Get the current user or null (no error/exit).
     */
    public static function getOptionalUser(): ?array {
        $token = JWT::extractFromHeader();
        if (!$token) return null;
        $payload = JWT::verify($token);
        if (!$payload) return null;
        return Database::fetchOne("SELECT * FROM users WHERE id = ?", [$payload['sub']]);
    }

    /**
     * Strip sensitive fields (password_hash) from user array.
     */
    public static function sanitizeUser(array $user): array {
        unset($user['password_hash']);
        if (isset($user['assignments']) && is_string($user['assignments'])) {
            $user['assignments'] = json_decode($user['assignments'], true) ?? [];
        }
        if (!isset($user['assignments']) || !is_array($user['assignments'])) {
            $user['assignments'] = [];
        }
        return $user;
    }
}
