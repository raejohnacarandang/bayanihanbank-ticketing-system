/**
 * Client for the Bayanihan Bank IT Service Desk backend.
 *
 * The PHP backend (php-backend/) is the single source of truth. This module
 * keeps a synchronous in-memory mirror (persisted to localStorage) so the UI
 * renders instantly. Mutations hit scoped API endpoints, then the mirror is
 * refreshed from the role-filtered /api/state snapshot.
 *
 * Auth: a JWT (localStorage) is attached as `Authorization: Bearer` to every
 * request. When the API is unreachable the app falls back to the shared pure
 * logic in ./store so it never hard-crashes offline.
 */
import {
  AppState,
  Branch,
  BranchAssignment,
  BranchHealth,
  BranchHealthDaily,
  BranchSystem,
  CategoryInfo,
  Comment,
  DailySnapshotDate,
  InternetSpeedLog,
  MonitoredEndpoint,
  SystemHealthStatus,
  Ticket,
  TicketStatus,
  TimelineEvent,
  NotificationItem,
  AuditLog,
  User,
} from "../types";
import {
  addComment as localAddComment,
  assignTicket as localAssignTicket,
  createBranch as localCreateBranch,
  createCategory as localCreateCategory,
  createState,
  createTicket as localCreateTicket,
  createUser as localCreateUser,
  deleteBranch as localDeleteBranch,
  deleteTicket as localDeleteTicket,
  deleteUser as localDeleteUser,
  markAllNotificationsAsRead as localMarkAllNotificationsAsRead,
  markNotificationAsRead as localMarkNotificationAsRead,
  setCurrentUser as localSetCurrentUser,
  updateBranch as localUpdateBranch,
  updateCategory as localUpdateCategory,
  updateStaffAssignments as localUpdateStaffAssignments,
  updateTicketStatus as localUpdateTicketStatus,
  updateUser as localUpdateUser,
  updateBranchHealth as localUpdateBranchHealth,
} from "./store";
import type {
  CreateBranchParams,
  CreateCategoryParams,
  CreateUserParams,
  UpdateCategoryChanges,
  UpdateUserChanges,
  UpdateBranchHealthChanges,
} from "./store";
import {
  enqueueMutation,
  startSyncProcessor,
  QueuedMutation,
  getPendingMutations,
} from "./offlineQueue";

const CACHE_KEY = "bb_it_state_v2";
const TOKEN_KEY = "bb_it_token";
const CSRF_KEY = "bb_it_csrf";

/**
 * Pull the server's `error` field out of a failed response, falling back to
 * `fallback` when the body is not the JSON we expect.
 */
async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string } | null;
    if (data?.error) return data.error;
  } catch {
    // non-JSON error body — keep the fallback
  }
  return fallback;
}

/** API error carrying the HTTP status when one was received. */
export class ApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}

class StorageService {
  private cache: AppState;
  private token: string | null = localStorage.getItem(TOKEN_KEY);
  private csrfToken: string | null = localStorage.getItem(CSRF_KEY);
  private pendingRequests = 0;
  private readonly pendingListeners = new Set<(count: number) => void>();
  private readonly dailySnapshotCache = new Map<
    string,
    {
      date: string;
      previousDate: string;
      availableDates: DailySnapshotDate[];
      snapshots: BranchHealthDaily[];
      previousSnapshots: BranchHealthDaily[];
    }
  >();

  constructor() {
    this.cache = this.loadFromLocal();
    this.startOfflineSync();
  }

  private startOfflineSync(): void {
    startSyncProcessor(async (mutation) => {
      if (mutation.type === 'updateBranchHealth') {
        const { branchId, changes } = mutation.payload as { branchId: string; changes: UpdateBranchHealthChanges };
        const json = await this.api<{ branchHealth?: BranchHealth }>(
          `/api/monitoring/${branchId}`,
          {
            method: "PATCH",
            body: JSON.stringify(changes),
          },
        );
        if (json.branchHealth) {
          const idx = this.cache.branchHealth.findIndex(
            (h) => h.branchId === branchId && h.system === changes.system,
          );
          if (idx >= 0) this.cache.branchHealth[idx] = json.branchHealth;
          else this.cache.branchHealth.push(json.branchHealth);
          this.mirror();
        }
      }
    });
  }

