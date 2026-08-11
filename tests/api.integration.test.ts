import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { initDatabase, loadState, closeDatabase, resetState, seedIfEmpty } from '../src/services/mysql';
import { createTicket, updateTicketStatus, assignTicket, addComment, createUser, createBranch } from '../src/services/store';
import { hashPassword, signToken, verifyToken, verifyPassword, DEFAULT_PASSWORD } from '../src/server/auth';
import { AppState, User, TicketStatus, Branch, Ticket } from '../src/types';

describe('API Integration Tests', () => {
  let app: express.Express;
  let state: AppState;
  let branchUserToken: string;
  let itStaffToken: string;
  let adminToken: string;
  let branchUser: User;
  let itStaff: User;
  let admin: User;
  let branch: Branch;
  
  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-secret';
    process.env.DEMO_MODE = 'true';
    
    // Initialize database
    await initDatabase();
    await resetState();
    await seedIfEmpty();
    state = await loadState();
    
    // Find test users
    branchUser = state.users.find((u) => u.username === 'branch.user')!;
    itStaff = state.users.find((u) => u.username === 'it.staff')!;
    admin = state.users.find((u) => u.username === 'admin')!;
    branch = state.branches[0];
    
    branchUserToken = signToken(branchUser);
    itStaffToken = signToken(itStaff);
    adminToken = signToken(admin);
    
    // Create test app with the actual state
    app = express();
    app.use(express.json());
    
    // Auth middleware
    const authenticate = (req: express.Request, res: express.Response, next: express.NextFunction) => {
      const header = req.headers.authorization;
      const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
      if (!token) return res.status(401).json({ error: 'Authentication required' });
      const payload = verifyToken(token);
      if (!payload) return res.status(401).json({ error: 'Invalid or expired token' });
      const user = state.users.find((u) => u.id === payload.sub);
      if (!user) return res.status(401).json({ error: 'Account no longer exists' });
      (req as any).user = user;
      next();
    };
    
    // Public routes
    app.post('/api/auth/login', async (req, res) => {
      const { username, password } = req.body;
      const user = state.users.find((u) => u.username.toLowerCase() === username?.toLowerCase());
      if (!user || !verifyPassword(password, user.passwordHash)) {
        return res.status(401).json({ error: 'Invalid username or password' });
      }
      const token = signToken(user);
      return res.json({ token, user: { ...user, passwordHash: undefined } });
    });
    
    app.get('/api/health', (_req, res) => res.json({ ok: true }));
    
    // Protected routes
    app.use('/api', authenticate);
    
    app.get('/api/state', (req, res) => {
      const viewer = (req as any).user;
      let users = state.users.map((u) => ({ ...u, passwordHash: undefined }));
      let tickets = state.tickets;
      if (viewer.role === 'BRANCH_USER') {
        tickets = tickets.filter((t) => t.branchId === viewer.branchId || t.requesterId === viewer.id);
        const supportIds = new Set(state.users.filter((u) => u.role === 'IT_STAFF' || u.role === 'ADMINISTRATOR').map((u) => u.id));
        users = users.filter((u) => u.id === viewer.id || supportIds.has(u.id));
      }
      res.json({ users, tickets, branches: state.branches, categories: state.categories, comments: state.comments, notifications: state.notifications.filter((n) => n.userId === viewer.id), timeline: state.timeline, auditLogs: viewer.role === 'BRANCH_USER' ? [] : state.auditLogs, currentUser: { ...viewer, passwordHash: undefined } });
    });
    
    app.get('/api/tickets', (req, res) => {
      const viewer = (req as any).user;
      let tickets = state.tickets;
      if (viewer.role === 'BRANCH_USER') {
        tickets = tickets.filter((t) => t.branchId === viewer.branchId || t.requesterId === viewer.id);
      }
      res.json({ tickets });
    });
    
    app.post('/api/tickets', async (req, res) => {
      const viewer = (req as any).user;
      const { subject, description, category } = req.body;
      if (!subject || !description || !category) {
        return res.status(400).json({ error: 'subject, description, and category are required' });
      }
      state = createTicket(state, { subject, description, category, currentUser: viewer });
      const created = state.tickets[0];
      res.json({ ticket: created });
    });
    
    app.patch('/api/tickets/:id/status', async (req, res) => {
      const viewer = (req as any).user;
      const { newStatus, notes } = req.body;
      if (!newStatus) return res.status(400).json({ error: 'newStatus is required' });
      const before = state;
      state = updateTicketStatus(state, req.params.id, newStatus, viewer, notes);
      if (state === before) return res.status(404).json({ error: 'Ticket not found' });
      const updated = state.tickets.find((t) => t.id === req.params.id);
      res.json({ ticket: updated });
    });
    
    app.patch('/api/tickets/:id/assign', async (req, res) => {
      const viewer = (req as any).user;
      const { staffUserId } = req.body;
      const staffUser = state.users.find((u) => u.id === staffUserId && (u.role === 'IT_STAFF' || u.role === 'ADMINISTRATOR'));
      if (!staffUser) return res.status(400).json({ error: 'Invalid staff user' });
      const before = state;
      state = assignTicket(state, req.params.id, staffUser, viewer);
      if (state === before) return res.status(404).json({ error: 'Ticket not found' });
      const updated = state.tickets.find((t) => t.id === req.params.id);
      res.json({ ticket: updated });
    });
    
    app.post('/api/tickets/:id/comments', async (req, res) => {
      const viewer = (req as any).user;
      const { content, isInternal } = req.body;
      if (!content?.trim()) return res.status(400).json({ error: 'content is required' });
      state = addComment(state, { ticketId: req.params.id, content, isInternal: Boolean(isInternal), currentUser: viewer });
      const comment = state.comments[state.comments.length - 1];
      res.json({ comment });
    });
    
    app.post('/api/users', async (req, res) => {
      const viewer = (req as any).user;
      if (viewer.role !== 'ADMINISTRATOR') return res.status(403).json({ error: 'Admin access required' });
      const { username, name, role, email, branchId, password } = req.body;
      if (!username || !name || !role || !email) {
        return res.status(400).json({ error: 'username, name, role, and email are required' });
      }
      state = createUser(state, { username, name, role, email, branchId, passwordHash: hashPassword(password || DEFAULT_PASSWORD), mustChangePassword: true }, viewer);
      const created = state.users[state.users.length - 1];
      res.json({ user: { ...created, passwordHash: undefined } });
    });
    
    app.post('/api/branches', async (req, res) => {
      const viewer = (req as any).user;
      if (viewer.role !== 'ADMINISTRATOR') return res.status(403).json({ error: 'Admin access required' });
      const { name, location, code } = req.body;
      if (!name || !location) return res.status(400).json({ error: 'branch name and location are required' });
      state = createBranch(state, { name, location, code, status: 'Active' }, viewer);
      const created = state.branches[state.branches.length - 1];
      res.json({ branch: created });
    });
  });
  
  afterAll(async () => {
    await closeDatabase();
  });
  
  beforeEach(async () => {
    await resetState();
    await seedIfEmpty();
    state = await loadState();
    
    branchUser = state.users.find((u) => u.username === 'branch.user')!;
    itStaff = state.users.find((u) => u.username === 'it.staff')!;
    admin = state.users.find((u) => u.username === 'admin')!;
    branch = state.branches[0];
    
    branchUserToken = signToken(branchUser);
    itStaffToken = signToken(itStaff);
    adminToken = signToken(admin);
  });
  
  describe('Health Check', () => {
    it('GET /api/health returns ok', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });
  });
  
  describe('Authentication', () => {
    it('POST /api/auth/login with valid credentials returns token', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'branch.user', password: 'password123' });
      
      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.username).toBe('branch.user');
    }, 10000);
    
    it('POST /api/auth/login with invalid credentials returns 401', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'branch.user', password: 'wrong' });
      
      expect(res.status).toBe(401);
      expect(res.body.error).toBeDefined();
    }, 10000);
  });
  
  describe('State Access', () => {
    it('GET /api/state returns full state for authenticated user', async () => {
      const res = await request(app)
        .get('/api/state')
        .set('Authorization', `Bearer ${branchUserToken}`);
      
      expect(res.status).toBe(200);
      expect(res.body.users).toBeDefined();
      expect(res.body.tickets).toBeDefined();
      expect(res.body.branches).toBeDefined();
      expect(res.body.currentUser).toBeDefined();
    });
    
    it('GET /api/state without token returns 401', async () => {
      const res = await request(app).get('/api/state');
      expect(res.status).toBe(401);
    });
    
    it('GET /api/state filters tickets for branch user', async () => {
      const res = await request(app)
        .get('/api/state')
        .set('Authorization', `Bearer ${branchUserToken}`);
      
      expect(res.status).toBe(200);
      const tickets = res.body.tickets;
      tickets.forEach((ticket: Ticket) => {
        expect(ticket.branchId === branchUser.branchId || ticket.requesterId === branchUser.id).toBe(true);
      });
    });
  });
  
  describe('Ticket Operations', () => {
    it('POST /api/tickets creates a new ticket', async () => {
      const res = await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${branchUserToken}`)
        .send({
          subject: 'Test Ticket',
          description: 'This is a test ticket description',
          category: 'Hardware',
        });
      
      expect(res.status).toBe(200);
      expect(res.body.ticket.subject).toBe('Test Ticket');
      // Ticket is auto-assigned to IT staff, so status becomes 'Assigned'
      expect(['Pending', 'Assigned']).toContain(res.body.ticket.status);
      expect(res.body.ticket.requesterId).toBe(branchUser.id);
      expect(res.body.ticket.branchId).toBe(branchUser.branchId);
    });
    
    it('POST /api/tickets requires subject, description, category', async () => {
      const res = await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${branchUserToken}`)
        .send({ subject: 'Only subject' });
      
      expect(res.status).toBe(400);
    });
    
    it('GET /api/tickets returns tickets for authenticated user', async () => {
      const res = await request(app)
        .get('/api/tickets')
        .set('Authorization', `Bearer ${branchUserToken}`);
      
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.tickets)).toBe(true);
    });
    
    it('PATCH /api/tickets/:id/status updates ticket status', async () => {
      const createRes = await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${branchUserToken}`)
        .send({
          subject: 'Status Test',
          description: 'Testing status update',
          category: 'Software',
        });
      
      const ticketId = createRes.body.ticket.id;
      
      const res = await request(app)
        .patch(`/api/tickets/${ticketId}/status`)
        .set('Authorization', `Bearer ${itStaffToken}`)
        .send({ newStatus: 'Assigned', notes: 'Assigning to IT staff' });
      
      expect(res.status).toBe(200);
      expect(res.body.ticket.status).toBe('Assigned');
    });
    
    it('PATCH /api/tickets/:id/assign assigns ticket to IT staff', async () => {
      const createRes = await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${branchUserToken}`)
        .send({
          subject: 'Assign Test',
          description: 'Testing assignment',
          category: 'Network',
        });
      
      const ticketId = createRes.body.ticket.id;
      
      const res = await request(app)
        .patch(`/api/tickets/${ticketId}/assign`)
        .set('Authorization', `Bearer ${itStaffToken}`)
        .send({ staffUserId: itStaff.id });
      
      expect(res.status).toBe(200);
      expect(res.body.ticket.assignedToId).toBe(itStaff.id);
      expect(res.body.ticket.status).toBe('Assigned');
    });
    
    it('POST /api/tickets/:id/comments adds a comment', async () => {
      const createRes = await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${branchUserToken}`)
        .send({
          subject: 'Comment Test',
          description: 'Testing comments',
          category: 'Access',
        });
      
      const ticketId = createRes.body.ticket.id;
      
      const res = await request(app)
        .post(`/api/tickets/${ticketId}/comments`)
        .set('Authorization', `Bearer ${itStaffToken}`)
        .send({ content: 'Looking into this issue', isInternal: false });
      
      expect(res.status).toBe(200);
      expect(res.body.comment.content).toBe('Looking into this issue');
      expect(res.body.comment.authorId).toBe(itStaff.id);
    });
  });
  
  describe('Role-based Access', () => {
    it('Branch user cannot access admin endpoints', async () => {
      const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${branchUserToken}`)
        .send({
          username: 'newuser',
          name: 'New User',
          role: 'BRANCH_USER',
          email: 'newuser@test.com',
        });
      
      expect(res.status).toBe(403);
    });
    
    it('Admin can create users', async () => {
      const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          username: 'newuser',
          name: 'New User',
          role: 'BRANCH_USER',
          email: 'newuser@test.com',
        });
      
      expect(res.status).toBe(200);
      expect(res.body.user.username).toBe('newuser');
    });
    
    it('Admin can create branches', async () => {
      const res = await request(app)
        .post('/api/branches')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Test Branch',
          location: 'Test Location',
          code: 'TST',
        });
      
      expect(res.status).toBe(200);
      expect(res.body.branch.name).toBe('Test Branch');
    });
  });
  
  describe('Token Verification', () => {
    it('verifyToken returns payload for valid token', () => {
      const payload = verifyToken(branchUserToken);
      expect(payload).not.toBeNull();
      expect(payload?.sub).toBe(branchUser.id);
      expect(payload?.username).toBe(branchUser.username);
    });
    
    it('verifyToken returns null for invalid token', () => {
      const payload = verifyToken('invalid.token.here');
      expect(payload).toBeNull();
    });
  });
});