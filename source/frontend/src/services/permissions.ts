/**
 * Role-based access control. All role string literals live here — the single
 * source of truth for what each role may do. Views/components should use
 * `can()` / `canFromRole()` instead of comparing roles inline.
 */

import { User, UserRole } from '../types';

export type Permission =
  | 'viewDashboard'
  | 'viewMyTickets'
  | 'viewAllTickets'
  | 'createTicket'
  | 'updateTicket'
  | 'deleteTicket'
  | 'respondToTickets'
  | 'viewMonitor'
  | 'updateMonitor'
  | 'bulkUpdateMonitor'
  | 'manageEndpoints'
  | 'manageAlerts'
  | 'viewReports'
  | 'exportData'
  | 'manageUsers'
  | 'manageBranches'
  | 'manageCategories'
  | 'viewAuditLogs'
  | 'manageWallboard';

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  BRANCH_USER: [
    'viewDashboard',
    'viewMyTickets',
    'createTicket',
    'updateTicket',
    'viewMonitor',
    'updateMonitor',
    'viewReports',
    'exportData',
  ],
  IT_STAFF: [
    'viewDashboard',
    'viewMyTickets',
    'viewAllTickets',
    'createTicket',
    'updateTicket',
    'respondToTickets',
    'viewMonitor',
    'updateMonitor',
    // Bulk update is how a specialist does the daily pass across their assigned
    // branches; the API scopes it to their assignments (bulk_update.php:20).
    'bulkUpdateMonitor',
    'viewReports',
    'exportData',
    'manageWallboard',
  ],
  ADMINISTRATOR: [
    'viewDashboard',
    'viewMyTickets',
    'viewAllTickets',
    'createTicket',
    'updateTicket',
    // Removing a ticket is destructive and cannot be undone, so it is limited
    // to administrators (enforced again in tickets_delete.php).
    'deleteTicket',
    'respondToTickets',
    'viewMonitor',
    'bulkUpdateMonitor',
    'manageEndpoints',
    'manageAlerts',
    'viewReports',
    'exportData',
    'manageUsers',
    'manageBranches',
    'manageCategories',
    'viewAuditLogs',
    'manageWallboard',
  ],
  AUDITOR: [
    'viewDashboard',
    'viewMyTickets',
    'viewAllTickets',
    'viewMonitor',
    'viewReports',
    'exportData',
    'viewAuditLogs',
  ],
};

export function can(user: User, permission: Permission): boolean {
  if (!user?.role) return false;
  return ROLE_PERMISSIONS[user.role]?.includes(permission) ?? false;
}

export function rolesWith(permission: Permission): UserRole[] {
  return (Object.keys(ROLE_PERMISSIONS) as UserRole[]).filter((role) =>
    ROLE_PERMISSIONS[role].includes(permission),
  );
}