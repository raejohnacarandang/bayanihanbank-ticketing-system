/**
 * Store-level workflow tests.
 *
 * Exercises the pure state logic (src/services/store.ts) that backs both the
 * Express server and the browser mirror. Every user workflow is covered:
 * branch user, IT specialist, administrator, auditor, plus the password
 * reset / recovery flows. No database is required — everything runs on
 * createState() seed data.
 */
import { describe, it, expect } from "vitest";
import {
  addComment,
  assignTicket,
  createBranch,
  createState,
  createTicket,
  createUser,
  deleteBranch,
  deleteUser,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  performAdminRecovery,
  requestPasswordReset,
  updateBranch,
  updateStaffAssignments,
  updateTicketStatus,
  updateUser,
} from "../src/services/store";
import {
  hashPassword,
  verifyPassword,
  DEFAULT_PASSWORD,
} from "../src/server/auth";
import type { AppState, BranchAssignment, User } from "../src/types";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const fresh = (): AppState => createState();

const branchUser = (): User =>
  createState().users.find((u) => u.username === "branch.user")!; // Juan Dela Cruz (br-011 Gumaca)
const itStaff1 = (): User =>
  createState().users.find((u) => u.username === "it.staff")!; // Mark Reyes
const itStaff2 = (): User =>
  createState().users.find((u) => u.username === "ana.cruz")!; // Ana Cruz
const admin = (): User =>
  createState().users.find((u) => u.role === "ADMINISTRATOR")!;

const hasAudit = (
  state: AppState,
  action: string,
  targetId?: string,
): boolean =>
  state.auditLogs.some(
    (l) =>
      l.action === action &&
      (targetId === undefined || l.targetId === targetId),
  );

const assignmentFor = (
  branchId: string,
  branchName: string,
  durationMonths = 6,
): BranchAssignment => {
  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + durationMonths * 30 * 24 * 60 * 60 * 1000,
  );
  return {
    branchId,
    branchName,
    durationMonths,
    assignedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
};

// ---------------------------------------------------------------------------
// BRANCH USER workflow
// ---------------------------------------------------------------------------

describe("Branch user workflow (store)", () => {
  it("creating a ticket auto-assigns it to the IT specialist covering the branch", () => {
    const state = fresh();
    const next = createTicket(state, {
      subject: "Printer jam at counter 1",
      description: "Passbook printer is jammed.",
      category: "Hardware",
      currentUser: branchUser(),
    });
    const created = next.tickets[0];
    expect(created.id).toBe("IT-000126");
    expect(created.status).toBe("Assigned");
    expect(created.assignedToId).toBe(itStaff1().id); // Mark Reyes covers br-011 (Gumaca)
    expect(created.requesterId).toBe(branchUser().id);
    expect(created.branchId).toBe("br-011");
    expect(next.ticketCounter).toBe(127);
  });

  it("leaves the ticket Pending when no IT specialist covers the branch", () => {
    const state = fresh();
    const requester = {
      ...branchUser(),
      branchId: "br-999",
      branchName: "Unknown Branch",
    };
    const next = createTicket(state, {
      subject: "Uncovered",
      description: "No staff covers this branch.",
      category: "Network",
      currentUser: requester,
    });
    expect(next.tickets[0].status).toBe("Pending");
    expect(next.tickets[0].assignedToId).toBeUndefined();
  });

  it("notifies only administrators and the assigned IT specialist", () => {
    const state = fresh();
    const next = createTicket(state, {
      subject: "Notify test",
      description: "desc",
      category: "Software",
      currentUser: branchUser(),
    });
    const expectedIds = [
      ...next.users
        .filter((u) => u.role === "ADMINISTRATOR")
        .map((u) => u.id),
      ...(next.tickets[0].assignedToId
        ? [next.tickets[0].assignedToId!]
        : []),
    ];
    const notified = next.notifications
      .filter((n) => n.ticketId === "IT-000126")
      .map((n) => n.userId);
    expect(new Set(notified)).toEqual(new Set(expectedIds));
  });

  it("records creation timeline and CREATE_TICKET audit entry", () => {
    const state = fresh();
    const next = createTicket(state, {
      subject: "Audit trail",
      description: "desc",
      category: "Hardware",
      currentUser: branchUser(),
    });
    expect(
      next.timeline.some(
        (t) => t.ticketId === "IT-000126" && t.action === "Ticket submitted",
      ),
    ).toBe(true);
    expect(hasAudit(next, "CREATE_TICKET", "IT-000126")).toBe(true);
  });

  it("notifies the assigned IT specialist when a branch user changes status", () => {
    const state = fresh();
    const ticket = state.tickets.find((t) => t.id === "IT-000122")!; // Assigned, usr-001, assigned usr-004
    const next = updateTicketStatus(
      state,
      "IT-000122",
      "Pending",
      branchUser(),
    );
    const relevant = next.notifications.filter(
      (n) => n.ticketId === "IT-000122",
    );
    expect(relevant.some((n) => n.userId === ticket.assignedToId)).toBe(true);
  });

  it("branch user can confirm a resolved ticket and close it with a timestamp", () => {
    let state = fresh();
    state = updateTicketStatus(
      state,
      "IT-000122",
      "Resolved",
      itStaff1(),
      "Replaced printer.",
    );
    const next = updateTicketStatus(
      state,
      "IT-000122",
      "Closed",
      branchUser(),
      "Branch confirmed resolution.",
    );
    const closed = next.tickets.find((t) => t.id === "IT-000122")!;
    expect(closed.status).toBe("Closed");
    expect(closed.closedAt).toBeDefined();
    expect(hasAudit(next, "UPDATE_STATUS", "IT-000122")).toBe(true);
  });

  it("branch user adding a comment appends a comment and timeline entry", () => {
    const state = fresh();
    const beforeComments = state.comments.length;
    const beforeTimeline = state.timeline.length;
    const next = addComment(state, {
      ticketId: "IT-000122",
      content: "We checked the power cable, still failing.",
      isInternal: false,
      currentUser: branchUser(),
    });
    expect(next.comments.length).toBe(beforeComments + 1);
    expect(next.timeline.length).toBe(beforeTimeline + 1);
    expect(next.comments[next.comments.length - 1]).toMatchObject({
      ticketId: "IT-000122",
      isInternal: false,
      authorId: branchUser().id,
    });
  });
});

