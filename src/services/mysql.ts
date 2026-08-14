/**
 * MySQL persistence layer for the Bayanihan Bank IT Service Desk.
 *
 * Replaces the previous data/db.json file storage. The application still
 * mutates an in-memory AppState through the pure store functions in
 * ./store.ts; every persisted mutation is written to MySQL by saveState().
 *
 * Schema is created automatically on first run and the app seeds the demo
 * data (users, branches, categories, tickets, etc.) from ./data/initialData.
 */
import mysql, { Pool, ResultSetHeader } from "mysql2/promise";
import { randomBytes } from "crypto";
import dotenv from "dotenv";
import {
  AppState,
  Attachment,
  AuditLog,
  Branch,
  BranchAssignment,
  CategoryInfo,
  Comment,
  NotificationItem,
  Ticket,
  TimelineEvent,
  User,
} from "../types";
import { createState } from "./store";
import { DEFAULT_PASSWORD, hashPassword } from "../server/auth";
import {
  INITIAL_AUDIT_LOGS,
  INITIAL_BRANCHES,
  INITIAL_CATEGORIES,
  INITIAL_COMMENTS,
  INITIAL_NOTIFICATIONS,
  INITIAL_TICKETS,
  INITIAL_TIMELINE,
  INITIAL_USERS,
} from "../data/initialData";

dotenv.config();

function getDbName(): string {
  return process.env.DB_NAME || "bayanihan_bank";
}

// Destructive operations (resetState) are only allowed against test databases
// or when explicitly enabled via ALLOW_DB_RESET=1. This prevents test runs or
// the /api/reset endpoint from silently wiping real (non-test) data.
function isSafeToReset(): boolean {
  const db = getDbName();
  return (
    process.env.NODE_ENV === "test" ||
    db.endsWith("_test") ||
    process.env.ALLOW_DB_RESET === "1"
  );
}

let pool: Pool;

