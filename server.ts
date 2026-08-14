/**
 * Bayanihan Bank IT Service Desk — API + static host.
 *
 * Run in development:  `npm run dev` (starts this on :3001 and Vite on :3000)
 * Run in production:    `npm run build && npm start` (serves dist/ from :3001)
 *
 * The API is the single source of truth; state is persisted to MySQL.
 * Configure MySQL credentials via the DB_* environment variables (.env).
 *
 * Auth: every /api route (except login/demo-accounts) requires a Bearer JWT
 * obtained from POST /api/auth/login. The actor identity comes from the token,
 * never from the request body.
 */
import express, { Request, Response } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { randomBytes, timingSafeEqual } from "crypto";
import dotenv from "dotenv";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { createServer } from "http";
import {
  initWebSocketServer,
  broadcastUpdate as wsBroadcastUpdate,
} from "./src/server/websocket";
import { csrfCookie, csrfProtection } from "./src/server/csrf";
import {
  AppState,
  Branch,
  BranchAssignment,
  Comment,
  Ticket,
  TicketStatus,
  User,
} from "./src/types";
import {
  addComment,
  assignTicket,
  createBranch,
  createCategory,
  createTicket,
  createUser,
  deleteBranch,
  deleteUser,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  setCurrentUser,
  updateBranch,
  updateCategory,
  updateStaffAssignments,
  updateTicketStatus,
  updateUser,
  requestPasswordReset,
  performAdminRecovery,
} from "./src/services/store";
import type {
  CreateBranchParams,
  CreateUserParams,
  UpdateUserChanges,
} from "./src/services/store";
import {
  closeDatabase,
  initDatabase,
  loadState,
  persistDiff,
  resetState,
  seedIfEmpty,
} from "./src/services/mysql";
import {
  DEFAULT_PASSWORD,
  hashPassword,
  publicUser,
  signToken,
  stateForViewer,
  verifyPassword,
  verifyToken,
} from "./src/server/auth";
import {
  loginSchema,
  resetRequestSchema,
  adminRecoverySchema,
  changePasswordSchema,
  createTicketSchema,
  updateTicketStatusSchema,
  assignTicketSchema,
  addCommentSchema,
  createUserSchema,
  updateUserSchema,
  updateAssignmentsSchema,
  createBranchSchema,
  updateBranchSchema,
  createCategorySchema,
  updateCategorySchema,
  validate,
} from "./src/server/validation";
import { setupSwagger } from "./src/server/swagger";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3001);

let state: AppState;

const app = express();
app.set("trust proxy", "loopback");
app.use(express.json());
app.use(cookieParser());

// Create HTTP server for WebSocket support
const httpServer = createServer(app);

// CSRF protection - set cookie on safe methods
app.use(csrfCookie);

// Security headers via Helmet
app.use(
  helmet({
    contentSecurityPolicy: false, // Disable CSP for development flexibility
    crossOriginEmbedderPolicy: false,
    hsts: process.env.NODE_ENV === "production", // Enable HSTS in production
  }),
);

// API Documentation (Swagger UI)
setupSwagger(app);

// Initialize WebSocket server for real-time updates
initWebSocketServer(httpServer);

// Login rate limiting (in-memory, per client IP — no external dependencies).
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

function isLoginLocked(ip: string): boolean {
  const entry = loginAttempts.get(ip);
  return (
    Boolean(entry) &&
    entry!.count >= LOGIN_MAX_ATTEMPTS &&
    Date.now() < entry!.resetAt
  );
}

function recordFailedLogin(ip: string): void {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || now >= entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
  } else {
    entry.count += 1;
  }
}

// ---------------------------------------------------------------------------
// Real-time broadcast (Server-Sent Events + WebSocket)
// ---------------------------------------------------------------------------

const sseClients = new Set<Response>();