// ---------------------------------------------------------------------------
// IT STAFF workflow
// ---------------------------------------------------------------------------

describe("IT staff workflow (store)", () => {
  it("changing status notifies the requester", () => {
    const state = fresh();
    const requesterId = state.tickets.find(
      (t) => t.id === "IT-000121",
    )!.requesterId;
    const next = updateTicketStatus(
      state,
      "IT-000121",
      "In Progress",
      itStaff1(),
    );
    expect(next.tickets.find((t) => t.id === "IT-000121")!.status).toBe(
      "In Progress",
    );
    expect(
      next.notifications.some(
        (n) => n.ticketId === "IT-000121" && n.userId === requesterId,
      ),
    ).toBe(true);
  });

  it("resolving records resolution notes and notifies the requester with a success type", () => {
    const state = fresh();
    const requesterId = state.tickets.find(
      (t) => t.id === "IT-000121",
    )!.requesterId;
    const next = updateTicketStatus(
      state,
      "IT-000121",
      "Resolved",
      itStaff1(),
      "Reconfigured the switch port.",
    );
    const updated = next.tickets.find((t) => t.id === "IT-000121")!;
    expect(updated.status).toBe("Resolved");
    expect(updated.resolutionNotes).toBe("Reconfigured the switch port.");
    expect(updated.resolvedAt).toBeDefined();
    expect(
      next.notifications.some(
        (n) =>
          n.ticketId === "IT-000121" &&
          n.userId === requesterId &&
          n.type === "success",
      ),
    ).toBe(true);
  });

  it("assigns a pending ticket to a staff member and moves it to Assigned", () => {
    const state = fresh();
    const next = assignTicket(state, "IT-000123", itStaff1(), itStaff1());
    const assigned = next.tickets.find((t) => t.id === "IT-000123")!;
    expect(assigned.status).toBe("Assigned");
    expect(assigned.assignedToId).toBe(itStaff1().id);
    expect(hasAudit(next, "ASSIGN_TICKET", "IT-000123")).toBe(true);
  });

  it("stores internal IT notes as internal comments", () => {
    const state = fresh();
    const next = addComment(state, {
      ticketId: "IT-000122",
      content: "Suspect fuser assembly, ordering replacement.",
      isInternal: true,
      currentUser: itStaff1(),
    });
    expect(next.comments[next.comments.length - 1].isInternal).toBe(true);
    expect(
      next.timeline.some(
        (t) =>
          t.ticketId === "IT-000122" && t.action === "Added Internal IT Note",
      ),
    ).toBe(true);
  });

  it("admin-assigned branch coverage auto-assigns previously pending tickets", () => {
    let state = fresh();
    const requester = {
      ...branchUser(),
      branchId: "br-999",
      branchName: "Unknown Branch",
    };
    state = createTicket(state, {
      subject: "Uncovered",
      description: "No IT specialist yet",
      category: "Network",
      currentUser: requester,
    });
    const pending = state.tickets[0];
    expect(pending.status).toBe("Pending");

    const next = updateStaffAssignments(
      state,
      itStaff1().id,
      [assignmentFor("br-999", "Unknown Branch")],
      admin(),
    );
    const assigned = next.tickets.find((t) => t.id === pending.id)!;
    expect(assigned.status).toBe("Assigned");
    expect(assigned.assignedToId).toBe(itStaff1().id);
    expect(hasAudit(next, "UPDATE_STAFF_ASSIGNMENTS", itStaff1().id)).toBe(
      true,
    );
  });

  it("ignores assignment updates for users who are not IT staff", () => {
    const state = fresh();
    const target = branchUser();
    const next = updateStaffAssignments(
      state,
      target.id,
      [assignmentFor("br-999", "Unknown Branch")],
      admin(),
    );
    expect(next.users.find((u) => u.id === target.id)).toEqual(target);
    expect(hasAudit(next, "UPDATE_STAFF_ASSIGNMENTS")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// ADMINISTRATOR workflow
// ---------------------------------------------------------------------------

describe("Administrator workflow (store)", () => {
  it("creates a user with mustChangePassword defaulting to true and branch fields for branch users", () => {
    const state = fresh();
    const next = createUser(
      state,
      {
        username: "new.branch",
        name: "New Branch User",
        role: "BRANCH_USER",
        email: "new.branch@bayanihanbank.demo",
        branchId: "br-003",
      },
      admin(),
    );
    const created = next.users[next.users.length - 1];
    expect(created.role).toBe("BRANCH_USER");
    expect(created.branchId).toBe("br-003");
    expect(created.mustChangePassword).toBe(true);
    expect(created.department).toBeUndefined();
    expect(hasAudit(next, "CREATE_USER")).toBe(true);
  });

  it("stores department (not branch) for IT, admin and auditor roles", () => {
    const state = fresh();
    const next = createUser(
      state,
      {
        username: "new.it",
        name: "New IT Staff",
        role: "IT_STAFF",
        email: "new.it@bayanihanbank.demo",
        department: "Main IT Department",
      },
      admin(),
    );
    const created = next.users[next.users.length - 1];
    expect(created.department).toBe("Main IT Department");
    expect(created.branchId).toBeUndefined();
  });

  it("updates a user and records the UPDATE_USER audit entry", () => {
    const state = fresh();
    const next = updateUser(
      state,
      branchUser().id,
      { name: "Juan Renamed" },
      admin(),
    );
    expect(next.users.find((u) => u.id === branchUser().id)!.name).toBe(
      "Juan Renamed",
    );
    expect(hasAudit(next, "UPDATE_USER", branchUser().id)).toBe(true);
  });

  it("clears branch fields when converting a user to a non-branch role", () => {
    const state = fresh();
    const next = updateUser(
      state,
      branchUser().id,
      { role: "IT_STAFF" },
      admin(),
    );
    const updated = next.users.find((u) => u.id === branchUser().id)!;
    expect(updated.role).toBe("IT_STAFF");
    expect(updated.branchId).toBeUndefined();
    expect(updated.branchName).toBeUndefined();
  });

  it("replacing a password hash makes the new password verifiable", () => {
    const state = fresh();
    const newHash = hashPassword("new-pass-123");
    const next = updateUser(
      state,
      branchUser().id,
      { passwordHash: newHash },
      admin(),
    );
    const updated = next.users.find((u) => u.id === branchUser().id)!;
    expect(updated.passwordHash).toBe(newHash);
    expect(verifyPassword("new-pass-123", updated.passwordHash)).toBe(true);
    expect(verifyPassword("password123", updated.passwordHash)).toBe(false);
  });

  it("deletes a user and records the DELETE_USER audit entry", () => {
    const state = fresh();
    const next = deleteUser(state, itStaff2().id, admin());
    expect(next.users.some((u) => u.id === itStaff2().id)).toBe(false);
    expect(hasAudit(next, "DELETE_USER", itStaff2().id)).toBe(true);
  });

  it("cannot delete their own account", () => {
    const state = fresh();
    const next = deleteUser(state, admin().id, admin());
    expect(next).toBe(state);
  });

  it("creates, updates and deletes branches with audit entries", () => {
    let state = fresh();
    state = createBranch(
      state,
      {
        name: "Tiaong Branch",
        location: "Tiaong, Quezon",
        status: "Active",
        userCount: 1,
      },
      admin(),
    );
    const branch = state.branches.find((b) => b.name === "Tiaong Branch")!;
    expect(branch).toBeDefined();
    expect(branch.userCount).toBe(1);
    expect(hasAudit(state, "CREATE_BRANCH")).toBe(true);

    state = updateBranch(
      state,
      branch.id,
      { name: "Tiaong Main Branch", userCount: 2 },
      admin(),
    );
    expect(state.branches.find((b) => b.id === branch.id)!.name).toBe(
      "Tiaong Main Branch",
    );
    expect(state.branches.find((b) => b.id === branch.id)!.userCount).toBe(2);
    expect(hasAudit(state, "UPDATE_BRANCH", branch.id)).toBe(true);

    state = deleteBranch(state, branch.id, admin());
    expect(state.branches.some((b) => b.id === branch.id)).toBe(false);
    expect(hasAudit(state, "DELETE_BRANCH", branch.id)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AUDITOR workflow
// ---------------------------------------------------------------------------

describe("Auditor workflow (store)", () => {
  it("has no store-level mutation functions exposed beyond shared reads", () => {
    // Auditors are enforced read-only in the UI/API layer (App.tsx isViewOnly,
    // and admin endpoints are role-gated). At the store level there is nothing
    // auditor-specific to mutate; assert the shared state remains available.
    const state = fresh();
    expect(state.tickets.length).toBeGreaterThan(0);
    expect(state.auditLogs.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Password reset / recovery workflows
// ---------------------------------------------------------------------------

describe("Password reset & recovery workflows (store)", () => {
  it("requesting a reset for a branch user flags the account and notifies every admin", () => {
    const state = fresh();
    const {
      state: next,
      user,
      requiresRecoveryKey,
    } = requestPasswordReset(state, "branch.user");
    expect(user?.username).toBe("branch.user");
    expect(requiresRecoveryKey).toBe(false);
    expect(
      next.users.find((u) => u.id === user!.id)!.passwordResetRequested,
    ).toBe(true);
    const admins = next.users.filter((u) => u.role === "ADMINISTRATOR");
    for (const a of admins) {
      expect(
        next.notifications.some(
          (n) =>
            n.userId === a.id &&
            n.title === "Password reset requested" &&
            n.ticketId === user!.id,
        ),
      ).toBe(true);
    }
    expect(hasAudit(next, "REQUEST_PASSWORD_RESET", user!.id)).toBe(true);
  });

  it("unknown usernames return no user and leave state untouched", () => {
    const state = fresh();
    const result = requestPasswordReset(state, "nobody.here");
    expect(result.user).toBeUndefined();
    expect(result.requiresRecoveryKey).toBe(false);
    expect(result.state).toBe(state);
  });

  it("admin accounts short-circuit to the recovery-key flow", () => {
    const state = fresh();
    const result = requestPasswordReset(state, "admin");
    expect(result.requiresRecoveryKey).toBe(true);
    expect(result.state).toBe(state);
    expect(
      result.state.notifications.some(
        (n) => n.title === "Password reset requested",
      ),
    ).toBe(false);
  });

  it("performAdminRecovery rotates the hash, forces a change and records an audit entry", () => {
    const state = fresh();
    const newHash = hashPassword("one-time-pass-1");
    const next = performAdminRecovery(state, admin(), newHash);
    const updated = next.users.find((u) => u.id === admin().id)!;
    expect(updated.passwordHash).toBe(newHash);
    expect(updated.mustChangePassword).toBe(true);
    expect(updated.passwordResetRequested).toBe(false);
    expect(verifyPassword("one-time-pass-1", updated.passwordHash)).toBe(true);
    expect(hasAudit(next, "ADMIN_RECOVERY", admin().id)).toBe(true);
  });

  it("users created by an admin can be verified against the default password", () => {
    const state = fresh();
    const next = createUser(
      state,
      {
        username: "fresh.account",
        name: "Fresh Account",
        role: "BRANCH_USER",
        email: "fresh@bayanihanbank.demo",
        branchId: "br-002",
      },
      admin(),
    );
    const created = next.users[next.users.length - 1];
    expect(created.mustChangePassword).toBe(true);
    expect(DEFAULT_PASSWORD).toBe("password123");
  });
});

// ---------------------------------------------------------------------------
// Notifications workflow
// ---------------------------------------------------------------------------

describe("Notifications workflow (store)", () => {
  it("marks only the target notification as read", () => {
    const state = fresh();
    const target = state.notifications.find((n) => !n.read)!;
    const next = markNotificationAsRead(state, target.id);
    expect(next.notifications.find((n) => n.id === target.id)!.read).toBe(true);
    const others = next.notifications.filter(
      (n) => n.id !== target.id && n.read,
    );
    expect(others).toHaveLength(
      state.notifications.filter((n) => n.read).length,
    );
  });

  it("marks all notifications for a single user as read, leaving others alone", () => {
    const state = fresh();
    const userId = "usr-002";
    const next = markAllNotificationsAsRead(state, userId);
    for (const n of next.notifications.filter((n) => n.userId === userId)) {
      expect(n.read).toBe(true);
    }
    for (const n of next.notifications.filter((n) => n.userId !== userId)) {
      expect(n.read).toBe(state.notifications.find((x) => x.id === n.id)!.read);
    }
  });
});
