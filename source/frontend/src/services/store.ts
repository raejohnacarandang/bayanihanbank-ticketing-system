/**
 * Pure application state logic shared by the Express server and the browser.
 * No DOM / Node dependencies — safe to run in vitest, tsx, or the Vite bundle.
 */
import {
  AppState,
  AuditLog,
  Branch,
  BranchAssignment,
  BranchHealth,
  BranchSystem,
  CategoryInfo,
  Comment,
  InternetSpeedLog,
  NotificationItem,
  SystemHealthStatus,
  Ticket,
  TicketCategory,
  TicketPriority,
  TicketStatus,
  TimelineEvent,
  User,
  UserRole
} from '../types';

// ---------------------------------------------------------------------------
// State construction
// ---------------------------------------------------------------------------

/**
 * Empty application state. The PHP backend is the single source of truth, so
 * this holds no seed data — it is only the mirror used before the first
 * /api/state snapshot arrives (or while offline with no cached state).
 */
export function createState(): AppState {
  return {
    tickets: [],
    comments: [],
    timeline: [],
    notifications: [],
    auditLogs: [],
    users: [],
    branches: [],
    categories: [],
    branchHealth: [],
    internetSpeedLogs: [],
    monitoredEndpoints: [],
    currentUser: {
      id: '',
      username: '',
      name: '',
      role: 'BRANCH_USER',
      email: '',
    },
    ticketCounter: 1,
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

export function nowDisplay(): string {
  return new Date().toLocaleString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export function nowIso(): string {
  return new Date().toISOString();
}

let idSeq = 0;

const nextId = (prefix: string, state: AppState): string =>
  `${prefix}-${Date.now()}-${state.ticketCounter}-${++idSeq % 100000}`;

function withTimeline(state: AppState, event: Omit<TimelineEvent, 'id' | 'timestamp'>): AppState {
  const timeline: TimelineEvent[] = [
    ...state.timeline,
    { id: nextId('tl', state), timestamp: nowDisplay(), ...event },
  ];
  return { ...state, timeline };
}

function withAudit(state: AppState, log: Omit<AuditLog, 'id' | 'timestamp'>): AppState {
  const auditLogs: AuditLog[] = [
    ...state.auditLogs,
    { id: nextId('aud', state), timestamp: nowIso().replace('T', ' ').substring(0, 19), ...log },
  ];
  return { ...state, auditLogs };
}

function withNotification(
  state: AppState,
  notification: Omit<NotificationItem, 'id' | 'timestamp' | 'read'>
): AppState {
  const notifications: NotificationItem[] = [
    { id: nextId('notif', state), timestamp: nowDisplay(), read: false, ...notification },
    ...state.notifications,
  ];
  return { ...state, notifications };
}

// ---------------------------------------------------------------------------
// Auto-assignment (branch coverage)
// ---------------------------------------------------------------------------

export function isAssignmentActive(assignment: BranchAssignment, now: Date = new Date()): boolean {
  const expires = Date.parse(assignment.expiresAt);
  if (Number.isNaN(expires)) return true;
  return expires > now.getTime();
}

/**
 * Returns the IT specialist member whose active branch assignment covers the given
 * branch. When multiple staff cover the branch, the least-loaded one (fewest
 * open tickets) is preferred for load balancing.
 */
export function findAssignableItStaff(state: AppState, branchId: string): User | undefined {
  const candidates = state.users.filter(
    (u) =>
      u.role === 'IT_STAFF' &&
      (u.assignments ?? []).some((a) => a.branchId === branchId && isAssignmentActive(a))
  );
  if (candidates.length === 0) return undefined;

  const openTicketsFor = (u: User): number =>
    state.tickets.filter(
      (t) => t.assignedToId === u.id && t.status === 'In Progress'
    ).length;

  return [...candidates].sort((a, b) => openTicketsFor(a) - openTicketsFor(b))[0];
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export interface CreateTicketParams {
  subject: string;
  description: string;
  category: TicketCategory;
  subcategory?: string;
  attachmentName?: string;
  currentUser: User;
  requesterName?: string;
}

function getPriorityFromCategory(category: TicketCategory): TicketPriority {
  const criticalCategories = ['Network', 'Account & Access'];
  const highCategories = ['Hardware', 'Installation / Configuration', 'IT Equipment'];
  const mediumCategories = ['Software'];
  
  if (criticalCategories.includes(category)) return 'Critical';
  if (highCategories.includes(category)) return 'High';
  if (mediumCategories.includes(category)) return 'Medium';
  return 'Low';
}

function getSLADuration(priority: TicketPriority): number {
  switch (priority) {
    case 'Critical': return 4 * 60 * 60 * 1000; // 4 hours
    case 'High': return 8 * 60 * 60 * 1000; // 8 hours
    case 'Medium': return 24 * 60 * 60 * 1000; // 24 hours
    case 'Low': return 48 * 60 * 60 * 1000; // 48 hours
  }
}

export function createTicket(state: AppState, params: CreateTicketParams): AppState {
  const desc = params.description.trim();
  if (!desc) throw new Error('Description is required');
  if (desc.length < 20) throw new Error('Description must be at least 20 characters long');
  if (!/[a-zA-Z]/.test(desc)) throw new Error('Description must contain at least one letter');

  const id = `IT-${String(state.ticketCounter).padStart(6, '0')}`;
  const nowStr = nowDisplay();
  const nowISO = nowIso();

  // Auto-assign to the IT specialist member whose active branch assignment covers
  // the requester's branch (least-loaded when multiple staff cover it).
  const assignedStaff = params.currentUser.branchId
    ? findAssignableItStaff(state, params.currentUser.branchId)
    : undefined;

  const priority = getPriorityFromCategory(params.category);
  const slaDuration = getSLADuration(priority);
  const slaDeadline = new Date(nowISO);
  slaDeadline.setTime(slaDeadline.getTime() + slaDuration);

  const ticket: Ticket = {
    id,
    subject: params.subject,
    description: params.description,
    category: params.category,
    subcategory: params.subcategory?.trim() || undefined,
    status: 'In Progress',
    priority,
    requesterId: params.currentUser.id,
    requesterName: params.requesterName ?? params.currentUser.name,
    branchId: params.currentUser.branchId || 'br-001',
    branchName: params.currentUser.branchName || 'Alabang',
    assignedToId: assignedStaff?.id,
    assignedToName: assignedStaff?.name,
    createdAt: nowStr,
    createdAtISO: nowISO,
    updatedAt: nowStr,
    slaDeadline: slaDeadline.toISOString(),
    escalated: false,
    attachments: params.attachmentName
      ? [
          {
            id: `att-${Date.now()}`,
            filename: params.attachmentName,
            filesize: '1.4 MB',
            filetype: 'document',
          },
        ]
      : undefined,
  };

  let next: AppState = {
    ...state,
    tickets: [ticket, ...state.tickets],
    ticketCounter: state.ticketCounter + 1,
  };

  next = withTimeline(next, {
    ticketId: id,
    actorName: params.currentUser.name,
    actorRole: params.currentUser.role,
    action: 'Ticket submitted',
    details: `Category: ${params.category}${params.subcategory ? ` / Subcategory: ${params.subcategory}` : ''}`,
    type: 'creation',
  });

  next = withAudit(next, {
    actorName: params.currentUser.name,
    actorRole: params.currentUser.role,
    action: 'CREATE_TICKET',
    targetId: id,
    details: `Created Ticket #${id} for ${params.currentUser.branchName}`,
  });

  if (assignedStaff) {
    next = withTimeline(next, {
      ticketId: id,
      actorName: 'System',
      actorRole: 'ADMINISTRATOR',
      action: 'Ticket auto-assigned',
      details: `Auto-assigned to ${assignedStaff.name} (branch coverage: ${params.currentUser.branchName})`,
      type: 'assignment',
    });

    next = withAudit(next, {
      actorName: assignedStaff.name,
      actorRole: assignedStaff.role,
      action: 'ASSIGN_TICKET_AUTO',
      targetId: id,
      details: `Auto-assigned #${id} to ${assignedStaff.name} (branch coverage: ${params.currentUser.branchName})`,
    });

    next = withNotification(next, {
      userId: assignedStaff.id,
      ticketId: id,
      title: 'Ticket Auto-Assigned to You',
      message: `Ticket #${id} was automatically assigned to you (${params.currentUser.branchName})`,
      type: 'info',
    });
  }

  // Notify every administrator. The auto-assigned IT specialist (if any) already
  // received a dedicated notification above; unassigned IT staff are not pinged
  // until the ticket is actually assigned to them.
  const adminUsers = next.users.filter((u) => u.role === 'ADMINISTRATOR');
  for (const u of adminUsers) {
    // An admin who happens to be the assignee already got the dedicated notification.
    if (assignedStaff && u.id === assignedStaff.id) continue;
    next = withNotification(next, {
      userId: u.id,
      ticketId: id,
      title: 'New IT Request',
      message: `New ticket #${id} submitted by ${params.currentUser.branchName} (${params.currentUser.name})`,
      type: 'info',
    });
  }

  return next;
}

export function updateTicketStatus(
  state: AppState,
  ticketId: string,
  newStatus: TicketStatus,
  currentUser: User,
  notes?: string
): AppState {
  const index = state.tickets.findIndex((t) => t.id === ticketId);
  if (index === -1) return state;
  if (state.tickets[index].status === 'Resolved') return state;

  const tickets = [...state.tickets];
  const oldStatus = tickets[index].status;
  const nowStr = nowDisplay();

  tickets[index] = {
    ...tickets[index],
    status: newStatus,
    updatedAt: nowStr,
    resolutionNotes: newStatus === 'Resolved' ? notes || 'Request handled and issue resolved.' : tickets[index].resolutionNotes,
    resolvedAt: newStatus === 'Resolved' ? nowStr : tickets[index].resolvedAt,
  };

  let next: AppState = { ...state, tickets };

  next = withTimeline(next, {
    ticketId,
    actorName: currentUser.name,
    actorRole: currentUser.role,
    action: `Status changed to ${newStatus}`,
    details: notes
      ? `Notes: ${notes}`
      : `Status changed from ${oldStatus} to ${newStatus}`,
    type: newStatus === 'Resolved' ? 'resolution' : 'status_change',
  });

  next = withAudit(next, {
    actorName: currentUser.name,
    actorRole: currentUser.role,
    action: 'UPDATE_STATUS',
    targetId: ticketId,
    details: `Status changed from ${oldStatus} to ${newStatus} for #${ticketId}`,
  });

  const requesterId = tickets[index].requesterId;
  const actorIsSupport = currentUser.role === 'IT_STAFF' || currentUser.role === 'ADMINISTRATOR';

  if (actorIsSupport && requesterId !== currentUser.id) {
    next = withNotification(next, {
      userId: requesterId,
      ticketId,
      title: `Ticket Status: ${newStatus}`,
      message: `Ticket #${ticketId} status was changed to ${newStatus} by ${currentUser.name}`,
      type: newStatus === 'Resolved' ? 'success' : 'info',
    });
  }

  // A branch user updating a ticket should notify the assigned IT specialist.
  if (!actorIsSupport && tickets[index].assignedToId) {
    next = withNotification(next, {
      userId: tickets[index].assignedToId!,
      ticketId,
      title: `Branch Update on Ticket ${ticketId}`,
      message: `${currentUser.name} updated ticket #${ticketId} — status is now ${newStatus}`,
      type: 'info',
    });
  }

  return next;
}

/**
 * Permanently remove a ticket along with its comments, timeline events, and
 * notifications. The audit entry is kept so the deletion stays traceable.
 * Admin-only at the UI and API layers; this reducer is the offline mirror.
 */
export function deleteTicket(
  state: AppState,
  ticketId: string,
  currentUser: User
): AppState {
  if (currentUser.role !== 'ADMINISTRATOR') return state;
  const ticket = state.tickets.find((t) => t.id === ticketId);
  if (!ticket) return state;

  let next: AppState = {
    ...state,
    tickets: state.tickets.filter((t) => t.id !== ticketId),
    comments: state.comments.filter((c) => c.ticketId !== ticketId),
    timeline: state.timeline.filter((e) => e.ticketId !== ticketId),
    notifications: state.notifications.filter((n) => n.ticketId !== ticketId),
  };

  next = withAudit(next, {
    actorName: currentUser.name,
    actorRole: currentUser.role,
    action: 'DELETE_TICKET',
    targetId: ticketId,
    details: `Deleted ticket #${ticketId} "${ticket.subject}" (${ticket.branchName})`,
  });

  return next;
}

export function assignTicket(
  state: AppState,
  ticketId: string,
  staffUser: User,
  currentUser: User
): AppState {
  const index = state.tickets.findIndex((t) => t.id === ticketId);
  if (index === -1) return state;
  if (state.tickets[index].status === 'Resolved') return state;

  const tickets = [...state.tickets];
  tickets[index] = {
    ...tickets[index],
    assignedToId: staffUser.id,
    assignedToName: staffUser.name,
    updatedAt: nowDisplay(),
  };

  let next: AppState = { ...state, tickets };

  next = withTimeline(next, {
    ticketId,
    actorName: currentUser.name,
    actorRole: currentUser.role,
    action: 'Ticket assigned',
    details: `Assigned to ${staffUser.name} (${staffUser.department || 'Main IT'})`,
    type: 'assignment',
  });

  next = withAudit(next, {
    actorName: currentUser.name,
    actorRole: currentUser.role,
    action: 'ASSIGN_TICKET',
    targetId: ticketId,
    details: `Assigned #${ticketId} to ${staffUser.name}`,
  });

  return next;
}

export interface AddCommentParams {
  ticketId: string;
  content: string;
  isInternal: boolean;
  currentUser: User;
}

export function addComment(state: AppState, params: AddCommentParams): AppState {
  const comment: Comment = {
    id: nextId('cmt', state),
    ticketId: params.ticketId,
    authorId: params.currentUser.id,
    authorName: params.currentUser.name,
    authorRole: params.currentUser.role,
    content: params.content,
    timestamp: nowDisplay(),
    isInternal: params.isInternal,
  };

  let next: AppState = {
    ...state,
    comments: [...state.comments, comment],
  };

  next = withTimeline(next, {
    ticketId: params.ticketId,
    actorName: params.currentUser.name,
    actorRole: params.currentUser.role,
    action: params.isInternal ? 'Added Internal IT Note' : 'Added Comment',
    details: params.isInternal ? '(Internal Note - Hidden from Branch)' : params.content,
    type: 'comment',
  });

  return next;
}

export function markNotificationAsRead(state: AppState, id: string): AppState {
  const notifications = state.notifications.map((n) =>
    n.id === id ? { ...n, read: true } : n
  );
  return { ...state, notifications };
}

export function markAllNotificationsAsRead(state: AppState, userId: string): AppState {
  const notifications = state.notifications.map((n) =>
    n.userId === userId ? { ...n, read: true } : n
  );
  return { ...state, notifications };
}

export function setCurrentUser(state: AppState, user: User): AppState {
  return { ...state, currentUser: user };
}

// ---------------------------------------------------------------------------
// Admin mutations (users & branches)
// ---------------------------------------------------------------------------

export interface CreateUserParams {
  username: string;
  name: string;
  role: UserRole;
  email: string;
  branchId?: string;
  branchName?: string;
  department?: string;
  /** Plain-text password (server hashes it). */
  password?: string;
  /** Pre-computed scrypt hash. Server computes it; the browser has no fallback login. */
  passwordHash?: string;
  /** True to force the user to change the password on first login. */
  mustChangePassword?: boolean;
}

export interface UpdateUserChanges {
  name?: string;
  username?: string;
  role?: UserRole;
  email?: string;
  branchId?: string;
  branchName?: string;
  department?: string;
  /** Plain-text password (server hashes it). */
  password?: string;
  passwordHash?: string;
  /** True to force the user to change the password on next login. */
  mustChangePassword?: boolean;
  /** True when the user requested a password reset (awaiting admin action). */
  passwordResetRequested?: boolean;
}

export function createUser(state: AppState, params: CreateUserParams, currentUser: User): AppState {
  const id = nextId('usr', state);
  const user: User = {
    id,
    username: params.username.trim(),
    name: params.name.trim(),
    role: params.role,
    email: params.email.trim(),
    branchId: params.role === 'BRANCH_USER' ? params.branchId : undefined,
    branchName: params.role === 'BRANCH_USER' ? params.branchName : undefined,
    department: params.role === 'BRANCH_USER' ? undefined : params.department,
    passwordHash: params.passwordHash,
    mustChangePassword: params.mustChangePassword ?? true,
  };

  let next: AppState = {
    ...state,
    users: [...state.users, user],
  };

  next = withAudit(next, {
    actorName: currentUser.name,
    actorRole: currentUser.role,
    action: 'CREATE_USER',
    targetId: id,
    details: `Created account for ${user.name} (${user.username}) as ${user.role}`,
  });

  return next;
}

/**
 * Password reset request (self-service, no login required). Marks the account,
 * notifies every administrator, and records an audit entry. Returns the
 * unchanged state when the username does not match any account.
 *
 * Administrator accounts never use the "notify the admins" path — the person
 * who forgot the password IS the admin, so notifying would just notify
 * themselves. Instead the caller must go through the recovery-key flow.
 */
export function requestPasswordReset(
  state: AppState,
  username: string
): { state: AppState; user: User | undefined; requiresRecoveryKey: boolean } {
  const user = state.users.find(
    (u) => u.username.toLowerCase() === username.trim().toLowerCase()
  );
  if (!user) return { state, user: undefined, requiresRecoveryKey: false };

  if (user.role === 'ADMINISTRATOR') {
    return { state, user, requiresRecoveryKey: true };
  }

  const users = state.users.map((u) =>
    u.id === user.id ? { ...u, passwordResetRequested: true } : u
  );

  let next: AppState = { ...state, users };

  const admins = next.users.filter((u) => u.role === 'ADMINISTRATOR');
  for (const admin of admins) {
    next = withNotification(next, {
      userId: admin.id,
      ticketId: user.id,
      title: 'Password reset requested',
      message: `${user.name} (${user.username}) requested a password reset. Set a new one from Admin → Users.`,
      type: 'warning',
    });
  }

  next = withAudit(next, {
    actorName: user.name,
    actorRole: user.role,
    action: 'REQUEST_PASSWORD_RESET',
    targetId: user.id,
    details: `Password reset requested for ${user.name} (${user.username})`,
  });

  return { state: next, user, requiresRecoveryKey: false };
}

/**
 * Recovery-key password rotation for an administrator who cannot log in. Sets a
 * fresh password hash, forces a change on next login, clears any reset flag,
 * and records an audit entry. `newPasswordHash` must be pre-computed (scrypt).
 */
export function performAdminRecovery(
  state: AppState,
  user: User,
  newPasswordHash: string
): AppState {
  let next = updateUser(
    state,
    user.id,
    {
      passwordHash: newPasswordHash,
      mustChangePassword: true,
      passwordResetRequested: false,
    },
    user
  );
  next = withAudit(next, {
    actorName: user.name,
    actorRole: user.role,
    action: 'ADMIN_RECOVERY',
    targetId: user.id,
    details: `Admin password recovered via recovery key (one-time password issued)`,
  });
  return next;
}

export function updateUser(
  state: AppState,
  userId: string,
  changes: UpdateUserChanges,
  currentUser: User
): AppState {
  const index = state.users.findIndex((u) => u.id === userId);
  if (index === -1) return state;

  const users = [...state.users];
  const isBranchRole = (changes.role ?? users[index].role) === 'BRANCH_USER';

  users[index] = {
    ...users[index],
    ...changes,
    name: changes.name?.trim() ?? users[index].name,
    username: changes.username?.trim() ?? users[index].username,
    email: changes.email?.trim() ?? users[index].email,
    branchId: isBranchRole ? (changes.branchId ?? users[index].branchId) : undefined,
    branchName: isBranchRole ? (changes.branchName ?? users[index].branchName) : undefined,
    department: isBranchRole ? undefined : (changes.department ?? users[index].department),
    passwordHash: changes.passwordHash ?? users[index].passwordHash,
  };

  let next: AppState = { ...state, users };

  next = withAudit(next, {
    actorName: currentUser.name,
    actorRole: currentUser.role,
    action: 'UPDATE_USER',
    targetId: userId,
    details: `Updated account for ${users[index].name}`,
  });

  return next;
}

export function deleteUser(state: AppState, userId: string, currentUser: User): AppState {
  if (userId === currentUser.id) return state;
  const user = state.users.find((u) => u.id === userId);
  if (!user) return state;

  let next: AppState = {
    ...state,
    users: state.users.filter((u) => u.id !== userId),
  };

  next = withAudit(next, {
    actorName: currentUser.name,
    actorRole: currentUser.role,
    action: 'DELETE_USER',
    targetId: userId,
    details: `Removed account ${user.name} (${user.username})`,
  });

  return next;
}

export interface CreateBranchParams {
  name: string;
  location: string;
  status: 'Active' | 'Inactive';
  userCount?: number;
}

export function createBranch(state: AppState, params: CreateBranchParams, currentUser: User): AppState {
  const id = nextId('br', state);
  const branch: Branch = {
    id,
    name: params.name.trim(),
    location: params.location.trim(),
    status: params.status,
    userCount: params.userCount ?? 0,
  };

  let next: AppState = {
    ...state,
    branches: [...state.branches, branch],
  };

  next = withAudit(next, {
    actorName: currentUser.name,
    actorRole: currentUser.role,
    action: 'CREATE_BRANCH',
    targetId: id,
    details: `Added branch ${branch.name}`,
  });

  return next;
}

export function updateBranch(
  state: AppState,
  branchId: string,
  changes: Partial<Branch>,
  currentUser: User
): AppState {
  const index = state.branches.findIndex((b) => b.id === branchId);
  if (index === -1) return state;

  const branches = [...state.branches];
  branches[index] = {
    ...branches[index],
    ...changes,
    name: changes.name?.trim() ?? branches[index].name,
    location: changes.location?.trim() ?? branches[index].location,
  };

  let next: AppState = { ...state, branches };

  next = withAudit(next, {
    actorName: currentUser.name,
    actorRole: currentUser.role,
    action: 'UPDATE_BRANCH',
    targetId: branchId,
    details: `Updated branch ${branches[index].name}`,
  });

  return next;
}

export function deleteBranch(state: AppState, branchId: string, currentUser: User): AppState {
  const branch = state.branches.find((b) => b.id === branchId);
  if (!branch) return state;

  let next: AppState = {
    ...state,
    branches: state.branches.filter((b) => b.id !== branchId),
  };

  next = withAudit(next, {
    actorName: currentUser.name,
    actorRole: currentUser.role,
    action: 'DELETE_BRANCH',
    targetId: branchId,
    details: `Removed branch ${branch.name}`,
  });

  return next;
}

export interface CreateCategoryParams {
  name: string;
  subcategory: string;
}

export function createCategory(
  state: AppState,
  params: CreateCategoryParams,
  currentUser: User,
): AppState {
  const id = nextId('cat', state);
  const category: CategoryInfo = {
    id,
    name: params.name.trim() as CategoryInfo['name'],
    subcategory: params.subcategory?.trim() ?? '',
    status: 'Active',
  };

  let next: AppState = {
    ...state,
    categories: [...state.categories, category],
  };

  next = withAudit(next, {
    actorName: currentUser.name,
    actorRole: currentUser.role,
    action: 'CREATE_CATEGORY',
    targetId: id,
    details: `Added category ${category.name}`,
  });

  return next;
}

export interface UpdateCategoryChanges {
  name?: string;
  subcategory?: string;
  status?: CategoryInfo['status'];
}

export function updateCategory(
  state: AppState,
  categoryId: string,
  changes: UpdateCategoryChanges,
  currentUser: User,
): AppState {
  const index = state.categories.findIndex((c) => c.id === categoryId);
  if (index === -1) return state;

  const categories = [...state.categories];
  categories[index] = {
    ...categories[index],
    ...changes,
    name:
      (changes.name?.trim() as CategoryInfo['name']) ??
      categories[index].name,
    subcategory: changes.subcategory?.trim() ?? categories[index].subcategory,
  };

  let next: AppState = { ...state, categories };

  next = withAudit(next, {
    actorName: currentUser.name,
    actorRole: currentUser.role,
    action: 'UPDATE_CATEGORY',
    targetId: categoryId,
    details: `Updated category ${categories[index].name}`,
  });

  return next;
}

// ---------------------------------------------------------------------------
// Branch infrastructure health monitoring
// ---------------------------------------------------------------------------

export const BRANCH_SYSTEMS: BranchSystem[] = [
  BranchSystem.Internet,
  BranchSystem.CCTV,
  BranchSystem.ATM,
  BranchSystem.PC,
  BranchSystem.Printer,
  BranchSystem.GenSet,
];

/** Systems that track per-unit counts. Others are single units (status only). */
export const UNIT_SYSTEMS: BranchSystem[] = [
  BranchSystem.CCTV,
  BranchSystem.PC,
  BranchSystem.Printer,
];

export function shouldTrackUnits(system: BranchSystem): boolean {
  return UNIT_SYSTEMS.includes(system);
}

export interface UpdateBranchHealthChanges {
  system: BranchSystem;
  status?: SystemHealthStatus;
  totalUnits?: number | null;
  workingUnits?: number | null;
  internetSpeed?: string;
  notes?: string;
}

export function deriveHealthStatus(
  totalUnits?: number | null,
  workingUnits?: number | null,
): SystemHealthStatus | null {
  if (typeof totalUnits !== 'number' || totalUnits < 1) return null;
  const working = typeof workingUnits === 'number' ? workingUnits : null;
  if (working === null) return null;
  if (working >= totalUnits) return SystemHealthStatus.Working;
  if (working > 0) return SystemHealthStatus.NotWorking;
  return SystemHealthStatus.Offline;
}

/**
 * Record the health status of one monitored system at a branch. Upserts the
 * matching (branchId, system) row and writes an audit entry. For systems that
 * track unit counts (CCTV, PC, Printer), the status is derived from the counts
 * for consistency. Other systems are single units and use status directly.
 * For Internet, an optional internetSpeed can be recorded and logged.
 */
export function updateBranchHealth(
  state: AppState,
  branchId: string,
  changes: UpdateBranchHealthChanges,
  currentUser: User
): AppState {
  const branch = state.branches.find((b) => b.id === branchId);
  if (!branch) return state;

  const trackUnits = shouldTrackUnits(changes.system);
  const hasUnits =
    trackUnits &&
    typeof changes.totalUnits === 'number' &&
    typeof changes.workingUnits === 'number';
  const isInternet = changes.system === 'Internet';
  const hasSpeed = isInternet && typeof changes.internetSpeed === 'string' && changes.internetSpeed.trim() !== '';
  const status = hasUnits
    ? (deriveHealthStatus(changes.totalUnits, changes.workingUnits) ?? changes.status)
    : changes.status;
  if (!status) return state;

  const existing = state.branchHealth.find(
    (h) => h.branchId === branchId && h.system === changes.system
  );
  const entry: BranchHealth = {
    id: existing?.id ?? nextId('bh', state),
    branchId,
    system: changes.system,
    status,
    totalUnits: hasUnits ? changes.totalUnits : null,
    workingUnits: hasUnits ? changes.workingUnits : null,
    internetSpeed: hasSpeed ? changes.internetSpeed.trim() : (isInternet ? existing?.internetSpeed ?? null : null),
    notes: changes.notes?.trim() || undefined,
    updatedBy: currentUser.id,
    updatedByName: currentUser.name,
    updatedAt: nowDisplay(),
  };

  let next: AppState = {
    ...state,
    branchHealth: [
      ...state.branchHealth.filter(
        (h) => !(h.branchId === branchId && h.system === changes.system)
      ),
      entry,
    ],
  };

  if (hasSpeed) {
    const logEntry: InternetSpeedLog = {
      id: nextId('sl', state),
      branchId,
      speed: entry.internetSpeed,
      recordedBy: currentUser.id,
      recordedByName: currentUser.name,
      recordedAt: nowDisplay(),
      notes: changes.notes?.trim() || undefined,
    };
    next = {
      ...next,
      internetSpeedLogs: [logEntry, ...state.internetSpeedLogs],
    };
  }

  next = withAudit(next, {
    actorName: currentUser.name,
    actorRole: currentUser.role,
    action: 'UPDATE_BRANCH_HEALTH',
    targetId: branchId,
    details: `Set ${branch.name} ${changes.system} to ${status}${
      hasUnits ? ` (${changes.workingUnits}/${changes.totalUnits})` : ''
    }${hasSpeed ? ` — Speed: ${entry.internetSpeed}` : ''}${entry.notes ? ' — ' + entry.notes : ''}`,
  });

  if (status === SystemHealthStatus.NotWorking || status === SystemHealthStatus.Offline) {
    const adminUsers = next.users.filter((u) => u.role === 'ADMINISTRATOR');
    for (const u of adminUsers) {
      next = withNotification(next, {
        userId: u.id,
        ticketId: '',
        branchId: branchId,
        title: 'Branch System Alert',
        message: `${branch.name} — ${changes.system} is now ${status === SystemHealthStatus.NotWorking ? 'Not Working' : 'Offline'}`,
        type: status === SystemHealthStatus.Offline ? 'warning' : 'info',
      });
    }
  }

  return next;
}

// ---------------------------------------------------------------------------
// IT specialist branch assignments
// ---------------------------------------------------------------------------

export function buildBranchAssignment(
  branchId: string,
  branchName: string,
  durationMonths: number
): BranchAssignment {
  const assignedAt = new Date();
  const expiresAt = new Date(assignedAt.getTime() + durationMonths * 30 * 24 * 60 * 60 * 1000);
  return {
    branchId,
    branchName,
    durationMonths,
    assignedAt: assignedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
}

export function updateStaffAssignments(
  state: AppState,
  staffUserId: string,
  assignments: BranchAssignment[],
  currentUser: User
): AppState {
  const index = state.users.findIndex((u) => u.id === staffUserId);
  if (index === -1) return state;
  if (state.users[index].role !== 'IT_STAFF') return state;

  const users = [...state.users];
  users[index] = { ...users[index], assignments };

  let next: AppState = { ...state, users };

  // Auto-assign previously-unassigned tickets whose branch is now covered by
  // this IT specialist.
  const staff = users[index];
  const coveredBranchIds = new Set(
    assignments.filter((a) => isAssignmentActive(a)).map((a) => a.branchId)
  );

  const unassignedTicketIds = next.tickets
    .filter(
      (t) => !t.assignedToId && t.status === 'In Progress' && coveredBranchIds.has(t.branchId)
    )
    .map((t) => t.id);

  for (const ticketId of unassignedTicketIds) {
    next = assignTicket(next, ticketId, staff, currentUser);
  }

  next = withAudit(next, {
    actorName: currentUser.name,
    actorRole: currentUser.role,
    action: 'UPDATE_STAFF_ASSIGNMENTS',
    targetId: staffUserId,
    details:
      assignments.length > 0
        ? `Assigned ${users[index].name} to ${assignments.length} branch(es): ${assignments.map((a) => a.branchName).join(', ')}`
        : `Cleared all branch assignments for ${users[index].name}`,
  });

  return next;
}

export const getRoleLabel = (role: UserRole): string => {
  switch (role) {
    case 'BRANCH_USER':
      return 'Branch User';
    case 'IT_STAFF':
      return 'IT Specialist';
    case 'ADMINISTRATOR':
      return 'Administrator';
    case 'AUDITOR':
      return 'Auditor';
    default:
      return role;
  }
};
