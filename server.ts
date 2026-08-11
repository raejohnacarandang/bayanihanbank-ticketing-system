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
import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import {
  AppState,
  Branch,
  BranchAssignment,
  Comment,
  Ticket,
  TicketPriority,
  TicketStatus,
  User
} from './src/types';
import {
  addComment,
  assignTicket,
  createBranch,
  createTicket,
  createUser,
  deleteBranch,
  deleteUser,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  setCurrentUser,
  updateBranch,
  updateStaffAssignments,
  updateTicketPriority,
  updateTicketStatus,
  updateUser
} from './src/services/store';
import type {
  CreateBranchParams,
  CreateUserParams,
  UpdateUserChanges
} from './src/services/store';
import {
  closeDatabase,
  initDatabase,
  loadState,
  persistDiff,
  resetState,
  seedIfEmpty
} from './src/services/mysql';
import {
  DEFAULT_PASSWORD,
  hashPassword,
  publicUser,
  signToken,
  stateForViewer,
  verifyPassword,
  verifyToken
} from './src/server/auth';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3001);

let state: AppState;

const app = express();
app.use(express.json());

// ---------------------------------------------------------------------------
// Real-time broadcast (Server-Sent Events)
// ---------------------------------------------------------------------------

const sseClients = new Set<Response>();

function broadcastUpdate(): void {
  const payload = `data: ${JSON.stringify({ type: 'update', at: Date.now() })}\n\n`;
  for (const res of sseClients) {
    try {
      res.write(payload);
    } catch {
      sseClients.delete(res);
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface AuthedRequest extends Request {
  user: User;
}

const actor = (req: Request): User => (req as AuthedRequest).user;

/** Persist the diff between `before` and `after`, then respond with `payload`. */
async function commit(res: Response, before: AppState, after: AppState, payload: unknown): Promise<void> {
  state = after;
  try {
    await persistDiff(before, after);
    res.json(payload);
    broadcastUpdate();
  } catch (err) {
    console.error('[mysql] Failed to persist state.', err);
    res.status(500).json({ error: 'Failed to persist state to MySQL' });
  }
}

function requireAdmin(req: Request, res: Response): boolean {
  if (actor(req).role !== 'ADMINISTRATOR') {
    res.status(403).json({ error: 'Only administrators can perform this action' });
    return false;
  }
  return true;
}

function ticketListForViewer(state: AppState, viewer: User, filters: Record<string, string | undefined>): Ticket[] {
  let tickets = state.tickets;
  if (viewer.role === 'BRANCH_USER') {
    tickets = tickets.filter(
      (t) => t.branchId === viewer.branchId || t.requesterId === viewer.id
    );
  }
  if (filters.status) tickets = tickets.filter((t) => t.status === filters.status);
  if (filters.branchId) tickets = tickets.filter((t) => t.branchId === filters.branchId);
  if (filters.assignedToId) tickets = tickets.filter((t) => t.assignedToId === filters.assignedToId);
  if (filters.requesterId) tickets = tickets.filter((t) => t.requesterId === filters.requesterId);
  if (filters.category) tickets = tickets.filter((t) => t.category === filters.category);
  if (filters.priority) tickets = tickets.filter((t) => t.priority === filters.priority);
  return tickets;
}

const DEMO_USERNAMES = ['branch.user', 'maria.santos', 'it.staff', 'ana.cruz', 'admin', 'auditor'];

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

app.post('/api/auth/login', async (req: Request, res: Response) => {
  const { username, password } = req.body as { username?: string; password?: string };
  if (!username || !password) {
    return res.status(400).json({ error: 'username and password are required' });
  }
  const user = state.users.find((u) => u.username.toLowerCase() === username.trim().toLowerCase());
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }
  const before = state;
  const after = setCurrentUser(state, user);
  const token = signToken(user);
  await commit(res, before, after, { token, user: publicUser(user) });
});

app.get('/api/auth/demo-accounts', (_req: Request, res: Response) => {
  // Disabled in production (DEMO_MODE=false): demo usernames must not leak.
  const users =
    process.env.DEMO_MODE === 'false'
      ? []
      : state.users.filter((u) => DEMO_USERNAMES.includes(u.username)).map(publicUser);
  res.json({ users });
});

// ---------------------------------------------------------------------------
// Auth middleware + readiness guard
// ---------------------------------------------------------------------------

function authenticate(req: Request, res: Response, next: express.NextFunction): void {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }
  const user = state.users.find((u) => u.id === payload.sub);
  if (!user) {
    res.status(401).json({ error: 'Account no longer exists' });
    return;
  }
  (req as AuthedRequest).user = user;
  next();
}

app.use('/api', (_req: Request, res: Response, next: express.NextFunction) => {
  if (!state) {
    res.status(503).json({ error: 'Server is still starting' });
    return;
  }
  next();
});

// Public health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ ok: true });
});