function createPool(database?: string): Pool {
  return mysql.createPool({
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database,
    waitForConnections: true,
    connectionLimit: 10,
    charset: "utf8mb4",
  });
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const DDL: string[] = [
  `CREATE DATABASE IF NOT EXISTS \`${getDbName()}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci`,

  `CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(50) PRIMARY KEY,
    username VARCHAR(100) NOT NULL,
    name VARCHAR(150) NOT NULL,
    role VARCHAR(30) NOT NULL,
    branchId VARCHAR(50),
    branchName VARCHAR(150),
    department VARCHAR(150),
    email VARCHAR(200),
    avatarUrl VARCHAR(500),
    password_hash VARCHAR(200),
    must_change_password TINYINT(1) DEFAULT 0,
    password_reset_requested TINYINT(1) DEFAULT 0,
    assignments JSON
  )`,

  `CREATE TABLE IF NOT EXISTS branches (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    location VARCHAR(200),
    status VARCHAR(20) NOT NULL,
    userCount INT DEFAULT 0
  )`,

  `CREATE TABLE IF NOT EXISTS categories (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    subcategory TEXT,
    status VARCHAR(20) NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS tickets (
    id VARCHAR(50) PRIMARY KEY,
    subject VARCHAR(300) NOT NULL,
    description TEXT,
    category VARCHAR(100) NOT NULL,
    subcategory VARCHAR(300),
    status VARCHAR(20) NOT NULL,
    requesterId VARCHAR(50),
    requesterName VARCHAR(150),
    branchId VARCHAR(50),
    branchName VARCHAR(150),
    assignedToId VARCHAR(50),
    assignedToName VARCHAR(150),
    createdAt VARCHAR(100),
    createdAtISO VARCHAR(50),
    updatedAt VARCHAR(100),
    resolutionNotes TEXT,
    resolvedAt VARCHAR(100),
    closedAt VARCHAR(100),
    attachments JSON,
    INDEX idx_tickets_status (status),
    INDEX idx_tickets_category (category),
    INDEX idx_tickets_branch (branchId)
  )`,

  `CREATE TABLE IF NOT EXISTS comments (
    id VARCHAR(50) PRIMARY KEY,
    ticketId VARCHAR(50) NOT NULL,
    authorId VARCHAR(50),
    authorName VARCHAR(150),
    authorRole VARCHAR(30),
    content TEXT,
    timestamp VARCHAR(100),
    isInternal TINYINT(1) DEFAULT 0,
    INDEX idx_comments_ticket (ticketId)
  )`,

  `CREATE TABLE IF NOT EXISTS timeline (
    id VARCHAR(50) PRIMARY KEY,
    ticketId VARCHAR(50),
    timestamp VARCHAR(100),
    actorName VARCHAR(150),
    actorRole VARCHAR(30),
    action VARCHAR(200),
    details TEXT,
    type VARCHAR(30)
  )`,

  `CREATE TABLE IF NOT EXISTS notifications (
    id VARCHAR(50) PRIMARY KEY,
    userId VARCHAR(50),
    ticketId VARCHAR(50),
    title VARCHAR(300),
    message TEXT,
    timestamp VARCHAR(100),
    \`read\` TINYINT(1) DEFAULT 0,
    type VARCHAR(20)
  )`,

  `CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(50) PRIMARY KEY,
    timestamp VARCHAR(100),
    actorName VARCHAR(150),
    actorRole VARCHAR(30),
    action VARCHAR(100),
    targetId VARCHAR(50),
    details TEXT
  )`,

  `CREATE TABLE IF NOT EXISTS app_meta (
    meta_key VARCHAR(50) PRIMARY KEY,
    meta_value VARCHAR(100) NOT NULL
  )`,
];

export async function initDatabase(): Promise<void> {
  pool = createPool();
  await pool.query(
    `CREATE DATABASE IF NOT EXISTS \`${getDbName()}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci`,
  );
  await pool.end();

  pool = createPool(getDbName());
  for (const ddl of DDL) {
    await pool.query(ddl);
  }

  // Migration: add assignments column to pre-existing users tables.
  try {
    await pool.query("ALTER TABLE users ADD COLUMN assignments JSON");
  } catch {
    // Column already exists (or DB does not support IF NOT EXISTS).
  }
  // Migration: add password_hash column to pre-existing users tables.
  try {
    await pool.query("ALTER TABLE users ADD COLUMN password_hash VARCHAR(200)");
  } catch {
    // Column already exists.
  }
  // Migration: add must_change_password column to pre-existing users tables.
  try {
    await pool.query(
      "ALTER TABLE users ADD COLUMN must_change_password TINYINT(1) DEFAULT 0",
    );
  } catch {
    // Column already exists.
  }
  // Migration: add password_reset_requested column to pre-existing users tables.
  try {
    await pool.query(
      "ALTER TABLE users ADD COLUMN password_reset_requested TINYINT(1) DEFAULT 0",
    );
  } catch {
    // Column already exists.
  }
  // Backfill: assign the demo password hash to any legacy account without one.
  await pool.query(
    "UPDATE users SET password_hash = ? WHERE password_hash IS NULL",
    [hashPassword(DEFAULT_PASSWORD)],
  );
  // Migration: drop the legacy priority column from pre-existing tickets tables.
  try {
    await pool.query("ALTER TABLE tickets DROP COLUMN priority");
  } catch {
    // Column already dropped.
  }
  // Migration: add the subcategory column to pre-existing tickets tables.
  try {
    await pool.query(
      "ALTER TABLE tickets ADD COLUMN subcategory VARCHAR(300) NULL",
    );
  } catch {
    // Column already added.
  }
  // Migration: drop the legacy SLA columns from pre-existing categories tables.
  try {
    await pool.query("ALTER TABLE categories DROP COLUMN slaTargetHours");
  } catch {
    // Column already dropped.
  }
  try {
    await pool.query("ALTER TABLE categories DROP COLUMN slaHours");
  } catch {
    // Column already dropped.
  }
  // Migration: rename the legacy description column to subcategory.
  try {
    await pool.query(
      "ALTER TABLE categories CHANGE description subcategory TEXT NULL",
    );
  } catch {
    // Column already renamed.
  }
  // Migration: drop the branch code column (bank has no branch codes).
  try {
    await pool.query("ALTER TABLE branches DROP COLUMN code");
  } catch {
    // Column already dropped.
  }
}

// ---------------------------------------------------------------------------
// Seeding
// ---------------------------------------------------------------------------

async function getMeta(key: string): Promise<string | null> {
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    "SELECT meta_value FROM app_meta WHERE meta_key = ?",
    [key],
  );
  return rows.length ? (rows[0].meta_value as string) : null;
}

