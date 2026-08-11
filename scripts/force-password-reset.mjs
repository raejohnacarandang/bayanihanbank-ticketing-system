/**
 * Rotate every user's password to a fresh random one-time password and mark
 * the account as "must change password on next login".
 *
 * Run right before go-live on the PRODUCTION database:
 *   npm run force-password-reset
 *
 * The one-time passwords are printed to the console once. Hand them to the
 * users; everyone is forced to pick a new password at first login.
 */
import { randomBytes, scryptSync } from 'node:crypto';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'bayanihan_bank',
  waitForConnections: true,
  connectionLimit: 1,
  charset: 'utf8mb4',
});

const [rows] = await pool.query('SELECT id, username, name, role FROM users ORDER BY username');
console.log(`Rotating passwords for ${rows.length} user(s)...\n`);

for (const user of rows) {
  const tempPassword = randomBytes(9).toString('base64url');
  await pool.query(
    'UPDATE users SET password_hash = ?, must_change_password = 1 WHERE id = ?',
    [hashPassword(tempPassword), user.id]
  );
  console.log(`  ${user.username.padEnd(16)} (${user.role.padEnd(15)}) one-time password: ${tempPassword}`);
}

console.log('\nDone. All users must change their password on next login.');
await pool.end();