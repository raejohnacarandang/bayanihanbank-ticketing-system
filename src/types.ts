/**
 * Bayanihan Bank IT Service Desk Prototype Types
 */

export type UserRole = 'BRANCH_USER' | 'IT_STAFF' | 'ADMINISTRATOR' | 'AUDITOR';

export type TicketCategory =
  | 'Hardware'
  | 'Software'
  | 'Network'
  | 'Account & Access'
  | 'Installation / Configuration'
  | 'IT Equipment'
  | 'Other IT Concern';

export type TicketPriority = 'Low' | 'Medium' | 'High' | 'Critical';

export type TicketStatus =
  | 'New'
  | 'Assigned'
  | 'In Progress'
  | 'Pending'
  | 'Resolved'
  | 'Closed'
  | 'Reopened'
  | 'Cancelled';

export interface User {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  branchId?: string;
  branchName?: string;
  department?: string;
  email: string;
  avatarUrl?: string;
  assignments?: BranchAssignment[];
  /** scrypt password hash. Server-only — never returned to the client. */
  passwordHash?: string;
  /** True when the user must set a new password on their next login. */
  mustChangePassword?: boolean;
}

export interface BranchAssignment {
  branchId: string;
  branchName: string;
  durationMonths: number;
  assignedAt: string; // ISO
  expiresAt: string; // ISO
}

export interface Branch {
  id: string;
  code: string;
  name: string;
  location: string;
  status: 'Active' | 'Inactive';
  userCount: number;
}

export interface CategoryInfo {
  id: string;
  name: TicketCategory;
  description: string;
  slaTargetHours: string; // Display string e.g. "4 - 24 hrs (TBD)"
  slaHours: number; // Numeric SLA target (hours) used for breach tracking
  status: 'Active' | 'Proposed';
}

export interface Comment {
  id: string;
  ticketId: string;
  authorId: string;
  authorName: string;
  authorRole: UserRole;
  content: string;
  timestamp: string;
  isInternal: boolean; // True for internal IT notes
}

export interface TimelineEvent {
  id: string;
  ticketId: string;
  timestamp: string;
  actorName: string;
  actorRole: UserRole;
  action: string;
  details?: string;
  type: 'creation' | 'assignment' | 'status_change' | 'comment' | 'resolution' | 'confirmation' | 'system';
}

export interface Attachment {
  id: string;
  filename: string;
  filesize: string;
  filetype: string;
}

export interface Ticket {
  id: string; // e.g. IT-000125
  subject: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  requesterId: string;
  requesterName: string;
  branchId: string;
  branchName: string;
  assignedToId?: string;
  assignedToName?: string;
  createdAt: string;
  createdAtISO?: string;
  updatedAt: string;
  resolutionNotes?: string;
  resolvedAt?: string;
  closedAt?: string;
  attachments?: Attachment[];
}

export interface NotificationItem {
  id: string;
  userId: string;
  ticketId: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  type: 'info' | 'success' | 'warning';
}

export interface AuditLog {
  id: string;
  timestamp: string;
  actorName: string;
  actorRole: UserRole;
  action: string;
  targetId?: string;
  details: string;
}

export type ActiveView =
  | 'dashboard'
  | 'new_request'
  | 'my_tickets'
  | 'all_tickets'
  | 'assigned_tickets'
  | 'in_progress'
  | 'resolved_tickets'
  | 'ticket_detail'
  | 'notifications'
  | 'users'
  | 'branches'
  | 'categories'
  | 'it_staff'
  | 'activity_logs'
  | 'reports'
  | 'profile'
  | 'requirements';

/**
 * The full persisted application state. The Express server is the source of
 * truth; the browser mirrors it so the UI can render synchronously.
 */
export interface AppState {
  tickets: Ticket[];
  comments: Comment[];
  timeline: TimelineEvent[];
  notifications: NotificationItem[];
  auditLogs: AuditLog[];
  users: User[];
  branches: Branch[];
  categories: CategoryInfo[];
  currentUser: User;
  ticketCounter: number;
}