async function setMeta(key: string, value: string): Promise<void> {
  await pool.query(
    "INSERT INTO app_meta (meta_key, meta_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE meta_value = VALUES(meta_value)",
    [key, value],
  );
}

function toBool(value: unknown): boolean {
  return value === 1 || value === true || value === "1";
}

export async function seedIfEmpty(force = false): Promise<void> {
  if (!force) {
    const seeded = await getMeta("seeded");
    if (seeded === "1") return;
  }

  const demoMode = process.env.DEMO_MODE !== "false";

  // In production (DEMO_MODE=false) we do NOT seed the demo accounts. Only a
  // single bootstrap admin is created with a random one-time password that is
  // printed to the server log; the password must be changed on first login.
  const usersToSeed: Array<{
    user: (typeof INITIAL_USERS)[number];
    tempPassword?: string;
  }> = demoMode
    ? INITIAL_USERS.map((u) => ({ user: u }))
    : [
        {
          user:
            INITIAL_USERS.find((u) => u.username === "admin") ??
            INITIAL_USERS[0],
          tempPassword: randomBytes(9).toString("base64url"),
        },
      ];

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    for (const { user: u, tempPassword } of usersToSeed) {
      const password = tempPassword ?? DEFAULT_PASSWORD;
      if (tempPassword) {
        console.log(
          `[mysql] Bootstrap account "${u.username}" created. One-time password (CHANGE ON FIRST LOGIN): ${tempPassword}`,
        );
      }
      await upsertUserRow(conn, {
        ...u,
        passwordHash: hashPassword(password),
        mustChangePassword: demoMode ? false : true,
        passwordResetRequested: u.passwordResetRequested ?? false,
      });
    }

    if (demoMode) {
      for (const b of INITIAL_BRANCHES) {
        await conn.query(
          "INSERT INTO branches (id, name, location, status, userCount) VALUES (?, ?, ?, ?, ?)",
          [b.id, b.name, b.location, b.status, b.userCount],
        );
      }

      for (const c of INITIAL_CATEGORIES) {
        await conn.query(
          "INSERT INTO categories (id, name, subcategory, status) VALUES (?, ?, ?, ?)",
          [c.id, c.name, c.subcategory, c.status],
        );
      }

      for (const t of INITIAL_TICKETS) {
        await insertTicket(conn, t);
      }

      for (const c of INITIAL_COMMENTS) {
        await conn.query(
          "INSERT INTO comments (id, ticketId, authorId, authorName, authorRole, content, timestamp, isInternal) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          [
            c.id,
            c.ticketId,
            c.authorId,
            c.authorName,
            c.authorRole,
            c.content,
            c.timestamp,
            c.isInternal ? 1 : 0,
          ],
        );
      }

      for (const t of INITIAL_TIMELINE) {
        await conn.query(
          "INSERT INTO timeline (id, ticketId, timestamp, actorName, actorRole, action, details, type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          [
            t.id,
            t.ticketId,
            t.timestamp,
            t.actorName,
            t.actorRole,
            t.action,
            t.details ?? null,
            t.type,
          ],
        );
      }

      for (const n of INITIAL_NOTIFICATIONS) {
        await conn.query(
          "INSERT INTO notifications (id, userId, ticketId, title, message, timestamp, `read`, type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          [
            n.id,
            n.userId,
            n.ticketId,
            n.title,
            n.message,
            n.timestamp,
            n.read ? 1 : 0,
            n.type,
          ],
        );
      }

      for (const a of INITIAL_AUDIT_LOGS) {
        await conn.query(
          "INSERT INTO audit_logs (id, timestamp, actorName, actorRole, action, targetId, details) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [
            a.id,
            a.timestamp,
            a.actorName,
            a.actorRole,
            a.action,
            a.targetId ?? null,
            a.details,
          ],
        );
      }
    }

    await conn.query(
      "INSERT INTO app_meta (meta_key, meta_value) VALUES (?, ?), (?, ?) ON DUPLICATE KEY UPDATE meta_value = VALUES(meta_value)",
      ["seeded", "1", "currentUserId", usersToSeed[0].user.id],
    );

    await conn.commit();
    console.log(`[mysql] Seeded database "${getDbName()}" with initial data.`);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

