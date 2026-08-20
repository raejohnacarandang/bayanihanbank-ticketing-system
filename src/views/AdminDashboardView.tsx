import React, { useState } from "react";
import {
  User,
  Branch,
  CategoryInfo,
  AuditLog,
  Ticket,
  TicketStatus,
  BranchAssignment,
  NotificationItem,
} from "../types";
import type {
  CreateBranchParams,
  CreateCategoryParams,
  CreateUserParams,
  UpdateCategoryChanges,
  UpdateUserChanges,
} from "../services/store";
import { UserFormState, BranchFormState, DeleteTarget } from "../components/admin/types";
import { UserFormModal } from "../components/admin/UserFormModal";
import { BranchFormModal } from "../components/admin/BranchFormModal";
import { CategoryFormModal } from "../components/admin/CategoryFormModal";
import { StaffAssignmentModal } from "../components/admin/StaffAssignmentModal";
import { DeleteConfirmModal } from "../components/admin/DeleteConfirmModal";
import {
  Building,
  ShieldCheck,
  CheckCircle2,
  Ticket as TicketIcon,
  Plus,
  HelpCircle,
  UserCheck,
  Pencil,
  Trash2,
  MapPin,
  CalendarClock,
  PlayCircle,
  Clock,
  Archive,
  BarChart3,
  Monitor,
  Activity,
  ExternalLink,
  type LucideIcon,
} from "lucide-react";

type AdminTab =
  | "overview"
  | "users"
  | "branches"
  | "categories"
  | "it_staff"
  | "activity_logs";

