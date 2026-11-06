import { describe, it, expect } from 'vitest';
import { AppState, BranchAssignment, BranchSystem, SystemHealthStatus, User } from '../types';
import {
  createState,
  createTicket,
  deleteTicket,
  deriveHealthStatus,
  findAssignableItStaff,
  getRoleLabel,
  isAssignmentActive,
  shouldTrackUnits,
  updateTicketStatus,
} from './store';

// ---------------------------------------------------------------------------
// Inline fixtures — no seed/demo data lives in the app, so tests build the
// minimal state they need right here.
// ---------------------------------------------------------------------------

const user = (over: Partial<User> & Pick<User, 'id' | 'role' | 'name'>): User => ({
  username: over.id,
  email: `${over.id}@example.test`,
  ...over,
});

const assignment = (
  branchId: string,
  branchName: string,
  durationMonths = 6,
): BranchAssignment => {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + durationMonths * 30 * 24 * 60 * 60 * 1000);
  return {
    branchId,
    branchName,
    durationMonths,
    assignedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
};

const empty = (over: Partial<AppState> = {}): AppState => ({ ...createState(), ...over });

const branchUser = (over: Partial<User> = {}): User =>
  user({
    id: 'usr-branch',
    role: 'BRANCH_USER',
    name: 'Branch User',
    branchId: 'br-1',
    branchName: 'Branch One',
    ...over,
  });

const itStaff = (over: Partial<User> = {}): User =>
  user({
    id: 'usr-it',
    role: 'IT_STAFF',
    name: 'IT One',
    assignments: [assignment('br-1', 'Branch One')],
    ...over,
  });

const admin = (): User => user({ id: 'usr-admin', role: 'ADMINISTRATOR', name: 'Admin' });

describe('createState', () => {
  it('starts empty with no seed data', () => {
    const state = createState();
    expect(state.tickets).toEqual([]);
    expect(state.users).toEqual([]);
    expect(state.branches).toEqual([]);
    expect(state.categories).toEqual([]);
    expect(state.branchHealth).toEqual([]);
  });
});

describe('createTicket', () => {
  it('creates a ticket as In Progress and auto-assigns the IT specialist covering the branch', () => {
    const requester = branchUser();
    const staff = itStaff();
    const state = empty({ users: [staff, requester], branches: [], currentUser: requester });

    const next = createTicket(state, {
      subject: 'Test',
      description: 'Description for test',
      category: 'Hardware',
      currentUser: requester,
    });

    const created = next.tickets[0];
    expect(created.id).toBe('IT-000001');
    expect(created.status).toBe('In Progress');
    expect(created.assignedToId).toBe(staff.id);
    expect(created.assignedToName).toBe(staff.name);
    expect(next.ticketCounter).toBe(2);
  });

  it('creates ticket as In Progress even when no IT specialist covers the branch', () => {
    const requester = branchUser({ branchId: 'br-999', branchName: 'Unknown' });
    const state = empty({ users: [requester], currentUser: requester });

    const next = createTicket(state, {
      subject: 'Test',
      description: 'Description for test',
      category: 'Network',
      currentUser: requester,
    });

    expect(next.tickets[0].status).toBe('In Progress');
    expect(next.tickets[0].assignedToId).toBeUndefined();
  });

  it('notifies administrators and the assigned IT specialist', () => {
    const requester = branchUser();
    const staff = itStaff();
    const state = empty({
      users: [staff, admin(), requester],
      currentUser: requester,
    });

    const next = createTicket(state, {
      subject: 'Test',
      description: 'Description for test',
      category: 'Software',
      currentUser: requester,
    });

    const notified = next.notifications.map((n) => n.userId);
    expect(notified).toContain('usr-admin');
    expect(notified).toContain('usr-it');
  });
});