interface Queryable {
  query(sql: string, values?: unknown[]): Promise<unknown>;
}

async function insertTicket(conn: Queryable, t: Ticket): Promise<void> {
  await conn.query(
    `INSERT INTO tickets
      (id, subject, description, category, subcategory, status, requesterId, requesterName,
       branchId, branchName, assignedToId, assignedToName, createdAt, createdAtISO,
       updatedAt, resolutionNotes, resolvedAt, closedAt, attachments)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      t.id,
      t.subject,
      t.description,
      t.category,
      t.subcategory ?? null,
      t.status,
      t.requesterId,
      t.requesterName,
      t.branchId,
      t.branchName,
      t.assignedToId ?? null,
      t.assignedToName ?? null,
      t.createdAt,
      t.createdAtISO ?? null,
      t.updatedAt,
      t.resolutionNotes ?? null,
      t.resolvedAt ?? null,
      t.closedAt ?? null,
      t.attachments ? JSON.stringify(t.attachments) : null,
    ],
  );
}

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

async function loadRows<T>(table: string): Promise<T[]> {
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT * FROM ${table}`,
  );
  return rows as T[];
}

export async function loadState(): Promise<AppState> {
  const [
    users,
    branches,
    categories,
    tickets,
    comments,
    timeline,
    notifications,
    auditLogs,
  ] = await Promise.all([
    loadRows<
      User & {
        assignments?: string | null;
        password_hash?: string | null;
        must_change_password?: number | boolean;
        password_reset_requested?: number | boolean;
      }
    >("users"),
    loadRows<Branch>("branches"),
    loadRows<CategoryInfo>("categories"),
    loadRows<Ticket & { attachments?: string | null }>("tickets"),
    loadRows<Comment & { isInternal: number | boolean }>("comments"),
    loadRows<TimelineEvent>("timeline"),
    loadRows<NotificationItem & { read: number | boolean }>("notifications"),
    loadRows<AuditLog>("audit_logs"),
  ]);

  const currentUserId = (await getMeta("currentUserId")) || users[0]?.id || "";
  const ticketCounter = Number(await getMeta("ticketCounter")) || 126;

  const parsedUsers: User[] = users.map((u) => ({
    id: u.id,
    username: u.username,
    name: u.name,
    role: u.role,
    branchId: u.branchId ?? undefined,
    branchName: u.branchName ?? undefined,
    department: u.department ?? undefined,
    email: u.email,
    avatarUrl: u.avatarUrl ?? undefined,
    assignments: u.assignments
      ? typeof u.assignments === "string"
        ? (JSON.parse(u.assignments) as BranchAssignment[])
        : (u.assignments as BranchAssignment[])
      : undefined,
    passwordHash: u.password_hash ?? undefined,
    mustChangePassword: toBool(u.must_change_password),
    passwordResetRequested: toBool(u.password_reset_requested),
  }));

  const parsedTickets: Ticket[] = tickets.map((t) => ({
    ...t,
    attachments: t.attachments
      ? typeof t.attachments === "string"
        ? (JSON.parse(t.attachments) as Attachment[])
        : (t.attachments as Attachment[])
      : undefined,
  }));

  const parsedComments: Comment[] = comments.map((c) => ({
    ...c,
    isInternal: toBool(c.isInternal),
  }));

  const parsedNotifications: NotificationItem[] = notifications.map((n) => ({
    ...n,
    read: toBool(n.read),
  }));

  return {
    tickets: parsedTickets,
    comments: parsedComments,
    timeline,
    notifications: parsedNotifications,
    auditLogs,
    users: parsedUsers,
    branches,
    categories,
    currentUser:
      parsedUsers.find((u) => u.id === currentUserId) ||
      parsedUsers[0] ||
      createState().currentUser,
    ticketCounter,
  };
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

export async function saveState(state: AppState): Promise<void> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    await conn.query("DELETE FROM comments");
    await conn.query("DELETE FROM timeline");
    await conn.query("DELETE FROM notifications");
    await conn.query("DELETE FROM audit_logs");
    await conn.query("DELETE FROM tickets");
    await conn.query("DELETE FROM users");
    await conn.query("DELETE FROM branches");
    await conn.query("DELETE FROM categories");

    for (const u of state.users) {
      await conn.query(
        "INSERT INTO users (id, username, name, role, branchId, branchName, department, email, avatarUrl, must_change_password, password_reset_requested, assignments) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          u.id,
          u.username,
          u.name,
          u.role,
          u.branchId ?? null,
          u.branchName ?? null,
          u.department ?? null,
          u.email ?? null,
          u.avatarUrl ?? null,
          u.mustChangePassword ? 1 : 0,
          u.passwordResetRequested ? 1 : 0,
          u.assignments ? JSON.stringify(u.assignments) : null,
        ],
      );
    }

    for (const b of state.branches) {
      await conn.query(
        "INSERT INTO branches (id, name, location, status, userCount) VALUES (?, ?, ?, ?, ?)",
        [b.id, b.name, b.location, b.status, b.userCount],
      );
    }

    for (const c of state.categories) {
      await conn.query(
        "INSERT INTO categories (id, name, subcategory, status) VALUES (?, ?, ?, ?)",
        [c.id, c.name, c.subcategory, c.status],
      );
    }

    for (const t of state.tickets) {
      await insertTicket(conn, t);
    }

    for (const c of state.comments) {
      await conn.query(
        "INSERT INTO comments (id, ticketId, authorId, authorName, authorRole, content, timestamp, isInternal) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [
          c.id,
          c.ticketId,
          c.authorId,
          c.authorName,
          c.authorRole,
          c.content,
          c.timestamp,
          c.isInternal ? 1 : 0,
        ],
      );
    }

    for (const t of state.timeline) {
      await conn.query(
        "INSERT INTO timeline (id, ticketId, timestamp, actorName, actorRole, action, details, type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [
          t.id,
          t.ticketId,
          t.timestamp,
          t.actorName,
          t.actorRole,
          t.action,
          t.details ?? null,
          t.type,
        ],
      );
    }

    for (const n of state.notifications) {
      await conn.query(
        "INSERT INTO notifications (id, userId, ticketId, title, message, timestamp, `read`, type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [
          n.id,
          n.userId,
          n.ticketId,
          n.title,
          n.message,
          n.timestamp,
          n.read ? 1 : 0,
          n.type,
        ],
      );
    }

    for (const a of state.auditLogs) {
      await conn.query(
        "INSERT INTO audit_logs (id, timestamp, actorName, actorRole, action, targetId, details) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
          a.id,
          a.timestamp,
          a.actorName,
          a.actorRole,
          a.action,
          a.targetId ?? null,
          a.details,
        ],
      );
    }

    await conn.query(
      "INSERT INTO app_meta (meta_key, meta_value) VALUES (?, ?), (?, ?) ON DUPLICATE KEY UPDATE meta_value = VALUES(meta_value)",
      [
        "currentUserId",
        state.currentUser.id,
        "ticketCounter",
        String(state.ticketCounter),
      ],
    );

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// ---------------------------------------------------------------------------
// Incremental persistence (diff-based)
// ---------------------------------------------------------------------------
//
// Instead of rewriting every table after each mutation, only the rows that
// actually changed are upserted/inserted/deleted.

