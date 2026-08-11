/**
 * Client for the Bayanihan Bank IT Service Desk backend.
 *
 * The Express server (server.ts) is the single source of truth. This module
 * keeps a synchronous in-memory mirror (persisted to localStorage) so the UI
 * renders instantly. Mutations hit scoped API endpoints, then the mirror is
 * refreshed from the role-filtered /api/state snapshot.
 *
 * Auth: a JWT (localStorage) is attached as `Authorization: Bearer` to every
 * request. When the API is unreachable the app falls back to the shared pure
 * logic in ./store (demo credentials) so it never hard-crashes in a demo.
 */
import {
  AppState,
  Branch,
  BranchAssignment,
  CategoryInfo,
  Comment,
  Ticket,
  TicketStatus,
  TimelineEvent,
  NotificationItem,
  AuditLog,
  User
} from '../types';
import {
  addComment as localAddComment,
  assignTicket as localAssignTicket,
  createBranch as localCreateBranch,
  createState,
  createTicket as localCreateTicket,
  createUser as localCreateUser,
  deleteBranch as localDeleteBranch,
  deleteUser as localDeleteUser,
  markAllNotificationsAsRead as localMarkAllNotificationsAsRead,
  markNotificationAsRead as localMarkNotificationAsRead,
  updateBranch as localUpdateBranch,
  updateTicketStatus as localUpdateTicketStatus,
  updateStaffAssignments as localUpdateStaffAssignments,
  updateUser as localUpdateUser,
} from './store';
import type {
  CreateBranchParams,
  CreateUserParams,
  UpdateUserChanges,
} from './store';

const CACHE_KEY = 'bb_it_state_v2';
const TOKEN_KEY = 'bb_it_token';
/** Demo credentials used for offline fallback and the role switcher. */
const DEMO_PASSWORD = 'password123';

/** API error carrying the HTTP status when one was received. */
class ApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}

class StorageService {
  private cache: AppState;
  private token: string | null = localStorage.getItem(TOKEN_KEY);

  constructor() {
    this.cache = this.loadFromLocal();
  }