interface AdminDashboardViewProps {
  users: User[];
  branches: Branch[];
  categories: CategoryInfo[];
  auditLogs: AuditLog[];
  tickets: Ticket[];
  notifications: NotificationItem[];
  activeTab: AdminTab;
  onSelectTab: (tab: AdminTab) => void;
  mode?: "admin" | "auditor";
  onCreateUser?: (user: CreateUserParams) => void;
  onUpdateUser?: (userId: string, changes: UpdateUserChanges) => void;
  onDeleteUser?: (userId: string) => void;
  onCreateBranch?: (branch: CreateBranchParams) => void;
  onCreateCategory?: (category: CreateCategoryParams) => void;
  onUpdateCategory?: (categoryId: string, changes: UpdateCategoryChanges) => void;
  onUpdateBranch?: (branchId: string, changes: Partial<Branch>) => void;
  onDeleteBranch?: (branchId: string) => void;
  onUpdateStaffAssignments?: (
    staffUserId: string,
    assignments: BranchAssignment[],
  ) => void;
  onViewStatusTickets?: (status: TicketStatus) => void;
}

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({
  users,
  branches,
  categories,
  auditLogs,
  tickets,
  notifications,
  activeTab,
  mode = "admin",
  onCreateUser,
  onUpdateUser,
  onDeleteUser,
  onCreateBranch,
  onCreateCategory,
  onUpdateCategory,
  onUpdateBranch,
  onDeleteBranch,
  onUpdateStaffAssignments,
  onViewStatusTickets,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [userModal, setUserModal] = useState<{
    mode: "create" | "edit";
    user?: User;
  } | null>(null);
  const [branchModal, setBranchModal] = useState<{
    mode: "create" | "edit";
    branch?: Branch;
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [assignmentModal, setAssignmentModal] = useState<User | null>(null);
  const [categoryModal, setCategoryModal] = useState<{
    mode: "create" | "edit";
    category?: CategoryInfo;
  } | null>(null);
  const isAuditor = mode === "auditor";
  const isAdmin = mode === "admin";
  const canManage = isAdmin && !!onCreateUser && !!onCreateBranch;
  const canManageCategories =
    isAdmin && !!onCreateCategory && !!onUpdateCategory;

  const totalUsers = users.length;
  const totalBranches = branches.length;
  const totalItStaff = users.filter((u) => u.role === "IT_STAFF").length;
  const totalTickets = tickets.length;

  const STATUS_DEFS: {
    status: TicketStatus;
    label: string;
    icon: LucideIcon;
    cardClass: string;
    barClass: string;
    countClass: string;
  }[] = [
    {
      status: "In Progress",
      label: "In Progress",
      icon: PlayCircle,
      cardClass: "bg-amber-50 border-amber-200",
      barClass: "bg-amber-500",
      countClass: "text-amber-900",
    },
    {
      status: "Pending",
      label: "Pending",
      icon: Clock,
      cardClass: "bg-purple-50 border-purple-200",
      barClass: "bg-purple-600",
      countClass: "text-purple-900",
    },
    {
      status: "Resolved",
      label: "Resolved",
      icon: CheckCircle2,
      cardClass: "bg-emerald-50 border-emerald-200",
      barClass: "bg-emerald-600",
      countClass: "text-emerald-900",
    },
  ];
  const statusCount = (s: TicketStatus) =>
    tickets.filter((t) => t.status === s).length;

  const itStaff = users.filter((u) => u.role === "IT_STAFF");

  const staffStatus = itStaff.map((s) => {
    const staffTickets = tickets.filter((t) => t.assignedToId === s.id);
    const pendingCount = staffTickets.filter(
      (t) => t.status === "Pending",
    ).length;
    const inProgressCount = staffTickets.filter(
      (t) => t.status === "In Progress",
    ).length;
    const resolvedCount = staffTickets.filter(
      (t) => t.status === "Resolved",
    ).length;
    const openCount = pendingCount + inProgressCount;
    const totalCount = staffTickets.length;
    const newNotificationCount = notifications.filter(
      (n) => n.userId === s.id && !n.read,
    ).length;
    return {
      staff: s,
      pendingCount,
      inProgressCount,
      resolvedCount,
      openCount,
      totalCount,
      newNotificationCount,
    };
  });

  const branchById = (id?: string): Branch | undefined =>
    branches.find((b) => b.id === id);

  const handleUserFormSubmit = (form: UserFormState) => {
    if (form.id) {
      onUpdateUser?.(form.id, {
        name: form.name,
        username: form.username,
        role: form.role,
        email: form.email,
        branchId: form.role === "BRANCH_USER" ? form.branchId : undefined,
        branchName: form.role === "BRANCH_USER" ? form.branchName : undefined,
        department: form.role === "BRANCH_USER" ? undefined : form.department,
        password: form.password || undefined,
      });
    } else {
      onCreateUser?.({
        name: form.name,
        username: form.username,
        role: form.role,
        email: form.email,
        branchId: form.role === "BRANCH_USER" ? form.branchId : undefined,
        branchName: form.role === "BRANCH_USER" ? form.branchName : undefined,
        department: form.role === "BRANCH_USER" ? undefined : form.department,
        password: form.password || undefined,
      });
    }
    setUserModal(null);
  };

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
    if (deleteTarget.type === "user") onDeleteUser?.(deleteTarget.id);
    else onDeleteBranch?.(deleteTarget.id);
    setDeleteTarget(null);
  };

  const handleCategoryFormSubmit = (
    category: CreateCategoryParams,
    categoryId?: string,
  ) => {
    if (categoryId) {
      onUpdateCategory?.(categoryId, category);
    } else {
      onCreateCategory?.(category);
    }
    setCategoryModal(null);
  };

  return (
    <div className="space-y-6">
      {/* Admin Header */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded border text-xs font-bold uppercase tracking-wider mb-2 ${
              isAuditor
                ? "bg-teal-900 text-teal-200 border-teal-700"
                : "bg-purple-900 text-purple-200 border-purple-700"
            }`}
          >
            <ShieldCheck
              className={`w-3.5 h-3.5 ${isAuditor ? "text-teal-400" : "text-purple-400"}`}
            />
            <span>
              {isAuditor
                ? "Audit Console (View-Only)"
                : "Administrator Control Console"}
            </span>
          </div>
          <h1 className="text-2xl font-black">
            {isAuditor
              ? "Audit & Monitoring"
              : "System Administration & Settings"}
          </h1>
          <p className="text-xs text-slate-300 mt-1">
            {isAuditor
              ? "Read-only monitoring of tickets and audit activity for the Internal Audit Department"
              : "Manage users, branches, IT specialist, and review system audit activity"}
          </p>
        </div>
      </div>

      {/* IT Specialist Status (Overview only) */}
      {activeTab === "overview" && (
        <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-lg overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/60">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-sky-500/15 border border-sky-500/30 flex items-center justify-center">
                  <UserCheck className="w-4 h-4 text-sky-400" />
                </span>
                <span>IT Specialist Status</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Per-staff workload, live ticket counts, and assigned branch
                coverage
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-lg bg-sky-500/10 border border-sky-500/30 text-sky-300 text-[11px] font-bold inline-flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5" />
                {itStaff.length} IT specialist
                {itStaff.length !== 1 ? "s" : ""}
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 text-[11px] font-semibold font-mono">
                {staffStatus.reduce((acc, s) => acc + s.openCount, 0)} open
              </span>
            </div>
          </div>
          <div className="p-4 sm:p-5">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {staffStatus.map(
                  ({
                    staff: s,
                    pendingCount,
                    inProgressCount,
                    resolvedCount,
                    openCount,
                    totalCount,
                    newNotificationCount,
                  }) => {
                    const loadPct =
                      totalCount > 0
                        ? Math.round((openCount / totalCount) * 100)
                        : 0;
                    const loadColor =
                      loadPct === 0
                        ? "bg-slate-600"
                        : loadPct >= 60
                          ? "bg-red-500"
                          : loadPct >= 35
                            ? "bg-amber-400"
                            : "bg-emerald-400";
                    return (
                      <div
                        key={s.id}
                        className="p-4 bg-slate-800/60 rounded-2xl border border-slate-700/70 shadow-sm hover:shadow-xl hover:-translate-y-0.5 hover:border-sky-500/50 hover:bg-slate-800 transition-all duration-200 space-y-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="relative shrink-0">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white font-black flex items-center justify-center shadow-md border-2 border-slate-900 ring-1 ring-amber-400/50">
                              {s.name.charAt(0)}
                            </div>
                            <span
                              className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-slate-900"
                              title="Active"
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-bold text-slate-100 text-sm truncate flex items-center gap-1.5">
                              {s.name}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono truncate">
                              @{s.username}
                            </div>
                          </div>
                          {newNotificationCount > 0 ? (
                            <span className="min-w-6 h-6 px-1.5 rounded-full bg-emerald-500 text-white text-xs font-black flex items-center justify-center shadow-md ring-2 ring-emerald-500/30 shrink-0">
                              {newNotificationCount}
                            </span>
                          ) : (
                            <span className="h-6 px-2 rounded-full bg-slate-900 text-slate-400 text-[9px] font-bold uppercase tracking-wider flex items-center border border-slate-700 shrink-0">
                              Idle
                            </span>
                          )}
                        </div>

                        {/* Workload Bar */}
                        <div>
                          <div className="flex items-center justify-between text-[10px] font-semibold text-slate-400 mb-1.5">
                            <span className="inline-flex items-center gap-1">
                              <Activity className="w-3 h-3 text-sky-400" />
                              Current Workload
                            </span>
                            <span className="font-mono text-slate-200">
                              {openCount} open of {totalCount} assigned
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full bg-slate-700/80 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${loadColor}`}
                              style={{ width: `${Math.min(100, loadPct)}%` }}
                            />
                          </div>
                        </div>

                        {/* Status Counts */}
                        <div className="grid grid-cols-3 gap-2">
                          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-center space-y-1">
                            <PlayCircle className="w-3.5 h-3.5 text-amber-400 mx-auto" />
                            <div className="text-[9px] font-bold text-amber-300 uppercase tracking-wider">
                              In Progress
                            </div>
                            <div className="text-xl font-black text-amber-100 leading-none">
                              {inProgressCount}
                            </div>
                          </div>
                          <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/25 text-center space-y-1">
                            <Clock className="w-3.5 h-3.5 text-purple-400 mx-auto" />
                            <div className="text-[9px] font-bold text-purple-300 uppercase tracking-wider">
                              Pending
                            </div>
                            <div className="text-xl font-black text-purple-100 leading-none">
                              {pendingCount}
                            </div>
                          </div>
                          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-center space-y-1">
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
                                    className="px-2 py-1 rounded-lg bg-slate-900/70 border border-slate-700 text-[10px] font-semibold text-slate-300 flex items-center gap-1"
                                  >
                                    <Building className="w-2.5 h-2.5 text-sky-400 shrink-0" />
                                    {branchName}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        <button
                          onClick={() =>
                            window.open(
                              `/wallboard/${s.id}`,
                              "_blank",
                              "noopener",
                            )
                          }
                          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-[11px] font-bold transition group cursor-pointer shadow-md shadow-sky-950/50"
                          title="Open this staff member's status on a dedicated monitor"
                        >
                          <Monitor className="w-3.5 h-3.5" />
                          <span>Open Monitor View</span>
                          <ExternalLink className="w-3 h-3 opacity-60 group-hover:opacity-100 transition" />
                        </button>
                      </div>
                    );
                  },
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Overview */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Ticket Status Breakdown */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50/60">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-purple-600" />
                  <span>Ticket Status Breakdown</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Distribution of tickets by current status
                </p>
              </div>
              <span className="text-xs text-slate-500 font-mono">
                {totalTickets} tickets total
              </span>
            </div>
            <div className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
              {STATUS_DEFS.map((s) => {
                const count = statusCount(s.status);
                const pct =
                  totalTickets > 0
                    ? Math.round((count / totalTickets) * 100)
                    : 0;
                const Icon = s.icon;
                return (
                  <div
                    key={s.status}
                    onClick={() => onViewStatusTickets?.(s.status)}
                    className={`p-4 rounded-xl border ${s.cardClass} ${
                      onViewStatusTickets
                        ? "cursor-pointer hover:ring-2 hover:ring-purple-300 transition"
                        : ""
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
                        {s.label}
                      </span>
                      <Icon className="w-3.5 h-3.5 text-slate-500" />
                    </div>
                    <div className={`text-2xl font-black mt-1 ${s.countClass}`}>
                      {count}
                    </div>
                    <div className="text-[10px] text-slate-500 font-semibold">
                      {pct}% of total
                    </div>
                    <div className="mt-2 h-1.5 rounded-full bg-white/70 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${s.barClass}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Overview Stat Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-xl border border-slate-200">
              <span className="text-[11px] font-bold text-slate-500 uppercase">
                Total Users
              </span>
              <div className="text-4xl font-black text-slate-900 mt-1">
                {totalUsers}
              </div>
            </div>
            <div className="bg-white p-5 rounded-xl border border-slate-200">
              <span className="text-[11px] font-bold text-slate-500 uppercase">
                Total Branches
              </span>
              <div className="text-4xl font-black text-slate-900 mt-1">
                {totalBranches}
              </div>
            </div>
            <div className="bg-white p-5 rounded-xl border border-slate-200">
              <span className="text-[11px] font-bold text-slate-500 uppercase">
                IT Specialist
              </span>
              <div className="text-4xl font-black text-emerald-900 mt-1">
                {totalItStaff}
              </div>
            </div>
            <div className="bg-white p-5 rounded-xl border border-slate-200">
              <span className="text-[11px] font-bold text-slate-500 uppercase">
                Total Tickets
              </span>
              <div className="text-4xl font-black text-slate-900 mt-1">
                {totalTickets}
              </div>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-900 space-y-2">
            <div className="font-bold text-amber-950 flex items-center gap-1.5">
              <HelpCircle className="w-4 h-4 text-amber-700" />
              <span>Prototype Note on Administrator Section</span>
            </div>
            <p className="leading-relaxed text-amber-900/90">
              This administrator interface is provided as a conceptual
              representation of future system administration features. User
              creation, Active Directory syncing, and branch management will be
              wired to actual database tables in the backend development phase.
            </p>
          </div>
        </div>
      )}

      {/* Users Tab */}
      {activeTab === "users" && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 bg-slate-50">
            <h3 className="font-bold text-slate-900 text-sm">
              System Users Directory
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">
                {users.length} registered accounts
              </span>
              {canManage && (
                <button
                  onClick={() => setUserModal({ mode: "create" })}
                  className="px-3 py-1.5 bg-purple-700 hover:bg-purple-600 text-white font-bold text-[11px] rounded-lg transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create Account</span>
                </button>
              )}
            </div>
          </div>
          <div className="overflow-x-auto">
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
                    <td className="p-3 text-slate-700">
                      {u.branchName || u.department || "—"}
                    </td>
                    <td className="p-3 text-slate-500 font-mono">{u.email}</td>
                    <td className="p-3 text-right">
                      <div className="inline-flex flex-col items-end gap-1">
                        {u.passwordResetRequested && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                            Reset requested
                          </span>
                        )}
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          Active
                        </span>
                      </div>
                    </td>
                    {canManage && (
                      <td className="p-3 text-right whitespace-nowrap">
                        <button
                          onClick={() => setUserModal({ mode: "edit", user: u })}
                          className="p-1.5 rounded bg-slate-100 hover:bg-purple-700 hover:text-white text-slate-600 transition inline-flex cursor-pointer"
                          title="Edit account"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() =>
                            setDeleteTarget({
                              type: "user",
                              id: u.id,
                              name: u.name,
                            })
                          }
                          disabled={
                            u.id ===
                            users.find((x) => x.role === "ADMINISTRATOR")?.id
                          }
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
        </div>
      )}

      {/* IT Specialist Settings Tab */}
      {activeTab === "it_staff" && (
        <div className="space-y-4">
          <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 text-xs text-sky-900 space-y-1">
            <div className="font-bold text-sky-950 flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-sky-700" />
              <span>IT Specialist Settings</span>
            </div>
            <p className="leading-relaxed text-sky-900/80">
              Manage Main IT Department staff accounts. IT specialist receive
              notifications for every new ticket and handle the service desk
              queue. New tickets are also visible to administrators.
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 bg-slate-50">
              <h3 className="font-bold text-slate-900 text-sm">
                Main IT Department Roster
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">
                  {itStaff.length} IT specialist accounts
                </span>
                {canManage && (
                  <button
                    onClick={() =>
                      setUserModal({
                        mode: "create",
                        user: { role: "IT_STAFF" } as User,
                      })
                    }
                    className="px-3 py-1.5 bg-sky-700 hover:bg-sky-600 text-white font-bold text-[11px] rounded-lg transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add IT Specialist</span>
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 p-4">
              {itStaff.length === 0 && (
                <div className="lg:col-span-2 p-8 text-center text-slate-400 text-xs">
                  No IT specialist accounts yet. Click "Add IT Specialist" to
                  create one.
                </div>
              )}
              {itStaff.map((s) => (
                <div
                  key={s.id}
                  className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col gap-3"
                >
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-amber-600 text-white font-bold flex items-center justify-center shrink-0 border border-amber-300/40">
                        {s.name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 text-sm">
                          {s.name}
                        </div>
                        <div className="font-mono text-[11px] text-slate-500">
                          {s.username}
                        </div>
                        <div className="text-[11px] text-slate-600 mt-1 flex items-center gap-1">
                          <UserCheck className="w-3 h-3 text-amber-600" />
                          {s.department || "Main IT Department"}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                          {s.email}
                        </div>
                      </div>
                    </div>
                    {canManage && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => setAssignmentModal(s)}
                          className="px-2 py-1.5 rounded bg-sky-700 hover:bg-sky-600 text-white text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                          title="Assign branches"
                        >
                          <MapPin className="w-3 h-3" />
                          <span>Assign Branches</span>
                        </button>
                        <button
                          onClick={() =>
                            setUserModal({ mode: "edit", user: s })
                          }
                          className="p-1.5 rounded bg-white hover:bg-sky-700 hover:text-white text-slate-600 border border-slate-200 transition cursor-pointer"
                          title="Edit IT specialist"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() =>
                            setDeleteTarget({
                              type: "user",
                              id: s.id,
                              name: s.name,
                            })
                          }
                          className="p-1.5 rounded bg-white hover:bg-red-700 hover:text-white text-slate-600 border border-slate-200 transition cursor-pointer"
                          title="Remove IT specialist"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Branch Assignments */}
                  {s.assignments && s.assignments.length > 0 ? (
                    <div className="pt-3 border-t border-slate-200">
                      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        Assigned Branches ({s.assignments.length})
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {s.assignments.map((a) => {
                          const branchName =
                            a.branchName ||
                            branches.find((b) => b.id === a.branchId)?.name ||
                            a.branchId;
                          const expiresMs = a.expiresAt
                            ? new Date(a.expiresAt).getTime()
                            : NaN;
                          const hasExpiry = Number.isFinite(expiresMs);
                          const expired = hasExpiry && expiresMs < Date.now();
                          const hasDuration = Number.isFinite(
                            a.durationMonths,
                          );
                          return (
                            <div
                              key={a.branchId}
                              className={`px-2.5 py-1.5 rounded-lg border text-[11px] flex items-center gap-1.5 ${
                                expired
                                  ? "bg-red-50 border-red-200 text-red-800"
                                  : "bg-emerald-50 border-emerald-200 text-emerald-900"
                              }`}
                            >
                              <Building className="w-3 h-3 shrink-0" />
                              <span className="font-semibold">
                                {branchName}
                              </span>
                              {hasDuration && (
                                <>
                                  <span className="opacity-70">•</span>
                                  <span className="flex items-center gap-1 font-medium">
                                    <CalendarClock className="w-3 h-3" />
                                    {a.durationMonths} mo
                                  </span>
                                </>
                              )}
                              {hasExpiry && (
                                <span className="opacity-60">
                                  (until{" "}
                                  {new Date(a.expiresAt).toLocaleDateString(
                                    "en-US",
                                    {
                                      month: "short",
                                      day: "2-digit",
                                      year: "numeric",
                                    },
                                  )}
                                  )
                                </span>
                              )}
                              {expired && (
                                <span className="text-[9px] font-bold bg-red-100 px-1 py-0.5 rounded ml-0.5">
                                  EXPIRED
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="pt-3 border-t border-slate-200">
                      <span className="text-[11px] text-slate-400 italic flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        Not assigned to any branch — handles the general IT
                        queue.
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Branches Tab */}
      {activeTab === "branches" && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 bg-slate-50">
            <h3 className="font-bold text-slate-900 text-sm">
              Bayanihan Bank Branches Directory
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">
                {branches.length} bank locations
              </span>
              {canManage && (
                <button
                  onClick={() => setBranchModal({ mode: "create" })}
                  className="px-3 py-1.5 bg-indigo-700 hover:bg-indigo-600 text-white font-bold text-[11px] rounded-lg transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Branch</span>
                </button>
              )}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider">
                <tr>
                  <th className="p-3">Branch Name</th>
                  <th className="p-3">Location</th>
                  <th className="p-3">Status</th>
                  {canManage && <th className="p-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {branches.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50">
                    <td className="p-3 font-bold text-slate-900">{b.name}</td>
                    <td className="p-3 text-slate-600">{b.location}</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          b.status === "Active"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-slate-200 text-slate-600"
                        }`}
                      >
                        {b.status}
                      </span>
                    </td>
                    {canManage && (
                      <td className="p-3 text-right whitespace-nowrap">
                        <button
                          onClick={() =>
                            setBranchModal({ mode: "edit", branch: b })
                          }
                          className="p-1.5 rounded bg-slate-100 hover:bg-indigo-700 hover:text-white text-slate-600 transition inline-flex cursor-pointer"
                          title="Edit branch"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() =>
                            setDeleteTarget({
                              type: "branch",
                              id: b.id,
                              name: b.name,
                            })
                          }
                          className="p-1.5 rounded bg-slate-100 hover:bg-red-700 hover:text-white text-slate-600 transition inline-flex ml-1 cursor-pointer"
                          title="Delete branch"
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
        </div>
      )}

      {/* Categories Tab */}
      {activeTab === "categories" && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 bg-slate-50">
            <h3 className="font-bold text-slate-900 text-sm">
              IT Request Categories Taxonomy
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded font-semibold border border-amber-200">
                Taxonomy: TBD — For Confirmation
              </span>
              {canManageCategories && (
                <button
                  onClick={() => setCategoryModal({ mode: "create" })}
                  className="px-3 py-1.5 bg-purple-700 hover:bg-purple-600 text-white font-bold text-[11px] rounded-lg transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Category</span>
                </button>
              )}
            </div>
          </div>
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            {categories.map((c) => (
              <div
                key={c.id}
                className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1"
              >
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-900 text-sm">{c.name}</h4>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                      {c.status}
                    </span>
                    {canManageCategories && (
                      <button
                        onClick={() =>
                          setCategoryModal({ mode: "edit", category: c })
                        }
                        className="p-1.5 rounded bg-slate-100 hover:bg-purple-700 hover:text-white text-slate-600 transition inline-flex cursor-pointer"
                        title="Edit category"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {c.subcategory
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean)
                    .map((sub, i) => (
                      <span
                        key={i}
                        className="text-[10px] px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-600"
                      >
                        {sub}
                      </span>
                    ))}
                  {!c.subcategory.trim() && (
                    <span className="text-[10px] text-slate-400 italic">
                      No subcategories
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Activity Logs Tab */}
      {activeTab === "activity_logs" && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm space-y-3 p-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">
                System Audit Activity Logs
              </h3>
              <p className="text-xs text-slate-500">
                Traceability log for ticket events, status updates, and user
                actions
              </p>
            </div>
            <span className="text-xs text-slate-400 font-mono">
              {auditLogs.length} entries
            </span>
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
                      <span className="font-mono text-[10px] bg-emerald-100 text-emerald-900 px-1.5 py-0.5 rounded font-bold">
                        #{log.targetId}
                      </span>
                    )}
                  </div>
                  <div className="text-slate-600 mt-0.5">{log.details}</div>
                </div>

                <div className="text-right text-[10px] text-slate-500 font-mono shrink-0">
                  <div>
                    By {log.actorName} ({log.actorRole}) {log.requesterName && ' - Requester: ' + log.requesterName}
                  </div>
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
          currentUserId={users.find((x) => x.role === "ADMINISTRATOR")?.id}
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

      {/* Category Modal */}
      {categoryModal && (
        <CategoryFormModal
          mode={categoryModal.mode}
          initial={categoryModal.category}
          onClose={() => setCategoryModal(null)}
          onSubmit={(category) =>
            handleCategoryFormSubmit(category, categoryModal.category?.id)
          }
        />
      )}
    </div>
  );
};