const rowsEqual = (a: unknown, b: unknown): boolean =>
  JSON.stringify(a) === JSON.stringify(b);

async function upsertUserRow(conn: Queryable, u: User): Promise<void> {
  await conn.query(
    `INSERT INTO users (id, username, name, role, branchId, branchName, department, email, avatarUrl, password_hash, must_change_password, password_reset_requested, assignments)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       username = VALUES(username), name = VALUES(name), role = VALUES(role),
       branchId = VALUES(branchId), branchName = VALUES(branchName),
       department = VALUES(department), email = VALUES(email),
       avatarUrl = VALUES(avatarUrl), password_hash = VALUES(password_hash),
       must_change_password = VALUES(must_change_password),
       password_reset_requested = VALUES(password_reset_requested),
       assignments = VALUES(assignments)`,
    [
      u.id,
      u.username,
      u.name,
      u.role,
      u.branchId ?? null,
      u.branchName ?? null,
      u.department ?? null,
      u.email ?? null,
      u.avatarUrl ?? null,
      u.passwordHash ?? null,
      u.mustChangePassword ? 1 : 0,
      u.passwordResetRequested ? 1 : 0,
      u.assignments ? JSON.stringify(u.assignments) : null,
    ],
  );
}

async function upsertBranchRow(conn: Queryable, b: Branch): Promise<void> {
  await conn.query(
    `INSERT INTO branches (id, name, location, status, userCount)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       name = VALUES(name), location = VALUES(location),
       status = VALUES(status), userCount = VALUES(userCount)`,
    [b.id, b.name, b.location, b.status, b.userCount],
  );
}

