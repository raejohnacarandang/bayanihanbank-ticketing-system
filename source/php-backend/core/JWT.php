<?php
/**
 * JWT helper — HS256 sign/verify using hash_hmac.
 * Compatible with the Node.js implementation (base64url encoding).
 */

require_once __DIR__ . '/../config/app.php';

class JWT {
    private static function secret(): string {
        $cfg = require __DIR__ . '/../config/app.php';
        $secret = $cfg['jwt_secret'];
        if ($secret === 'CHANGE_ME_TO_A_LONG_RANDOM_STRING' && php_sapi_name() !== 'cli') {
            error_log('[JWT] WARNING: Using default JWT secret. Set JWT_SECRET in .env for production.');
        }
        return $secret;
    }

    private static function base64url(string $data): string {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    private static function base64urlDecode(string $data): string {
        return base64_decode(strtr($data, '-_', '+/') . str_repeat('=', 3 - (3 + strlen($data)) % 4));
    }

    /** Sign a JWT for the given user array (must have id, username, role). */
    public static function sign(array $user): string {
        $cfg = require __DIR__ . '/../config/app.php';
        $header = self::base64url(json_encode(['alg' => 'HS256', 'typ' => 'JWT']));
        $now = time();
        $payload = self::base64url(json_encode([
            'sub'      => $user['id'],
            'username' => $user['username'],
            'role'     => $user['role'],
            'iat'      => $now,
            'exp'      => $now + $cfg['jwt_ttl'],
        ]));
        $signature = self::base64url(hash_hmac('sha256', "$header.$payload", self::secret(), true));
        return "$header.$payload.$signature";
    }

    /** Verify a JWT. Returns the payload array on success, null on failure. */
    public static function verify(string $token): ?array {
        $parts = explode('.', $token);
        if (count($parts) !== 3) return null;
        [$header, $payload, $signature] = $parts;

        $expected = self::base64url(hash_hmac('sha256', "$header.$payload", self::secret(), true));
        if (!hash_equals($expected, $signature)) return null;

        try {
            $data = json_decode(self::base64urlDecode($payload), true);
            if (!$data || !isset($data['sub']) || !isset($data['exp'])) return null;
            if ($data['exp'] < time()) return null;
            return $data;
        } catch (\Throwable $e) {
            return null;
        }
    }

    /** Extract token from Authorization header or return null. */
    public static function extractFromHeader(): ?string {
        $headers = [];
        // Try multiple header sources for shared hosting compatibility
        foreach (['HTTP_AUTHORIZATION', 'REDIRECT_HTTP_AUTHORIZATION', 'Authorization'] as $key) {
            if (isset($_SERVER[$key])) {
                $headers['Authorization'] = $_SERVER[$key];
                break;
            }
        }
        // Also check apache_request_headers() if available
        if (empty($headers['Authorization']) && function_exists('apache_request_headers')) {
            $ah = apache_request_headers();
            if (isset($ah['Authorization'])) {
                $headers['Authorization'] = $ah['Authorization'];
            }
        }

        $auth = $headers['Authorization'] ?? '';
        if (preg_match('/^Bearer\s+(.+)$/i', $auth, $m)) {
            return trim($m[1]);
        }
        return null;
    }
}