  /** Number of in-flight (non-silent) API requests. */
  public getPendingCount(): number {
    return this.pendingRequests;
  }

  /** Subscribe to in-flight request count changes. Returns an unsubscribe fn. */
  public onPendingChange(cb: (count: number) => void): () => void {
    this.pendingListeners.add(cb);
    return () => {
      this.pendingListeners.delete(cb);
    };
  }

  private trackPending(delta: number): void {
    this.pendingRequests = Math.max(0, this.pendingRequests + delta);
    for (const cb of this.pendingListeners) cb(this.pendingRequests);
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

  /**
   * Obtain a CSRF token from the server. The token is issued as an HttpOnly
   * cookie plus an `X-CSRF-Token` response header on every safe request, so we
   * grab it from a lightweight unauthenticated endpoint and echo it back as an
   * `x-csrf-token` header on state-changing requests (the SPA usage documented
   * in src/server/csrf.ts for the former Node backend).
   */
  private async ensureCsrfToken(): Promise<void> {
    if (this.csrfToken) return;
    try {
      // The issued X-CSRF-Token header is captured inside api() itself.
      await this.api("/api/health", undefined, true);
    } catch {
      // API unreachable — mutations will fall back to the local mirror.
    }
  }

  private async api<T = unknown>(
    path: string,
    options?: RequestInit,
    silent = false,
    isRetry = false,
    isAuthAttempt = false,
  ): Promise<T> {
    const method = (options?.method ?? "GET").toUpperCase();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options?.headers as Record<string, string> | undefined),
    };
    if (this.token) headers["Authorization"] = `Bearer ${this.token}`;
    if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
      await this.ensureCsrfToken();
      if (this.csrfToken) headers["x-csrf-token"] = this.csrfToken;
    }

    if (!silent) this.trackPending(1);
    try {
      let res: Response;
      try {
        res = await fetch(path, { ...options, headers });
      } catch {
        // Network failure (API unreachable).
        throw new ApiError("Network error");
      }

      const issuedCsrf = res.headers.get("X-CSRF-Token");
      if (issuedCsrf) {
        this.csrfToken = issuedCsrf;
        localStorage.setItem(CSRF_KEY, issuedCsrf);
      }

      if (res.status === 401) {
        // On a credential check, 401 means "wrong username or password" — not
        // an expired session. Surface the server's wording and leave any
        // existing session alone so the caller can present it correctly.
        if (isAuthAttempt) {
          throw new ApiError(
            await readErrorMessage(res, "Invalid username or password."),
            401,
          );
        }
        this.clearSession();
        throw new ApiError("Session expired", 401);
      }
      if (res.status === 403 && this.csrfToken && !isRetry) {
        this.csrfToken = null;
        localStorage.removeItem(CSRF_KEY);
        return this.api<T>(path, options, silent, true, isAuthAttempt);
      }
      if (!res.ok) {
        throw new ApiError(
          await readErrorMessage(res, `API request failed (${res.status})`),
          res.status,
        );
      }
      try {
        return (await res.json()) as T;
      } catch {
        // A 2xx body that is not JSON means the request never reached the API
        // (a proxy/HTML error page, or PHP writing a plain-text fault before
        // the router runs). Report it as a server fault instead of letting a
        // raw SyntaxError escape and get mislabelled as bad credentials.
        throw new ApiError(
          "The server returned an unexpected response. Please try again.",
          res.status,
        );
      }
    } finally {
      if (!silent) this.trackPending(-1);
    }
  }

  /** A fetch failure with no HTTP status means the API is unreachable. */
  private isNetworkError(err: unknown): boolean {
    return err instanceof ApiError && err.status === undefined;
  }

  /** Re-fetch the role-filtered snapshot into the local mirror. */
  public async refresh(): Promise<void> {
    if (!this.token) return;
    try {
      this.cache = await this.api<AppState>("/api/state", { method: "GET" }, true);
      this.mirror();
    } catch {
      // Offline / API not running: keep the local mirror.
    }
  }

  /** Restore an existing session. Returns true when a valid session was found. */
  public async init(): Promise<boolean> {
    if (this.token) {
      try {
        const me = await this.api<{ user: User }>("/api/auth/me", {
          method: "GET",
        });
        await this.refresh();
        this.cache.currentUser = me.user;
        this.mirror();
        return true;
      } catch {
        this.clearSession();
      }
    }
    return false;
  }

  public hasSession(): boolean {
    return !!this.token;
  }

  public async login(username: string, password: string): Promise<User> {
    let res: { token: string; user: User };
    try {
      res = await this.api<{ token: string; user: User }>(
        "/api/auth/login",
        {
          method: "POST",
          body: JSON.stringify({ username, password }),
        },
        false,
        false,
        true,
      );
    } catch (err) {
      // Authentication is always decided by the server. A network failure or a
      // 5xx must never fall back to a local decision, otherwise anyone who knows
      // a username could sign in whenever the API is unreachable.
      if (!(err instanceof ApiError)) throw err;

      // No HTTP status at all — the request never got a reply.
      if (err.status === undefined) {
        throw new ApiError(
          "Cannot reach the server. Check your connection and try again.",
        );
      }
      // 401 is a genuine credential rejection.
      if (err.status === 401) {
        throw new ApiError("Invalid username or password.", 401);
      }
      // Anything else is the server failing, not the user typing a bad
      // password. Say so, and keep it distinguishable so the login screen does
      // not report a broken backend as bad credentials.
      throw new ApiError(
        "Sign-in is temporarily unavailable. Please try again shortly.",
        err.status,
      );
    }
    this.token = res.token;
    localStorage.setItem(TOKEN_KEY, res.token);
    this.cache.currentUser = res.user;
    this.mirror();
    return res.user;
  }

  public async logout(): Promise<void> {
    try {
      await this.api("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore — the token is discarded locally regardless
    }
    this.clearSession();
  }

  /** Self-service password reset request (public, no session required). */
  public async requestPasswordReset(
    username: string,
  ): Promise<{ requiresRecoveryKey?: boolean }> {
    return this.api<{ requiresRecoveryKey?: boolean }>(
      "/api/auth/reset-request",
      {
        method: "POST",
        body: JSON.stringify({ username }),
      },
    );
  }

  /**
   * Recovery-key password reset for administrator accounts (public). Returns
   * the one-time password issued for the account.
   */
  public async adminRecovery(
    username: string,
    key: string,
  ): Promise<{ oneTimePassword: string }> {
    return this.api<{ oneTimePassword: string }>("/api/auth/admin-recovery", {
      method: "POST",
      body: JSON.stringify({ username, key }),
    });
  }

  /** Change the signed-in user's password (verifies the current password). */
  public async changePassword(
    currentPassword: string,
    newPassword: string,
  ): Promise<User> {
    try {
      const json = await this.api<{ ok: boolean; user: User }>(
        "/api/auth/password",
        {
          method: "PATCH",
          body: JSON.stringify({ currentPassword, newPassword }),
        },
      );
      await this.refresh();
      this.cache.currentUser = json.user;
      this.mirror();
      return json.user;
    } catch (err) {
      // Re-throw real API failures (wrong current password, CSRF, server
      // errors) so the UI can show them instead of a misleading success.
      // Only a pure network failure falls back to the local mirror.
      if (!this.isNetworkError(err)) throw err;
      // Offline best-effort: clear the forced-change flag locally. The server
      // remains the source of truth, so the change only applies once online.
      this.cache.currentUser = {
        ...this.cache.currentUser,
        mustChangePassword: false,
      };
      this.cache.users = this.cache.users.map((u) =>
        u.id === this.cache.currentUser.id ? this.cache.currentUser : u,
      );
      this.mirror();
      return this.cache.currentUser;
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

  public getBranchHealth(): BranchHealth[] {
    return this.cache.branchHealth;
  }

  public getInternetSpeedLogs(branchId?: string): InternetSpeedLog[] {
    const logs = this.cache.internetSpeedLogs ?? [];
    return branchId ? logs.filter((l) => l.branchId === branchId) : logs;
  }

  public getMonitoredEndpoints(): MonitoredEndpoint[] {
    return this.cache.monitoredEndpoints ?? [];
  }

  /**
   * End-of-day branch health for one day, plus the days that have a snapshot.
   * Fetched on demand rather than held in AppState because it is date-scoped
   * and grows with the retention window. Cached per date so flipping back and
   * forth between days does not re-hit the API.
   */
  public async getDailySnapshot(date?: string): Promise<{
    date: string;
    previousDate: string;
    availableDates: DailySnapshotDate[];
    snapshots: BranchHealthDaily[];
    previousSnapshots: BranchHealthDaily[];
  }> {
    const key = date ?? "latest";
    const cached = this.dailySnapshotCache.get(key);
    if (cached) return cached;

    const query = date ? `?date=${encodeURIComponent(date)}` : "";
    const json = await this.api<{
      date?: string;
      previousDate?: string;
      availableDates?: DailySnapshotDate[];
      snapshots?: BranchHealthDaily[];
      previousSnapshots?: BranchHealthDaily[];
    }>(`/api/monitoring/daily${query}`);

    const result = {
      date: json.date ?? "",
      previousDate: json.previousDate ?? "",
      availableDates: json.availableDates ?? [],
      snapshots: json.snapshots ?? [],
      previousSnapshots: json.previousSnapshots ?? [],
    };
    this.dailySnapshotCache.set(key, result);
    return result;
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
    category: Ticket["category"];
    subcategory?: string;
    attachmentName?: string;
    requesterName?: string;
  }): Promise<Ticket> {
    try {
      const json = await this.api<{ ticket: Ticket }>("/api/tickets", {
        method: "POST",
        body: JSON.stringify(params),
      });
      await this.refresh();
      return json.ticket;
    } catch {
      const next = localCreateTicket(this.cache, {
        ...params,
        currentUser: this.cache.currentUser,
      });
      this.cache = next;
      this.mirror();
      return next.tickets[0];
    }
  }

  public async updateTicketStatus(
    ticketId: string,
    newStatus: TicketStatus,
    notes?: string,
  ): Promise<Ticket | undefined> {
    try {
      const json = await this.api<{ ticket?: Ticket }>(
        `/api/tickets/${ticketId}/status`,
        {
          method: "PATCH",
          body: JSON.stringify({ newStatus, notes }),
        },
      );
      await this.refresh();
      return json.ticket ?? this.cache.tickets.find((t) => t.id === ticketId);
    } catch {
      this.cache = localUpdateTicketStatus(
        this.cache,
        ticketId,
        newStatus,
        this.cache.currentUser,
        notes,
      );
      this.mirror();
      return this.cache.tickets.find((t) => t.id === ticketId);
    }
  }

  public async assignTicket(
    ticketId: string,
    staffUser: User,
  ): Promise<Ticket | undefined> {
    try {
      const json = await this.api<{ ticket?: Ticket }>(
        `/api/tickets/${ticketId}/assign`,
        {
          method: "PATCH",
          body: JSON.stringify({ staffUserId: staffUser.id }),
        },
      );
      await this.refresh();
      return json.ticket ?? this.cache.tickets.find((t) => t.id === ticketId);
    } catch {
      this.cache = localAssignTicket(
        this.cache,
        ticketId,
        staffUser,
        this.cache.currentUser,
      );
      this.mirror();
      return this.cache.tickets.find((t) => t.id === ticketId);
    }
  }

  public async deleteTicket(ticketId: string): Promise<boolean> {
    try {
      await this.api(`/api/tickets/${ticketId}`, { method: "DELETE" });
      await this.refresh();
      return true;
    } catch (err) {
      if (!this.isNetworkError(err)) throw err;
      const before = this.cache;
      this.cache = localDeleteTicket(this.cache, ticketId, this.cache.currentUser);
      this.mirror();
      return this.cache !== before;
    }
  }

  public async addComment(params: {
    ticketId: string;
    content: string;
    isInternal: boolean;
  }): Promise<Comment> {
    try {
      const json = await this.api<{ comment: Comment }>(
        `/api/tickets/${params.ticketId}/comments`,
        {
          method: "POST",
          body: JSON.stringify({
            content: params.content,
            isInternal: params.isInternal,
          }),
        },
      );
      await this.refresh();
      return json.comment;
    } catch {
      const next = localAddComment(this.cache, {
        ...params,
        currentUser: this.cache.currentUser,
      });
      this.cache = next;
      this.mirror();
      return next.comments[next.comments.length - 1];
    }
  }

  public async markNotificationAsRead(id: string): Promise<void> {
    try {
      await this.api(`/api/notifications/${id}/read`, { method: "POST" });
      await this.refresh();
    } catch {
      this.cache = localMarkNotificationAsRead(this.cache, id);
      this.mirror();
    }
  }

  public async markAllNotificationsRead(userId: string): Promise<void> {
    try {
      await this.api("/api/notifications/read-all", { method: "POST" });
      await this.refresh();
    } catch {
      this.cache = localMarkAllNotificationsAsRead(this.cache, userId);
      this.mirror();
    }
  }

  public async createUser(user: CreateUserParams): Promise<User> {
    try {
      const json = await this.api<{ user: User }>("/api/users", {
        method: "POST",
        body: JSON.stringify(user),
      });
      await this.refresh();
      return json.user;
    } catch (err) {
      if (!this.isNetworkError(err)) throw err;
      const next = localCreateUser(this.cache, user, this.cache.currentUser);
      this.cache = next;
      this.mirror();
      return next.users[next.users.length - 1];
    }
  }

  public async updateUser(
    userId: string,
    changes: UpdateUserChanges,
  ): Promise<User | undefined> {
    try {
      const json = await this.api<{ user?: User }>(`/api/users/${userId}`, {
        method: "PATCH",
        body: JSON.stringify(changes),
      });
      await this.refresh();
      return json.user ?? this.cache.users.find((u) => u.id === userId);
    } catch (err) {
      if (!this.isNetworkError(err)) throw err;
      this.cache = localUpdateUser(
        this.cache,
        userId,
        changes,
        this.cache.currentUser,
      );
      this.mirror();
      return this.cache.users.find((u) => u.id === userId);
    }
  }

  public async deleteUser(userId: string): Promise<boolean> {
    try {
      await this.api(`/api/users/${userId}`, { method: "DELETE" });
      await this.refresh();
      return true;
    } catch (err) {
      if (!this.isNetworkError(err)) throw err;
      const before = this.cache;
      this.cache = localDeleteUser(this.cache, userId, this.cache.currentUser);
      this.mirror();
      return this.cache !== before;
    }
  }

  public async updateStaffAssignments(
    staffUserId: string,
    assignments: BranchAssignment[],
  ): Promise<User | undefined> {
    try {
      const json = await this.api<{ user?: User }>(
        `/api/users/${staffUserId}/assignments`,
        {
          method: "PATCH",
          body: JSON.stringify({ assignments }),
        },
      );
      await this.refresh();
      return json.user ?? this.cache.users.find((u) => u.id === staffUserId);
    } catch (err) {
      if (!this.isNetworkError(err)) throw err;
      this.cache = localUpdateStaffAssignments(
        this.cache,
        staffUserId,
        assignments,
        this.cache.currentUser,
      );
      this.mirror();
      return this.cache.users.find((u) => u.id === staffUserId);
    }
  }

  public async createBranch(branch: CreateBranchParams): Promise<Branch> {
    try {
      const json = await this.api<{ branch: Branch }>("/api/branches", {
        method: "POST",
        body: JSON.stringify(branch),
      });
      await this.refresh();
      return json.branch;
    } catch (err) {
      if (!this.isNetworkError(err)) throw err;
      const next = localCreateBranch(
        this.cache,
        branch,
        this.cache.currentUser,
      );
      this.cache = next;
      this.mirror();
      return next.branches[next.branches.length - 1];
    }
  }

  public async createCategory(
    category: CreateCategoryParams,
  ): Promise<CategoryInfo> {
    try {
      const json = await this.api<{ category: CategoryInfo }>(
        "/api/categories",
        {
          method: "POST",
          body: JSON.stringify(category),
        },
      );
      await this.refresh();
      return json.category;
    } catch (err) {
      if (!this.isNetworkError(err)) throw err;
      const next = localCreateCategory(
        this.cache,
        category,
        this.cache.currentUser,
      );
      this.cache = next;
      this.mirror();
      return next.categories[next.categories.length - 1];
    }
  }

  public async updateCategory(
    categoryId: string,
    changes: UpdateCategoryChanges,
  ): Promise<CategoryInfo | undefined> {
    try {
      const json = await this.api<{ category?: CategoryInfo }>(
        `/api/categories/${categoryId}`,
        {
          method: "PATCH",
          body: JSON.stringify(changes),
        },
      );
      await this.refresh();
      return (
        json.category ??
        this.cache.categories.find((c) => c.id === categoryId)
      );
    } catch (err) {
      if (!this.isNetworkError(err)) throw err;
      this.cache = localUpdateCategory(
        this.cache,
        categoryId,
        changes,
        this.cache.currentUser,
      );
      this.mirror();
      return this.cache.categories.find((c) => c.id === categoryId);
    }
  }

  public async updateBranch(
    branchId: string,
    changes: Partial<Branch>,
  ): Promise<Branch | undefined> {
    try {
      const json = await this.api<{ branch?: Branch }>(
        `/api/branches/${branchId}`,
        {
          method: "PATCH",
          body: JSON.stringify(changes),
        },
      );
      await this.refresh();
      return json.branch ?? this.cache.branches.find((b) => b.id === branchId);
    } catch (err) {
      if (!this.isNetworkError(err)) throw err;
      this.cache = localUpdateBranch(
        this.cache,
        branchId,
        changes,
        this.cache.currentUser,
      );
      this.mirror();
      return this.cache.branches.find((b) => b.id === branchId);
    }
  }

  public async deleteBranch(branchId: string): Promise<boolean> {
    try {
      await this.api(`/api/branches/${branchId}`, { method: "DELETE" });
      await this.refresh();
      return true;
    } catch (err) {
      if (!this.isNetworkError(err)) throw err;
      const before = this.cache;
      this.cache = localDeleteBranch(
        this.cache,
        branchId,
        this.cache.currentUser,
      );
      this.mirror();
      return this.cache !== before;
    }
  }

  public async updateBranchHealth(
    branchId: string,
    changes: UpdateBranchHealthChanges,
  ): Promise<BranchHealth | undefined> {
    try {
      const json = await this.api<{ branchHealth?: BranchHealth }>(
        `/api/monitoring/${branchId}`,
        {
          method: "PATCH",
          body: JSON.stringify(changes),
        },
      );
      await this.refresh();
      return (
        json.branchHealth ??
        this.cache.branchHealth.find(
          (h) => h.branchId === branchId && h.system === changes.system,
        )
      );
    } catch (err) {
      if (!this.isNetworkError(err)) throw err;
      // Enqueue for background sync
      await enqueueMutation('updateBranchHealth', { branchId, changes });
      // Apply locally immediately
      this.cache = localUpdateBranchHealth(
        this.cache,
        branchId,
        changes,
        this.cache.currentUser,
      );
      this.mirror();
      return this.cache.branchHealth.find(
        (h) => h.branchId === branchId && h.system === changes.system,
      );
    }
  }

  public async bulkUpdateBranchHealth(
    system: BranchSystem,
    options: {
      status?: SystemHealthStatus;
      totalUnits?: number | null;
      workingUnits?: number | null;
      internetSpeed?: string | null;
      notes?: string | null;
      branchIds?: string[];
    }
  ): Promise<{ updated: number; results: BranchHealth[] }> {
    const json = await this.api<{ updated: number; results: BranchHealth[] }>(
      "/api/monitoring/bulk",
      {
        method: "POST",
        body: JSON.stringify({ system, ...options }),
      },
    );
    await this.refresh();
    return json;
  }
}

export const storage = new StorageService();
