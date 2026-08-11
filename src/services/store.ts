/**
 * Pure application state logic shared by the Express server and the browser.
 * No DOM / Node dependencies — safe to run in vitest, tsx, or the Vite bundle.
 */
import {
  AppState,
  AuditLog,
  Branch,
  BranchAssignment,
  Comment,
  NotificationItem,
  Ticket,
  TicketCategory,
  TicketPriority,
  TicketStatus,
  TimelineEvent,
  User,
  UserRole
} from '../types';
import {
  INITIAL_TICKETS,
  INITIAL_COMMENTS,
  INITIAL_TIMELINE,
  INITIAL_NOTIFICATIONS,
  INITIAL_AUDIT_LOGS,
  INITIAL_USERS,
  INITIAL_BRANCHES,
  INITIAL_CATEGORIES
} from '../data/initialData';

export const DEFAULT_TICKET_COUNTER = 126;

// ---------------------------------------------------------------------------
// State construction
// ---------------------------------------------------------------------------

const parseDisplayDate = (value: string): string => {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? '' : new Date(parsed).toISOString();
};

export function createState(): AppState {
  return {
    tickets: INITIAL_TICKETS.map((t) => ({
      ...t,
      createdAtISO: parseDisplayDate(t.createdAt) || new Date().toISOString(),
    })),
    comments: [...INITIAL_COMMENTS],
    timeline: [...INITIAL_TIMELINE],
    notifications: [...INITIAL_NOTIFICATIONS],
    auditLogs: [...INITIAL_AUDIT_LOGS],
    users: [...INITIAL_USERS],
    branches: [...INITIAL_BRANCHES],
    categories: [...INITIAL_CATEGORIES],
    currentUser: { ...INITIAL_USERS[0] },
    ticketCounter: DEFAULT_TICKET_COUNTER,
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
// SLA tracking
// ---------------------------------------------------------------------------

const SLA_HOURS: Record<TicketCategory, number> = {
  Hardware: 24,
  Software: 12,
  Network: 4,
  'Account & Access': 8,
  'Installation / Configuration': 48,
  'IT Equipment': 72,
  'Other IT Concern': 48,
};

export function slaHoursFor(category: TicketCategory): number {
  return SLA_HOURS[category] ?? 24;
}

export function slaDeadlineFor(ticket: Ticket): Date | null {
  if (!ticket.createdAtISO) return null;
  const start = new Date(ticket.createdAtISO);
  if (Number.isNaN(start.getTime())) return null;
  return new Date(start.getTime() + slaHoursFor(ticket.category) * 60 * 60 * 1000);
}

export type SlaStatus = 'ok' | 'critical' | 'breached' | 'na';

export function slaStatusFor(ticket: Ticket, now: Date = new Date()): SlaStatus {
  if (ticket.status === 'Closed' || ticket.status === 'Cancelled') return 'na';
  const deadline = slaDeadlineFor(ticket);
  if (!deadline) return 'na';
  const remaining = deadline.getTime() - now.getTime();
  if (remaining < 0) return 'breached';
  if (remaining < slaHoursFor(ticket.category) * 0.25 * 60 * 60 * 1000) return 'critical';
  return 'ok';
}

export interface SlaInfo {
  status: SlaStatus;
  slaHours: number;
  deadlineIso: string | null;
  remainingMs: number | null;
  label: string;
}

export function slaInfoFor(ticket: Ticket, now: Date = new Date()): SlaInfo {
  const slaHours = slaHoursFor(ticket.category);
  const deadline = slaDeadlineFor(ticket);
  const status = slaStatusFor(ticket, now);
  let label = 'N/A';
  if (deadline && status !== 'na') {
    const remaining = deadline.getTime() - now.getTime();
    if (remaining <= 0) {
      label = 'SLA Breached';
    } else if (remaining < slaHours * 0.25 * 60 * 60 * 1000) {
      label = `Due in ${Math.max(1, Math.ceil(remaining / (60 * 60 * 1000)))}h`;
    } else {
      label = `Due in ${Math.ceil(remaining / (60 * 60 * 1000))}h`;
    }
  }
  return {
    status,
    slaHours,
    deadlineIso: deadline ? deadline.toISOString() : null,
    remainingMs: deadline ? deadline.getTime() - now.getTime() : null,
    label,
  };
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
 * Returns the IT staff member whose active branch assignment covers the given
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
      (t) => t.assignedToId === u.id && t.status !== 'Closed' && t.status !== 'Cancelled'
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
  priority: TicketPriority;
  attachmentName?: string;
  currentUser: User;
}

export function createTicket(state: AppState, params: CreateTicketParams): AppState {
  const id = `IT-${String(state.ticketCounter).padStart(6, '0')}`;
  const nowStr = nowDisplay();

  // Auto-assign to the IT staff member whose active branch assignment covers
  // the requester's branch (least-loaded when multiple staff cover it).
  const assignedStaff = params.currentUser.branchId
    ? findAssignableItStaff(state, params.currentUser.branchId)
    : undefined;

  const ticket: Ticket = {
    id,
    subject: params.subject,
    description: params.description,
    category: params.category,
    priority: params.priority,
    status: assignedStaff ? 'Assigned' : 'New',
    requesterId: params.currentUser.id,
    requesterName: params.currentUser.name,
    branchId: params.currentUser.branchId || 'br-001',
    branchName: params.currentUser.branchName || 'Unisan Branch',
    assignedToId: assignedStaff?.id,
    assignedToName: assignedStaff?.name,
    createdAt: nowStr,
    createdAtISO: nowIso(),
    updatedAt: nowStr,
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
    details: `Category: ${params.category} | Priority: ${params.priority}`,
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

  // Notify every IT staff member and administrator, not just one person.
  const supportUsers = next.users.filter(
    (u) => u.role === 'IT_STAFF' || u.role === 'ADMINISTRATOR'
  );
  for (const u of supportUsers) {
    // The auto-assigned staff member already received a dedicated notification.
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

  const tickets = [...state.tickets];
  const oldStatus = tickets[index].status;
  const nowStr = nowDisplay();

  tickets[index] = {
    ...tickets[index],
    status: newStatus,
    updatedAt: nowStr,
    resolutionNotes: newStatus === 'Resolved' ? notes || 'Request handled and issue resolved.' : tickets[index].resolutionNotes,
    resolvedAt: newStatus === 'Resolved' ? nowStr : tickets[index].resolvedAt,
    closedAt: newStatus === 'Closed' ? nowStr : tickets[index].closedAt,
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

  // A branch user updating a ticket should notify the assigned IT staff.
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

export function assignTicket(
  state: AppState,
  ticketId: string,
  staffUser: User,
  currentUser: User
): AppState {
  const index = state.tickets.findIndex((t) => t.id === ticketId);
  if (index === -1) return state;

  const tickets = [...state.tickets];
  tickets[index] = {
    ...tickets[index],
    assignedToId: staffUser.id,
    assignedToName: staffUser.name,
    status: tickets[index].status === 'New' ? 'Assigned' : tickets[index].status,
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

export function updateTicketPriority(
  state: AppState,
  ticketId: string,
  newPriority: TicketPriority,
  currentUser: User
): AppState {
  const index = state.tickets.findIndex((t) => t.id === ticketId);
  if (index === -1) return state;

  const tickets = [...state.tickets];
  const oldPriority = tickets[index].priority;
  tickets[index] = {
    ...tickets[index],
    priority: newPriority,
    updatedAt: nowDisplay(),
  };

  let next: AppState = { ...state, tickets };

  next = withTimeline(next, {
    ticketId,
    actorName: currentUser.name,
    actorRole: currentUser.role,
    action: 'Priority adjusted',
    details: `Priority updated from ${oldPriority} to ${newPriority} (IT Review)`,
    type: 'status_change',
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
  /** Pre-computed scrypt hash. Server computes it; the browser falls back to demo login. */
  passwordHash?: string;
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
  code: string;
  name: string;
  location: string;
  status: 'Active' | 'Inactive';
  userCount?: number;
}

export function createBranch(state: AppState, params: CreateBranchParams, currentUser: User): AppState {
  const id = nextId('br', state);
  const branch: Branch = {
    id,
    code: params.code.trim().toUpperCase(),
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
    details: `Added branch ${branch.name} (${branch.code})`,
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
    code: changes.code?.trim().toUpperCase() ?? branches[index].code,
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
    details: `Removed branch ${branch.name} (${branch.code})`,
  });

  return next;
}

// ---------------------------------------------------------------------------
// IT staff branch assignments
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
      return 'IT Staff';
    case 'ADMINISTRATOR':
      return 'Administrator';
    case 'AUDITOR':
      return 'Auditor';
    default:
      return role;
  }
};
