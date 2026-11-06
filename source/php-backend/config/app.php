<?php
/**
 * Application configuration — JWT secrets, feature flags, limits.
 */

return [
    // JWT
    'jwt_secret'  => getenv('JWT_SECRET') ?: 'CHANGE_ME_TO_A_LONG_RANDOM_STRING',
    'jwt_ttl'     => 12 * 3600, // 12 hours in seconds

    // App
    'demo_mode'   => (getenv('DEMO_MODE') !== 'false'), // default true
    'admin_recovery_key' => getenv('ADMIN_RECOVERY_KEY') ?: '',

    // Rate limiting
    'login_max_attempts'  => 9999,
    'login_window_secs'   => 15 * 60,
    'recovery_max_attempts' => 5,
    'recovery_window_secs'  => 15 * 60,

    // CORS — set to your frontend origin in production
    'cors_origin' => getenv('CORS_ORIGIN') ?: '*',

    // Default password for new accounts
    'default_password' => 'password123',
];