describe('updateTicketStatus', () => {
  it('notifies the requester when support marks the ticket resolved', () => {
    const requester = branchUser();
    const state = empty({
      users: [requester],
      currentUser: requester,
      tickets: [
        {
          id: 'IT-000002',
          subject: 'X',
          description: 'X',
          category: 'Hardware',
          status: 'In Progress',
          priority: 'High',
          requesterId: requester.id,
          requesterName: requester.name,
          branchId: 'br-1',
          branchName: 'Branch One',
          createdAt: 'Jan 01, 2026',
          updatedAt: 'Jan 01, 2026',
        },
      ],
    });

    const next = updateTicketStatus(state, 'IT-000002', 'Resolved', itStaff(), 'Fixed');
    const updated = next.tickets.find((t) => t.id === 'IT-000002')!;
    expect(updated.status).toBe('Resolved');
    expect(updated.resolutionNotes).toBe('Fixed');
    expect(updated.resolvedAt).toBeDefined();
    expect(
      next.notifications.some(
        (n) => n.ticketId === 'IT-000002' && n.userId === requester.id,
      ),
    ).toBe(true);
  });

  it('does not reopen a resolved ticket', () => {
    const requester = branchUser();
    const state = empty({
      users: [requester],
      currentUser: requester,
      tickets: [
        {
          id: 'IT-000004',
          subject: 'X',
          description: 'X',
          category: 'Hardware',
          status: 'Resolved',
          priority: 'High',
          requesterId: requester.id,
          requesterName: requester.name,
          branchId: 'br-1',
          branchName: 'Branch One',
          createdAt: 'Jan 01, 2026',
          updatedAt: 'Jan 01, 2026',
        },
      ],
    });

    expect(updateTicketStatus(state, 'IT-000004', 'In Progress', itStaff())).toBe(state);
  });
});

describe('deleteTicket', () => {
  const stateWithTicket = (): AppState =>
    empty({
      users: [admin(), branchUser()],
      currentUser: admin(),
      tickets: [
        {
          id: 'IT-000003',
          subject: 'X',
          description: 'X',
          category: 'Hardware',
          status: 'In Progress',
          priority: 'High',
          requesterId: 'usr-branch',
          requesterName: 'Branch User',
          branchId: 'br-1',
          branchName: 'Branch One',
          createdAt: 'Jan 01, 2026',
          updatedAt: 'Jan 01, 2026',
        },
      ],
    });

  it('removes the ticket and records a DELETE_TICKET audit entry', () => {
    const next = deleteTicket(stateWithTicket(), 'IT-000003', admin());
    expect(next.tickets.some((t) => t.id === 'IT-000003')).toBe(false);
    expect(
      next.auditLogs.some((a) => a.action === 'DELETE_TICKET' && a.targetId === 'IT-000003'),
    ).toBe(true);
  });

  it('refuses non-admin roles', () => {
    const state = stateWithTicket();
    expect(deleteTicket(state, 'IT-000003', branchUser())).toBe(state);
  });
});

describe('deriveHealthStatus', () => {
  it('returns null when counts are missing', () => {
    expect(deriveHealthStatus()).toBeNull();
    expect(deriveHealthStatus(0, 0)).toBeNull();
  });

  it('maps counts to Working / Not Working / Offline', () => {
    expect(deriveHealthStatus(5, 5)).toBe(SystemHealthStatus.Working);
    expect(deriveHealthStatus(4, 1)).toBe(SystemHealthStatus.NotWorking);
    expect(deriveHealthStatus(4, 3)).toBe(SystemHealthStatus.NotWorking);
    expect(deriveHealthStatus(2, 0)).toBe(SystemHealthStatus.Offline);
  });
});

describe('shouldTrackUnits', () => {
  it('tracks units only for CCTV, PC, and Printer', () => {
    expect(shouldTrackUnits(BranchSystem.CCTV)).toBe(true);
    expect(shouldTrackUnits(BranchSystem.PC)).toBe(true);
    expect(shouldTrackUnits(BranchSystem.Printer)).toBe(true);
    expect(shouldTrackUnits(BranchSystem.Internet)).toBe(false);
    expect(shouldTrackUnits(BranchSystem.ATM)).toBe(false);
    expect(shouldTrackUnits(BranchSystem.GenSet)).toBe(false);
  });
});

describe('findAssignableItStaff', () => {
  it('returns the IT specialist whose active assignment covers the branch', () => {
    const staff = itStaff();
    const state = empty({ users: [staff] });
    expect(findAssignableItStaff(state, 'br-1')?.id).toBe(staff.id);
    expect(findAssignableItStaff(state, 'br-2')).toBeUndefined();
  });
});

describe('isAssignmentActive', () => {
  it('treats a future expiry as active and a past expiry as inactive', () => {
    const active = assignment('br-1', 'Branch One');
    expect(isAssignmentActive(active)).toBe(true);

    const expired: BranchAssignment = { ...active, expiresAt: '2000-01-01T00:00:00.000Z' };
    expect(isAssignmentActive(expired)).toBe(false);
  });
});

describe('getRoleLabel', () => {
  it('maps roles to display labels', () => {
    expect(getRoleLabel('BRANCH_USER')).toBe('Branch User');
    expect(getRoleLabel('IT_STAFF')).toBe('IT Specialist');
    expect(getRoleLabel('ADMINISTRATOR')).toBe('Administrator');
    expect(getRoleLabel('AUDITOR')).toBe('Auditor');
  });
});