function broadcastUpdate(): void {
  // SSE broadcast
  const payload = `data: ${JSON.stringify({ type: "update", at: Date.now() })}\n\n`;
  for (const res of sseClients) {
    try {
      res.write(payload);
    } catch {
      sseClients.delete(res);
    }
  }

  // WebSocket broadcast
  wsBroadcastUpdate("update", { at: Date.now() });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface AuthedRequest extends Request {
  user: User;
}

const actor = (req: Request): User => (req as AuthedRequest).user;

/** Persist the diff between `before` and `after`, then respond with `payload`. */
async function commit(
  res: Response,
  before: AppState,
  after: AppState,
  payload: unknown,
): Promise<void> {
  state = after;
  try {
    await persistDiff(before, after);
    res.json(payload);
    broadcastUpdate();
  } catch (err) {
    console.error("[mysql] Failed to persist state.", err);
    res.status(500).json({ error: "Failed to persist state to MySQL" });
  }
}

function requireAdmin(req: Request, res: Response): boolean {
  if (actor(req).role !== "ADMINISTRATOR") {
    res
      .status(403)
      .json({ error: "Only administrators can perform this action" });
    return false;
  }
  return true;
}

function ticketListForViewer(
  state: AppState,
  viewer: User,
  filters: Record<string, string | undefined>,
): Ticket[] {
  let tickets = state.tickets;
  if (viewer.role === "BRANCH_USER") {
    tickets = tickets.filter(
      (t) => t.branchId === viewer.branchId || t.requesterId === viewer.id,
    );
  }
  if (viewer.role === "IT_STAFF") {
    tickets = tickets.filter(
      (t) => t.assignedToId === viewer.id || t.requesterId === viewer.id,
    );
  }
  if (filters.status)
    tickets = tickets.filter((t) => t.status === filters.status);
  if (filters.branchId)
    tickets = tickets.filter((t) => t.branchId === filters.branchId);
  if (filters.assignedToId)
    tickets = tickets.filter((t) => t.assignedToId === filters.assignedToId);
  if (filters.requesterId)
    tickets = tickets.filter((t) => t.requesterId === filters.requesterId);
  if (filters.category)
    tickets = tickets.filter((t) => t.category === filters.category);
  return tickets;
}

const DEMO_USERNAMES = [
  "branch.user",
  "maria.santos",
  "it.staff",
  "ana.cruz",
  "admin",
  "auditor",
];

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

app.post(
  "/api/auth/login",
  validate(loginSchema),
  async (req: Request, res: Response) => {
    const ip = req.ip || "unknown";
    if (isLoginLocked(ip)) {
      res.setHeader("Retry-After", "900");
      return res
        .status(429)
        .json({ error: "Too many login attempts. Try again in 15 minutes." });
    }
    const { username, password } = req.body as {
      username?: string;
      password?: string;
    };
    if (!username || !password) {
      return res
        .status(400)
        .json({ error: "username and password are required" });
    }
    const user = state.users.find(
      (u) => u.username.toLowerCase() === username.trim().toLowerCase(),
    );
    if (!user || !verifyPassword(password, user.passwordHash)) {
      recordFailedLogin(ip);
      return res.status(401).json({ error: "Invalid username or password" });
    }
    loginAttempts.delete(ip);
    const before = state;
    const after = setCurrentUser(state, user);
    const token = signToken(user);
    await commit(res, before, after, { token, user: publicUser(user) });
  },
);

app.get("/api/auth/demo-accounts", (_req: Request, res: Response) => {
  // Disabled in production (DEMO_MODE=false): demo usernames must not leak.
  const users =
    process.env.DEMO_MODE === "false"
      ? []
      : state.users
          .filter((u) => DEMO_USERNAMES.includes(u.username))
          .map(publicUser);
  res.json({ users });
});

// Public: self-service password reset request (no session required). Marks the
// account and notifies all administrators, who can then set a new password.
// Administrator accounts short-circuit to the recovery-key flow instead.
app.post(
  "/api/auth/reset-request",
  validate(resetRequestSchema),
  async (req: Request, res: Response) => {
    const { username } = req.body as { username?: string };
    if (!username || !username.trim()) {
      return res.status(400).json({ error: "Username is required" });
    }
    const before = state;
    const {
      state: after,
      user,
      requiresRecoveryKey,
    } = requestPasswordReset(state, username);
    if (!user) {
      return res
        .status(404)
        .json({ error: "No account found with that username" });
    }
    if (requiresRecoveryKey) {
      return res.status(200).json({
        ok: true,
        requiresRecoveryKey: true,
        message:
          "This is an administrator account. Enter the recovery key to reset it.",
      });
    }
    await commit(res, before, after, {
      ok: true,
      message: "Reset request submitted. Your administrator will contact you.",
    });
  },
);

// Public: recovery-key password reset for administrator accounts (no session
// required). Validates a static operator key from the environment, rotates the
// admin's password to a fresh one-time password, and returns it ONCE. Also
// force-change-on-login so the one-time password cannot be replayed.
const recoveryAttempts = new Map<string, { count: number; resetAt: number }>();
app.post(
  "/api/auth/admin-recovery",
  validate(adminRecoverySchema),
  async (req: Request, res: Response) => {
    const expected = process.env.ADMIN_RECOVERY_KEY;
    if (!expected) {
      return res
        .status(503)
        .json({ error: "Admin recovery is not configured" });
    }
    const ip = req.ip || "unknown";
    const now = Date.now();
    const attempt = recoveryAttempts.get(ip);
    if (attempt && attempt.count >= 5 && attempt.resetAt > now) {
      return res
        .status(429)
        .json({ error: "Too many attempts. Try again in 15 minutes." });
    }
    const { username, key } = req.body as { username?: string; key?: string };
    if (!username || !username.trim()) {
      return res.status(400).json({ error: "Username is required" });
    }
    if (!key || typeof key !== "string") {
      return res.status(400).json({ error: "Recovery key is required" });
    }
    const user = state.users.find(
      (u) => u.username.toLowerCase() === username.trim().toLowerCase(),
    );
    if (!user || user.role !== "ADMINISTRATOR") {
      return res
        .status(403)
        .json({ error: "Invalid credentials for admin recovery" });
    }

    const keyBuf = Buffer.from(key);
    const expectedBuf = Buffer.from(expected);
    const keyOk =
      keyBuf.length === expectedBuf.length &&
      timingSafeEqual(keyBuf, expectedBuf);
    if (!keyOk) {
      recoveryAttempts.set(ip, {
        count: (attempt?.count ?? 0) + 1,
        resetAt: now + 1000 * 60 * 15,
      });
      return res.status(403).json({ error: "Invalid recovery key" });
    }
    recoveryAttempts.delete(ip);

    const oneTimePassword = randomBytes(9).toString("base64url");
    const before = state;
    const after = performAdminRecovery(
      state,
      user,
      hashPassword(oneTimePassword),
    );
    await commit(res, before, after, {
      ok: true,
      oneTimePassword,
      message:
        "Password reset. Use the one-time password to log in, then set a new one.",
    });
  },
);

// ---------------------------------------------------------------------------
// Auth middleware + readiness guard
// ---------------------------------------------------------------------------

function authenticate(
  req: Request,
  res: Response,
  next: express.NextFunction,
): void {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  if (!token) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }
  const user = state.users.find((u) => u.id === payload.sub);
  if (!user) {
    res.status(401).json({ error: "Account no longer exists" });
    return;
  }
  (req as AuthedRequest).user = user;
  next();
}