async function upsertCategoryRow(
  conn: Queryable,
  c: CategoryInfo,
): Promise<void> {
  await conn.query(
    `INSERT INTO categories (id, name, subcategory, status)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       name = VALUES(name), subcategory = VALUES(subcategory),
       status = VALUES(status)`,
    [c.id, c.name, c.subcategory, c.status],
  );
}

async function upsertTicketRow(conn: Queryable, t: Ticket): Promise<void> {
  await conn.query(
    `INSERT INTO tickets
       (id, subject, description, category, subcategory, status, requesterId, requesterName,
        branchId, branchName, assignedToId, assignedToName, createdAt, createdAtISO,
        updatedAt, resolutionNotes, resolvedAt, closedAt, attachments)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       subject = VALUES(subject), description = VALUES(description),
       category = VALUES(category), subcategory = VALUES(subcategory),
       status = VALUES(status),
       requesterId = VALUES(requesterId), requesterName = VALUES(requesterName),
       branchId = VALUES(branchId), branchName = VALUES(branchName),
       assignedToId = VALUES(assignedToId), assignedToName = VALUES(assignedToName),
       createdAt = VALUES(createdAt), createdAtISO = VALUES(createdAtISO),
       updatedAt = VALUES(updatedAt), resolutionNotes = VALUES(resolutionNotes),
       resolvedAt = VALUES(resolvedAt), closedAt = VALUES(closedAt),
       attachments = VALUES(attachments)`,
    [
      t.id,
      t.subject,
      t.description,
      t.category,
      t.subcategory ?? null,
      t.status,
      t.requesterId,
      t.requesterName,
      t.branchId,
      t.branchName,
      t.assignedToId ?? null,
      t.assignedToName ?? null,
      t.createdAt,
      t.createdAtISO ?? null,
      t.updatedAt,
      t.resolutionNotes ?? null,
      t.resolvedAt ?? null,
      t.closedAt ?? null,
      t.attachments ? JSON.stringify(t.attachments) : null,
    ],
  );
}

async function insertCommentRow(conn: Queryable, c: Comment): Promise<void> {
  await conn.query(
    "INSERT INTO comments (id, ticketId, authorId, authorName, authorRole, content, timestamp, isInternal) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [
      c.id,
      c.ticketId,
      c.authorId,
      c.authorName,
      c.authorRole,
      c.content,
      c.timestamp,
      c.isInternal ? 1 : 0,
    ],
  );
}

async function insertTimelineRow(
  conn: Queryable,
  t: TimelineEvent,
): Promise<void> {
  await conn.query(
    "INSERT INTO timeline (id, ticketId, timestamp, actorName, actorRole, action, details, type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [
      t.id,
      t.ticketId,
      t.timestamp,
      t.actorName,
      t.actorRole,
      t.action,
      t.details ?? null,
      t.type,
    ],
  );
}

async function upsertNotificationRow(
  conn: Queryable,
  n: NotificationItem,
): Promise<void> {
  await conn.query(
    `INSERT INTO notifications (id, userId, ticketId, title, message, timestamp, \`read\`, type)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       userId = VALUES(userId), ticketId = VALUES(ticketId), title = VALUES(title),
       message = VALUES(message), timestamp = VALUES(timestamp),
       \`read\` = VALUES(\`read\`), type = VALUES(type)`,
    [
      n.id,
      n.userId,
      n.ticketId,
      n.title,
      n.message,
      n.timestamp,
      n.read ? 1 : 0,
      n.type,
    ],
  );
}

async function insertAuditRow(conn: Queryable, a: AuditLog): Promise<void> {
  await conn.query(
    "INSERT INTO audit_logs (id, timestamp, actorName, actorRole, action, targetId, details) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [
      a.id,
      a.timestamp,
      a.actorName,
      a.actorRole,
      a.action,
      a.targetId ?? null,
      a.details,
    ],
  );
}

