/**
 * Backup the MySQL database using mysqldump into the backups/ folder.
 *
 * Usage:
 *   npm run backup
 *
 * Reads DB_* values from .env. Keeps the last 10 backups and prunes older
 * ones. Restore with: mysql -u <user> -p <db> < backups/<file>.sql
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config();

const host = process.env.DB_HOST || '127.0.0.1';
const port = process.env.DB_PORT || '3306';
const user = process.env.DB_USER || 'root';
const password = process.env.DB_PASSWORD || '';
const db = process.env.DB_NAME || 'bayanihan_bank';
const KEEP = 10;

const backupDir = path.resolve('backups');
mkdirSync(backupDir, { recursive: true });

const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
const file = path.join(backupDir, `${db}_${stamp}.sql`);

const args = [
  `--host=${host}`,
  `--port=${port}`,
  `--user=${user}`,
  `--password=${password}`,
  '--single-transaction',
  '--routines',
  '--triggers',
  db,
];

try {
  execFileSync('mysqldump', args, { stdio: ['ignore', 'inherit', 'inherit'] });
  console.log(`Backup written: ${file}`);
} catch {
  console.error(
    'mysqldump failed. Make sure MySQL is running and its bin directory is on PATH (e.g. C:\\mysql\\bin\\mysqldump.exe).'
  );
  process.exit(1);
}

const existing = readdirSync(backupDir)
  .filter((f) => f.endsWith('.sql'))
  .sort();
while (existing.length > KEEP) {
  const old = existing.shift();
  rmSync(path.join(backupDir, old));
  console.log(`Pruned old backup: ${old}`);
}