app.use("/api", (_req: Request, res: Response, next: express.NextFunction) => {
  if (!state) {
    res.status(503).json({ error: "Server is still starting" });
    return;
  }
  next();
});

// Public health check
app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ ok: true });
});

// Server-Sent Events stream — notifies browsers when state changes.
// EventSource cannot send headers, so the JWT is passed as a query parameter.
// Registered BEFORE the auth middleware so the query token is what gets verified.
app.get("/api/events", (req: Request, res: Response) => {
  const token = String(req.query.token || "");
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }
  const user = state.users.find((u) => u.id === payload.sub);
  if (!user) {
    res.status(401).json({ error: "Account no longer exists" });
    return;
  }
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();
  res.write("retry: 15000\n\n");
  res.write(`data: ${JSON.stringify({ type: "ready", at: Date.now() })}\n\n`);
  sseClients.add(res);
  req.on("close", () => {
    sseClients.delete(res);
  });
});

// Everything below requires a valid session.
app.use("/api", authenticate);

// CSRF protection for state-changing operations
app.use("/api", csrfProtection);

// ---------------------------------------------------------------------------
// Auth session reads
// ---------------------------------------------------------------------------

app.post("/api/auth/logout", (_req: Request, res: Response) => {
  // The client discards the token. A revocation store can be added later.
  res.json({ ok: true });
});

app.patch(
  "/api/auth/password",
  validate(changePasswordSchema),
  async (req: Request, res: Response) => {
    const user = actor(req);
    const { currentPassword, newPassword } = req.body as {
      currentPassword?: string;
      newPassword?: string;
    };
    if (!currentPassword) {
      return res.status(400).json({ error: "Current password is required" });
    }
    if (!newPassword || newPassword.length < 6) {
      return res
        .status(400)
        .json({ error: "New password must be at least 6 characters long" });
    }
    if (!verifyPassword(currentPassword, user.passwordHash)) {
      return res.status(400).json({ error: "Current password is incorrect" });
    }
    const before = state;
    const after = updateUser(
      state,
      user.id,
      {
        passwordHash: hashPassword(newPassword),
        mustChangePassword: false,
        passwordResetRequested: false,
      },
      user,
    );
    const updated = after.users.find((u) => u.id === user.id);
    await commit(res, before, after, { ok: true, user: publicUser(updated!) });
  },
);

