/**
 * API-level workflow tests.
 *
 * Builds an in-memory Express app that mirrors the route logic, RBAC, scoping
 * and rate limiting in server.ts — but without MySQL (persistence is skipped).
 * The real validation schemas, JWT helpers and state-for-viewer logic are
 * reused, so these tests exercise the same code paths as production.
 *
 * CSRF, Helmet, Swagger and WebSocket/SSE middleware are intentionally omitted
 * (the same approach as tests/api.integration.test.ts) to keep the harness
 * focused on the user workflows.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import express, { Request, Response, NextFunction } from "express";
import { randomBytes, timingSafeEqual } from "crypto";
import {
  addComment,
  assignTicket,
  createBranch,
  createState,
  createTicket,
  createUser,
  deleteBranch,
  deleteUser,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  setCurrentUser,
  updateBranch,
  updateStaffAssignments,
  updateTicketStatus,
  updateUser,
  requestPasswordReset,
  performAdminRecovery,
} from "../src/services/store";
import {
  DEFAULT_PASSWORD,
  hashPassword,
  publicUser,
  signToken,
  stateForViewer,
  verifyPassword,
  verifyToken,
} from "../src/server/auth";
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
  validate,
} from "../src/server/validation";
import type { AppState, User } from "../src/types";

const PASSWORD = DEFAULT_PASSWORD;

interface Harness {
  app: express.Express;
  getState(): AppState;
}

function seedState(): AppState {
  const state = createState();
  return {
    ...state,
    users: state.users.map((u) => ({
      ...u,
      passwordHash: hashPassword(PASSWORD),
      mustChangePassword: false,
    })),
  };
}

function blankState(): AppState {
  const state = createState();
  const admin =
    state.users.find((u) => u.username === "admin") ?? state.users[0];
  return {
    ...state,
    users: state.users
      .filter((u) => u.id === admin.id)
      .map((u) => ({
        ...u,
        passwordHash: hashPassword(PASSWORD),
        mustChangePassword: false,
      })),
    tickets: [],
    comments: [],
    timeline: [],
    notifications: [],
    auditLogs: [],
    branches: [],
    categories: [],
    currentUser: admin,
  };
}

function buildHarness(): Harness {
  let state: AppState = seedState();

  // Login rate limiting (mirrors server.ts).
  const loginAttempts = new Map<string, { count: number; resetAt: number }>();
  const LOGIN_MAX_ATTEMPTS = 5;
  const LOGIN_WINDOW_MS = 15 * 60 * 1000;

  const isLoginLocked = (ip: string): boolean => {
    const entry = loginAttempts.get(ip);
    return (
      Boolean(entry) &&
      entry!.count >= LOGIN_MAX_ATTEMPTS &&
      Date.now() < entry!.resetAt
    );
  };
  const recordFailedLogin = (ip: string): void => {
    const now = Date.now();
    const entry = loginAttempts.get(ip);
    if (!entry || now >= entry.resetAt) {
      loginAttempts.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    } else {
      entry.count += 1;
    }
  };

  // Admin-recovery rate limiting (mirrors server.ts).
  const recoveryAttempts = new Map<
    string,
    { count: number; resetAt: number }
  >();

  interface AuthedRequest extends Request {
    user: User;
  }
  const actor = (req: Request): User => (req as AuthedRequest).user;

  async function commit(
    res: Response,
    before: AppState,
    after: AppState,
    payload: unknown,
  ): Promise<void> {
    state = after;
    res.json(payload);
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
    viewer: User,
    filters: Record<string, string | undefined>,
  ) {
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

  const app = express();
  app.set("trust proxy", "loopback");
  app.use(express.json());

  // --- Public routes (before auth middleware) ---

  app.post("/api/auth/login", validate(loginSchema), async (req, res) => {
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
  });

  app.get("/api/auth/demo-accounts", (_req: Request, res: Response) => {
    const users =
      process.env.DEMO_MODE === "false"
        ? []
        : state.users
            .filter((u) => DEMO_USERNAMES.includes(u.username))
            .map(publicUser);
    res.json({ users });
  });

  app.post(
    "/api/auth/reset-request",
    validate(resetRequestSchema),
    async (req, res) => {
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
        message:
          "Reset request submitted. Your administrator will contact you.",
      });
    },
  );

  app.post(
    "/api/auth/admin-recovery",
    validate(adminRecoverySchema),
    async (req, res) => {
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

  // --- Auth middleware + readiness guard ---

  function authenticate(req: Request, res: Response, next: NextFunction): void {
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

  app.use("/api", (_req: Request, res: Response, next: NextFunction) => {
    if (!state) {
      res.status(503).json({ error: "Server is still starting" });
      return;
    }
    next();
  });

  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  app.use("/api", authenticate);

  // --- Session reads ---

  app.post("/api/auth/logout", (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  app.patch(
    "/api/auth/password",
    validate(changePasswordSchema),
    async (req, res) => {
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
      await commit(res, before, after, {
        ok: true,
        user: publicUser(updated!),
      });
    },
  );

  app.get("/api/auth/me", (req: Request, res: Response) => {
    res.json({ user: publicUser(actor(req)) });
  });

  // --- Reads ---

  app.get("/api/state", (req: Request, res: Response) => {
    res.json(stateForViewer(state, actor(req)));
  });

  app.get("/api/tickets", (req: Request, res: Response) => {
    const { status, branchId, assignedToId, requesterId, category } =
      req.query as Record<string, string | undefined>;
    res.json({
      tickets: ticketListForViewer(actor(req), {
        status,
        branchId,
        assignedToId,
        requesterId,
        category,
      }),
    });
  });

  app.get("/api/tickets/:id", (req: Request, res: Response) => {
    const ticket = ticketListForViewer(actor(req), {}).find(
      (t) => t.id === req.params.id,
    );
    if (!ticket) return res.status(404).json({ error: "Ticket not found" });
    res.json({ ticket });
  });

  app.get("/api/tickets/:id/comments", (req: Request, res: Response) => {
    const viewer = actor(req);
    const ticket = ticketListForViewer(viewer, {}).find(
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
    const ticket = ticketListForViewer(viewer, {}).find(
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

  // --- Mutations ---

  app.post("/api/tickets", validate(createTicketSchema), async (req, res) => {
    const params = req.body;
    const before = state;
    const after = createTicket(state, {
      subject: params.subject!,
      description: params.description!,
      category: params.category!,
      attachmentName: params.attachmentName,
      currentUser: actor(req),
    });
    const created = after.tickets[0];
    await commit(res, before, after, { ticket: created });
  });

  app.patch(
    "/api/tickets/:id/status",
    validate(updateTicketStatusSchema),
    async (req, res) => {
      const viewer = actor(req);
      const ticket = state.tickets.find((t) => t.id === req.params.id);
      if (!ticket) return res.status(404).json({ error: "Ticket not found" });
      if (viewer.role === "AUDITOR") {
        return res
          .status(403)
          .json({ error: "Auditors have read-only access" });
      }
      if (
        viewer.role === "BRANCH_USER" &&
        !(
          ticket.requesterId === viewer.id ||
          ticket.branchId === viewer.branchId
        )
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
    async (req, res) => {
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
        return res
          .status(403)
          .json({ error: "Auditors have read-only access" });
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
    async (req, res) => {
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

  app.post(
    "/api/notifications/:id/read",
    async (req: Request, res: Response) => {
      const before = state;
      const after = markNotificationAsRead(state, req.params.id);
      await commit(res, before, after, { ok: true });
    },
  );

  app.post(
    "/api/notifications/read-all",
    async (req: Request, res: Response) => {
      const viewer = actor(req);
      const before = state;
      const after = markAllNotificationsAsRead(state, viewer.id);
      await commit(res, before, after, { ok: true });
    },
  );

  // --- Admin management ---

  app.post("/api/users", validate(createUserSchema), async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const { username, name, role, email, branchId, password } = req.body;
    const before = state;
    const after = createUser(
      state,
      {
        username,
        name,
        role,
        email,
        branchId,
        passwordHash: hashPassword(password || DEFAULT_PASSWORD),
        mustChangePassword: true,
      },
      actor(req),
    );
    const created = after.users[after.users.length - 1];
    await commit(res, before, after, { user: publicUser(created) });
  });

  app.patch("/api/users/:id", validate(updateUserSchema), async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const changes = req.body;
    const before = state;
    const withPassword = {
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
  });

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
    async (req, res) => {
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

  app.post("/api/branches", validate(createBranchSchema), async (req, res) => {
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
  });

  app.patch(
    "/api/branches/:id",
    validate(updateBranchSchema),
    async (req, res) => {
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
    state = blankState();
    res.json({ ok: true });
  });

  // --- API 404 ---

  app.use("/api", (_req: Request, res: Response) => {
    res.status(404).json({ error: "Not found" });
  });

  return { app, getState: () => state };
}

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

async function login(
  app: express.Express,
  username: string,
  password: string = PASSWORD,
) {
  const res = await request(app)
    .post("/api/auth/login")
    .send({ username, password });
  expect(res.status).toBe(200);
  return res.body.token as string;
}

let harness: Harness;

beforeEach(() => {
  process.env.JWT_SECRET = "workflow-test-secret";
  process.env.ADMIN_RECOVERY_KEY = "TEST-RECOVERY-KEY-123";
  process.env.DEMO_MODE = "true";
  harness = buildHarness();
});

afterEach(() => {
  delete process.env.JWT_SECRET;
  delete process.env.ADMIN_RECOVERY_KEY;
  delete process.env.DEMO_MODE;
});

// ---------------------------------------------------------------------------
// Authentication & sessions
// ---------------------------------------------------------------------------

describe("Authentication & sessions (API)", () => {
  it("logs in with valid credentials and returns a JWT + sanitized user", async () => {
    const res = await request(harness.app)
      .post("/api/auth/login")
      .send({ username: "branch.user", password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.username).toBe("branch.user");
    expect(res.body.user.id).toBe("usr-001");
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(harness.getState().currentUser.id).toBe("usr-001");
  });

  it("rejects invalid credentials with 401", async () => {
    const res = await request(harness.app)
      .post("/api/auth/login")
      .send({ username: "branch.user", password: "wrong-password" });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Invalid username or password");
  });

  it("rejects a malformed body with 400 (zod validation)", async () => {
    const res = await request(harness.app).post("/api/auth/login").send({});
    expect(res.status).toBe(400);
  });

  it("locks an IP after 5 failed attempts and returns Retry-After", async () => {
    for (let i = 0; i < 5; i++) {
      const res = await request(harness.app)
        .post("/api/auth/login")
        .send({ username: "branch.user", password: "wrong-password" });
      expect(res.status).toBe(401);
    }
    const locked = await request(harness.app)
      .post("/api/auth/login")
      .send({ username: "branch.user", password: PASSWORD });
    expect(locked.status).toBe(429);
    expect(locked.headers["retry-after"]).toBe("900");
  });

  it("a successful login clears the failed-attempt counter", async () => {
    // Note: once an IP is actually locked (5 failures), server.ts returns 429
    // before ever reaching the credentials check, so the counter can only be
    // reset by a successful login while the count is below the threshold.
    for (let i = 0; i < 3; i++) {
      await request(harness.app)
        .post("/api/auth/login")
        .send({ username: "branch.user", password: "wrong" });
    }
    await login(harness.app, "branch.user"); // success -> clears the counter
    for (let i = 0; i < 5; i++) {
      await request(harness.app)
        .post("/api/auth/login")
        .send({ username: "branch.user", password: "wrong" });
    }
    const locked = await request(harness.app)
      .post("/api/auth/login")
      .send({ username: "branch.user", password: PASSWORD });
    expect(locked.status).toBe(429);
  });

  it("GET /api/auth/me returns the authenticated user", async () => {
    const token = await login(harness.app, "it.staff");
    const res = await request(harness.app)
      .get("/api/auth/me")
      .set(bearer(token));
    expect(res.status).toBe(200);
    expect(res.body.user.username).toBe("it.staff");
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it("POST /api/auth/logout always succeeds", async () => {
    const token = await login(harness.app, "admin");
    const res = await request(harness.app)
      .post("/api/auth/logout")
      .set(bearer(token));
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it("GET /api/auth/demo-accounts lists demo users in DEMO_MODE", async () => {
    process.env.DEMO_MODE = "true";
    const res = await request(harness.app).get("/api/auth/demo-accounts");
    expect(res.status).toBe(200);
    expect(res.body.users.map((u: User) => u.username)).toEqual(
      expect.arrayContaining([
        "branch.user",
        "maria.santos",
        "it.staff",
        "ana.cruz",
        "admin",
        "auditor",
      ]),
    );
    expect(res.body.users[0].passwordHash).toBeUndefined();
  });

  it("GET /api/auth/demo-accounts returns an empty list when DEMO_MODE=false", async () => {
    process.env.DEMO_MODE = "false";
    const res = await request(harness.app).get("/api/auth/demo-accounts");
    expect(res.status).toBe(200);
    expect(res.body.users).toEqual([]);
  });

  it("rejects protected routes without a token", async () => {
    const res = await request(harness.app).get("/api/state");
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Authentication required");
  });

  it("rejects an invalid token", async () => {
    const res = await request(harness.app)
      .get("/api/state")
      .set(bearer("not.a.jwt"));
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Invalid or expired token");
  });

  it("returns 404 JSON for unknown API routes", async () => {
    const token = await login(harness.app, "admin");
    const res = await request(harness.app).get("/api/nope").set(bearer(token));
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Not found");
  });
});

// ---------------------------------------------------------------------------
// Password workflows
// ---------------------------------------------------------------------------

describe("Password workflows (API)", () => {
  it("changes the current password and requires the new one on next login", async () => {
    const token = await login(harness.app, "branch.user");
    const res = await request(harness.app)
      .patch("/api/auth/password")
      .set(bearer(token))
      .send({ currentPassword: PASSWORD, newPassword: "securepass1" });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    const oldLogin = await request(harness.app)
      .post("/api/auth/login")
      .send({ username: "branch.user", password: PASSWORD });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(harness.app)
      .post("/api/auth/login")
      .send({ username: "branch.user", password: "securepass1" });
    expect(newLogin.status).toBe(200);
  });

  it("rejects a password change when the current password is wrong", async () => {
    const token = await login(harness.app, "branch.user");
    const res = await request(harness.app)
      .patch("/api/auth/password")
      .set(bearer(token))
      .send({ currentPassword: "nope", newPassword: "securepass1" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Current password is incorrect");
  });

  it("rejects a new password shorter than 6 characters", async () => {
    const token = await login(harness.app, "branch.user");
    const res = await request(harness.app)
      .patch("/api/auth/password")
      .set(bearer(token))
      .send({ currentPassword: PASSWORD, newPassword: "short" });
    expect(res.status).toBe(400);
  });

  it("lets a branch user request a password reset, notifying all admins", async () => {
    const res = await request(harness.app)
      .post("/api/auth/reset-request")
      .send({ username: "maria.santos" });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.requiresRecoveryKey).toBeUndefined();

    const flagged = harness
      .getState()
      .users.find((u) => u.username === "maria.santos")!;
    expect(flagged.passwordResetRequested).toBe(true);

    const adminToken = await login(harness.app, "admin");
    const notifs = await request(harness.app)
      .get("/api/notifications")
      .set(bearer(adminToken));
    expect(
      notifs.body.notifications.some(
        (n: { title: string }) => n.title === "Password reset requested",
      ),
    ).toBe(true);
  });

  it("returns 404 for a reset request on an unknown username", async () => {
    const res = await request(harness.app)
      .post("/api/auth/reset-request")
      .send({ username: "nobody.here" });
    expect(res.status).toBe(404);
  });

  it("short-circuits admin reset requests to the recovery-key flow", async () => {
    const res = await request(harness.app)
      .post("/api/auth/reset-request")
      .send({ username: "admin" });
    expect(res.status).toBe(200);
    expect(res.body.requiresRecoveryKey).toBe(true);
  });

  it("returns 503 for admin recovery when the key is not configured", async () => {
    delete process.env.ADMIN_RECOVERY_KEY;
    const res = await request(harness.app)
      .post("/api/auth/admin-recovery")
      .send({ username: "admin", key: "anything" });
    expect(res.status).toBe(503);
  });

  it("rejects a wrong recovery key with 403", async () => {
    const res = await request(harness.app)
      .post("/api/auth/admin-recovery")
      .send({ username: "admin", key: "WRONG-KEY" });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("Invalid recovery key");
  });

  it("issues a one-time password that works once and forces a password change", async () => {
    const res = await request(harness.app)
      .post("/api/auth/admin-recovery")
      .send({ username: "admin", key: "TEST-RECOVERY-KEY-123" });
    expect(res.status).toBe(200);
    expect(res.body.oneTimePassword).toBeTruthy();

    const otp = res.body.oneTimePassword as string;
    const loginRes = await request(harness.app)
      .post("/api/auth/login")
      .send({ username: "admin", password: otp });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.user.mustChangePassword).toBe(true);

    const oldLogin = await request(harness.app)
      .post("/api/auth/login")
      .send({ username: "admin", password: PASSWORD });
    expect(oldLogin.status).toBe(401);

    const change = await request(harness.app)
      .patch("/api/auth/password")
      .set(bearer(loginRes.body.token))
      .send({ currentPassword: otp, newPassword: "admin-secure-1" });
    expect(change.status).toBe(200);

    const finalLogin = await request(harness.app)
      .post("/api/auth/login")
      .send({ username: "admin", password: "admin-secure-1" });
    expect(finalLogin.status).toBe(200);
    expect(finalLogin.body.user.mustChangePassword).toBe(false);
  });

  it("rate-limits admin recovery attempts per IP", async () => {
    for (let i = 0; i < 5; i++) {
      const res = await request(harness.app)
        .post("/api/auth/admin-recovery")
        .send({ username: "admin", key: "WRONG-KEY" });
      expect(res.status).toBe(403);
    }
    const locked = await request(harness.app)
      .post("/api/auth/admin-recovery")
      .send({ username: "admin", key: "TEST-RECOVERY-KEY-123" });
    expect(locked.status).toBe(429);
  });

  it("lets an admin reset a user password via PATCH /api/users/:id", async () => {
    const adminToken = await login(harness.app, "admin");
    const res = await request(harness.app)
      .patch("/api/users/usr-002")
      .set(bearer(adminToken))
      .send({ password: "resetpass1" });
    expect(res.status).toBe(200);

    const newLogin = await request(harness.app)
      .post("/api/auth/login")
      .send({ username: "maria.santos", password: "resetpass1" });
    expect(newLogin.status).toBe(200);
    expect(newLogin.body.user.mustChangePassword).toBe(true);

    const oldLogin = await request(harness.app)
      .post("/api/auth/login")
      .send({ username: "maria.santos", password: PASSWORD });
    expect(oldLogin.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Branch user workflow
// ---------------------------------------------------------------------------

describe("Branch user workflow (API)", () => {
  it("creates a ticket that is auto-assigned to the IT specialist covering the branch", async () => {
    const token = await login(harness.app, "branch.user"); // Juan Dela Cruz, br-001
    const res = await request(harness.app)
      .post("/api/tickets")
      .set(bearer(token))
      .send({
        subject: "Counter 1 printer jam",
        description: "Passbook printer is jammed.",
        category: "Hardware",
      });
    expect(res.status).toBe(200);
    expect(res.body.ticket.id).toBe("IT-000126");
    expect(res.body.ticket.status).toBe("Assigned");
    expect(res.body.ticket.assignedToId).toBe("usr-003");
    expect(res.body.ticket.requesterId).toBe("usr-001");
    expect(res.body.ticket.branchId).toBe("br-001");
  });

  it("rejects ticket creation missing required fields", async () => {
    const token = await login(harness.app, "branch.user");
    const res = await request(harness.app)
      .post("/api/tickets")
      .set(bearer(token))
      .send({ subject: "Missing fields" });
    expect(res.status).toBe(400);
  });

  it("rejects ticket creation with an invalid category", async () => {
    const token = await login(harness.app, "branch.user");
    const res = await request(harness.app)
      .post("/api/tickets")
      .set(bearer(token))
      .send({ subject: "X", description: "Y", category: "NotACategory" });
    expect(res.status).toBe(400);
  });

  it("only exposes tickets from the branch or requested by the user", async () => {
    const token = await login(harness.app, "branch.user");
    const res = await request(harness.app)
      .get("/api/tickets")
      .set(bearer(token));
    expect(res.status).toBe(200);
    const ids = res.body.tickets.map((t: { id: string }) => t.id).sort();
    // br-001 (IT-000122, IT-000125) + requested by usr-001 (IT-000123, IT-000125)
    expect(ids).toEqual(["IT-000122", "IT-000123", "IT-000125"]);
  });

  it("returns 404 for a ticket outside the branch scope", async () => {
    const token = await login(harness.app, "branch.user");
    const res = await request(harness.app)
      .get("/api/tickets/IT-000121")
      .set(bearer(token));
    expect(res.status).toBe(404);
  });

  it("filters tickets by status, branch, requester and assigned staff", async () => {
    const token = await login(harness.app, "admin");
    const byStatus = await request(harness.app)
      .get("/api/tickets?status=Pending")
      .set(bearer(token));
    expect(byStatus.body.tickets.map((t: { id: string }) => t.id)).toEqual([
      "IT-000123",
    ]);

    const byBranch = await request(harness.app)
      .get("/api/tickets?branchId=br-001")
      .set(bearer(token));
    expect(
      byBranch.body.tickets.map((t: { id: string }) => t.id).sort(),
    ).toEqual(["IT-000122", "IT-000125"]);

    const byRequester = await request(harness.app)
      .get("/api/tickets?requesterId=usr-001")
      .set(bearer(token));
    expect(
      byRequester.body.tickets.map((t: { id: string }) => t.id).sort(),
    ).toEqual(["IT-000122", "IT-000123", "IT-000125"]);

    const byAssignee = await request(harness.app)
      .get("/api/tickets?assignedToId=usr-003")
      .set(bearer(token));
    expect(
      byAssignee.body.tickets.map((t: { id: string }) => t.id).sort(),
    ).toEqual(["IT-000121", "IT-000124"]);
  });

  it("hides internal IT comments from branch users but not from IT staff", async () => {
    const itToken = await login(harness.app, "it.staff");
    // Create a ticket visible to both it.staff (requester) and branch.user (br-001).
    const createRes = await request(harness.app)
      .post("/api/tickets")
      .set(bearer(itToken))
      .send({
        subject: "Comment visibility",
        description: "Checking comment visibility",
        category: "Software",
      });
    const ticketId = createRes.body.ticket.id;

    await request(harness.app)
      .post(`/api/tickets/${ticketId}/comments`)
      .set(bearer(itToken))
      .send({
        content: "Suspect fuser assembly; ordering replacement.",
        isInternal: true,
      });

    const itComments = await request(harness.app)
      .get(`/api/tickets/${ticketId}/comments`)
      .set(bearer(itToken));
    expect(
      itComments.body.comments.some((c: { content: string }) =>
        c.content.includes("fuser assembly"),
      ),
    ).toBe(true);

    const branchToken = await login(harness.app, "branch.user"); // br-001
    const branchComments = await request(harness.app)
      .get(`/api/tickets/${ticketId}/comments`)
      .set(bearer(branchToken));
    expect(branchComments.status).toBe(200);
    expect(
      branchComments.body.comments.some((c: { content: string }) =>
        c.content.includes("fuser assembly"),
      ),
    ).toBe(false);
  });

  it("returns 404 when reading comments of an out-of-scope ticket", async () => {
    const token = await login(harness.app, "branch.user");
    const res = await request(harness.app)
      .get("/api/tickets/IT-000121/comments")
      .set(bearer(token));
    expect(res.status).toBe(404);
  });

  it("returns only self + support staff in the users list", async () => {
    const token = await login(harness.app, "branch.user");
    const res = await request(harness.app).get("/api/users").set(bearer(token));
    const ids = res.body.users.map((u: User) => u.id).sort();
    expect(ids).toEqual(["usr-001", "usr-003", "usr-004", "usr-005"]);
    expect(
      res.body.users.every((u: User) => u.passwordHash === undefined),
    ).toBe(true);
  });

  it("receives an empty audit log", async () => {
    const token = await login(harness.app, "branch.user");
    const res = await request(harness.app)
      .get("/api/audit-logs")
      .set(bearer(token));
    expect(res.status).toBe(200);
    expect(res.body.auditLogs).toEqual([]);
  });

  it("runs the full lifecycle: create -> IT resolves -> branch confirms -> closed", async () => {
    const branchToken = await login(harness.app, "branch.user");
    const createRes = await request(harness.app)
      .post("/api/tickets")
      .set(bearer(branchToken))
      .send({
        subject: "Monitor flickering",
        description: "Monitor flickers after boot.",
        category: "Hardware",
      });
    const ticketId = createRes.body.ticket.id;

    const itToken = await login(harness.app, "it.staff");
    const resolveRes = await request(harness.app)
      .patch(`/api/tickets/${ticketId}/status`)
      .set(bearer(itToken))
      .send({ newStatus: "Resolved", notes: "Replaced power adapter." });
    expect(resolveRes.status).toBe(200);
    expect(resolveRes.body.ticket.resolutionNotes).toBe(
      "Replaced power adapter.",
    );
    expect(resolveRes.body.ticket.resolvedAt).toBeTruthy();

    // Requester is notified about the resolution.
    const branchNotifs = await request(harness.app)
      .get("/api/notifications")
      .set(bearer(branchToken));
    expect(
      branchNotifs.body.notifications.some(
        (n: { ticketId: string; title: string; type: string }) =>
          n.ticketId === ticketId &&
          n.title === "Ticket Status: Resolved" &&
          n.type === "success",
      ),
    ).toBe(true);

    const closeRes = await request(harness.app)
      .patch(`/api/tickets/${ticketId}/status`)
      .set(bearer(branchToken))
      .send({ newStatus: "Closed" });
    expect(closeRes.status).toBe(200);
    expect(closeRes.body.ticket.status).toBe("Closed");
    expect(closeRes.body.ticket.closedAt).toBeTruthy();

    // Assigned IT specialist is notified of the branch update.
    const itNotifs = await request(harness.app)
      .get("/api/notifications")
      .set(bearer(itToken));
    expect(
      itNotifs.body.notifications.some(
        (n: { ticketId: string; title: string }) =>
          n.ticketId === ticketId &&
          n.title.startsWith("Branch Update on Ticket"),
      ),
    ).toBe(true);
  });

  it("cannot access admin endpoints", async () => {
    const token = await login(harness.app, "branch.user");
    const res = await request(harness.app)
      .post("/api/users")
      .set(bearer(token))
      .send({
        username: "sneaky",
        name: "Sneaky",
        role: "BRANCH_USER",
        email: "sneaky@demo.test",
      });
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// IT staff workflow
// ---------------------------------------------------------------------------

describe("IT staff workflow (API)", () => {
  it("only sees tickets assigned to them (unassigned and other-assigned are hidden)", async () => {
    const token = await login(harness.app, "it.staff");
    const res = await request(harness.app)
      .get("/api/tickets")
      .set(bearer(token));
    const ids = res.body.tickets.map((t: { id: string }) => t.id);
    expect(ids).toEqual(expect.arrayContaining(["IT-000121", "IT-000124"]));
    expect(ids).not.toContain("IT-000123"); // unassigned
    expect(ids).not.toContain("IT-000122"); // assigned to another specialist
    expect(ids).not.toContain("IT-000125"); // assigned to another specialist

    const users = await request(harness.app)
      .get("/api/users")
      .set(bearer(token));
    expect(users.body.users).toHaveLength(6);

    const logs = await request(harness.app)
      .get("/api/audit-logs")
      .set(bearer(token));
    expect(logs.body.auditLogs.length).toBeGreaterThan(0);
  });

  it("cannot change the status of a ticket not assigned to them", async () => {
    const token = await login(harness.app, "it.staff");
    const res = await request(harness.app)
      .patch("/api/tickets/IT-000122/status")
      .set(bearer(token))
      .send({ newStatus: "In Progress" });
    expect(res.status).toBe(403);
  });

  it("cannot assign a ticket to a different IT specialist", async () => {
    const token = await login(harness.app, "it.staff");
    const res = await request(harness.app)
      .patch("/api/tickets/IT-000123/assign")
      .set(bearer(token))
      .send({ staffUserId: "usr-004" });
    expect(res.status).toBe(403);
  });

  it("assigns a pending ticket and moves it to Assigned", async () => {
    const itToken = await login(harness.app, "it.staff");
    const res = await request(harness.app)
      .patch("/api/tickets/IT-000123/assign")
      .set(bearer(itToken))
      .send({ staffUserId: "usr-003" });
    expect(res.status).toBe(200);
    expect(res.body.ticket.status).toBe("Assigned");
    expect(res.body.ticket.assignedToId).toBe("usr-003");
  });

  it("rejects assigning a ticket to a non-IT user", async () => {
    const itToken = await login(harness.app, "it.staff");
    const res = await request(harness.app)
      .patch("/api/tickets/IT-000123/assign")
      .set(bearer(itToken))
      .send({ staffUserId: "usr-001" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("A valid IT specialist member is required");
  });

  it("notifies the requester when IT changes a status", async () => {
    const branchToken = await login(harness.app, "maria.santos"); // requester of IT-000121
    const itToken = await login(harness.app, "it.staff");
    await request(harness.app)
      .patch("/api/tickets/IT-000121/status")
      .set(bearer(itToken))
      .send({ newStatus: "In Progress" });

    const notifs = await request(harness.app)
      .get("/api/notifications")
      .set(bearer(branchToken));
    expect(
      notifs.body.notifications.some(
        (n: { ticketId: string; title: string }) =>
          n.ticketId === "IT-000121" &&
          n.title === "Ticket Status: In Progress",
      ),
    ).toBe(true);
  });

  it("stores internal notes via isInternal comments", async () => {
    const itToken = await login(harness.app, "it.staff");
    const res = await request(harness.app)
      .post("/api/tickets/IT-000121/comments")
      .set(bearer(itToken))
      .send({
        content: "Contacting telecom partner for line test.",
        isInternal: true,
      });
    expect(res.status).toBe(200);
    expect(res.body.comment.isInternal).toBe(true);
    expect(res.body.comment.authorId).toBe("usr-003");
  });

  it("can create a ticket (no branch coverage -> Pending)", async () => {
    const token = await login(harness.app, "it.staff");
    const res = await request(harness.app)
      .post("/api/tickets")
      .set(bearer(token))
      .send({
        subject: "Head office server",
        description: "Server fan is loud.",
        category: "Hardware",
      });
    expect(res.status).toBe(200);
    expect(res.body.ticket.status).toBe("Pending");
    expect(res.body.ticket.requesterId).toBe("usr-003");
  });

  it("cannot access admin endpoints", async () => {
    const token = await login(harness.app, "it.staff");
    const res = await request(harness.app)
      .post("/api/users")
      .set(bearer(token))
      .send({
        username: "newuser",
        name: "New User",
        role: "BRANCH_USER",
        email: "newuser@test.com",
      });
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// Administrator workflow
// ---------------------------------------------------------------------------

describe("Administrator workflow (API)", () => {
  it("creates a user who can log in with the default password", async () => {
    const adminToken = await login(harness.app, "admin");
    const res = await request(harness.app)
      .post("/api/users")
      .set(bearer(adminToken))
      .send({
        username: "new.branch",
        name: "New Branch User",
        role: "BRANCH_USER",
        email: "new.branch@bayanihanbank.demo",
        branchId: "br-003",
      });
    expect(res.status).toBe(200);
    expect(res.body.user.username).toBe("new.branch");
    expect(res.body.user.passwordHash).toBeUndefined();

    const loginRes = await request(harness.app)
      .post("/api/auth/login")
      .send({ username: "new.branch", password: DEFAULT_PASSWORD });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.user.mustChangePassword).toBe(true);
  });

  it("updates a user record", async () => {
    const adminToken = await login(harness.app, "admin");
    const res = await request(harness.app)
      .patch("/api/users/usr-001")
      .set(bearer(adminToken))
      .send({ name: "Juan Renamed Dela Cruz" });
    expect(res.status).toBe(200);
    expect(res.body.user.name).toBe("Juan Renamed Dela Cruz");
  });

  it("returns 404 when updating a non-existent user", async () => {
    const adminToken = await login(harness.app, "admin");
    const res = await request(harness.app)
      .patch("/api/users/usr-999")
      .set(bearer(adminToken))
      .send({ name: "Ghost" });
    expect(res.status).toBe(404);
  });

  it("deletes a user, invalidating their existing tokens", async () => {
    const anaToken = await login(harness.app, "ana.cruz");
    const adminToken = await login(harness.app, "admin");
    const del = await request(harness.app)
      .delete("/api/users/usr-004")
      .set(bearer(adminToken));
    expect(del.status).toBe(200);

    const res = await request(harness.app)
      .get("/api/state")
      .set(bearer(anaToken));
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Account no longer exists");
  });

  it("cannot delete their own account", async () => {
    const adminToken = await login(harness.app, "admin");
    const res = await request(harness.app)
      .delete("/api/users/usr-005")
      .set(bearer(adminToken));
    expect(res.status).toBe(404);
  });

  it("creates, updates and deletes branches", async () => {
    const adminToken = await login(harness.app, "admin");
    const created = await request(harness.app)
      .post("/api/branches")
      .set(bearer(adminToken))
      .send({
        name: "Tiaong Branch",
        location: "Tiaong, Quezon",
        code: "TIA",
        userCount: 1,
      });
    expect(created.status).toBe(200);
    expect(created.body.branch.userCount).toBe(1);
    const branchId = created.body.branch.id;

    const updated = await request(harness.app)
      .patch(`/api/branches/${branchId}`)
      .set(bearer(adminToken))
      .send({ name: "Tiaong Main Branch", userCount: 2 });
    expect(updated.status).toBe(200);
    expect(updated.body.branch.name).toBe("Tiaong Main Branch");
    expect(updated.body.branch.userCount).toBe(2);

    const deleted = await request(harness.app)
      .delete(`/api/branches/${branchId}`)
      .set(bearer(adminToken));
    expect(deleted.status).toBe(200);
    expect(harness.getState().branches.some((b) => b.id === branchId)).toBe(
      false,
    );
  });

  it("rejects updating assignments for non-IT users", async () => {
    const adminToken = await login(harness.app, "admin");
    const res = await request(harness.app)
      .patch("/api/users/usr-002/assignments")
      .set(bearer(adminToken))
      .send({ assignments: [{ branchId: "br-001", isPrimary: true }] });
    expect(res.status).toBe(404);
  });

  it("auto-assigns pending tickets when a new branch coverage is added (end-to-end)", async () => {
    const adminToken = await login(harness.app, "admin");

    // Create a branch user at the uncovered Main IT / Head Office branch.
    const createdUser = await request(harness.app)
      .post("/api/users")
      .set(bearer(adminToken))
      .send({
        username: "ho.user",
        name: "Head Office User",
        role: "BRANCH_USER",
        email: "ho.user@bayanihanbank.demo",
        branchId: "br-006",
        password: "temppass123",
      });
    expect(createdUser.status).toBe(200);

    // Their ticket stays Pending because no IT specialist covers br-006.
    const hoToken = await login(harness.app, "ho.user", "temppass123");
    const created = await request(harness.app)
      .post("/api/tickets")
      .set(bearer(hoToken))
      .send({
        subject: "Head office laptop",
        description: "Laptop battery not charging.",
        category: "Hardware",
      });
    expect(created.status).toBe(200);
    expect(created.body.ticket.status).toBe("Pending");
    expect(created.body.ticket.assignedToId).toBeUndefined();
    expect(created.body.ticket.branchId).toBe("br-006");

    // Adding br-006 coverage to it.staff auto-assigns the pending ticket.
    const assigned = await request(harness.app)
      .patch("/api/users/usr-003/assignments")
      .set(bearer(adminToken))
      .send({ assignments: [{ branchId: "br-006", isPrimary: true }] });
    expect(assigned.status).toBe(200);

    const after = harness
      .getState()
      .tickets.find((t) => t.id === created.body.ticket.id)!;
    expect(after.status).toBe("Assigned");
    expect(after.assignedToId).toBe("usr-003");
  });

  it("resets the system to a blank state (admin only, no demo data)", async () => {
    const adminToken = await login(harness.app, "admin");
    await request(harness.app)
      .post("/api/tickets")
      .set(bearer(adminToken))
      .send({
        subject: "Extra ticket",
        description: "To be wiped",
        category: "Software",
      });
    expect(harness.getState().tickets.length).toBe(6);

    const res = await request(harness.app)
      .post("/api/reset")
      .set(bearer(adminToken));
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    const s = harness.getState();
    expect(s.tickets.length).toBe(0);
    expect(s.branches.length).toBe(0);
    expect(s.categories.length).toBe(0);
    expect(s.users).toHaveLength(1);
    expect(s.users[0].username).toBe("admin");
    expect(s.ticketCounter).toBe(126);
  });
});

// ---------------------------------------------------------------------------
// Auditor workflow
// ---------------------------------------------------------------------------

describe("Auditor workflow (API)", () => {
  it("reads the full state including tickets, users and audit logs", async () => {
    const token = await login(harness.app, "auditor");
    const state = await request(harness.app)
      .get("/api/state")
      .set(bearer(token));
    expect(state.status).toBe(200);
    expect(state.body.tickets).toHaveLength(5);
    expect(state.body.users).toHaveLength(6);
    expect(state.body.auditLogs.length).toBeGreaterThan(0);
    expect(state.body.currentUser.role).toBe("AUDITOR");
  });

  it("is blocked from admin-only endpoints", async () => {
    const token = await login(harness.app, "auditor");
    const users = await request(harness.app)
      .post("/api/users")
      .set(bearer(token))
      .send({
        username: "newuser",
        name: "New User",
        role: "BRANCH_USER",
        email: "newuser@test.com",
      });
    expect(users.status).toBe(403);

    const branches = await request(harness.app)
      .post("/api/branches")
      .set(bearer(token))
      .send({ name: "X", location: "Y" });
    expect(branches.status).toBe(403);

    const del = await request(harness.app)
      .delete("/api/users/usr-001")
      .set(bearer(token));
    expect(del.status).toBe(403);
  });

  it("documents current behavior: creating tickets has no server-side role guard", async () => {
    // The UI hides the create-ticket form for auditors (isViewOnly), but the
    // API route itself has no role guard. This test pins the current behavior.
    const token = await login(harness.app, "auditor");
    const res = await request(harness.app)
      .post("/api/tickets")
      .set(bearer(token))
      .send({
        subject: "Audit observation",
        description: "Noted during audit.",
        category: "Other",
      });
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Notifications workflow
// ---------------------------------------------------------------------------

describe("Notifications workflow (API)", () => {
  it("only returns the authenticated user notifications", async () => {
    const token = await login(harness.app, "branch.user");
    const res = await request(harness.app)
      .get("/api/notifications")
      .set(bearer(token));
    expect(res.status).toBe(200);
    const ids = res.body.notifications.map((n: { id: string }) => n.id);
    expect(ids).toEqual(["notif-2"]);
    expect(
      res.body.notifications.every(
        (n: { userId: string }) => n.userId === "usr-001",
      ),
    ).toBe(true);
  });

  it("marks a single notification as read", async () => {
    const itToken = await login(harness.app, "it.staff");
    const read = await request(harness.app)
      .post("/api/notifications/notif-1/read")
      .set(bearer(itToken));
    expect(read.status).toBe(200);
    expect(
      harness.getState().notifications.find((n) => n.id === "notif-1")!.read,
    ).toBe(true);
  });

  it("marks all notifications of the current user as read", async () => {
    const itToken = await login(harness.app, "it.staff");
    await request(harness.app)
      .post("/api/notifications/read-all")
      .set(bearer(itToken));

    const mine = harness
      .getState()
      .notifications.filter((n) => n.userId === "usr-003");
    expect(mine.every((n) => n.read)).toBe(true);
    // Other users are untouched.
    const others = harness
      .getState()
      .notifications.filter((n) => n.userId !== "usr-003");
    expect(others.some((n) => !n.read)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

describe("Health check (API)", () => {
  it("GET /api/health returns ok without auth", async () => {
    const res = await request(harness.app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