// Everything below requires a valid session.
app.use('/api', authenticate);

// ---------------------------------------------------------------------------
// Auth session reads
// ---------------------------------------------------------------------------

app.post('/api/auth/logout', (_req: Request, res: Response) => {
  // The client discards the token. A revocation store can be added later.
  res.json({ ok: true });
});

app.patch('/api/auth/password', async (req: Request, res: Response) => {
  const user = actor(req);
  const { currentPassword, newPassword } = req.body as {
    currentPassword?: string;
    newPassword?: string;
  };
  if (!currentPassword) {
    return res.status(400).json({ error: 'Current password is required' });
  }
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters long' });
  }
  if (!verifyPassword(currentPassword, user.passwordHash)) {
    return res.status(400).json({ error: 'Current password is incorrect' });
  }
  const before = state;
  const after = updateUser(
    state,
    user.id,
    { passwordHash: hashPassword(newPassword), mustChangePassword: false },
    user
  );
  const updated = after.users.find((u) => u.id === user.id);
  await commit(res, before, after, { ok: true, user: publicUser(updated!) });
});

app.get('/api/auth/me', (req: Request, res: Response) => {
  res.json({ user: publicUser(actor(req)) });
});

// Server-Sent Events stream — notifies browsers when state changes.
// EventSource cannot send headers, so the JWT is passed as a query parameter.
app.get('/api/events', (req: Request, res: Response) => {
  const token = String(req.query.token || '');
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }
  const user = state.users.find((u) => u.id === payload.sub);
  if (!user) {
    res.status(401).json({ error: 'Account no longer exists' });
    return;
  }
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  res.write('retry: 15000\n\n');
  res.write(`data: ${JSON.stringify({ type: 'ready', at: Date.now() })}\n\n`);
  sseClients.add(res);
  req.on('close', () => {
    sseClients.delete(res);
  });
});

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

app.get('/api/state', (req: Request, res: Response) => {
  res.json(stateForViewer(state, actor(req)));
});

app.get('/api/tickets', (req: Request, res: Response) => {
  const { status, branchId, assignedToId, requesterId, category, priority } = req.query as Record<
    string,
    string | undefined
  >;
  res.json({ tickets: ticketListForViewer(state, actor(req), { status, branchId, assignedToId, requesterId, category, priority }) });
});

app.get('/api/tickets/:id', (req: Request, res: Response) => {
  const ticket = ticketListForViewer(state, actor(req), {}).find((t) => t.id === req.params.id);
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
  res.json({ ticket });
});

app.get('/api/tickets/:id/comments', (req: Request, res: Response) => {
  const viewer = actor(req);
  const ticket = ticketListForViewer(state, viewer, {}).find((t) => t.id === req.params.id);
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
  const comments = state.comments.filter((c) => c.ticketId === ticket.id);
  const visible = viewer.role === 'BRANCH_USER' ? comments.filter((c) => !c.isInternal) : comments;
  res.json({ comments: visible });
});

app.get('/api/tickets/:id/timeline', (req: Request, res: Response) => {
  const viewer = actor(req);
  const ticket = ticketListForViewer(state, viewer, {}).find((t) => t.id === req.params.id);
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
  res.json({ timeline: state.timeline.filter((tl) => tl.ticketId === ticket.id) });
});

app.get('/api/users', (req: Request, res: Response) => {
  const viewer = actor(req);
  let users = state.users.map(publicUser);
  if (viewer.role === 'BRANCH_USER') {
    const supportIds = new Set(
      state.users.filter((u) => u.role === 'IT_STAFF' || u.role === 'ADMINISTRATOR').map((u) => u.id)
    );
    users = users.filter((u) => u.id === viewer.id || supportIds.has(u.id));
  }
  res.json({ users });
});