app.get("/api/auth/me", (req: Request, res: Response) => {
  res.json({ user: publicUser(actor(req)) });
});

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

app.get("/api/state", (req: Request, res: Response) => {
  res.json(stateForViewer(state, actor(req)));
});

app.get("/api/tickets", (req: Request, res: Response) => {
  const { status, branchId, assignedToId, requesterId, category } =
    req.query as Record<string, string | undefined>;
  res.json({
    tickets: ticketListForViewer(state, actor(req), {
      status,
      branchId,
      assignedToId,
      requesterId,
      category,
    }),
  });
});

app.get("/api/tickets/:id", (req: Request, res: Response) => {
  const ticket = ticketListForViewer(state, actor(req), {}).find(
    (t) => t.id === req.params.id,
  );
  if (!ticket) return res.status(404).json({ error: "Ticket not found" });
  res.json({ ticket });
});

app.get("/api/tickets/:id/comments", (req: Request, res: Response) => {
  const viewer = actor(req);
  const ticket = ticketListForViewer(state, viewer, {}).find(
    (t) => t.id === req.params.id,
  );
  if (!ticket) return res.status(404).json({ error: "Ticket not found" });
  const comments = state.comments.filter((c) => c.ticketId === ticket.id);
  const visible =
    viewer.role === "BRANCH_USER"
      ? comments.filter((c) => !c.isInternal)
      : comments;
  res.json({ comments: visible });
});

app.get("/api/tickets/:id/timeline", (req: Request, res: Response) => {
  const viewer = actor(req);
  const ticket = ticketListForViewer(state, viewer, {}).find(
    (t) => t.id === req.params.id,
  );
  if (!ticket) return res.status(404).json({ error: "Ticket not found" });
  res.json({
    timeline: state.timeline.filter((tl) => tl.ticketId === ticket.id),
  });
});

app.get("/api/users", (req: Request, res: Response) => {
  const viewer = actor(req);
  let users = state.users.map(publicUser);
  if (viewer.role === "BRANCH_USER") {
    const supportIds = new Set(
      state.users
        .filter((u) => u.role === "IT_STAFF" || u.role === "ADMINISTRATOR")
        .map((u) => u.id),
    );
    users = users.filter((u) => u.id === viewer.id || supportIds.has(u.id));
  }
  res.json({ users });
});

app.get("/api/branches", (_req: Request, res: Response) => {
  res.json({ branches: state.branches });
});

app.get("/api/categories", (_req: Request, res: Response) => {
  res.json({ categories: state.categories });
});

app.post(
  "/api/categories",
  validate(createCategorySchema),
  async (req: Request, res: Response) => {
    if (!requireAdmin(req, res)) return;
    const { name, subcategory } = req.body;
    const before = state;
    const after = createCategory(state, { name, subcategory }, actor(req));
    const created = after.categories[after.categories.length - 1];
    await commit(res, before, after, { category: created });
  },
);

app.patch(
  "/api/categories/:id",
  validate(updateCategorySchema),
  async (req: Request, res: Response) => {
    if (!requireAdmin(req, res)) return;
    const changes = req.body;
    const before = state;
    const after = updateCategory(state, req.params.id, changes, actor(req));
    if (after === before)
      return res.status(404).json({ error: "Category not found" });
    const updated = after.categories.find((c) => c.id === req.params.id);
    await commit(res, before, after, { category: updated });
  },
);

app.get("/api/notifications", (req: Request, res: Response) => {
  const viewer = actor(req);
  res.json({
    notifications: state.notifications.filter((n) => n.userId === viewer.id),
  });
});

app.get("/api/audit-logs", (req: Request, res: Response) => {
  const viewer = actor(req);
  if (viewer.role === "BRANCH_USER") return res.json({ auditLogs: [] });
  res.json({ auditLogs: state.auditLogs });
});

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

