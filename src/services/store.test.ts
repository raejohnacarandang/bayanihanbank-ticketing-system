import { describe, it, expect } from 'vitest';
import { User } from '../types';
import {
  addComment,
  assignTicket,
  createState,
  createTicket,
  markNotificationAsRead,
  setCurrentUser,
  updateStaffAssignments,
  updateTicketStatus
} from './store';

const branchUser = (): User => createState().users[0]; // Juan Dela Cruz (BRANCH_USER)
const itStaff = (): User => createState().users.find((u) => u.role === 'IT_STAFF')!;

describe('createState', () => {
  it('hydrates ISO timestamps for demo tickets', () => {
    const state = createState();
    expect(state.tickets.every((t) => t.createdAtISO)).toBe(true);
    expect(state.ticketCounter).toBe(126);
  });
});

describe('createTicket', () => {
  it('creates a ticket with the next sequential id and auto-assigns to the IT specialist covering the branch', () => {
    let state = createState();
    const ticket = { subject: 'Test', description: 'Desc', category: 'Hardware' as const };
    state = createTicket(state, { ...ticket, currentUser: branchUser() });
    const created = state.tickets[0];
    expect(created.id).toBe('IT-000126');
    expect(created.status).toBe('Assigned');
    expect(created.subject).toBe('Test');
    expect(created.assignedToName).toBe('Mark Reyes'); // covers Gumaca (br-011)
    expect(state.ticketCounter).toBe(127);
  });

  it('auto-assigns to the IT specialist assigned to the requester branch', () => {
    const state = createState();
    const requester = state.users.find((u) => u.id === 'usr-002')!; // Atimonan
    const next = createTicket(state, {
      subject: 'Test',
      description: 'Desc',
      category: 'Network' as const,
      currentUser: requester,
    });
    const created = next.tickets[0];
    expect(created.status).toBe('Assigned');
    expect(created.assignedToName).toBe('Mark Reyes'); // covers Atimonan (br-003)
    expect(created.assignedToId).toBe('usr-003');
  });

  it('leaves the ticket Pending when no IT specialist covers the branch', () => {
    const state = createState();
    const requester = { ...state.users[0], branchId: 'br-999', branchName: 'Unknown Branch' };
    const next = createTicket(state, {
      subject: 'Test',
      description: 'Desc',
      category: 'Hardware' as const,
      currentUser: requester,
    });
    expect(next.tickets[0].status).toBe('Pending');
    expect(next.tickets[0].assignedToId).toBeUndefined();
  });

  it('notifies only administrators and the assigned IT specialist, not every support member', () => {
    const state = createState();
    const next = createTicket(state, {
      subject: 'Test',
      description: 'Desc',
      category: 'Network' as const,
      currentUser: branchUser(),
    });
    const assigned = next.tickets[0].assignedToId;
    const admins = next.users.filter((u) => u.role === 'ADMINISTRATOR');
    const notifiedIds = next.notifications
      .filter((n) => n.ticketId === 'IT-000126')
      .map((n) => n.userId);
    expect(notifiedIds).toHaveLength(admins.length + (assigned ? 1 : 0));
    for (const u of admins) {
      expect(notifiedIds).toContain(u.id);
    }
    for (const u of next.users.filter((u) => u.role === 'IT_STAFF')) {
      if (u.id !== assigned) expect(notifiedIds).not.toContain(u.id);
    }
  });
});

describe('updateTicketStatus', () => {
  it('notifies the requester when IT specialist change the status', () => {
    const state = createState();
    const requesterId = state.tickets.find((t) => t.id === 'IT-000122')!.requesterId;
    const next = updateTicketStatus(state, 'IT-000122', 'In Progress', itStaff());
    expect(next.tickets.find((t) => t.id === 'IT-000122')!.status).toBe('In Progress');
    expect(next.notifications.some((n) => n.ticketId === 'IT-000122' && n.userId === requesterId)).toBe(true);
  });

  it('notifies the assigned IT specialist when a branch user updates a ticket', () => {
    const state = createState();
    const ticket = state.tickets.find((t) => t.id === 'IT-000122')!;
    expect(ticket.assignedToId).toBeDefined();
    const next = updateTicketStatus(state, 'IT-000122', 'Pending', branchUser());
    const relevant = next.notifications.filter((n) => n.ticketId === 'IT-000122');
    expect(relevant.some((n) => n.userId === ticket.assignedToId)).toBe(true);
  });
});

describe('assignTicket', () => {
  it('assigns the staff member and moves Pending tickets to Assigned', () => {
    const state = createState();
    const staff = itStaff();
    const next = assignTicket(state, 'IT-000123', staff, branchUser());
    const assigned = next.tickets.find((t) => t.id === 'IT-000123')!;
    expect(assigned.assignedToName).toBe(staff.name);
    expect(assigned.status).toBe('Assigned');
  });
});

describe('updateStaffAssignments', () => {
  it('auto-assigns existing unassigned tickets when a branch gets an IT specialist', () => {
    let state = createState();
    const staff = itStaff();
    const requester = { ...state.users[0], branchId: 'br-999', branchName: 'Unknown Branch' };
    state = createTicket(state, {
      subject: 'Uncovered',
      description: 'No IT specialist yet',
      category: 'Network' as const,
      currentUser: requester,
    });
    const pending = state.tickets[0];
    expect(pending.status).toBe('Pending');
    expect(pending.assignedToId).toBeUndefined();

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 6 * 30 * 24 * 60 * 60 * 1000);
    const next = updateStaffAssignments(
      state,
      staff.id,
      [
        {
          branchId: 'br-999',
          branchName: 'Unknown Branch',
          durationMonths: 6,
          assignedAt: now.toISOString(),
          expiresAt: expiresAt.toISOString(),
        },
      ],
      branchUser()
    );

    const assigned = next.tickets.find((t) => t.id === pending.id)!;
    expect(assigned.status).toBe('Assigned');
    expect(assigned.assignedToId).toBe(staff.id);
    expect(assigned.assignedToName).toBe(staff.name);
  });
});

describe('addComment', () => {
  it('appends a comment and a timeline entry', () => {
    let state = createState();
    const beforeComments = state.comments.length;
    const beforeTimeline = state.timeline.length;
    state = addComment(state, {
      ticketId: 'IT-000121',
      content: 'Testing connectivity now.',
      isInternal: true,
      currentUser: itStaff(),
    });
    expect(state.comments.length).toBe(beforeComments + 1);
    expect(state.timeline.length).toBe(beforeTimeline + 1);
    expect(state.comments[state.comments.length - 1].content).toBe('Testing connectivity now.');
  });
});

describe('markNotificationAsRead', () => {
  it('marks only the target notification as read', () => {
    const state = createState();
    const target = state.notifications[0];
    const next = markNotificationAsRead(state, target.id);
    expect(next.notifications.find((n) => n.id === target.id)!.read).toBe(true);
    const others = next.notifications.filter((n) => n.id !== target.id && n.read);
    expect(others).toHaveLength(state.notifications.filter((n) => n.read).length);
  });
});

describe('setCurrentUser', () => {
  it('swaps the active user', () => {
    const state = createState();
    const admin = state.users.find((u) => u.role === 'ADMINISTRATOR')!;
    expect(setCurrentUser(state, admin).currentUser.id).toBe(admin.id);
  });
});
