/**
 * URL ↔ view mapping for the prototype. Keeps the single-state App render
 * while giving every screen a real, deep-linkable URL.
 */
import { ActiveView } from './types';

export type AdminTab = 'overview' | 'users' | 'branches' | 'categories' | 'it_staff' | 'activity_logs';

const ADMIN_TAB_PATH: Record<Exclude<AdminTab, 'overview'>, string> = {
  users: '/admin/users',
  branches: '/admin/branches',
  categories: '/admin/categories',
  it_staff: '/admin/it-staff',
  activity_logs: '/admin/activity-logs',
};

export function pathForView(view: ActiveView, adminTab?: AdminTab, ticketId?: string): string {
  switch (view) {
    case 'dashboard':
      return '/';
    case 'new_request':
      return '/tickets/new';
    case 'my_tickets':
      return '/tickets/my';
    case 'all_tickets':
      return '/tickets';
    case 'assigned_tickets':
      return '/tickets/assigned';
    case 'in_progress':
      return '/tickets/in-progress';
    case 'resolved_tickets':
      return '/tickets/resolved';
    case 'ticket_detail':
      return ticketId ? `/tickets/${encodeURIComponent(ticketId)}` : '/tickets';
    case 'notifications':
      return '/notifications';
    case 'reports':
      return '/reports';
    case 'users':
      return adminTab && adminTab !== 'overview' ? ADMIN_TAB_PATH[adminTab] : '/admin';
    case 'branches':
      return '/admin/branches';
    case 'categories':
      return '/admin/categories';
    case 'it_staff':
      return '/admin/it-staff';
    case 'activity_logs':
      return '/admin/activity-logs';
    case 'profile':
      return '/profile';
    case 'requirements':
      return '/requirements';
    default:
      return '/';
  }
}

export interface ParsedPath {
  view: ActiveView;
  adminTab?: AdminTab;
  ticketId?: string;
}

export function parsePath(pathname: string): ParsedPath | null {
  const parts = pathname.split('/').filter(Boolean);

  if (parts.length === 0) return { view: 'dashboard' };

  switch (parts[0]) {
    case 'login':
      return null;
    case 'notifications':
      return { view: 'notifications' };
    case 'reports':
      return { view: 'reports' };
    case 'profile':
      return { view: 'profile' };
    case 'requirements':
      return { view: 'requirements' };
    case 'tickets': {
      if (parts.length === 1) return { view: 'all_tickets' };
      switch (parts[1]) {
        case 'new':
          return { view: 'new_request' };
        case 'my':
          return { view: 'my_tickets' };
        case 'assigned':
          return { view: 'assigned_tickets' };
        case 'in-progress':
          return { view: 'in_progress' };
        case 'resolved':
          return { view: 'resolved_tickets' };
        default:
          return { view: 'ticket_detail', ticketId: decodeURIComponent(parts[1]) };
      }
    }
    case 'admin': {
      const seg = parts[1];
      const adminSegments: Record<string, AdminTab> = {
        users: 'users',
        branches: 'branches',
        categories: 'categories',
        'it-staff': 'it_staff',
        'activity-logs': 'activity_logs',
      };
      if (seg && adminSegments[seg]) {
        return { view: 'users', adminTab: adminSegments[seg] };
      }
      return { view: 'users', adminTab: 'overview' };
    }
    default:
      return { view: 'dashboard' };
  }
}
