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

export type TicketStatus = 'In Progress' | 'Resolved';

export type TicketPriority = 'Critical' | 'High' | 'Medium' | 'Low';

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
  /** True when the user has requested a password reset and the admin has not resolved it yet. */
  passwordResetRequested?: boolean;
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
  name: string;
  location: string;
  status: 'Active' | 'Inactive';
  userCount: number;
}

/**
 * Infrastructure systems tracked per branch on the monitoring wallboard.
 * Member values are the wire format used by the PHP backend.
 */
export enum BranchSystem {
  Internet = 'Internet',
  CCTV = 'CCTV',
  ATM = 'ATM',
  PC = 'PC',
  Printer = 'Printer',
  GenSet = 'GenSet',
}

export enum SystemHealthStatus {
  Working = 'Working',
  NotWorking = 'Not Working',
  Offline = 'Offline',
}

/** Monitor quick-filter used on the branch monitor view. */
export enum MonitorFilter {
  All = 'ALL',
  Good = 'Good',
  Attention = 'Attention',
}

export interface BranchHealth {
  id: string;
  branchId: string;
  system: BranchSystem;
  status: SystemHealthStatus;
  totalUnits?: number | null;
  workingUnits?: number | null;
  internetSpeed?: string | null;
  notes?: string;
  updatedBy?: string;
  updatedByName?: string;
  updatedAt?: string;
}

export interface InternetSpeedLog {
  id: string;
  branchId: string;
  speed: string;
  recordedBy?: string;
  recordedByName?: string;
  recordedAt?: string;
  notes?: string;
}

/**
 * End-of-day snapshot of one branch/system, frozen by the daily snapshot job
 * (api/monitoring/daily_snapshot.php). `branch_health` only holds the current
 * state, so these rows are the only record of how a branch looked on a past day.
 */
export interface BranchHealthDaily {
  id: string;
  snapshotDate: string;
  branchId: string;
  system: BranchSystem;
  status: SystemHealthStatus;
  totalUnits?: number | null;
  workingUnits?: number | null;
  internetSpeed?: string | null;
  notes?: string;
  updatedBy?: string;
  updatedByName?: string;
  updatedAt?: string;
  /** Day the source branch_health row was last edited, YYYY-MM-DD. */
  lastUpdatedOn?: string | null;
  capturedAt?: string | null;
}

/** A day that has at least one captured snapshot, and how many rows it holds. */
export interface DailySnapshotDate {
  snapshotDate: string;
  rowCount: number;
}

/** A monitored endpoint driven by the scheduled health checker (cron). */
export interface MonitoredEndpoint {
  id: string;
  branchId: string;
  system: BranchSystem;
  checkType: 'http' | 'ping' | 'tcp' | 'dns';
  target: string;
  enabled: number;
  intervalMinutes: number;
  lastCheck?: string | null;
  lastStatus?: string | null;
  failureCount: number;
  lastDetails?: string | null;
  createdBy?: string | null;
  createdAt?: string | null;
}

export interface CategoryInfo {
  id: string;
  name: TicketCategory;
  subcategory: string;
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
  subcategory?: string;
  status: TicketStatus;
  priority: TicketPriority;
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
  attachments?: Attachment[];
  slaDeadline?: string;
  escalated?: boolean;
  escalatedAt?: string;
}

export interface NotificationItem {
  id: string;
  userId: string;
  ticketId: string;
  branchId?: string;
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
  requesterName?: string;
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
  | 'requirements'
  | 'wallboard'
  | 'branch_monitor'
  | 'help_center'
  | 'knowledge_base'
  | 'cloud_bank_monitoring';

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
  branchHealth: BranchHealth[];
  internetSpeedLogs: InternetSpeedLog[];
  monitoredEndpoints: MonitoredEndpoint[];
  currentUser: User;
  ticketCounter: number;
}
