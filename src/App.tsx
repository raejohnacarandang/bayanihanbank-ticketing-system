import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  User,
  Ticket,
  ActiveView,
  TicketStatus,
  TicketPriority,
  TicketCategory,
  UserRole,
  Branch,
  BranchAssignment
} from './types';
import { AdminTab, pathForView, parsePath } from './routes';
import { storage } from './services/storageService';
import type {
  CreateBranchParams,
  CreateUserParams,
  UpdateUserChanges
} from './services/store';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { PrototypeBanner } from './components/PrototypeBanner';
import { RequirementStatusModal } from './components/RequirementStatusModal';
import { GuidedDemoModal } from './components/GuidedDemoModal';
import { LoginView } from './views/LoginView';
import { BranchDashboardView } from './views/BranchDashboardView';
import { CreateTicketView } from './views/CreateTicketView';
import { TicketListView } from './views/TicketListView';
import { TicketDetailView } from './views/TicketDetailView';
import { ItDashboardView } from './views/ItDashboardView';
import { AdminDashboardView } from './views/AdminDashboardView';
import { NotificationsView } from './views/NotificationsView';
import { ProfileView } from './views/ProfileView';

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();

  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => storage.hasSession());
  const [currentUser, setCurrentUser] = useState<User>(() => storage.getCurrentUser());
  const [allUsers, setAllUsers] = useState<User[]>(() => storage.getUsers());
  const [tickets, setTickets] = useState<Ticket[]>(() => storage.getTickets());
  const [activeView, setActiveView] = useState<ActiveView>('dashboard');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [adminTab, setAdminTab] = useState<AdminTab>('overview');

  // Modals state
  const [showReqModal, setShowReqModal] = useState<boolean>(false);
  const [showDemoGuideModal, setShowDemoGuideModal] = useState<boolean>(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);

  // Refresh dataset from the in-memory mirror
  const refreshData = useCallback(() => {
    setTickets(storage.getTickets());
    setAllUsers(storage.getUsers());
  }, []);

  // Restore an existing session on mount
  useEffect(() => {
    let cancelled = false;
    storage.init().then((restored) => {
      if (cancelled) return;
      if (restored) {
        refreshData();
        setCurrentUser(storage.getCurrentUser());
        setIsLoggedIn(true);
      } else {
        setIsLoggedIn(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [refreshData]);

  // Keep state in sync with the URL (browser back/forward, deep links)
  useEffect(() => {
    const parsed = parsePath(location.pathname);
    if (!parsed) return;
    if (parsed.view === 'requirements') {
      setShowReqModal(true);
      setActiveView('dashboard');
      return;
    }
    setActiveView(parsed.view);
    if (parsed.adminTab) setAdminTab(parsed.adminTab);
    if (parsed.ticketId) setSelectedTicketId(parsed.ticketId);
  }, [location.pathname]);

  // Poll for changes made in other tabs / sessions
  useEffect(() => {
    let active = true;
    const sync = async () => {
      await storage.refresh();
      if (active) refreshData();
    };
    const interval = setInterval(() => void sync(), 30000);
    const onFocus = () => void sync();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void sync();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      active = false;
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refreshData]);

  /** Navigate to a view, updating both state and the URL. */
  const go = useCallback(
    (view: ActiveView, opts?: { adminTab?: AdminTab; ticketId?: string }) => {
      if (view === 'requirements') {
        setShowReqModal(true);
        return;
      }
      setActiveView(view);
      if (opts?.adminTab) setAdminTab(opts.adminTab);
      if (opts?.ticketId) setSelectedTicketId(opts.ticketId);
      navigate(pathForView(view, opts?.adminTab, opts?.ticketId));
    },
    [navigate]
  );

  const handleLogin = async (username: string, password: string) => {
    const user = await storage.login(username, password);
    setCurrentUser(user);
    setIsLoggedIn(true);
    setActiveView('dashboard');
    refreshData();
    navigate('/');
  };

  const handleLogout = async () => {
    await storage.logout();
    setIsLoggedIn(false);
    navigate('/login');
  };

  const handleSwitchUser = async (user: User) => {
    try {
      const switched = await storage.impersonate(user);
      setCurrentUser(switched);
      refreshData();
      if (activeView !== 'ticket_detail') {
        go('dashboard');
      }
    } catch (err) {
      console.error('Failed to switch user', err);
    }
  };

  const handleQuickSwitchRole = (role: UserRole) => {
    const matched = allUsers.find((u) => u.role === role);
    if (matched) {
      handleSwitchUser(matched);
    }
  };

  // Ticket Operations
  const isViewOnly = currentUser.role === 'AUDITOR';

  const handleCreateTicket = async (params: {
    subject: string;
    description: string;
    category: TicketCategory;
    priority: TicketPriority;
    attachmentName?: string;
  }): Promise<Ticket> => {
    if (isViewOnly) throw new Error('Auditors have read-only access.');
    const newTicket = await storage.createTicket(params);
    refreshData();
    return newTicket;
  };

  const handleUpdateTicketStatus = async (
    ticketId: string,
    newStatus: TicketStatus,
    notes?: string
  ) => {
    if (isViewOnly) return;
    await storage.updateTicketStatus(ticketId, newStatus, notes);
    refreshData();
  };

  const handleAssignStaff = async (ticketId: string, staffUser: User) => {
    if (isViewOnly) return;
    await storage.assignTicket(ticketId, staffUser);
    refreshData();
  };

  const handleUpdatePriority = async (ticketId: string, newPriority: TicketPriority) => {
    if (isViewOnly) return;
    await storage.updateTicketPriority(ticketId, newPriority);
    refreshData();
  };

  const handleAddComment = async (ticketId: string, content: string, isInternal: boolean) => {
    if (isViewOnly) return;
    await storage.addComment({ ticketId, content, isInternal });
    refreshData();
  };

  // Admin: user & branch management
  const handleCreateUser = async (user: CreateUserParams) => {
    await storage.createUser(user);
    refreshData();
  };

  const handleUpdateUser = async (userId: string, changes: UpdateUserChanges) => {
    await storage.updateUser(userId, changes);
    refreshData();
  };

  const handleDeleteUser = async (userId: string) => {
    await storage.deleteUser(userId);
    refreshData();
  };

  const handleUpdateStaffAssignments = async (staffUserId: string, assignments: BranchAssignment[]) => {
    await storage.updateStaffAssignments(staffUserId, assignments);
    refreshData();
  };

  const handleCreateBranch = async (branch: CreateBranchParams) => {
    await storage.createBranch(branch);
    refreshData();
  };

  const handleUpdateBranch = async (branchId: string, changes: Partial<Branch>) => {
    await storage.updateBranch(branchId, changes);
    refreshData();
  };

  const handleDeleteBranch = async (branchId: string) => {
    await storage.deleteBranch(branchId);
    refreshData();
  };

  const handleNavigateTicketDetail = (ticketId: string) => {
    setSelectedTicketId(ticketId);
    setActiveView('ticket_detail');
    navigate(pathForView('ticket_detail', undefined, ticketId));
  };

  const onAdminTabSelect = (tab: AdminTab) => {
    setAdminTab(tab);
    navigate(pathForView('users', tab));
  };

  // Unread notifications for header
  const userNotifications = storage.getNotifications(currentUser.id);
  const unreadCount = userNotifications.filter((n) => !n.read).length;

  const myOpenTicketCount = tickets.filter(
    (t) =>
      (t.branchId === currentUser.branchId || t.requesterId === currentUser.id) &&
      t.status !== 'Closed' &&
      t.status !== 'Cancelled'
  ).length;

  const newTicketCount = tickets.filter((t) => t.status === 'New').length;

  const allBranches = storage.getBranches();
  const allStaff = allUsers.filter((u) => u.role === 'IT_STAFF' || u.role === 'ADMINISTRATOR');

  if (!isLoggedIn) {
    return <LoginView allUsers={allUsers} onLogin={handleLogin} />;
  }

  const selectedTicket = selectedTicketId ? storage.getTicketById(selectedTicketId) : null;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans flex flex-col antialiased">
      {/* Top Prototype Disclaimer Banner */}
      <PrototypeBanner
        onOpenRequirements={() => setShowReqModal(true)}
        onOpenDemoGuide={() => setShowDemoGuideModal(true)}
        onResetData={async () => {
          await storage.resetToDefaults();
          setCurrentUser(storage.getCurrentUser());
          refreshData();
        }}
      />

      {/* Main Top Header */}
      <Header
        currentUser={currentUser}
        allUsers={allUsers}
        notifications={userNotifications}
        unreadCount={unreadCount}
        onSwitchUser={handleSwitchUser}
        onLogout={handleLogout}
        onOpenNotifications={() => go('notifications')}
        onMarkNotificationRead={async (id) => {
          await storage.markNotificationAsRead(id);
          refreshData();
        }}
        onNavigateTicket={(id) => handleNavigateTicketDetail(id)}
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        isSidebarOpen={isSidebarOpen}
      />

      {/* Main Body Layout */}
      <div className="flex-1 flex max-w-7xl mx-auto w-full">
        {/* Role-Specific Navigation Sidebar */}
        <Sidebar
          currentUser={currentUser}
          activeView={activeView}
          newTicketCount={newTicketCount}
          myOpenTicketCount={myOpenTicketCount}
          onNavigate={(view) => {
            if (
              view === 'users' ||
              view === 'branches' ||
              view === 'categories' ||
              view === 'it_staff' ||
              view === 'activity_logs'
            ) {
              go('users', { adminTab: view });
            } else {
              go(view);
            }
          }}
          onLogout={handleLogout}
          isOpen={isSidebarOpen}
          onCloseMobile={() => setIsSidebarOpen(false)}
        />

        {/* Main Content Viewport */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 min-w-0 overflow-hidden">
          {/* DASHBOARD VIEW */}
          {activeView === 'dashboard' && (
            <>
              {currentUser.role === 'BRANCH_USER' && (
                <BranchDashboardView
                  currentUser={currentUser}
                  tickets={tickets}
                  onNavigateNewRequest={() => go('new_request')}
                  onNavigateTicketDetail={handleNavigateTicketDetail}
                />
              )}
              {currentUser.role === 'IT_STAFF' && (
                <ItDashboardView
                  currentUser={currentUser}
                  tickets={tickets}
                  onNavigateTicketDetail={handleNavigateTicketDetail}
                  onNavigateAllTickets={() => go('all_tickets')}
                />
              )}
              {currentUser.role === 'ADMINISTRATOR' && (
                <AdminDashboardView
                  users={allUsers}
                  branches={allBranches}
                  categories={storage.getCategories()}
                  auditLogs={storage.getAuditLogs()}
                  tickets={tickets}
                  activeTab={adminTab}
                  onSelectTab={onAdminTabSelect}
                  onCreateUser={handleCreateUser}
                  onUpdateUser={handleUpdateUser}
                  onDeleteUser={handleDeleteUser}
                  onCreateBranch={handleCreateBranch}
                  onUpdateBranch={handleUpdateBranch}
                  onDeleteBranch={handleDeleteBranch}
                  onUpdateStaffAssignments={handleUpdateStaffAssignments}
                />
              )}
              {currentUser.role === 'AUDITOR' && (
                <AdminDashboardView
                  mode="auditor"
                  users={allUsers}
                  branches={allBranches}
                  categories={storage.getCategories()}
                  auditLogs={storage.getAuditLogs()}
                  tickets={tickets}
                  activeTab={adminTab}
                  onSelectTab={onAdminTabSelect}
                />
              )}
            </>
          )}

          {/* CREATE TICKET VIEW */}
          {activeView === 'new_request' && (
            <CreateTicketView
              currentUser={currentUser}
              onSubmitTicket={handleCreateTicket}
              onNavigateBack={() => go('dashboard')}
              onNavigateTicketDetail={handleNavigateTicketDetail}
            />
          )}

          {/* TICKET LIST VIEWS */}
          {activeView === 'my_tickets' && (
            <TicketListView
              currentUser={currentUser}
              tickets={tickets.filter(
                (t) => t.branchId === currentUser.branchId || t.requesterId === currentUser.id
              )}
              allBranches={allBranches}
              allStaff={allStaff}
              title={`${currentUser.branchName || 'Branch'} IT Requests`}
              subtitle="All IT concerns and requests submitted from your branch location"
              onNavigateTicketDetail={handleNavigateTicketDetail}
              onNavigateNewRequest={() => go('new_request')}
            />
          )}

          {activeView === 'all_tickets' && (
            <TicketListView
              currentUser={currentUser}
              tickets={tickets}
              allBranches={allBranches}
              allStaff={allStaff}
              title="Main IT Queue — All Tickets"
              subtitle="Comprehensive repository of IT tickets across all Bayanihan Bank branches"
              onNavigateTicketDetail={handleNavigateTicketDetail}
            />
          )}

          {activeView === 'assigned_tickets' && (
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

          {activeView === 'in_progress' && (
            <TicketListView
              currentUser={currentUser}
              tickets={tickets.filter((t) => t.status === 'In Progress')}
              allBranches={allBranches}
              allStaff={allStaff}
              title="In Progress Tickets Queue"
              subtitle="IT tickets actively being worked on by Main IT Staff"
              onNavigateTicketDetail={handleNavigateTicketDetail}
            />
          )}

          {activeView === 'resolved_tickets' && (
            <TicketListView
              currentUser={currentUser}
              tickets={tickets.filter((t) => t.status === 'Resolved')}
              allBranches={allBranches}
              allStaff={allStaff}
              title="Resolved Tickets Queue"
              subtitle="Tickets marked resolved by IT awaiting branch confirmation"
              onNavigateTicketDetail={handleNavigateTicketDetail}
            />
          )}

          {/* TICKET DETAIL VIEW */}
          {activeView === 'ticket_detail' && selectedTicket && (
            <TicketDetailView
              ticket={selectedTicket}
              comments={storage.getComments(selectedTicket.id)}
              timeline={storage.getTimeline(selectedTicket.id)}
              currentUser={currentUser}
              allStaff={allStaff}
              onNavigateBack={() => go('dashboard')}
              onUpdateStatus={handleUpdateTicketStatus}
              onAssignStaff={handleAssignStaff}
              onUpdatePriority={handleUpdatePriority}
              onAddComment={handleAddComment}
            />
          )}

          {/* ADMIN MANAGEMENT VIEWS */}
          {activeView === 'users' && (
            <AdminDashboardView
              mode={currentUser.role === 'AUDITOR' ? 'auditor' : 'admin'}
              users={allUsers}
              branches={allBranches}
              categories={storage.getCategories()}
              auditLogs={storage.getAuditLogs()}
              tickets={tickets}
              activeTab={adminTab}
              onSelectTab={onAdminTabSelect}
              onCreateUser={handleCreateUser}
              onUpdateUser={handleUpdateUser}
              onDeleteUser={handleDeleteUser}
              onCreateBranch={handleCreateBranch}
              onUpdateBranch={handleUpdateBranch}
              onDeleteBranch={handleDeleteBranch}
              onUpdateStaffAssignments={handleUpdateStaffAssignments}
            />
          )}

          {/* NOTIFICATIONS VIEW */}
          {activeView === 'notifications' && (
            <NotificationsView
              notifications={userNotifications}
              onMarkRead={async (id) => {
                await storage.markNotificationAsRead(id);
                refreshData();
              }}
              onNavigateTicket={handleNavigateTicketDetail}
            />
          )}

          {/* PROFILE VIEW */}
          {activeView === 'profile' && <ProfileView currentUser={currentUser} />}
        </main>
      </div>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 border-t border-slate-800 text-xs py-4 px-6 text-center space-y-1">
        <div>
          <strong>Bayanihan Bank IT Service Desk</strong> Prototype Concept (August 7, 2026)
        </div>
        <div className="text-[11px] text-slate-500">
          Internal Trainee Project • Prototype UI for Supervisor Review • Fictional Demo Data Only
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
    </div>
  );
}
