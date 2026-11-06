import React, { useState } from 'react';
import { User, Branch, CategoryInfo, AuditLog, Ticket, TicketStatus, UserRole, BranchAssignment } from '../../types';
import type { CreateBranchParams, CreateUserParams, UpdateUserChanges } from '../../services/store';
import {
  Users,
  Building,
  Layers,
  History,
  Mail,
  Search,
  ShieldCheck,
  CheckCircle2,
  Plus,
  HelpCircle,
  UserCheck,
  Pencil,
  Trash2,
  X,
  AlertTriangle,
  MapPin,
  CalendarClock,
  PlayCircle,
  Activity,
  BarChart3,
  Eye,
  EyeOff,
  Building2,
  LayoutDashboard,
  type LucideIcon
} from 'lucide-react';

type AdminTab = 'overview' | 'users' | 'branches' | 'categories' | 'it_staff' | 'activity_logs';

const adminTabs: { id: AdminTab; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'Overview', icon: <LayoutDashboard /> },
  { id: 'users', label: 'Users', icon: <Users /> },
  { id: 'branches', label: 'Branches', icon: <Building2 /> },
  { id: 'categories', label: 'Categories', icon: <Layers /> },
  { id: 'it_staff', label: 'IT Staff', icon: <UserCheck /> },
  { id: 'activity_logs', label: 'Activity Logs', icon: <History /> },
];

interface AdminDashboardViewProps {
  users: User[];
  branches: Branch[];
  categories: CategoryInfo[];
  auditLogs: AuditLog[];
  tickets: Ticket[];
  activeTab: AdminTab;
  onSelectTab: (tab: AdminTab) => void;
  mode?: 'admin' | 'auditor';
  onCreateUser?: (user: CreateUserParams) => void;
  onUpdateUser?: (userId: string, changes: UpdateUserChanges) => void;
  onDeleteUser?: (userId: string) => void;
  onCreateBranch?: (branch: CreateBranchParams) => void;
  onUpdateBranch?: (branchId: string, changes: Partial<Branch>) => void;
  onDeleteBranch?: (branchId: string) => void;
  onUpdateStaffAssignments?: (staffUserId: string, assignments: BranchAssignment[]) => void;
  onViewStatusTickets?: (status: TicketStatus) => void;
}

interface UserFormState {
  id?: string;
  name: string;
  username: string;
  role: UserRole;
  email: string;
  branchId?: string;
  branchName?: string;
  department?: string;
  password?: string;
}

interface BranchFormState {
  id?: string;
  name: string;
  location: string;
  status: 'Active' | 'Inactive';
  userCount: number;
}