app.get('/api/branches', (_req: Request, res: Response) => {
  res.json({ branches: state.branches });
});

app.get('/api/categories', (_req: Request, res: Response) => {
  res.json({ categories: state.categories });
});

app.get('/api/notifications', (req: Request, res: Response) => {
  const viewer = actor(req);
  res.json({ notifications: state.notifications.filter((n) => n.userId === viewer.id) });
});

app.get('/api/audit-logs', (req: Request, res: Response) => {
  const viewer = actor(req);
  if (viewer.role === 'BRANCH_USER') return res.json({ auditLogs: [] });
  res.json({ auditLogs: state.auditLogs });
});

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

app.post('/api/tickets', async (req: Request, res: Response) => {
  const params = req.body as {
    subject?: string;
    description?: string;
    category?: Ticket['category'];
    priority?: Ticket['priority'];
    attachmentName?: string;
  };
  if (!params?.subject || !params?.description || !params?.category || !params?.priority) {
    return res.status(400).json({ error: 'subject, description, category, and priority are required' });
  }
  const before = state;
  const after = createTicket(state, {
    subject: params.subject!,
    description: params.description!,
    category: params.category!,
    priority: params.priority!,
    attachmentName: params.attachmentName,
    currentUser: actor(req),
  });
  const created = after.tickets[0];
  await commit(res, before, after, { ticket: created });
});

app.patch('/api/tickets/:id/status', async (req: Request, res: Response) => {
  const { newStatus, notes } = req.body as { newStatus?: TicketStatus; notes?: string };
  if (!newStatus) {
    return res.status(400).json({ error: 'newStatus is required' });
  }
  const before = state;
  const after = updateTicketStatus(state, req.params.id, newStatus, actor(req), notes);
  if (after === before) return res.status(404).json({ error: 'Ticket not found' });
  const updated = after.tickets.find((t) => t.id === req.params.id);
  await commit(res, before, after, { ticket: updated });
});

app.patch('/api/tickets/:id/assign', async (req: Request, res: Response) => {
  const { staffUserId } = req.body as { staffUserId?: string };
  const staffUser = state.users.find((u) => u.id === staffUserId && (u.role === 'IT_STAFF' || u.role === 'ADMINISTRATOR'));
  if (!staffUser) {
    return res.status(400).json({ error: 'A valid IT staff member is required' });
  }
  const before = state;
  const after = assignTicket(state, req.params.id, staffUser, actor(req));
  if (after === before) return res.status(404).json({ error: 'Ticket not found' });
  const updated = after.tickets.find((t) => t.id === req.params.id);
  await commit(res, before, after, { ticket: updated });
});

app.patch('/api/tickets/:id/priority', async (req: Request, res: Response) => {
  const { newPriority } = req.body as { newPriority?: TicketPriority };
  if (!newPriority) {
    return res.status(400).json({ error: 'newPriority is required' });
  }
  const before = state;
  const after = updateTicketPriority(state, req.params.id, newPriority, actor(req));
  if (after === before) return res.status(404).json({ error: 'Ticket not found' });
  const updated = after.tickets.find((t) => t.id === req.params.id);
  await commit(res, before, after, { ticket: updated });
});

app.post('/api/tickets/:id/comments', async (req: Request, res: Response) => {
  const { content, isInternal } = req.body as { content?: string; isInternal?: boolean };
  if (!content?.trim()) {
    return res.status(400).json({ error: 'content is required' });
  }
  const before = state;
  const after = addComment(state, {
    ticketId: req.params.id,
    content,
    isInternal: Boolean(isInternal),
    currentUser: actor(req),
  });
  const comment = after.comments[after.comments.length - 1];
  await commit(res, before, after, { comment });
});

app.post('/api/notifications/:id/read', async (req: Request, res: Response) => {
  const before = state;
  const after = markNotificationAsRead(state, req.params.id);
  await commit(res, before, after, { ok: true });
});

app.post('/api/notifications/read-all', async (req: Request, res: Response) => {
  const viewer = actor(req);
  const before = state;
  const after = markAllNotificationsAsRead(state, viewer.id);
  await commit(res, before, after, { ok: true });
});

// ---------------------------------------------------------------------------
// Admin management (users & branches)
// ---------------------------------------------------------------------------