  private loadFromLocal(): AppState {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      try {
        return JSON.parse(raw) as AppState;
      } catch {
        // ignore corrupt cache
      }
    }
    return createState();
  }

  private mirror() {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(this.cache));
    } catch {
      // storage may be full or unavailable
    }
  }

  private clearSession() {
    this.token = null;
    localStorage.removeItem(TOKEN_KEY);
  }

  private async api<T = unknown>(path: string, options?: RequestInit): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options?.headers as Record<string, string> | undefined),
    };
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;

    let res: Response;
    try {
      res = await fetch(path, { ...options, headers });
    } catch (err) {
      // Network failure (API unreachable).
      throw new ApiError('Network error');
    }

    if (res.status === 401) {
      this.clearSession();
      throw new ApiError('Session expired', 401);
    }
    if (!res.ok) {
      throw new ApiError(`API request failed (${res.status})`, res.status);
    }
    return (await res.json()) as T;
  }

  /** Re-fetch the role-filtered snapshot into the local mirror. */
  public async refresh(): Promise<void> {
    if (!this.token) return;
    try {
      this.cache = await this.api<AppState>('/api/state', { method: 'GET' });
      this.mirror();
    } catch {
      // Offline / API not running: keep the local mirror.
    }
  }

  /** Restore an existing session, or prime the demo-account list for login. */
  public async init(): Promise<boolean> {
    if (this.token) {
      try {
        const me = await this.api<{ user: User }>('/api/auth/me', { method: 'GET' });
        await this.refresh();
        this.cache.currentUser = me.user;
        this.mirror();
        return true;
      } catch {
        this.clearSession();
      }
    }
    try {
      const demo = await this.api<{ users: User[] }>('/api/auth/demo-accounts', { method: 'GET' });
      this.cache = { ...this.cache, users: demo.users };
      this.mirror();
    } catch {
      // Offline: keep the local mirror (createState demo users).
    }
    return false;
  }

  public hasSession(): boolean {
    return !!this.token;
  }

  public async login(username: string, password: string): Promise<User> {
    try {
      const res = await this.api<{ token: string; user: User }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      this.token = res.token;
      localStorage.setItem(TOKEN_KEY, res.token);
      this.cache.currentUser = res.user;
      this.mirror();
      return res.user;
    } catch (err) {
      if (err instanceof ApiError && err.status && err.status < 500) throw err;
      // Offline / server error: allow demo accounts with the demo password.
      const matched = this.cache.users.find(
        (u) => u.username.toLowerCase() === username.trim().toLowerCase()
      );
      if (matched && password === DEMO_PASSWORD) {
        this.cache.currentUser = matched;
        this.mirror();
        return matched;
      }
      throw new ApiError('Invalid username or password');
    }
  }

  public async logout(): Promise<void> {
    try {
      await this.api('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore — the token is discarded locally regardless
    }
    this.clearSession();
  }

  /** Self-service password reset request (public, no session required). */
  public async requestPasswordReset(
    username: string
  ): Promise<{ requiresRecoveryKey?: boolean }> {
    return this.api<{ requiresRecoveryKey?: boolean }>('/api/auth/reset-request', {
      method: 'POST',
      body: JSON.stringify({ username }),
    });
  }

  /**
   * Recovery-key password reset for administrator accounts (public). Returns
   * the one-time password issued for the account.
   */
  public async adminRecovery(username: string, key: string): Promise<{ oneTimePassword: string }> {
    return this.api<{ oneTimePassword: string }>('/api/auth/admin-recovery', {
      method: 'POST',
      body: JSON.stringify({ username, key }),
    });
  }

  /** Change the signed-in user's password (verifies the current password). */
  public async changePassword(currentPassword: string, newPassword: string): Promise<User> {
    try {
      const json = await this.api<{ ok: boolean; user: User }>('/api/auth/password', {
        method: 'PATCH',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      await this.refresh();
      this.cache.currentUser = json.user;
      this.mirror();
      return json.user;
    } catch {
      // Offline best-effort: clear the forced-change flag locally.
      this.cache.currentUser = { ...this.cache.currentUser, mustChangePassword: false };
      this.cache.users = this.cache.users.map((u) =>
        u.id === this.cache.currentUser.id ? this.cache.currentUser : u
      );
      this.mirror();
      return this.cache.currentUser;
    }
  }

  /** Demo persona switch: log in as the target account with the demo password. */
  public async impersonate(user: User): Promise<User> {
    try {
      return await this.login(user.username, DEMO_PASSWORD);
    } catch (err) {
      if (err instanceof ApiError && err.status && err.status < 500) throw err;
      this.cache.currentUser = user;
      this.mirror();
      return user;
    }
  }

  // -------------------------------------------------------------------------
  // Reads (synchronous — backed by the in-memory mirror)
  // -------------------------------------------------------------------------

  public getCurrentUser(): User {
    return this.cache.currentUser;
  }

  public getUsers(): User[] {
    return this.cache.users;
  }

  public getBranches(): Branch[] {
    return this.cache.branches;
  }

  public getCategories(): CategoryInfo[] {
    return this.cache.categories;
  }

  public getTickets(): Ticket[] {
    return this.cache.tickets;
  }

  public getTicketById(id: string): Ticket | undefined {
    return this.cache.tickets.find((t) => t.id === id);
  }

  public getComments(ticketId: string): Comment[] {
    return this.cache.comments.filter((c) => c.ticketId === ticketId);
  }

  public getTimeline(ticketId: string): TimelineEvent[] {
    return this.cache.timeline.filter((tl) => tl.ticketId === ticketId);
  }

  public getNotifications(userId: string): NotificationItem[] {
    return this.cache.notifications.filter((n) => n.userId === userId);
  }

  public getAuditLogs(): AuditLog[] {
    return this.cache.auditLogs;
  }

  public getState(): AppState {
    return this.cache;
  }

  // -------------------------------------------------------------------------
  // Writes (asynchronous — API first, local fallback)
  // -------------------------------------------------------------------------

  public async createTicket(params: {
    subject: string;
    description: string;
    category: Ticket['category'];
    attachmentName?: string;
  }): Promise<Ticket> {
    try {
      const json = await this.api<{ ticket: Ticket }>('/api/tickets', {
        method: 'POST',
        body: JSON.stringify(params),
      });
      await this.refresh();
      return json.ticket;
    } catch {
      const next = localCreateTicket(this.cache, { ...params, currentUser: this.cache.currentUser });
      this.cache = next;
      this.mirror();
      return next.tickets[0];
    }
  }

  public async updateTicketStatus(
    ticketId: string,
    newStatus: TicketStatus,
    notes?: string
  ): Promise<Ticket | undefined> {
    try {
      const json = await this.api<{ ticket?: Ticket }>(`/api/tickets/${ticketId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ newStatus, notes }),
      });
      await this.refresh();
      return json.ticket ?? this.cache.tickets.find((t) => t.id === ticketId);
    } catch {
      this.cache = localUpdateTicketStatus(this.cache, ticketId, newStatus, this.cache.currentUser, notes);
      this.mirror();
      return this.cache.tickets.find((t) => t.id === ticketId);
    }
  }

  public async assignTicket(ticketId: string, staffUser: User): Promise<Ticket | undefined> {
    try {
      const json = await this.api<{ ticket?: Ticket }>(`/api/tickets/${ticketId}/assign`, {
        method: 'PATCH',
        body: JSON.stringify({ staffUserId: staffUser.id }),
      });
      await this.refresh();
      return json.ticket ?? this.cache.tickets.find((t) => t.id === ticketId);
    } catch {
      this.cache = localAssignTicket(this.cache, ticketId, staffUser, this.cache.currentUser);
      this.mirror();
      return this.cache.tickets.find((t) => t.id === ticketId);
    }
  }

  public async addComment(params: {
    ticketId: string;
    content: string;
    isInternal: boolean;
  }): Promise<Comment> {
    try {
      const json = await this.api<{ comment: Comment }>(`/api/tickets/${params.ticketId}/comments`, {
        method: 'POST',
        body: JSON.stringify({ content: params.content, isInternal: params.isInternal }),
      });
      await this.refresh();
      return json.comment;
    } catch {
      const next = localAddComment(this.cache, { ...params, currentUser: this.cache.currentUser });
      this.cache = next;
      this.mirror();
      return next.comments[next.comments.length - 1];
    }
  }

  public async markNotificationAsRead(id: string): Promise<void> {
    try {
      await this.api(`/api/notifications/${id}/read`, { method: 'POST' });
      await this.refresh();
    } catch {
      this.cache = localMarkNotificationAsRead(this.cache, id);
      this.mirror();
    }
  }

  public async markAllNotificationsRead(userId: string): Promise<void> {
    try {
      await this.api('/api/notifications/read-all', { method: 'POST' });
      await this.refresh();
    } catch {
      this.cache = localMarkAllNotificationsAsRead(this.cache, userId);
      this.mirror();
    }
  }

  public async createUser(user: CreateUserParams): Promise<User> {
    try {
      const json = await this.api<{ user: User }>('/api/users', {
        method: 'POST',
        body: JSON.stringify({ user }),
      });
      await this.refresh();
      return json.user;
    } catch {
      const next = localCreateUser(this.cache, user, this.cache.currentUser);
      this.cache = next;
      this.mirror();
      return next.users[next.users.length - 1];
    }
  }

  public async updateUser(userId: string, changes: UpdateUserChanges): Promise<User | undefined> {
    try {
      const json = await this.api<{ user?: User }>(`/api/users/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify({ changes }),
      });
      await this.refresh();
      return json.user ?? this.cache.users.find((u) => u.id === userId);
    } catch {
      this.cache = localUpdateUser(this.cache, userId, changes, this.cache.currentUser);
      this.mirror();
      return this.cache.users.find((u) => u.id === userId);
    }
  }

  public async deleteUser(userId: string): Promise<boolean> {
    try {
      await this.api(`/api/users/${userId}`, { method: 'DELETE' });
      await this.refresh();
      return true;
    } catch {
      const before = this.cache;
      this.cache = localDeleteUser(this.cache, userId, this.cache.currentUser);
      this.mirror();
      return this.cache !== before;
    }
  }

  public async updateStaffAssignments(
    staffUserId: string,
    assignments: BranchAssignment[]
  ): Promise<User | undefined> {
    try {
      const json = await this.api<{ user?: User }>(`/api/users/${staffUserId}/assignments`, {
        method: 'PATCH',
        body: JSON.stringify({ assignments }),
      });
      await this.refresh();
      return json.user ?? this.cache.users.find((u) => u.id === staffUserId);
    } catch {
      this.cache = localUpdateStaffAssignments(this.cache, staffUserId, assignments, this.cache.currentUser);
      this.mirror();
      return this.cache.users.find((u) => u.id === staffUserId);
    }
  }

  public async createBranch(branch: CreateBranchParams): Promise<Branch> {
    try {
      const json = await this.api<{ branch: Branch }>('/api/branches', {
        method: 'POST',
        body: JSON.stringify({ branch }),
      });
      await this.refresh();
      return json.branch;
    } catch {
      const next = localCreateBranch(this.cache, branch, this.cache.currentUser);
      this.cache = next;
      this.mirror();
      return next.branches[next.branches.length - 1];
    }
  }

  public async updateBranch(branchId: string, changes: Partial<Branch>): Promise<Branch | undefined> {
    try {
      const json = await this.api<{ branch?: Branch }>(`/api/branches/${branchId}`, {
        method: 'PATCH',
        body: JSON.stringify({ changes }),
      });
      await this.refresh();
      return json.branch ?? this.cache.branches.find((b) => b.id === branchId);
    } catch {
      this.cache = localUpdateBranch(this.cache, branchId, changes, this.cache.currentUser);
      this.mirror();
      return this.cache.branches.find((b) => b.id === branchId);
    }
  }

  public async deleteBranch(branchId: string): Promise<boolean> {
    try {
      await this.api(`/api/branches/${branchId}`, { method: 'DELETE' });
      await this.refresh();
      return true;
    } catch {
      const before = this.cache;
      this.cache = localDeleteBranch(this.cache, branchId, this.cache.currentUser);
      this.mirror();
      return this.cache !== before;
    }
  }

  public async resetToDefaults(): Promise<void> {
    try {
      await this.api('/api/reset', { method: 'POST' });
      await this.refresh();
    } catch {
      this.cache = createState();
      this.mirror();
    }
  }
}

export const storage = new StorageService();