app.post(
  "/api/tickets",
  validate(createTicketSchema),
  async (req: Request, res: Response) => {
    const params = req.body;
    const before = state;
    const after = createTicket(state, {
      subject: params.subject!,
      description: params.description!,
      category: params.category!,
      subcategory: params.subcategory,
      attachmentName: params.attachmentName,
      requesterName: params.requesterName,
      currentUser: actor(req),
    });
    const created = after.tickets[0];
    await commit(res, before, after, { ticket: created });
  },
);

app.patch(
  "/api/tickets/:id/status",
  validate(updateTicketStatusSchema),
  async (req: Request, res: Response) => {
    const viewer = actor(req);
    const ticket = state.tickets.find((t) => t.id === req.params.id);
    if (!ticket) return res.status(404).json({ error: "Ticket not found" });
    if (viewer.role === "AUDITOR") {
      return res.status(403).json({ error: "Auditors have read-only access" });
    }
    if (
      viewer.role === "BRANCH_USER" &&
      !(ticket.requesterId === viewer.id || ticket.branchId === viewer.branchId)
    ) {
      return res
        .status(403)
        .json({ error: "You can only update tickets from your branch" });
    }
    if (
      viewer.role === "IT_STAFF" &&
      ticket.assignedToId !== viewer.id &&
      ticket.requesterId !== viewer.id
    ) {
      return res
        .status(403)
        .json({
          error: "Only the assigned IT specialist can update this ticket",
        });
    }
    const { newStatus, notes } = req.body;
    const before = state;
    const after = updateTicketStatus(
      state,
      req.params.id,
      newStatus,
      viewer,
      notes,
    );
    if (after === before)
      return res.status(404).json({ error: "Ticket not found" });
    const updated = after.tickets.find((t) => t.id === req.params.id);
    await commit(res, before, after, { ticket: updated });
  },
);

app.patch(
  "/api/tickets/:id/assign",
  validate(assignTicketSchema),
  async (req: Request, res: Response) => {
    const viewer = actor(req);
    const { staffUserId } = req.body;
    const staffUser = state.users.find(
      (u) =>
        u.id === staffUserId &&
        (u.role === "IT_STAFF" || u.role === "ADMINISTRATOR"),
    );
    if (!staffUser) {
      return res
        .status(400)
        .json({ error: "A valid IT specialist member is required" });
    }
    if (viewer.role === "AUDITOR") {
      return res.status(403).json({ error: "Auditors have read-only access" });
    }
    if (viewer.role === "BRANCH_USER") {
      return res
        .status(403)
        .json({ error: "Only IT staff can assign tickets" });
    }
    if (viewer.role === "IT_STAFF" && staffUserId !== viewer.id) {
      return res
        .status(403)
        .json({
          error: "IT specialists can only claim tickets for themselves",
        });
    }
    const before = state;
    const after = assignTicket(state, req.params.id, staffUser, viewer);
    if (after === before)
      return res.status(404).json({ error: "Ticket not found" });
    const updated = after.tickets.find((t) => t.id === req.params.id);
    await commit(res, before, after, { ticket: updated });
  },
);

app.post(
  "/api/tickets/:id/comments",
  validate(addCommentSchema),
  async (req: Request, res: Response) => {
    const { content, isInternal } = req.body;
    const before = state;
    const after = addComment(state, {
      ticketId: req.params.id,
      content,
      isInternal: Boolean(isInternal),
      currentUser: actor(req),
    });
    const comment = after.comments[after.comments.length - 1];
    await commit(res, before, after, { comment });
  },
);

app.post("/api/notifications/:id/read", async (req: Request, res: Response) => {
  const before = state;
  const after = markNotificationAsRead(state, req.params.id);
  await commit(res, before, after, { ok: true });
});

app.post("/api/notifications/read-all", async (req: Request, res: Response) => {
  const viewer = actor(req);
  const before = state;
  const after = markAllNotificationsAsRead(state, viewer.id);
  await commit(res, before, after, { ok: true });
});

// ---------------------------------------------------------------------------
// Admin management (users & branches)
// ---------------------------------------------------------------------------

app.post(
  "/api/users",
  validate(createUserSchema),
  async (req: Request, res: Response) => {
    if (!requireAdmin(req, res)) return;
    const {
      username,
      name,
      role,
      email,
      branchId,
      branchName,
      department,
      password,
    } = req.body;
    const before = state;
    const after = createUser(
      state,
      {
        username,
        name,
        role,
        email,
        branchId,
        branchName,
        department,
        passwordHash: hashPassword(password || DEFAULT_PASSWORD),
        mustChangePassword: true,
      },
      actor(req),
    );
    const created = after.users[after.users.length - 1];
    await commit(res, before, after, { user: publicUser(created) });
  },
);