async function setMetaVal(
  conn: Queryable,
  key: string,
  value: string,
): Promise<void> {
  await conn.query(
    "INSERT INTO app_meta (meta_key, meta_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE meta_value = VALUES(meta_value)",
    [key, value],
  );
}

/**
 * Persist only the rows that changed between two states. Uses the pure store
 * functions in ./store as the source of truth; this keeps the database writes
 * targeted instead of rewriting every table on each request.
 */
export async function persistDiff(
  before: AppState,
  after: AppState,
): Promise<void> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    for (const t of after.tickets) {
      const old = before.tickets.find((x) => x.id === t.id);
      if (!old || !rowsEqual(old, t)) await upsertTicketRow(conn, t);
    }

    for (const u of after.users) {
      const old = before.users.find((x) => x.id === u.id);
      if (!old || !rowsEqual(old, u)) await upsertUserRow(conn, u);
    }
    for (const u of before.users) {
      if (!after.users.some((x) => x.id === u.id)) {
        await conn.query("DELETE FROM users WHERE id = ?", [u.id]);
      }
    }

    for (const b of after.branches) {
      const old = before.branches.find((x) => x.id === b.id);
      if (!old || !rowsEqual(old, b)) await upsertBranchRow(conn, b);
    }
    for (const b of before.branches) {
      if (!after.branches.some((x) => x.id === b.id)) {
        await conn.query("DELETE FROM branches WHERE id = ?", [b.id]);
      }
    }

    for (const c of after.categories) {
      const old = before.categories.find((x) => x.id === c.id);
      if (!old || !rowsEqual(old, c)) await upsertCategoryRow(conn, c);
    }

    for (const c of after.comments) {
      if (!before.comments.some((x) => x.id === c.id))
        await insertCommentRow(conn, c);
    }

    for (const tl of after.timeline) {
      if (!before.timeline.some((x) => x.id === tl.id))
        await insertTimelineRow(conn, tl);
    }

    for (const n of after.notifications) {
      const old = before.notifications.find((x) => x.id === n.id);
      if (!old || !rowsEqual(old, n)) await upsertNotificationRow(conn, n);
    }

    for (const a of after.auditLogs) {
      if (!before.auditLogs.some((x) => x.id === a.id))
        await insertAuditRow(conn, a);
    }

    if (before.currentUser.id !== after.currentUser.id) {
      await setMetaVal(conn, "currentUserId", after.currentUser.id);
    }
    if (before.ticketCounter !== after.ticketCounter) {
      await setMetaVal(conn, "ticketCounter", String(after.ticketCounter));
    }

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// ---------------------------------------------------------------------------
// Reset
// ---------------------------------------------------------------------------

export async function resetState(): Promise<AppState> {
  if (!isSafeToReset()) {
    throw new Error(
      `Refusing to reset database "${getDbName()}": destructive reset is only allowed on test databases. Set ALLOW_DB_RESET=1 to force.`,
    );
  }
  const admin =
    INITIAL_USERS.find((u) => u.username === "admin") ?? INITIAL_USERS[0];
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query("DELETE FROM comments");
    await conn.query("DELETE FROM timeline");
    await conn.query("DELETE FROM notifications");
    await conn.query("DELETE FROM audit_logs");
    await conn.query("DELETE FROM tickets");
    await conn.query("DELETE FROM branches");
    await conn.query("DELETE FROM categories");
    // Keep only the bootstrap administrator so the system stays usable, but
    // discard every demo record (branches, categories, tickets, ...). Reset
    // no longer re-seeds the demo dataset.
    await conn.query("DELETE FROM users WHERE id <> ?", [admin.id]);
    await conn.query("DELETE FROM app_meta");
    // Mark the database as seeded so a later server boot does NOT re-insert
    // the demo dataset via seedIfEmpty().
    await conn.query(
      "INSERT INTO app_meta (meta_key, meta_value) VALUES (?, ?), (?, ?) ON DUPLICATE KEY UPDATE meta_value = VALUES(meta_value)",
      ["seeded", "1", "currentUserId", admin.id],
    );
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
  return loadState();
}

export async function closeDatabase(): Promise<void> {
  if (pool) await pool.end();
}

// Re-exported so server.ts can keep a single persistence entry point.
export type { Pool, ResultSetHeader };
