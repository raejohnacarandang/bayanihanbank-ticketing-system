/**
 * Wipe all demo data so the system can be tested manually from an empty slate.
 *
 * Deletes every ticket, comment, timeline event, notification, audit log,
 * branch, category, and all demo users. The bootstrap "admin" account is kept
 * so the system stays usable; the database is marked as seeded so a later
 * server boot does NOT re-insert the demo dataset via seedIfEmpty().
 *
 * Run with:
 *   npm run reset:data          (asks for confirmation)
 *   npm run reset:data -- --yes  (skip confirmation)
 */
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const FORCE = process.argv.includes('--yes') || process.argv.includes('-y');

if (!FORCE) {
  const rl = createInterface({ input, output });
  const answer = await rl.question(
    'This will DELETE every branch, category, ticket and non-admin user.\nType "yes" to continue: ',
  );
  rl.close();
  if (answer.trim().toLowerCase() !== 'yes') {
    console.log('Aborted. No data was changed.');
    process.exit(0);
  }
}

dotenv.config();

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

const ADMIN_ID = 'usr-005';

const conn = await pool.getConnection();
try {
  await conn.beginTransaction();

  await conn.query('DELETE FROM comments');
  await conn.query('DELETE FROM timeline');
  await conn.query('DELETE FROM notifications');
  await conn.query('DELETE FROM audit_logs');
  await conn.query('DELETE FROM tickets');
  await conn.query('DELETE FROM branches');
  await conn.query('DELETE FROM categories');
  await conn.query('DELETE FROM users WHERE id <> ?', [ADMIN_ID]);
  await conn.query('DELETE FROM app_meta');
  await conn.query(
    'INSERT INTO app_meta (meta_key, meta_value) VALUES (?, ?), (?, ?) ON DUPLICATE KEY UPDATE meta_value = VALUES(meta_value)',
    ['seeded', '1', 'currentUserId', ADMIN_ID],
  );

  await conn.commit();

  const [[{ remaining }]] = await conn.query(
    'SELECT COUNT(*) AS remaining FROM `users` WHERE id = ?',
    [ADMIN_ID],
  );
  console.log('Demo data removed.');
  console.log(`Bootstrap admin kept (id=${ADMIN_ID}).`);
  console.log(`Users remaining: ${remaining}`);
  console.log('Log in as "admin" to start testing from an empty system.');
} catch (err) {
  await conn.rollback();
  throw err;
} finally {
  conn.release();
  await pool.end();
}