app.patch(
  "/api/users/:id",
  validate(updateUserSchema),
  async (req: Request, res: Response) => {
    if (!requireAdmin(req, res)) return;
    const changes = req.body;
    const before = state;
    const withPassword: UpdateUserChanges = {
      ...changes,
      passwordHash: changes.password
        ? hashPassword(changes.password)
        : changes.passwordHash,
      ...(changes.password
        ? { mustChangePassword: true, passwordResetRequested: false }
        : {}),
    };
    const after = updateUser(state, req.params.id, withPassword, actor(req));
    if (after === before)
      return res
        .status(404)
        .json({ error: "User not found or cannot be updated" });
    const updated = after.users.find((u) => u.id === req.params.id);
    await commit(res, before, after, { user: publicUser(updated!) });
  },
);

app.delete("/api/users/:id", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const before = state;
  const after = deleteUser(state, req.params.id, actor(req));
  if (after === before)
    return res
      .status(404)
      .json({ error: "User not found or cannot be deleted" });
  await commit(res, before, after, { ok: true });
});

app.patch(
  "/api/users/:id/assignments",
  validate(updateAssignmentsSchema),
  async (req: Request, res: Response) => {
    if (!requireAdmin(req, res)) return;
    const { assignments } = req.body;
    const before = state;
    const after = updateStaffAssignments(
      state,
      req.params.id,
      assignments,
      actor(req),
    );
    if (after === before)
      return res.status(404).json({ error: "IT specialist user not found" });
    const updated = after.users.find((u) => u.id === req.params.id);
    await commit(res, before, after, { user: publicUser(updated!) });
  },
);

app.post(
  "/api/branches",
  validate(createBranchSchema),
  async (req: Request, res: Response) => {
    if (!requireAdmin(req, res)) return;
    const { name, location, code, status, userCount } = req.body;
    const before = state;
    const after = createBranch(
      state,
      { name, location, code, status, userCount },
      actor(req),
    );
    const created = after.branches[after.branches.length - 1];
    await commit(res, before, after, { branch: created });
  },
);

app.patch(
  "/api/branches/:id",
  validate(updateBranchSchema),
  async (req: Request, res: Response) => {
    if (!requireAdmin(req, res)) return;
    const changes = req.body;
    const before = state;
    const after = updateBranch(state, req.params.id, changes, actor(req));
    if (after === before)
      return res.status(404).json({ error: "Branch not found" });
    const updated = after.branches.find((b) => b.id === req.params.id);
    await commit(res, before, after, { branch: updated });
  },
);

app.delete("/api/branches/:id", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const before = state;
  const after = deleteBranch(state, req.params.id, actor(req));
  if (after === before)
    return res.status(404).json({ error: "Branch not found" });
  await commit(res, before, after, { ok: true });
});

app.post("/api/reset", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    state = await resetState();
    res.json({ ok: true });
  } catch (err) {
    console.error("[mysql] Failed to reset state.", err);
    res.status(500).json({ error: "Failed to reset state" });
  }
});

// ---------------------------------------------------------------------------
// API 404: unknown /api routes return JSON, never the SPA shell.
// ---------------------------------------------------------------------------

app.use("/api", (_req: Request, res: Response) => {
  res.status(404).json({ error: "Not found" });
});

// ---------------------------------------------------------------------------
// Static hosting (production)
// ---------------------------------------------------------------------------

const dist = path.join(__dirname, "dist");
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/.*/, (_req: Request, res: Response) => {
    res.sendFile(path.join(dist, "index.html"));
  });
}

httpServer.listen(PORT, async () => {
  console.log(`[service-desk] API listening on http://localhost:${PORT}`);
  console.log(
    `[service-desk] WebSocket server ready on ws://localhost:${PORT}/api/ws`,
  );
  try {
    await initDatabase();
    await seedIfEmpty();
    state = await loadState();
    console.log(
      `[service-desk] MySQL connected. Database: ${process.env.DB_NAME || "bayanihan_bank"}`,
    );
    console.log(
      `[service-desk] Loaded ${state.tickets.length} tickets from MySQL.`,
    );
  } catch (err) {
    console.error("[service-desk] Failed to initialize MySQL.", err);
    process.exit(1);
  }
});

async function shutdown(): Promise<void> {
  await closeDatabase();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
