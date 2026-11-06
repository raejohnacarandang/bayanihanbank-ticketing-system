<?php
/**
 * Password hashing.
 *
 * Stored format is PHP's password_hash() output — bcrypt (cost 12) by default,
 * with argon2id hashes also accepted on verification so an operator can switch
 * algorithms without locking anyone out.
 *
 * Anything else (including the legacy "scrypt$..." hashes once written by the
 * Node prototype) is treated as UNVERIFIABLE and fails closed: it is never
 * matched against a guess. Use set-password.php or force-password-reset.php to
 * issue a real credential instead.
 */

class PasswordHelper {

    /** Prefix of the algorithms password_verify() can check. */
    private const NATIVE_PREFIXES = ['$2y$', '$2a$', '$2b$', '$2x$', '$argon2i$', '$argon2id$'];

    /**
     * Hash a new password using PHP's default algo (bcrypt).
     */
    public static function hash(string $password): string {
        return password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);
    }

    /**
     * Verify a password against a stored hash.
     *
     * Returns true only on a real password_verify() match. Unknown or
     * unsupported formats return false — a stored hash we cannot check is
     * never treated as a successful login.
     */
    public static function verify(string $password, ?string $stored): bool {
        if (!$stored) return false;
        if (!self::isNative($stored)) return false;

        return password_verify($password, $stored);
    }

    /**
     * True when the stored hash uses a format this class cannot verify, or a
     * supported format at outdated parameters. Only meaningful after verify()
     * has already returned true, i.e. for natively verifiable hashes.
     */
    public static function needsRehash(?string $stored): bool {
        if (!$stored) return false;
        if (!self::isNative($stored)) return true;

        return password_needs_rehash($stored, PASSWORD_BCRYPT, ['cost' => 12]);
    }

    /**
     * Whether password_verify() can evaluate this hash.
     */
    private static function isNative(string $stored): bool {
        foreach (self::NATIVE_PREFIXES as $prefix) {
            if (str_starts_with($stored, $prefix)) return true;
        }
        return false;
    }

    /**
     * Generate a random secure password.
     */
    public static function generateRandom(int $length = 12): string {
        $chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
        $password = '';
        for ($i = 0; $i < $length; $i++) {
            $password .= $chars[random_int(0, strlen($chars) - 1)];
        }
        return $password;
    }
}
