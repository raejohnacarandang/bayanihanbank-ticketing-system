<?php
/**
 * PDO database connection singleton.
 */

require_once __DIR__ . '/../config/database.php';

class Database {
    private static ?PDO $pdo = null;

    public static function getConnection(): PDO {
        if (self::$pdo === null) {
            $cfg = require __DIR__ . '/../config/database.php';
            $dsn = "mysql:host={$cfg['host']};port={$cfg['port']};dbname={$cfg['database']}" . (!empty($cfg['charset']) ? ";charset={$cfg['charset']}" : '');
            self::$pdo = new PDO($dsn, $cfg['username'], $cfg['password'], [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
            ]);
        }
        return self::$pdo;
    }

    /** Run a single query and return the statement. */
    public static function query(string $sql, array $params = []): PDOStatement {
        $stmt = self::getConnection()->prepare($sql);
        $stmt->execute($params);
        return $stmt;
    }

    /** Fetch all rows. */
    public static function fetchAll(string $sql, array $params = []): array {
        return self::query($sql, $params)->fetchAll();
    }

    /** Fetch a single row or null. */
    public static function fetchOne(string $sql, array $params = []): ?array {
        $row = self::query($sql, $params)->fetch();
        return $row ?: null;
    }

    /** Execute a statement (INSERT/UPDATE/DELETE). Returns row count. */
    public static function execute(string $sql, array $params = []): int {
        return self::query($sql, $params)->rowCount();
    }

    /** Get last insert ID. */
    public static function lastInsertId(): string {
        return self::getConnection()->lastInsertId();
    }

    /** Begin transaction. */
    public static function beginTransaction(): void {
        self::getConnection()->beginTransaction();
    }

    /** Commit transaction. */
    public static function commit(): void {
        self::getConnection()->commit();
    }

    /** Rollback transaction. */
    public static function rollback(): void {
        self::getConnection()->rollBack();
    }
}
