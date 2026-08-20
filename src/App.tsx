import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import {
  User,
  Ticket,
  ActiveView,
  TicketStatus,
  TicketCategory,
  UserRole,
  Branch,
  BranchAssignment,
  NotificationItem,
} from "./types";
import { AdminTab, pathForView, parsePath } from "./routes";
import { storage } from "./services/storageService";
import { connectRealtime } from "./services/realtime";
import {
  browserNotification,
  cancelPendingAlarms,
  playChime,
  primeAudio,
  requestNotificationPermission,
} from "./services/notify";
import { NotificationToasts, ToastItem } from "./components/NotificationToasts";
import { SkeletonCard, SkeletonTable } from "./components/ui/Skeleton";
import type {
  CreateBranchParams,
  CreateCategoryParams,
  CreateUserParams,
  UpdateCategoryChanges,
  UpdateUserChanges,
} from "./services/store";
import { Header } from "./components/Header";
import { Sidebar } from "./components/Sidebar";
import { RequirementStatusModal } from "./components/RequirementStatusModal";
import { GuidedDemoModal } from "./components/GuidedDemoModal";
import { LoginView } from "./views/LoginView";
import { ChangePasswordView } from "./views/ChangePasswordView";
import { BranchDashboardView } from "./views/BranchDashboardView";
import { TicketListView } from "./views/TicketListView";
import { TicketDetailView } from "./views/TicketDetailView";
import { ItDashboardView } from "./views/ItDashboardView";
import { AdminDashboardView } from "./views/AdminDashboardView";
import { NotificationsView } from "./views/NotificationsView";
import { ProfileView } from "./views/ProfileView";
import { ReportsView } from "./views/ReportsView";
import { CreateTicketView } from "./views/CreateTicketView";
import { WallboardView } from "./views/WallboardView";

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();

  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() =>
    storage.hasSession(),
  );
  const [isInitializing, setIsInitializing] = useState<boolean>(true);
  const [currentUser, setCurrentUser] = useState<User>(() =>
    storage.getCurrentUser(),
  );
  const [allUsers, setAllUsers] = useState<User[]>(() => storage.getUsers());
  const [tickets, setTickets] = useState<Ticket[]>(() => storage.getTickets());
  const [notifications, setNotifications] = useState<NotificationItem[]>(() =>
    storage.getNotifications(storage.getCurrentUser().id),
  );
  const [allNotifications, setAllNotifications] = useState<NotificationItem[]>(
    () => storage.getState().notifications,
  );
  const [activeView, setActiveView] = useState<ActiveView>("dashboard");
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [adminTab, setAdminTab] = useState<AdminTab>("overview");
  const [wallboardStaffId, setWallboardStaffId] = useState<string | undefined>(
    undefined,
  );
  const [ticketStatusFilter, setTicketStatusFilter] = useState<string>("ALL");

  // Modals state
  const [showReqModal, setShowReqModal] = useState<boolean>(false);
  const [showDemoGuideModal, setShowDemoGuideModal] = useState<boolean>(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);

  // Notification popups
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const seenNotifIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    primeAudio();
  }, []);

  /**
   * Mark already-read notifications as seen without dropping ids that were
   * flagged while storage.init() was still resolving (polling/SSE effects run
   * concurrently with the async restore). Replacing the ref wholesale would
   * re-trigger the same notifications as duplicate toasts with identical keys.
   */
  const seedSeenNotifIds = useCallback(() => {
    const next = new Set(seenNotifIds.current);
    for (const n of storage.getNotifications(storage.getCurrentUser().id)) {
      if (n.read) next.add(n.id);
    }
    seenNotifIds.current = next;
  }, []);

  /** Open a ticket from a notification popup / toast. */
  const openFromNotification = useCallback(
    (notificationId: string, ticketId: string) => {
      setToasts((prev) => prev.filter((t) => t.id !== notificationId));
      // Some notifications (e.g. password-reset requests) reference a user id
      // instead of a ticket — send the admin to the Users directory.
      if (!storage.getTicketById(ticketId)) {
        setAdminTab("users");
        setActiveView("users");
        navigate(pathForView("users", "users"));
        return;
      }
      setSelectedTicketId(ticketId);
      setActiveView("ticket_detail");
      navigate(pathForView("ticket_detail", undefined, ticketId));
    },
    [navigate],
  );

  /** Fire popups + sound for notifications the current session has not seen. */
  const detectNewNotifications = useCallback(() => {
    const user = storage.getCurrentUser();
    if (!user?.id) return;
    const fresh = storage
      .getNotifications(user.id)
      .filter((n) => !seenNotifIds.current.has(n.id));
    if (fresh.length === 0) return;
    for (const n of fresh) seenNotifIds.current.add(n.id);
    playChime();
    for (const n of fresh.slice(0, 5)) {
      setToasts((prev) =>
        prev.some((t) => t.id === n.id)
          ? prev
          : [...prev, { id: n.id, notification: n }],
      );
      browserNotification(n.title, n.message, () =>
        openFromNotification(n.id, n.ticketId),
      );
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== n.id));
      }, 7000);
    }
  }, [openFromNotification]);

  // Refresh dataset from the in-memory mirror
  const refreshData = useCallback(() => {
    setTickets(storage.getTickets());
    setAllUsers(storage.getUsers());
    setNotifications(storage.getNotifications(storage.getCurrentUser().id));
    setAllNotifications(storage.getState().notifications);
  }, []);

  // Restore an existing session on mount
  useEffect(() => {
    let cancelled = false;
    storage.init().then((restored) => {
      if (cancelled) return;
      setIsInitializing(false);
      if (restored) {
        refreshData();
        setCurrentUser(storage.getCurrentUser());
        setIsLoggedIn(true);
        // Only pre-see notifications that are already read; unread ones will
        // trigger the alarm + popups below.
        seedSeenNotifIds();
        detectNewNotifications();
      } else {
        setIsLoggedIn(false);
        cancelPendingAlarms();
      }
    });
    return () => {
      cancelled = true;
    };
  }, [refreshData, detectNewNotifications, seedSeenNotifIds]);

  // Keep state in sync with the URL (browser back/forward, deep links)
  useEffect(() => {
    const parsed = parsePath(location.pathname);
    if (!parsed) return;
    if (parsed.view === "requirements") {
      setShowReqModal(true);
      setActiveView("dashboard");
      return;
    }
    setActiveView(parsed.view);
    setAdminTab(parsed.adminTab ?? "overview");
    if (parsed.ticketId) setSelectedTicketId(parsed.ticketId);
    if (parsed.staffId) setWallboardStaffId(parsed.staffId);
  }, [location.pathname]);

  // Poll for changes made in other tabs / sessions
  useEffect(() => {
    if (!isLoggedIn) return;
    let active = true;
    const sync = async () => {
      await storage.refresh();
      if (active) {
        refreshData();
        detectNewNotifications();
      }
    };
    const interval = setInterval(() => void sync(), 15000);
    const onFocus = () => void sync();
    const onVisible = () => {
      if (document.visibilityState === "visible") void sync();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active = false;
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [isLoggedIn, refreshData, detectNewNotifications]);

  // Real-time updates pushed by the server (SSE); polling remains as fallback.
  useEffect(() => {
    if (!isLoggedIn) return;
    let cancelled = false;
    const handleRealtime = () => {
      void storage.refresh().then(() => {
        if (!cancelled) {
          refreshData();
          detectNewNotifications();
        }
      });
    };
    const disconnect = connectRealtime(handleRealtime);
    return () => {
      cancelled = true;
      disconnect();
    };
  }, [isLoggedIn, refreshData, detectNewNotifications]);

  /** Navigate to a view, updating both state and the URL. */
  const go = useCallback(
    (
      view: ActiveView,
      opts?: { adminTab?: AdminTab; ticketId?: string; staffId?: string },
    ) => {
      if (view === "requirements") {
        setShowReqModal(true);
        return;
      }
      setActiveView(view);
      setAdminTab(opts?.adminTab ?? "overview");
      if (opts?.ticketId) setSelectedTicketId(opts.ticketId);
      if (opts?.staffId) setWallboardStaffId(opts.staffId);
      navigate(
        pathForView(view, opts?.adminTab, opts?.ticketId, opts?.staffId),
      );
    },
    [navigate],
  );

  const handleLogin = async (username: string, password: string) => {
    const user = await storage.login(username, password);
    setCurrentUser(user);
    setIsLoggedIn(true);
    refreshData();
    // Only pre-see notifications that are already read; unread ones will
    // trigger the alarm + popups below.
    seedSeenNotifIds();
    requestNotificationPermission();
    detectNewNotifications();
    // Kiosk/control-room screens: stay on the wallboard they opened on.
    const parsed = parsePath(location.pathname);
    if (parsed?.view === "wallboard") {
      setActiveView("wallboard");
      if (parsed.staffId) setWallboardStaffId(parsed.staffId);
    } else {
      setActiveView("dashboard");
      navigate("/");
    }
  };

  const handleLogout = async () => {
    cancelPendingAlarms();
    await storage.logout();
    setIsLoggedIn(false);
    navigate("/login");
  };

  const handleChangePassword = async (
    currentPassword: string,
    newPassword: string,
  ) => {
    const updated = await storage.changePassword(currentPassword, newPassword);
    setCurrentUser(updated);
    refreshData();
    setActiveView("dashboard");
    navigate("/");
  };

  const handleMarkAllRead = useCallback(async () => {
    await storage.markAllNotificationsRead(currentUser.id);
    refreshData();
  }, [currentUser.id, refreshData]);

  // Viewing the notification center clears the unread badge.
  useEffect(() => {
    if (activeView === "notifications") {
      void handleMarkAllRead();
    }
  }, [activeView, handleMarkAllRead]);

  const handleSwitchUser = async (user: User) => {
    try {
      const switched = await storage.impersonate(user);
      setCurrentUser(switched);
      refreshData();
      // Unread notifications for the switched account fire the alarm + popups.
      seenNotifIds.current = new Set(
        storage
          .getNotifications(switched.id)
          .filter((n) => n.read)
          .map((n) => n.id),
      );
      detectNewNotifications();
      if (activeView !== "ticket_detail") {
        go("dashboard");
      }
    } catch (err) {
      console.error("Failed to switch user", err);
    }
  };

  const handleQuickSwitchRole = (role: UserRole) => {
    const matched = allUsers.find((u) => u.role === role);
    if (matched) {
      handleSwitchUser(matched);
    }
  };

  // Ticket Operations
  const isViewOnly = currentUser.role === "AUDITOR";

  const handleCreateTicket = async (params: {
    subject: string;
    description: string;
    category: TicketCategory;
    subcategory?: string;
    attachmentName?: string;
    requesterName?: string;
  }): Promise<Ticket> => {
    if (isViewOnly) throw new Error("Auditors have read-only access.");
    const newTicket = await storage.createTicket(params);
    refreshData();
    return newTicket;
  };

  const handleUpdateTicketStatus = async (
    ticketId: string,
    newStatus: TicketStatus,
    notes?: string,
  ) => {
    if (isViewOnly) return;
    await storage.updateTicketStatus(ticketId, newStatus, notes);
    refreshData();
  };

  const handleAddComment = async (
    ticketId: string,
    content: string,
    isInternal: boolean,
  ) => {
    if (isViewOnly) return;
    await storage.addComment({ ticketId, content, isInternal });
    refreshData();
  };

  // Admin: user & branch management
  const handleCreateUser = async (user: CreateUserParams) => {
    try {
      await storage.createUser(user);
      refreshData();
    } catch (err) {
      window.alert(
        err instanceof Error ? err.message : "Failed to create user.",
      );
    }
  };

  const handleUpdateUser = async (
    userId: string,
    changes: UpdateUserChanges,
  ) => {
    try {
      await storage.updateUser(userId, changes);
      refreshData();
    } catch (err) {
      window.alert(
        err instanceof Error ? err.message : "Failed to update user.",
      );
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      await storage.deleteUser(userId);
      refreshData();
    } catch (err) {
      window.alert(
        err instanceof Error ? err.message : "Failed to delete user.",
      );
    }
  };

  const handleUpdateStaffAssignments = async (
    staffUserId: string,
    assignments: BranchAssignment[],
  ) => {
    try {
      await storage.updateStaffAssignments(staffUserId, assignments);
      refreshData();
    } catch (err) {
      window.alert(
        err instanceof Error
          ? err.message
          : "Failed to update staff assignments.",
      );
    }
  };

  const handleCreateBranch = async (branch: CreateBranchParams) => {
    try {
      await storage.createBranch(branch);
      refreshData();
    } catch (err) {
      window.alert(
        err instanceof Error ? err.message : "Failed to create branch.",
      );
    }
  };

  const handleCreateCategory = async (category: CreateCategoryParams) => {
    try {
      await storage.createCategory(category);
      refreshData();
    } catch (err) {
      window.alert(
        err instanceof Error ? err.message : "Failed to create category.",
      );
    }
  };

  const handleUpdateCategory = async (
    categoryId: string,
    changes: UpdateCategoryChanges,
  ) => {
    try {
      await storage.updateCategory(categoryId, changes);
      refreshData();
    } catch (err) {
      window.alert(
        err instanceof Error ? err.message : "Failed to update category.",
      );
    }
  };

  const handleUpdateBranch = async (
    branchId: string,
    changes: Partial<Branch>,
  ) => {
    try {
      await storage.updateBranch(branchId, changes);
      refreshData();
    } catch (err) {
      window.alert(
        err instanceof Error ? err.message : "Failed to update branch.",
      );
    }
  };

  const handleDeleteBranch = async (branchId: string) => {
    try {
      await storage.deleteBranch(branchId);
      refreshData();
    } catch (err) {
      window.alert(
        err instanceof Error ? err.message : "Failed to delete branch.",
      );
    }
  };

  const handleNavigateTicketDetail = (ticketId: string) => {
    // Notifications may reference a user (e.g. password-reset requests) rather
    // than a ticket. Only administrators should be routed to the Users
    // directory for those. A ticket may also be missing from the viewer's
    // scope (IT staff do not see unassigned tickets) — in that case do not
    // push a non-admin onto a page they are not allowed to see.
    if (!storage.getTicketById(ticketId)) {
      const isUserRef = allUsers.some((u) => u.id === ticketId);
      if (isUserRef && currentUser.role === "ADMINISTRATOR") {
        setAdminTab("users");
        setActiveView("users");
        navigate(pathForView("users", "users"));
      }
      return;
    }
    setSelectedTicketId(ticketId);
    setActiveView("ticket_detail");
    navigate(pathForView("ticket_detail", undefined, ticketId));
  };

  const onAdminTabSelect = (tab: AdminTab) => {
    setAdminTab(tab);
    navigate(pathForView("users", tab));
  };

  // Unread notifications for header
  const unreadCount = notifications.filter((n) => !n.read).length;

  const myOpenTicketCount = tickets.filter(
    (t) =>
      (t.branchId === currentUser.branchId ||
        t.requesterId === currentUser.id) &&
      t.status !== "Closed",
  ).length;

  const newTicketCount = tickets.filter(
    (t) => !t.assignedToId && t.status !== "Closed",
  ).length;

  const allBranches = storage.getBranches();
  const allStaff = allUsers.filter(
    (u) => u.role === "IT_STAFF" || u.role === "ADMINISTRATOR",
  );

  // Show skeleton loading screen while session is being restored
  if (isInitializing) {
    return (
      <div className="min-h-screen bg-slate-100">
        <div className="h-16 bg-white border-b border-slate-200" />
        <div className="flex">
          <div className="w-64 h-[calc(100vh-4rem)] bg-white border-r border-slate-200 p-4 hidden lg:block">
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="skeleton h-9 rounded-lg" />
              ))}
            </div>
          </div>
          <div className="flex-1 p-6 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
            <SkeletonTable rows={5} />
          </div>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <LoginView
        onLogin={handleLogin}
        onRequestPasswordReset={(u) => storage.requestPasswordReset(u)}
        onAdminRecovery={(u, k) => storage.adminRecovery(u, k)}
      />
    );
  }

  if (currentUser.mustChangePassword) {
    return (
      <ChangePasswordView
        currentUser={currentUser}
        onChangePassword={handleChangePassword}
        onLogout={handleLogout}
      />
    );
  }

  // Full-screen per-staff monitor wallboard (opened on a dedicated display).
  if (activeView === "wallboard") {
    return (
      <WallboardView
        staff={
          wallboardStaffId
            ? (allUsers.find((u) => u.id === wallboardStaffId) ?? null)
            : null
        }
        tickets={tickets}
        notifications={allNotifications}
      />
    );
  }

  const selectedTicket = selectedTicketId
    ? storage.getTicketById(selectedTicketId)
    : null;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans flex flex-col antialiased">
      {/* Main Top Header */}
      <Header
        currentUser={currentUser}
        allUsers={allUsers}
        notifications={notifications}
        unreadCount={unreadCount}
        onSwitchUser={handleSwitchUser}
        onLogout={handleLogout}
        onOpenNotifications={() => {
          go("notifications");
          void handleMarkAllRead();
        }}
        onMarkAllRead={handleMarkAllRead}
        onMarkNotificationRead={async (id) => {
          await storage.markNotificationAsRead(id);
          refreshData();
        }}
        onNavigateTicket={(id) => handleNavigateTicketDetail(id)}
        onNavigateProfile={() => go("profile")}
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        isSidebarOpen={isSidebarOpen}
      />

      {/* Main Body Layout */}
      <div className="flex-1 flex w-full">
        {/* Role-Specific Navigation Sidebar */}
        <Sidebar
          currentUser={currentUser}
          activeView={activeView}
          newTicketCount={newTicketCount}
          myOpenTicketCount={myOpenTicketCount}
          onNavigate={(view) => {
            if (
              view === "users" ||
              view === "branches" ||
              view === "categories" ||
              view === "it_staff" ||
              view === "activity_logs"
            ) {
              go("users", { adminTab: view });
            } else {
              if (view === "all_tickets") setTicketStatusFilter("ALL");
              go(view);
            }
          }}
          onLogout={handleLogout}
          isOpen={isSidebarOpen}
          onCloseMobile={() => setIsSidebarOpen(false)}
        />

        {/* Main Content Viewport */}
        <AnimatePresence mode="wait">
          <motion.main
            key={activeView}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="flex-1 p-4 sm:p-6 lg:p-8 min-w-0 overflow-hidden"
          >
          {/* DASHBOARD VIEW */}
          {activeView === "dashboard" && (
            <>
              {currentUser.role === "BRANCH_USER" && (
                <BranchDashboardView
                  currentUser={currentUser}
                  tickets={tickets}
                  onNavigateNewRequest={() => go("new_request")}
                  onNavigateTicketDetail={handleNavigateTicketDetail}
                />
              )}
              {currentUser.role === "IT_STAFF" && (
                <ItDashboardView
                  currentUser={currentUser}
                  tickets={tickets}
                  onNavigateTicketDetail={handleNavigateTicketDetail}
                  onNavigateAllTickets={() => go("all_tickets")}
                />
              )}
              {currentUser.role === "ADMINISTRATOR" && (
                <AdminDashboardView
                  users={allUsers}
                  branches={allBranches}
                  categories={storage.getCategories()}
                  auditLogs={storage.getAuditLogs()}
                  tickets={tickets}
                  notifications={allNotifications}
                  activeTab={adminTab}
                  onSelectTab={onAdminTabSelect}
                  onCreateUser={handleCreateUser}
                  onUpdateUser={handleUpdateUser}
                  onDeleteUser={handleDeleteUser}
                  onCreateBranch={handleCreateBranch}
                  onCreateCategory={handleCreateCategory}
                  onUpdateCategory={handleUpdateCategory}
                  onUpdateBranch={handleUpdateBranch}
                  onDeleteBranch={handleDeleteBranch}
                  onUpdateStaffAssignments={handleUpdateStaffAssignments}
                  onViewStatusTickets={(status) => {
                    setTicketStatusFilter(status);
                    go("all_tickets");
                  }}
                />
              )}
              {currentUser.role === "AUDITOR" && (
                <AdminDashboardView
                  mode="auditor"
                  users={allUsers}
                  branches={allBranches}
                  categories={storage.getCategories()}
                  auditLogs={storage.getAuditLogs()}
                  tickets={tickets}
                  notifications={allNotifications}
                  activeTab={adminTab}
                  onSelectTab={onAdminTabSelect}
                  onViewStatusTickets={(status) => {
                    setTicketStatusFilter(status);
                    go("all_tickets");
                  }}
                />
              )}
            </>
          )}

          {/* CREATE TICKET VIEW */}
          {activeView === "new_request" && (
            <CreateTicketView
              currentUser={currentUser}
              categories={storage.getCategories()}
              onSubmitTicket={handleCreateTicket}
              onNavigateBack={() => go("dashboard")}
              onNavigateTicketDetail={handleNavigateTicketDetail}
            />
          )}

          {/* TICKET LIST VIEWS */}
          {activeView === "my_tickets" && (
            <TicketListView
              currentUser={currentUser}
              tickets={tickets.filter(
                (t) =>
                  t.branchId === currentUser.branchId ||
                  t.requesterId === currentUser.id,
              )}
              allBranches={allBranches}
              allStaff={allStaff}
              title={`${currentUser.branchName || "Branch"} IT Requests`}
              subtitle="All IT concerns and requests submitted from your branch location"
              onNavigateTicketDetail={handleNavigateTicketDetail}
              onNavigateNewRequest={() => go("new_request")}
            />
          )}

          {activeView === "all_tickets" && (
            <TicketListView
              currentUser={currentUser}
              tickets={tickets}
              allBranches={allBranches}
              allStaff={allStaff}
              title="Main IT Queue — All Tickets"
              subtitle="Comprehensive repository of IT tickets across all Bayanihan Bank branches"
              onNavigateTicketDetail={handleNavigateTicketDetail}
              initialStatusFilter={ticketStatusFilter}
            />
          )}

          {activeView === "assigned_tickets" && (
            <TicketListView
              currentUser={currentUser}
              tickets={tickets.filter((t) => t.assignedToId === currentUser.id)}
              allBranches={allBranches}
              allStaff={allStaff}
              title="My Assigned Tickets"
              subtitle={`IT tickets assigned to ${currentUser.name}`}
              onNavigateTicketDetail={handleNavigateTicketDetail}
            />
          )}

          {activeView === "in_progress" && (
            <TicketListView
              currentUser={currentUser}
              tickets={tickets.filter((t) => t.status === "In Progress")}
              allBranches={allBranches}
              allStaff={allStaff}
              title="In Progress Tickets Queue"
              subtitle="IT tickets actively being worked on by Main IT Specialist"
              onNavigateTicketDetail={handleNavigateTicketDetail}
            />
          )}

          {activeView === "resolved_tickets" && (
            <TicketListView
              currentUser={currentUser}
              tickets={tickets.filter((t) => t.status === "Resolved")}
              allBranches={allBranches}
              allStaff={allStaff}
              title="Resolved Tickets Queue"
              subtitle="Tickets marked resolved by IT awaiting branch confirmation"
              onNavigateTicketDetail={handleNavigateTicketDetail}
            />
          )}

          {/* TICKET DETAIL VIEW */}
          {activeView === "ticket_detail" && selectedTicket && (
            <TicketDetailView
              ticket={selectedTicket}
              comments={storage.getComments(selectedTicket.id)}
              timeline={storage.getTimeline(selectedTicket.id)}
              currentUser={currentUser}
              onNavigateBack={() => go("dashboard")}
              onUpdateStatus={handleUpdateTicketStatus}
              onAddComment={handleAddComment}
            />
          )}

          {/* ADMIN MANAGEMENT VIEWS */}
          {activeView === "users" && (
            <AdminDashboardView
              mode={currentUser.role === "AUDITOR" ? "auditor" : "admin"}
              users={allUsers}
              branches={allBranches}
              categories={storage.getCategories()}
              auditLogs={storage.getAuditLogs()}
              tickets={tickets}
              notifications={allNotifications}
              activeTab={adminTab}
              onSelectTab={onAdminTabSelect}
              onCreateUser={handleCreateUser}
              onUpdateUser={handleUpdateUser}
              onDeleteUser={handleDeleteUser}
              onCreateBranch={handleCreateBranch}
              onCreateCategory={handleCreateCategory}
              onUpdateCategory={handleUpdateCategory}
              onUpdateBranch={handleUpdateBranch}
              onDeleteBranch={handleDeleteBranch}
              onUpdateStaffAssignments={handleUpdateStaffAssignments}
            />
          )}

          {/* REPORTS VIEW */}
          {activeView === "reports" && (
            <ReportsView
              tickets={tickets}
              branches={allBranches}
              categories={storage.getCategories()}
              users={allUsers}
            />
          )}

          {/* NOTIFICATIONS VIEW */}
          {activeView === "notifications" && (
            <NotificationsView
              notifications={notifications}
              onMarkRead={async (id) => {
                await storage.markNotificationAsRead(id);
                refreshData();
              }}
              onNavigateTicket={handleNavigateTicketDetail}
            />
          )}

          {/* PROFILE VIEW */}
          {activeView === "profile" && (
            <ProfileView
              currentUser={currentUser}
              onChangePassword={handleChangePassword}
            />
          )}
          </motion.main>
        </AnimatePresence>
      </div>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 border-t border-slate-800 text-xs py-4 px-6 text-center space-y-1">
        <div>
          <strong>Bayanihan Bank IT Service Desk</strong> (August 7, 2026)
        </div>
        <div className="text-[11px] text-slate-500">
          Fictional Demo Data Only
        </div>
      </footer>

      {/* Modals */}
      <RequirementStatusModal
        isOpen={showReqModal}
        onClose={() => setShowReqModal(false)}
      />

      <GuidedDemoModal
        isOpen={showDemoGuideModal}
        onClose={() => setShowDemoGuideModal(false)}
        onQuickSwitchRole={handleQuickSwitchRole}
        onNavigateView={(view, ticketId) => {
          if (ticketId) {
            handleNavigateTicketDetail(ticketId);
          } else {
            go(view as ActiveView);
          }
        }}
      />

      {/* Real-time notification popups (never on the login page) */}
      {isLoggedIn && (
        <NotificationToasts
          toasts={toasts}
          onDismiss={(id) =>
            setToasts((prev) => prev.filter((t) => t.id !== id))
          }
          onOpen={(notification) =>
            openFromNotification(notification.id, notification.ticketId)
          }
        />
      )}
    </div>
  );
}
