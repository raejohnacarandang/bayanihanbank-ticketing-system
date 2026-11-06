<?php
/**
 * Simple request validation helpers.
 */

class Validator {
    /** Validate required fields exist and are non-empty. */
    public static function required(array $data, array $fields): ?string {
        foreach ($fields as $field) {
            if (!isset($data[$field]) || (is_string($data[$field]) && trim($data[$field]) === '')) {
                return "Field '$field' is required";
            }
        }
        return null;
    }

    /** Validate string length. */
    public static function maxLength(string $value, int $max, string $field): ?string {
        if (strlen($value) > $max) {
            return "Field '$field' must not exceed $max characters";
        }
        return null;
    }

    /** Validate email format. */
    public static function email(string $value): ?string {
        if (!filter_var($value, FILTER_VALIDATE_EMAIL)) {
            return "Invalid email format";
        }
        return null;
    }

    /** Validate role. */
    public static function validRole(string $role): ?string {
        $valid = ['BRANCH_USER', 'IT_STAFF', 'ADMINISTRATOR', 'AUDITOR'];
        if (!in_array($role, $valid, true)) {
            return "Invalid role. Must be one of: " . implode(', ', $valid);
        }
        return null;
    }

    /** Validate ticket status. */
    public static function validStatus(string $status): ?string {
        $valid = ['In Progress', 'Resolved'];
        if (!in_array($status, $valid, true)) {
            return "Invalid status. Must be one of: " . implode(', ', $valid);
        }
        return null;
    }

    /** Validate branch status. */
    public static function validBranchStatus(string $status): ?string {
        $valid = ['Active', 'Inactive'];
        if (!in_array($status, $valid, true)) {
            return "Invalid status. Must be one of: " . implode(', ', $valid);
        }
        return null;
    }

    /** Validate category status. */
    public static function validCategoryStatus(string $status): ?string {
        $valid = ['Active', 'Proposed'];
        if (!in_array($status, $valid, true)) {
            return "Invalid status. Must be one of: " . implode(', ', $valid);
        }
        return null;
    }

    /** Validate string is a positive integer. */
    public static function positiveInt($value, string $field): ?string {
        $int = filter_var($value, FILTER_VALIDATE_INT);
        if ($int === false || $int <= 0) {
            return "Field '$field' must be a positive integer";
        }
        return null;
    }

    /** Validate minimum length. */
    public static function minLength(string $value, int $min, string $field): ?string {
        if (strlen($value) < $min) {
            return "Field '$field' must be at least $min characters";
        }
        return null;
    }
}