app.post('/api/users', async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const { user } = req.body as { user?: CreateUserParams };
  if (!user?.username || !user?.name || !user?.role || !user?.email) {
    return res.status(400).json({ error: 'username, name, role, and email are required' });
  }
  const before = state;
  const after = createUser(
    state,
    { ...user, passwordHash: hashPassword(user.password || DEFAULT_PASSWORD), mustChangePassword: true },
    actor(req)
  );
  const created = after.users[after.users.length - 1];
  await commit(res, before, after, { user: publicUser(created) });
});

app.patch('/api/users/:id', async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const { changes } = req.body as { changes?: UpdateUserChanges };
  if (!changes) return res.status(400).json({ error: 'changes are required' });
  const before = state;
  const withPassword: UpdateUserChanges = {
    ...changes,
    passwordHash: changes.password ? hashPassword(changes.password) : changes.passwordHash,
    ...(changes.password ? { mustChangePassword: true } : {}),
  };
  const after = updateUser(state, req.params.id, withPassword, actor(req));
  if (after === before) return res.status(404).json({ error: 'User not found or cannot be updated' });
  const updated = after.users.find((u) => u.id === req.params.id);
  await commit(res, before, after, { user: publicUser(updated!) });
});

app.delete('/api/users/:id', async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const before = state;
  const after = deleteUser(state, req.params.id, actor(req));
  if (after === before) return res.status(404).json({ error: 'User not found or cannot be deleted' });
  await commit(res, before, after, { ok: true });
});

app.patch('/api/users/:id/assignments', async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const { assignments } = req.body as { assignments?: BranchAssignment[] };
  if (!Array.isArray(assignments)) {
    return res.status(400).json({ error: 'assignments are required' });
  }
  const before = state;
  const after = updateStaffAssignments(state, req.params.id, assignments, actor(req));
  if (after === before) return res.status(404).json({ error: 'IT staff user not found' });
  const updated = after.users.find((u) => u.id === req.params.id);
  await commit(res, before, after, { user: publicUser(updated!) });
});

app.post('/api/branches', async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const { branch } = req.body as { branch?: CreateBranchParams };
  if (!branch?.code || !branch?.name) {
    return res.status(400).json({ error: 'branch code and name are required' });
  }
  const before = state;
  const after = createBranch(state, branch, actor(req));
  const created = after.branches[after.branches.length - 1];
  await commit(res, before, after, { branch: created });
});

app.patch('/api/branches/:id', async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const { changes } = req.body as { changes?: Partial<Branch> };
  if (!changes) return res.status(400).json({ error: 'changes are required' });
  const before = state;
  const after = updateBranch(state, req.params.id, changes, actor(req));
  if (after === before) return res.status(404).json({ error: 'Branch not found' });
  const updated = after.branches.find((b) => b.id === req.params.id);
  await commit(res, before, after, { branch: updated });
});

app.delete('/api/branches/:id', async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const before = state;
  const after = deleteBranch(state, req.params.id, actor(req));
  if (after === before) return res.status(404).json({ error: 'Branch not found' });
  await commit(res, before, after, { ok: true });
});

app.post('/api/reset', async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    state = await resetState();
    res.json({ ok: true });
  } catch (err) {
    console.error('[mysql] Failed to reset state.', err);
    res.status(500).json({ error: 'Failed to reset state' });
  }
});

// ---------------------------------------------------------------------------
// Static hosting (production)
// ---------------------------------------------------------------------------

const dist = path.join(__dirname, 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/.*/, (_req: Request, res: Response) => {
    res.sendFile(path.join(dist, 'index.html'));
  });
}

app.listen(PORT, async () => {
  console.log(`[service-desk] API listening on http://localhost:${PORT}`);
  try {
    await initDatabase();
    await seedIfEmpty();
    state = await loadState();
    console.log(`[service-desk] MySQL connected. Database: ${process.env.DB_NAME || 'bayanihan_bank'}`);
    console.log(`[service-desk] Loaded ${state.tickets.length} tickets from MySQL.`);
  } catch (err) {
    console.error('[service-desk] Failed to initialize MySQL.', err);
    process.exit(1);
  }
});

process.on('SIGINT', async () => {
  await closeDatabase();
  process.exit(0);
});