type DeleteTarget = { type: 'user'; id: string; name: string } | { type: 'branch'; id: string; name: string };

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'BRANCH_USER', label: 'Branch User' },
  { value: 'IT_STAFF', label: 'IT Staff' },
  { value: 'ADMINISTRATOR', label: 'Administrator' },
  { value: 'AUDITOR', label: 'Auditor (View-Only)' },
];

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({
  users,
  branches,
  categories,
  auditLogs,
  tickets,
  activeTab,
  onSelectTab,
  mode = 'admin',
  onCreateUser,
  onUpdateUser,
  onDeleteUser,
  onCreateBranch,
  onUpdateBranch,
  onDeleteBranch,
  onUpdateStaffAssignments,
  onViewStatusTickets,
}) => {
  const [userModal, setUserModal] = useState<{ mode: 'create' | 'edit'; user?: User } | null>(null);
  const [branchModal, setBranchModal] = useState<{ mode: 'create' | 'edit'; branch?: Branch } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [assignmentModal, setAssignmentModal] = useState<User | null>(null);
  const [staffSearch, setStaffSearch] = useState('');
  const [staffFilter, setStaffFilter] = useState<'ALL' | 'ASSIGNED' | 'UNASSIGNED'>('ALL');
  const [branchSearch, setBranchSearch] = useState('');
  const [branchStatusFilter, setBranchStatusFilter] = useState<'ALL' | 'Active' | 'Inactive'>('ALL');
  const isAuditor = mode === 'auditor';
  const isAdmin = mode === 'admin';
  const canManage = isAdmin && !!onCreateUser && !!onCreateBranch;

  const totalUsers = users.length;
  const totalBranches = branches.length;
  const totalItStaff = users.filter((u) => u.role === 'IT_STAFF').length;
  const totalTickets = tickets.length;
  const openTickets = tickets.filter((t) => t.status === 'In Progress').length;
  const resolvedTickets = tickets.filter((t) => t.status === 'Resolved').length;

  const STATUS_DEFS: { status: TicketStatus; label: string; icon: LucideIcon; cardClass: string; barClass: string; countClass: string }[] = [
    { status: 'In Progress', label: 'In Progress', icon: PlayCircle, cardClass: 'bg-amber-50 border-amber-200', barClass: 'bg-amber-500', countClass: 'text-amber-900' },
    { status: 'Resolved', label: 'Resolved', icon: CheckCircle2, cardClass: 'bg-emerald-50 border-emerald-200', barClass: 'bg-emerald-600', countClass: 'text-emerald-900' },
  ];
  const statusCount = (s: TicketStatus) => tickets.filter((t) => t.status === s).length;

  const itStaff = users.filter((u) => u.role === 'IT_STAFF');
const staffStatus = itStaff.map((s) => {
    const staffTickets = tickets.filter((t) => t.assignedToId === s.id);

    const inProgressCount = staffTickets.filter(
      (t) => t.status === 'In Progress',
    ).length;
    const resolvedCount = staffTickets.filter(
      (t) => t.status === 'Resolved',
    ).length;
    const openCount = inProgressCount;

    return {
      staff: s,
      inProgressCount,
      resolvedCount,
      openCount,
      totalCount: staffTickets.length,
    };
  });


  const filteredItStaff = itStaff.filter((staffMember) => {
    const term = staffSearch.trim().toLowerCase();
    const matchesSearch =
      term === '' ||
      staffMember.name.toLowerCase().includes(term) ||
      staffMember.username.toLowerCase().includes(term) ||
      staffMember.email.toLowerCase().includes(term) ||
      (staffMember.department?.toLowerCase().includes(term) ?? false) ||
      (staffMember.assignments?.some((assignment) =>
        assignment.branchName.toLowerCase().includes(term),
      ) ??
        false);
    const assignmentState =
      (staffMember.assignments?.length ?? 0) > 0 ? 'ASSIGNED' : 'UNASSIGNED';
    const matchesFilter = staffFilter === 'ALL' || assignmentState === staffFilter;
    return matchesSearch && matchesFilter;
  });

  const assignedStaffCount = itStaff.filter(
    (staffMember) => (staffMember.assignments?.length ?? 0) > 0,
  ).length;
  const unassignedStaffCount = itStaff.length - assignedStaffCount;
  const expiredAssignmentCount = itStaff.reduce(
    (total, staffMember) =>
      total +
      (staffMember.assignments?.filter(
        (assignment) => new Date(assignment.expiresAt).getTime() < Date.now(),
      ).length ?? 0),
    0,
  );

  const handleUserFormSubmit = (form: UserFormState) => {
    if (form.id) {
      onUpdateUser?.(form.id, {
        name: form.name,
        username: form.username,
        role: form.role,
        email: form.email,
        branchId: form.role === 'BRANCH_USER' ? form.branchId : undefined,
        branchName: form.role === 'BRANCH_USER' ? form.branchName : undefined,
        department: form.role === 'BRANCH_USER' ? undefined : form.department,
        password: form.password || undefined,
      });
    } else {
      onCreateUser?.({
        name: form.name,
        username: form.username,
        role: form.role,
        email: form.email,
        branchId: form.role === 'BRANCH_USER' ? form.branchId : undefined,
        branchName: form.role === 'BRANCH_USER' ? form.branchName : undefined,
        department: form.role === 'BRANCH_USER' ? undefined : form.department,
        password: form.password || undefined,
      });
    }
    setUserModal(null);
  };

  const filteredBranches = branches.filter((branch) => {
    const term = branchSearch.trim().toLowerCase();
    const matchesSearch =
      term === '' ||
      branch.name.toLowerCase().includes(term) ||
      branch.location.toLowerCase().includes(term);
    const matchesStatus =
      branchStatusFilter === 'ALL' || branch.status === branchStatusFilter;
    return matchesSearch && matchesStatus;
  });

  const activeBranchCount = branches.filter((branch) => branch.status === 'Active').length;
  const inactiveBranchCount = branches.length - activeBranchCount;

  const handleBranchFormSubmit = (form: BranchFormState) => {
    if (form.id) {
      onUpdateBranch?.(form.id, {
        name: form.name,
        location: form.location,
        status: form.status,
        userCount: form.userCount,
      });
    } else {
      onCreateBranch?.({
        name: form.name,
        location: form.location,
        status: form.status,
        userCount: form.userCount,
      });
    }
    setBranchModal(null);
  };

  const handleDeleteConfirm = () => {
    if (!deleteTarget) return;
    if (deleteTarget.type === 'user') onDeleteUser?.(deleteTarget.id);
    else onDeleteBranch?.(deleteTarget.id);
    setDeleteTarget(null);
  };

  return (
    <div className="pt-20 md:pt-0 space-y-6">
      {/* Admin Header */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded border text-xs font-bold uppercase tracking-wider mb-2 ${
            isAuditor
              ? 'bg-teal-900 text-teal-200 border-teal-700'
              : 'bg-purple-900 text-purple-200 border-purple-700'
          }`}>
            <ShieldCheck className={`w-3.5 h-3.5 ${isAuditor ? 'text-teal-400' : 'text-purple-400'}`} />
            <span>{isAuditor ? 'Audit Console (View-Only)' : 'Administrator Control Console'}</span>
          </div>
          <h1 className="text-2xl font-black">
            {isAuditor ? 'Audit & Monitoring' : 'System Administration & Settings'}
          </h1>
          <p className="text-xs text-slate-300 mt-1">
            {isAuditor
              ? 'Read-only monitoring of tickets and audit activity for the Internal Audit Department'
              : 'Manage users, branches, IT staff, and review system audit activity'}
          </p>
        </div>
      </div>

      {/* Mobile Tab Bar - visible on mobile, hidden on desktop (sidebar handles desktop) */}
      <nav className="md:hidden fixed top-16 left-0 right-0 z-30 bg-white border-b border-slate-200 shadow-sm px-2 py-2" role="tablist" aria-label="Admin navigation">
        <div className="flex overflow-x-auto gap-1 px-2 pb-2 -mx-2">
          {adminTabs.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => onSelectTab(tab.id)}
              className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition ${
                activeTab === tab.id
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              <span className="w-6 h-6">{tab.icon}</span>
              <span className="text-[10px] font-semibold">{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Overview Stat Cards */}
      {activeTab === 'overview' && (
        <div className="space-y-5">
          {/* IT Specialist Status */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-lg overflow-hidden">
            <div className="p-5 sm:p-6 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/60">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span className="w-7 h-7 rounded-lg bg-sky-500/15 border border-sky-500/30 flex items-center justify-center">
                    <UserCheck className="w-4 h-4 text-sky-400" />
                  </span>
                  <span>IT Specialist Status</span>
                </h3>
                <p className="text-xs sm:text-sm text-slate-400 mt-1 leading-relaxed">
                  Per-staff workload, live ticket counts, and assigned branch
                  coverage
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-lg bg-sky-500/10 border border-sky-500/30 text-sky-300 text-[11px] font-bold inline-flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5" />
                  {itStaff.length} IT specialist
                  {itStaff.length !== 1 ? 's' : ''}
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 text-[11px] font-semibold font-mono">
                  {staffStatus.reduce((acc, s) => acc + s.openCount, 0)} open
                </span>
              </div>
            </div>

            <div className="p-4 sm:p-6">
              {itStaff.length === 0 ? (
                <div className="py-10 text-center space-y-2">
                  <div className="w-12 h-12 mx-auto rounded-full bg-slate-800 text-slate-500 flex items-center justify-center">
                    <UserCheck className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-200">
                    No IT specialists yet
                  </h4>
                  <p className="text-xs text-slate-400 max-w-xs mx-auto">
                    Create an IT specialist account from the IT Specialist
                    Settings tab to start tracking workload.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-3 sm:gap-4">
                  {staffStatus.map(
                    ({
                      staff: s,
                      inProgressCount,
                      resolvedCount,
                      openCount,
                      totalCount,
                    }) => {
                      const loadPct =
                        totalCount > 0
                          ? Math.round((openCount / totalCount) * 100)
                          : 0;

                      const loadColor =
                        loadPct === 0
                          ? 'bg-slate-600'
                          : loadPct >= 60
                            ? 'bg-red-500'
                            : loadPct >= 35
                              ? 'bg-amber-400'
                              : 'bg-emerald-400';

                      return (
                        <div
                          key={s.id}
                          className="p-4 sm:p-5 bg-slate-800/70 rounded-2xl border border-slate-700/80 shadow-sm hover:shadow-lg hover:-translate-y-0.5 hover:border-sky-500/50 hover:bg-slate-800 transition-all duration-200 space-y-4"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="relative shrink-0">
                              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white font-black flex items-center justify-center shadow-md border-2 border-slate-900 ring-1 ring-amber-400/50">
                                {s.name.charAt(0)}
                              </div>
                              <span
                                className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-slate-900"
                                title="Account active"
                              />
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="font-bold text-slate-100 text-sm truncate">
                                {s.name}
                              </div>
                              <div className="text-[11px] text-slate-400 font-mono truncate">
                                @{s.username}
                              </div>
                            </div>

                            {openCount > 0 ? (
                              <span className="h-6 px-2 rounded-full bg-sky-500/10 text-sky-300 text-[9px] font-bold uppercase tracking-wider flex items-center border border-sky-500/30 shrink-0">
                                Busy
                              </span>
                            ) : (
                              <span className="h-6 px-2 rounded-full bg-slate-900 text-slate-400 text-[9px] font-bold uppercase tracking-wider flex items-center border border-slate-700 shrink-0">
                                Idle
                              </span>
                            )}
                          </div>

                          {/* Workload Bar */}
                          <div>
                            <div className="flex items-center justify-between gap-2 text-[11px] font-semibold text-slate-400 mb-2">
                              <span className="inline-flex items-center gap-1">
                                <Activity className="w-3 h-3 text-sky-400" />
                                Current Workload
                              </span>
                              <span className="font-mono text-slate-200">
                                {openCount} open of {totalCount} assigned
                              </span>
                            </div>
                            <div className="h-2 rounded-full bg-slate-700/80 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${loadColor}`}
                                style={{ width: `${Math.min(100, loadPct)}%` }}
                              />
                            </div>
                          </div>

                          {/* Status Counts */}
                          <div className="grid grid-cols-2 gap-2">
                            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-center space-y-1">
                              <PlayCircle className="w-3.5 h-3.5 text-amber-400 mx-auto" />
                              <div className="text-[9px] font-bold text-amber-300 uppercase tracking-wider">
                                In Progress
                              </div>
                              <div className="text-xl font-black text-amber-100 leading-none">
                                {inProgressCount}
                              </div>
                            </div>


                            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-center space-y-1">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mx-auto" />
                              <div className="text-[9px] font-bold text-emerald-300 uppercase tracking-wider">
                                Resolved
                              </div>
                              <div className="text-xl font-black text-emerald-100 leading-none">
                                {resolvedCount}
                              </div>
                            </div>
                          </div>

                          {/* Assigned Branches */}
                          {s.assignments && s.assignments.length > 0 && (
                            <div className="pt-3 border-t border-slate-700/60">
                              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                                <Building className="w-3 h-3 text-sky-400" />
                                Assigned Branches ({s.assignments.length})
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {s.assignments.map((a) => {
                                  const branchName =
                                    a.branchName ||
                                    branches.find(
                                      (b) => b.id === a.branchId,
                                    )?.name ||
                                    a.branchId;

                                  return (
                                    <span
                                      key={a.branchId}
                                      className="px-2.5 py-1.5 rounded-lg bg-slate-900/70 border border-slate-700/80 text-[10px] font-semibold text-slate-200 flex items-center gap-1.5"
                                    >
                                      <Building className="w-2.5 h-2.5 text-sky-400 shrink-0" />
                                      {branchName}
                                    </span>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                        </div>
                      );
                    },
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
            <div className="min-w-0 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300 transition-all duration-200">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider">Total Users</span>
                <span className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                  <Users className="w-4 h-4" />
                </span>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-slate-900 mt-3 tabular-nums">{totalUsers}</div>
              <p className="text-[10px] text-slate-400 mt-1">Registered users</p>
            </div>

            <div className="min-w-0 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300 transition-all duration-200">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider">Total Branches</span>
                <span className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                  <Building className="w-4 h-4" />
                </span>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-slate-900 mt-3 tabular-nums">{totalBranches}</div>
              <p className="text-[10px] text-slate-400 mt-1">Registered branches</p>
            </div>

            <div className="min-w-0 bg-white p-4 sm:p-5 rounded-2xl border border-blue-100 shadow-sm hover:shadow-md hover:border-blue-200 transition-all duration-200">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] sm:text-xs font-bold text-blue-700 uppercase tracking-wider">IT Staff</span>
                <span className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <UserCheck className="w-4 h-4" />
                </span>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-blue-900 mt-3 tabular-nums">{totalItStaff}</div>
              <p className="text-[10px] text-slate-400 mt-1">IT specialist accounts</p>
            </div>

            <div className="min-w-0 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300 transition-all duration-200">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider">Total Tickets</span>
                <span className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                  <Layers className="w-4 h-4" />
                </span>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-slate-900 mt-3 tabular-nums">{totalTickets}</div>
              <p className="text-[10px] text-slate-400 mt-1">All recorded tickets</p>
            </div>

            <div className="min-w-0 bg-amber-50/70 p-4 sm:p-5 rounded-2xl border border-amber-200 shadow-sm hover:shadow-md hover:border-amber-300 transition-all duration-200">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] sm:text-xs font-bold text-amber-700 uppercase tracking-wider">Open Tickets</span>
                <span className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                  <Activity className="w-4 h-4" />
                </span>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-amber-900 mt-3 tabular-nums">{openTickets}</div>
              <p className="text-[10px] text-amber-700/70 mt-1">Require attention</p>
            </div>

            <div className="min-w-0 bg-emerald-50/70 p-4 sm:p-5 rounded-2xl border border-emerald-200 shadow-sm hover:shadow-md hover:border-emerald-300 transition-all duration-200">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] sm:text-xs font-bold text-emerald-700 uppercase tracking-wider">Resolved</span>
                <span className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-4 h-4" />
                </span>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-emerald-900 mt-3 tabular-nums">{resolvedTickets}</div>
              <p className="text-[10px] text-emerald-700/70 mt-1">Successfully resolved</p>
            </div>
          </div>

          {/* Ticket Status Breakdown */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/70">
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-purple-600" />
                  <span>Ticket Status Breakdown</span>
                </h3>
                <p className="text-xs sm:text-sm text-slate-500">
                  Distribution of tickets by current status
                </p>
              </div>
              <span className="inline-flex w-fit items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 tabular-nums">
                {totalTickets} tickets total
              </span>
            </div>

            <div className="p-4 sm:p-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {STATUS_DEFS.map((s) => {
                const count = statusCount(s.status);
                const pct = totalTickets > 0 ? Math.round((count / totalTickets) * 100) : 0;
                const Icon = s.icon;

                return (
                  <div
                    key={s.status}
                    onClick={() => onViewStatusTickets?.(s.status)}
                    className={`p-4 sm:p-5 rounded-xl border ${s.cardClass} ${
                      onViewStatusTickets
                        ? 'cursor-pointer hover:ring-2 hover:ring-purple-300 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200'
                        : ''
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-600">
                        {s.label}
                      </span>
                      <Icon className="w-4 h-4 shrink-0 text-slate-500" />
                    </div>

                    <div className={`text-3xl font-black tabular-nums mt-2 ${s.countClass}`}>
                      {count}
                    </div>

                    <div className="text-[11px] text-slate-500 font-semibold mt-0.5">
                      {pct}% of total
                    </div>

                    <div className="mt-3 h-2 rounded-full bg-white/70 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${s.barClass}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>



        </div>
      )}

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
            <h3 className="font-bold text-slate-900 text-sm">System Users Directory</h3>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">{users.length} registered accounts</span>
              {canManage && (
                <button
                  onClick={() => setUserModal({ mode: 'create' })}
                  className="px-3 py-1.5 bg-purple-700 hover:bg-purple-600 text-white font-bold text-[11px] rounded-lg transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create Account</span>
                </button>
              )}
            </div>
          </div>
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider">
              <tr>
                <th className="p-3">Name</th>
                <th className="p-3">Username</th>
                <th className="p-3">Role</th>
                <th className="p-3">Branch / Department</th>
                <th className="p-3">Email</th>
                <th className="p-3 text-right">Status</th>
                {canManage && <th className="p-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td className="p-3 font-bold text-slate-900">{u.name}</td>
                  <td className="p-3 font-mono text-slate-600">{u.username}</td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded font-semibold text-[10px] bg-slate-100 border border-slate-300">
                      {u.role}
                    </span>
                  </td>
                  <td className="p-3 text-slate-700">{u.branchName || u.department || 'Ã¢â‚¬â€'}</td>
                  <td className="p-3 text-slate-500 font-mono">{u.email}</td>
                  <td className="p-3 text-right">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      Active
                    </span>
                  </td>
                  {canManage && (
                    <td className="p-3 text-right whitespace-nowrap">
                      <button
                        onClick={() => setUserModal({ mode: 'edit', user: u })}
                        className="p-1.5 rounded bg-slate-100 hover:bg-purple-700 hover:text-white text-slate-600 transition inline-flex cursor-pointer"
                        title="Edit account"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget({ type: 'user', id: u.id, name: u.name })}
                        disabled={u.id === users.find((x) => x.role === 'ADMINISTRATOR')?.id}
                        className="p-1.5 rounded bg-slate-100 hover:bg-red-700 hover:text-white text-slate-600 transition inline-flex ml-1 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Delete account"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* IT Staff Settings Tab */}
      {activeTab === 'it_staff' && (
        <div className="space-y-5">
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-4 border-b border-slate-100 bg-slate-50/70 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-700 ring-1 ring-sky-100">
                  <UserCheck className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-800">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    IT Specialist settings
                  </div>
                  <h2 className="mt-2 text-lg font-bold tracking-tight text-slate-900">
                    Main IT Department roster
                  </h2>
                  <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-500">
                    Manage IT specialist accounts, branch assignments, and coverage for the service desk queue.
                    New tickets are visible to administrators and assigned IT staff.
                  </p>
                </div>
              </div>

              {canManage && (
                <button
                  type="button"
                  onClick={() => setUserModal({ mode: 'create', user: { role: 'IT_STAFF' } as User })}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-sky-700 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2"
                >
                  <Plus className="h-4 w-4" />
                  Add IT specialist
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 p-5 lg:grid-cols-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Specialists
                </p>
                <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">
                  {itStaff.length}
                </p>
              </div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">
                  Branch assigned
                </p>
                <p className="mt-2 text-2xl font-bold tabular-nums text-emerald-900">
                  {assignedStaffCount}
                </p>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-700">
                  General queue
                </p>
                <p className="mt-2 text-2xl font-bold tabular-nums text-amber-900">
                  {unassignedStaffCount}
                </p>
              </div>
              <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-red-700">
                  Expired assignments
                </p>
                <p className="mt-2 text-2xl font-bold tabular-nums text-red-900">
                  {expiredAssignmentCount}
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative w-full lg:max-w-md">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  name="staff-search"
                  aria-label="Search IT specialists"
                  value={staffSearch}
                  onChange={(event) => setStaffSearch(event.target.value)}
                  placeholder="Search by name, username, email, department, or branch"
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm font-medium text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-sky-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-600"
                />
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <label htmlFor="staff-coverage-filter" className="sr-only">
                  Filter by branch coverage
                </label>
                <select
                  id="staff-coverage-filter"
                  name="staff-coverage-filter"
                  aria-label="Filter by branch coverage"
                  value={staffFilter}
                  onChange={(event) =>
                    setStaffFilter(event.target.value as 'ALL' | 'ASSIGNED' | 'UNASSIGNED')
                  }
                  className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm transition focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600"
                >
                  <option value="ALL">All coverage</option>
                  <option value="ASSIGNED">Branch assigned</option>
                  <option value="UNASSIGNED">General queue only</option>
                </select>

                <span className="text-xs font-medium text-slate-500">
                  {filteredItStaff.length} of {itStaff.length} specialists
                </span>
              </div>
            </div>
          </section>

          {filteredItStaff.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center shadow-sm">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 ring-1 ring-slate-200">
                <UserCheck className="h-7 w-7" />
              </div>
              <h3 className="mt-4 text-base font-semibold text-slate-900">
                {itStaff.length === 0
                  ? 'No IT specialists configured'
                  : 'No specialists match these filters'}
              </h3>
              <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-slate-500">
                {itStaff.length === 0
                  ? 'Add the first IT specialist to begin assigning tickets and branch coverage.'
                  : 'Try a broader search or change the coverage filter.'}
              </p>
              {itStaff.length === 0 && canManage && (
                <button
                  type="button"
                  onClick={() => setUserModal({ mode: 'create', user: { role: 'IT_STAFF' } as User })}
                  className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-sky-700 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2"
                >
                  <Plus className="h-4 w-4" />
                  Add IT specialist
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {filteredItStaff.map((staffMember) => {
                const workload = staffStatus.find(
                  (entry) => entry.staff.id === staffMember.id,
                );
                const hasExpiredAssignment = staffMember.assignments?.some(
                  (assignment) => new Date(assignment.expiresAt).getTime() < Date.now(),
                );

                return (
                  <article
                    key={staffMember.id}
                    className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-sky-200 hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sky-700 text-sm font-bold text-white ring-2 ring-sky-100">
                          {staffMember.name.charAt(0).toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="truncate text-base font-bold text-slate-900">
                              {staffMember.name}
                            </h3>
                            <span className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-800">
                              IT specialist
                            </span>
                            {hasExpiredAssignment && (
                              <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                                Expired coverage
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 truncate font-mono text-[11px] text-slate-500">
                            {staffMember.username}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
                            <span className="flex items-center gap-1.5">
                              <UserCheck className="h-3.5 w-3.5 text-slate-400" />
                              {staffMember.department || 'Main IT Department'}
                            </span>
                            <span className="flex items-center gap-1.5">
                              <Mail className="h-3.5 w-3.5 text-slate-400" />
                              {staffMember.email}
                            </span>
                          </div>
                        </div>
                      </div>

                      {canManage && (
                        <div className="flex shrink-0 items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setAssignmentModal(staffMember)}
                            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-sky-700 px-2.5 text-[11px] font-semibold text-white shadow-sm transition hover:bg-sky-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2"
                            title="Assign branches"
                          >
                            <MapPin className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Assign branches</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setUserModal({ mode: 'edit', user: staffMember })}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2"
                            title="Edit IT specialist"
                            aria-label={`Edit ${staffMember.name}`}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setDeleteTarget({ type: 'user', id: staffMember.id, name: staffMember.name })
                            }
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
                            title="Remove IT specialist"
                            aria-label={`Remove ${staffMember.name}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                          Assigned tickets
                        </p>
                        <p className="mt-1 text-sm font-bold tabular-nums text-slate-900">
                          {workload?.totalCount ?? 0}
                        </p>
                      </div>
                      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-700">
                          In progress
                        </p>
                        <p className="mt-1 text-sm font-bold tabular-nums text-amber-900">
                          {workload?.inProgressCount ?? 0}
                        </p>
                      </div>
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
                          Resolved
                        </p>
                        <p className="mt-1 text-sm font-bold tabular-nums text-emerald-900">
                          {workload?.resolvedCount ?? 0}
                        </p>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                          Branch coverage
                        </p>
                        <p className="mt-1 text-sm font-bold tabular-nums text-slate-900">
                          {staffMember.assignments?.length ?? 0}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 border-t border-slate-100 pt-4">
                      {staffMember.assignments && staffMember.assignments.length > 0 ? (
                        <>
                          <div className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            <MapPin className="h-3 w-3" />
                            Assigned branches ({staffMember.assignments.length})
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {staffMember.assignments.map((assignment) => {
                              const expired =
                                new Date(assignment.expiresAt).getTime() < Date.now();
                              return (
                                <div
                                  key={assignment.branchId}
                                  className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] ${
                                    expired
                                      ? 'border-red-200 bg-red-50 text-red-800'
                                      : 'border-emerald-200 bg-emerald-50 text-emerald-900'
                                  }`}
                                >
                                  <Building className="h-3 w-3 shrink-0" />
                                  <span className="font-semibold">{assignment.branchName}</span>
                                  <span className="opacity-60">•</span>
                                  <span className="flex items-center gap-1 font-medium">
                                    <CalendarClock className="h-3 w-3" />
                                    {assignment.durationMonths} mo
                                  </span>
                                  <span className="opacity-60">
                                    (until{' '}
                                    {new Date(assignment.expiresAt).toLocaleDateString('en-US', {
                                      month: 'short',
                                      day: '2-digit',
                                      year: 'numeric',
                                    })}
                                    )
                                  </span>
                                  {expired && (
                                    <span className="rounded bg-red-100 px-1 py-0.5 text-[9px] font-bold">
                                      EXPIRED
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </>
                      ) : (
                        <p className="flex items-center gap-1.5 text-[11px] italic text-slate-400">
                          <MapPin className="h-3 w-3" />
                          Not assigned to any branch — handles the general IT queue.
                        </p>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Branches Tab */}
      {activeTab === 'branches' && (
        <div className="space-y-5">
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-4 border-b border-slate-100 bg-slate-50/70 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100">
                  <Building2 className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-800">
                    <Building className="h-3.5 w-3.5" />
                    Branch directory
                  </div>
                  <h2 className="mt-2 text-lg font-bold tracking-tight text-slate-900">
                    Bayanihan Bank branches
                  </h2>
                  <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-500">
                    Manage branch records, operational status, staffing counts, and verified branch codes.
                  </p>
                </div>
              </div>

              {canManage && (
                <button
                  type="button"
                  onClick={() => setBranchModal({ mode: 'create' })}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-indigo-700 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
                >
                  <Plus className="h-4 w-4" />
                  Add branch
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 p-5 lg:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Total branches
                </p>
                <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">
                  {branches.length}
                </p>
              </div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">
                  Active
                </p>
                <p className="mt-2 text-2xl font-bold tabular-nums text-emerald-900">
                  {activeBranchCount}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Inactive
                </p>
                <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">
                  {inactiveBranchCount}
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative w-full lg:max-w-md">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  name="branch-search"
                  aria-label="Search branches"
                  value={branchSearch}
                  onChange={(event) => setBranchSearch(event.target.value)}
                  placeholder="Search by branch name or location"
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm font-medium text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-indigo-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600"
                />
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <label htmlFor="branch-status-filter" className="sr-only">
                  Filter by status
                </label>
                <select
                  id="branch-status-filter"
                  name="branch-status-filter"
                  aria-label="Filter by branch status"
                  value={branchStatusFilter}
                  onChange={(event) =>
                    setBranchStatusFilter(event.target.value as 'ALL' | 'Active' | 'Inactive')
                  }
                  className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm transition focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                >
                  <option value="ALL">All statuses</option>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>

                <span className="text-xs font-medium text-slate-500">
                  {filteredBranches.length} of {branches.length} branches
                </span>
              </div>
            </div>
          </section>

          {filteredBranches.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center shadow-sm">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 ring-1 ring-slate-200">
                <Building2 className="h-7 w-7" />
              </div>
              <h3 className="mt-4 text-base font-semibold text-slate-900">
                {branches.length === 0 ? 'No branches configured' : 'No branches match these filters'}
              </h3>
              <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-slate-500">
                {branches.length === 0
                  ? 'Add the first branch to begin managing branch operations.'
                  : 'Try a broader search or change the status filter.'}
              </p>
              {branches.length === 0 && canManage && (
                <button
                  type="button"
                  onClick={() => setBranchModal({ mode: 'create' })}
                  className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-indigo-700 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
                >
                  <Plus className="h-4 w-4" />
                  Add branch
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:block">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-5 py-3">Branch name</th>
                      <th className="px-5 py-3">Location</th>
                      <th className="px-5 py-3">Staff users</th>
                      <th className="px-5 py-3">Status</th>
                      {canManage && <th className="px-5 py-3 text-right">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredBranches.map((branch) => (
                      <tr key={branch.id} className="transition hover:bg-slate-50/80">
                        <td className="px-5 py-4">
                          <div className="font-semibold text-slate-900">{branch.name}</div>
                          <div className="mt-0.5 font-mono text-[11px] text-slate-400">{branch.id}</div>
                        </td>
                        <td className="px-5 py-4 text-slate-600">{branch.location}</td>
                        <td className="px-5 py-4 font-medium text-slate-700">
                          {branch.userCount} {branch.userCount === 1 ? 'user' : 'users'}
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                              branch.status === 'Active'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-slate-100 text-slate-600 border border-slate-200'
                            }`}
                          >
                            {branch.status}
                          </span>
                        </td>
                        {canManage && (
                          <td className="px-5 py-4 text-right">
                            <div className="flex justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => setBranchModal({ mode: 'edit', branch })}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
                                title="Edit branch"
                                aria-label={`Edit ${branch.name}`}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setDeleteTarget({ type: 'branch', id: branch.id, name: branch.name })
                                }
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
                                title="Delete branch"
                                aria-label={`Delete ${branch.name}`}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-3 md:hidden">
                {filteredBranches.map((branch) => (
                  <article
                    key={branch.id}
                    className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-base font-bold text-slate-900">{branch.name}</h3>
                        <div className="mt-0.5 font-mono text-[11px] text-slate-400">{branch.id}</div>
                      </div>
                      <span
                        className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                          branch.status === 'Active'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}
                      >
                        {branch.status}
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600">
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                          Location
                        </p>
                        <p className="mt-1 truncate font-medium text-slate-900">{branch.location}</p>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                          Staff users
                        </p>
                        <p className="mt-1 font-medium text-slate-900">
                          {branch.userCount} {branch.userCount === 1 ? 'user' : 'users'}
                        </p>
                      </div>
                    </div>

                    {canManage && (
                      <div className="mt-3 flex gap-2 border-t border-slate-100 pt-3">
                        <button
                          type="button"
                          onClick={() => setBranchModal({ mode: 'edit', branch })}
                          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setDeleteTarget({ type: 'branch', id: branch.id, name: branch.name })
                          }
                          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </button>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Categories Tab */}
      {activeTab === 'categories' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
            <h3 className="font-bold text-slate-900 text-sm">IT Request Categories Taxonomy</h3>
            <span className="text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded font-semibold border border-amber-200">
              Taxonomy & SLAs: TBD Ã¢â‚¬â€ For Confirmation
            </span>
          </div>
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            {categories.map((c) => (
              <div key={c.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-900 text-sm">{c.name}</h4>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                    Category: {c.name}
                  </span>
                </div>
                <p className="text-xs text-slate-600">{c.subcategory}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Activity Logs Tab */}
      {activeTab === 'activity_logs' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm space-y-3 p-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">System Audit Activity Logs</h3>
              <p className="text-xs text-slate-500">Traceability log for ticket events, status updates, and user actions</p>
            </div>
            <span className="text-xs text-slate-400 font-mono">{auditLogs.length} entries</span>
          </div>

          <div className="space-y-2">
            {auditLogs.map((log) => (
              <div
                key={log.id}
                className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div>
                  <div className="font-bold text-slate-900 flex items-center gap-2">
                    <span>{log.action}</span>
                    {log.targetId && (
                      <span className="font-mono text-[10px] bg-blue-100 text-blue-900 px-1.5 py-0.5 rounded font-bold">
                        #{log.targetId}
                      </span>
                    )}
                  </div>
                  <div className="text-slate-600 mt-0.5">{log.details}</div>
                </div>

                <div className="text-right text-[10px] text-slate-500 font-mono shrink-0">
                  <div>By {log.actorName} ({log.actorRole})</div>
                  <div>{log.timestamp}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* User Form Modal */}
      {userModal && (
        <UserFormModal
          mode={userModal.mode}
          initial={userModal.user}
          branches={branches}
          currentUserId={users.find((x) => x.role === 'ADMINISTRATOR')?.id}
          onClose={() => setUserModal(null)}
          onSubmit={handleUserFormSubmit}
        />
      )}

      {/* Branch Form Modal */}
      {branchModal && (
        <BranchFormModal
          mode={branchModal.mode}
          initial={branchModal.branch}
          onClose={() => setBranchModal(null)}
          onSubmit={handleBranchFormSubmit}
        />
      )}

      {/* Staff Assignment Modal */}
      {assignmentModal && (
        <StaffAssignmentModal
          staff={assignmentModal}
          branches={branches}
          onClose={() => setAssignmentModal(null)}
          onSave={(assignments) => {
            onUpdateStaffAssignments?.(assignmentModal.id, assignments);
            setAssignmentModal(null);
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <DeleteConfirmModal
          target={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDeleteConfirm}
        />
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// User Form Modal
// ---------------------------------------------------------------------------

function UserFormModal({
  mode,
  initial,
  branches,
  currentUserId,
  onClose,
  onSubmit,
}: {
  mode: 'create' | 'edit';
  initial?: User;
  branches: Branch[];
  currentUserId?: string;
  onClose: () => void;
  onSubmit: (form: UserFormState) => void;
}) {
  const isEdit = mode === 'edit';
  const [form, setForm] = useState<UserFormState>(() => ({
    id: initial?.id,
    name: initial?.name || '',
    username: initial?.username || '',
    role: initial?.role || 'BRANCH_USER',
    email: initial?.email || '',
    branchId: initial?.branchId || branches[0]?.id,
    branchName: initial?.branchName || (branches[0] ? branches[0].name : ''),
    department: initial?.department || '',
    password: '',
  }));

  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleBranchChange = (branchId: string) => {
    const b = branches.find((x) => x.id === branchId);
    setForm((f) => ({ ...f, branchId, branchName: b?.name || '' }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.username.trim() || !form.email.trim()) {
      setError('Please fill in all required fields.');
      return;
    }
    if (form.role === 'BRANCH_USER' && !form.branchId) {
      setError('Please select a branch for this user.');
      return;
    }
    if (form.password && form.password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    onSubmit(form);
  };

  const inputClass = 'w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:bg-white transition';
  const labelClass = 'block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1';

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-purple-900 font-bold text-base">
            <Users className="w-5 h-5 text-purple-600" />
            <span>{isEdit ? 'Edit User Account' : 'Create User Account'}</span>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 text-slate-500 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className={labelClass}>Full Name <span className="text-red-500">*</span></label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Maria Santos"
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Username <span className="text-red-500">*</span></label>
              <input
                type="text"
                required
                value={form.username}
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                placeholder="e.g. maria.santos"
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Role <span className="text-red-500">*</span></label>
              <select
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as UserRole }))}
                className={inputClass}
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>

            {form.role === 'BRANCH_USER' ? (
              <div className="col-span-2">
                <label className={labelClass}>Branch <span className="text-red-500">*</span></label>
                <select
                  value={form.branchId || ''}
                  onChange={(e) => handleBranchChange(e.target.value)}
                  className={inputClass}
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="col-span-2">
                <label className={labelClass}>Department</label>
                <input
                  type="text"
                  value={form.department || ''}
                  onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
                  placeholder={form.role === 'IT_STAFF' ? 'Main IT Department' : form.role === 'AUDITOR' ? 'Internal Audit Department' : 'System Administration'}
                  className={inputClass}
                />
              </div>
            )}

            <div className="col-span-2">
              <label className={labelClass}>Email <span className="text-red-500">*</span></label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="e.g. maria.santos@bayanihanbank.demo"
                className={inputClass}
              />
            </div>

            <div className="col-span-2">
              <label className={labelClass}>
                {isEdit ? 'New Password (leave blank to keep current)' : 'Initial Password'}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder={isEdit ? 'Ã¢â‚¬Â¢Ã¢â‚¬Â¢Ã¢â‚¬Â¢Ã¢â‚¬Â¢Ã¢â‚¬Â¢Ã¢â‚¬Â¢Ã¢â‚¬Â¢Ã¢â‚¬Â¢' : `Default: password123 (min 6 chars)`}
                  className={`${inputClass} pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-slate-200 text-slate-500 cursor-pointer"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                {isEdit
                  ? 'Setting a new password forces the user to change it on their next login.'
                  : 'If left blank, the default password is password123. The user must change it on first login.'}
              </p>
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">{error}</div>
          )}

          {isEdit && form.id === currentUserId && (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-[11px] flex items-start gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>This is the currently logged-in administrator. Role and deletion cannot be changed for this account.</span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 text-slate-700 font-bold text-xs rounded-lg hover:bg-slate-200 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-purple-700 hover:bg-purple-600 text-white font-bold text-xs rounded-lg transition shadow-md cursor-pointer"
            >
              {isEdit ? 'Save Changes' : 'Create Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Branch Form Modal
// ---------------------------------------------------------------------------

function BranchFormModal({
  mode,
  initial,
  onClose,
  onSubmit,
}: {
  mode: 'create' | 'edit';
  initial?: Branch;
  onClose: () => void;
  onSubmit: (form: BranchFormState) => void;
}) {
  const isEdit = mode === 'edit';
  const [form, setForm] = useState<BranchFormState>(() => ({
    id: initial?.id,
    name: initial?.name || '',
    location: initial?.location || '',
    status: initial?.status || 'Active',
    userCount: initial?.userCount ?? 0,
  }));

  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.location.trim()) {
      setError('Please fill in all required fields.');
      return;
    }
    onSubmit(form);
  };

  const inputClass = 'w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-white transition';
  const labelClass = 'block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1';

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-indigo-900 font-bold text-base">
            <Building className="w-5 h-5 text-indigo-600" />
            <span>{isEdit ? 'Edit Branch' : 'Add Branch'}</span>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 text-slate-500 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as 'Active' | 'Inactive' }))}
                className={inputClass}
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>

            <div className="col-span-2">
              <label className={labelClass}>Branch Name <span className="text-red-500">*</span></label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Tiaong Branch"
                className={inputClass}
              />
            </div>

            <div className="col-span-2">
              <label className={labelClass}>Location <span className="text-red-500">*</span></label>
              <input
                type="text"
                required
                value={form.location}
                onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                placeholder="e.g. Tiaong, Quezon"
                className={inputClass}
              />
            </div>

            <div className="col-span-2">
              <label className={labelClass}>Staff User Count</label>
              <input
                type="number"
                min={0}
                value={form.userCount}
                onChange={(e) => setForm((f) => ({ ...f, userCount: Number(e.target.value) || 0 }))}
                className={inputClass}
              />
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">{error}</div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 text-slate-700 font-bold text-xs rounded-lg hover:bg-slate-200 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-indigo-700 hover:bg-indigo-600 text-white font-bold text-xs rounded-lg transition shadow-md cursor-pointer"
            >
              {isEdit ? 'Save Changes' : 'Add Branch'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Delete Confirmation Modal
// ---------------------------------------------------------------------------

const DURATION_OPTIONS = [1, 2, 3, 4, 5, 6, 9, 12];

function buildAssignment(branchId: string, branchName: string, durationMonths: number): BranchAssignment {
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

function StaffAssignmentModal({
  staff,
  branches,
  onClose,
  onSave,
}: {
  staff: User;
  branches: Branch[];
  onClose: () => void;
  onSave: (assignments: BranchAssignment[]) => void;
}) {
  const existing = staff.assignments || [];
  const [selections, setSelections] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    for (const a of existing) map[a.branchId] = a.durationMonths;
    return map;
  });

  const toggle = (branchId: string) => {
    setSelections((prev) => {
      const next = { ...prev };
      if (branchId in next) {
        delete next[branchId];
      } else {
        next[branchId] = 3;
      }
      return next;
    });
  };

  const setDuration = (branchId: string, months: number) => {
    setSelections((prev) => ({ ...prev, [branchId]: months }));
  };

  const handleSave = () => {
    const assignments: BranchAssignment[] = branches
      .filter((b) => b.id in selections)
      .map((b) => buildAssignment(b.id, b.name, selections[b.id]));
    onSave(assignments);
  };

  const selectedCount = Object.keys(selections).length;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sky-900 font-bold text-base">
            <MapPin className="w-5 h-5 text-sky-600" />
            <span>Assign Branches Ã¢â‚¬â€ {staff.name}</span>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 text-slate-500 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">
          Select which branch(es) this IT staff member is assigned to and set how long each assignment lasts.
          Expired assignments appear in red on the roster.
        </p>

        <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
          {branches.map((b) => {
            const checked = b.id in selections;
            return (
              <div
                key={b.id}
                className={`p-3 rounded-xl border transition flex flex-col sm:flex-row sm:items-center gap-3 ${
                  checked ? 'bg-sky-50/70 border-sky-300' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(b.id)}
                    className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 cursor-pointer"
                  />
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900 text-sm">{b.name}</div>
                    <div className="text-[11px] text-slate-500">
                      {b.location}
                    </div>
                  </div>
                </div>

                {checked && (
                  <div className="flex items-center gap-2 shrink-0">
                    <CalendarClock className="w-3.5 h-3.5 text-sky-600" />
                    <select
                      value={selections[b.id]}
                      onChange={(e) => setDuration(b.id, Number(e.target.value))}
                      className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer"
                    >
                      {DURATION_OPTIONS.map((m) => (
                        <option key={m} value={m}>
                          {m} month{m > 1 ? 's' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {selectedCount > 0 && (
          <div className="p-3 bg-sky-50 border border-sky-200 rounded-xl text-xs text-sky-900">
            <strong>{selectedCount}</strong> branch{selectedCount > 1 ? 'es' : ''} selected. Assignments will take
            effect immediately and show the expiry date on the roster.
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 text-slate-700 font-bold text-xs rounded-lg hover:bg-slate-200 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2 bg-sky-700 hover:bg-sky-600 text-white font-bold text-xs rounded-lg transition shadow-md cursor-pointer"
          >
            Save Assignments
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Delete Confirmation Modal
// ---------------------------------------------------------------------------

function DeleteConfirmModal({
  target,
  onClose,
  onConfirm,
}: {
  target: DeleteTarget;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4">
        <div className="flex items-center gap-2 text-red-900 font-bold text-base">
          <AlertTriangle className="w-5 h-5 text-red-600" />
          <span>Confirm Deletion</span>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed">
          Are you sure you want to delete{' '}
          <strong className="text-slate-900">
            {target.type === 'user' ? `user ${target.name}` : `branch "${target.name}"`}
          </strong>
          ? This action will be recorded in the audit log.
        </p>
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 text-slate-700 font-bold text-xs rounded-lg hover:bg-slate-200 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-5 py-2 bg-red-700 hover:bg-red-600 text-white font-bold text-xs rounded-lg transition shadow-md cursor-pointer"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
