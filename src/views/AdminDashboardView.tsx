import React, { useState } from 'react';
import { User, Branch, CategoryInfo, AuditLog, Ticket, UserRole, BranchAssignment } from '../types';
import type { CreateBranchParams, CreateUserParams, UpdateUserChanges } from '../services/store';
import {
  Users,
  Building,
  Layers,
  History,
  ShieldCheck,
  CheckCircle2,
  Ticket as TicketIcon,
  Plus,
  HelpCircle,
  UserCheck,
  Pencil,
  Trash2,
  X,
  AlertTriangle,
  MapPin,
  CalendarClock
} from 'lucide-react';

type AdminTab = 'overview' | 'users' | 'branches' | 'categories' | 'it_staff' | 'activity_logs';

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
}

interface BranchFormState {
  id?: string;
  code: string;
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
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [userModal, setUserModal] = useState<{ mode: 'create' | 'edit'; user?: User } | null>(null);
  const [branchModal, setBranchModal] = useState<{ mode: 'create' | 'edit'; branch?: Branch } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [assignmentModal, setAssignmentModal] = useState<User | null>(null);
  const isAuditor = mode === 'auditor';
  const isAdmin = mode === 'admin';
  const canManage = isAdmin && !!onCreateUser && !!onCreateBranch;

  const totalUsers = users.length;
  const totalBranches = branches.length;
  const totalItStaff = users.filter((u) => u.role === 'IT_STAFF').length;
  const totalTickets = tickets.length;
  const openTickets = tickets.filter((t) => t.status !== 'Closed' && t.status !== 'Cancelled').length;
  const resolvedTickets = tickets.filter((t) => t.status === 'Resolved' || t.status === 'Closed').length;

  const itStaff = users.filter((u) => u.role === 'IT_STAFF');

  const branchById = (id?: string): Branch | undefined => branches.find((b) => b.id === id);

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
      });
    }
    setUserModal(null);
  };

  const handleBranchFormSubmit = (form: BranchFormState) => {
    if (form.id) {
      onUpdateBranch?.(form.id, {
        code: form.code,
        name: form.name,
        location: form.location,
        status: form.status,
        userCount: form.userCount,
      });
    } else {
      onCreateBranch?.({
        code: form.code,
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

  const tabClass = (tab: AdminTab) => {
    const active = activeTab === tab;
    const accent = isAuditor ? 'bg-teal-600' : 'bg-purple-600';
    return `px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
      active ? `${accent} text-white` : 'text-slate-300 hover:text-white'
    }`;
  };

  return (
    <div className="space-y-6">
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

        {/* Tab Navigation Controls */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-800 p-1.5 rounded-xl border border-slate-700">
          <button onClick={() => onSelectTab('overview')} className={tabClass('overview')}>
            Overview
          </button>
          {!isAuditor && (
            <button onClick={() => onSelectTab('users')} className={tabClass('users')}>
              Users ({users.length})
            </button>
          )}
          {!isAuditor && (
            <button onClick={() => onSelectTab('it_staff')} className={tabClass('it_staff')}>
              IT Staff ({itStaff.length})
            </button>
          )}
          {!isAuditor && (
            <button onClick={() => onSelectTab('branches')} className={tabClass('branches')}>
              Branches ({branches.length})
            </button>
          )}
          {!isAuditor && (
            <button onClick={() => onSelectTab('categories')} className={tabClass('categories')}>
              Categories ({categories.length})
            </button>
          )}
          <button onClick={() => onSelectTab('activity_logs')} className={tabClass('activity_logs')}>
            Audit Logs
          </button>
        </div>
      </div>

      {/* Overview Stat Cards */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold text-slate-500 uppercase">Total Users</span>
              <div className="text-2xl font-black text-slate-900 mt-1">{totalUsers}</div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold text-slate-500 uppercase">Total Branches</span>
              <div className="text-2xl font-black text-slate-900 mt-1">{totalBranches}</div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold text-slate-500 uppercase">IT Staff</span>
              <div className="text-2xl font-black text-blue-900 mt-1">{totalItStaff}</div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold text-slate-500 uppercase">Total Tickets</span>
              <div className="text-2xl font-black text-slate-900 mt-1">{totalTickets}</div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold text-amber-700 uppercase">Open Tickets</span>
              <div className="text-2xl font-black text-amber-900 mt-1">{openTickets}</div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold text-emerald-700 uppercase">Resolved</span>
              <div className="text-2xl font-black text-emerald-900 mt-1">{resolvedTickets}</div>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-900 space-y-2">
            <div className="font-bold text-amber-950 flex items-center gap-1.5">
              <HelpCircle className="w-4 h-4 text-amber-700" />
              <span>Prototype Note on Administrator Section</span>
            </div>
            <p className="leading-relaxed text-amber-900/90">
              This administrator interface is provided as a conceptual representation of future system administration features. User creation, Active Directory syncing, branch management, and SLA configuration will be wired to actual database tables in the backend development phase.
            </p>
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
                  <td className="p-3 text-slate-700">{u.branchName || u.department || '—'}</td>
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
        <div className="space-y-4">
          <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 text-xs text-sky-900 space-y-1">
            <div className="font-bold text-sky-950 flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-sky-700" />
              <span>IT Staff Settings</span>
            </div>
            <p className="leading-relaxed text-sky-900/80">
              Manage Main IT Department staff accounts. IT staff receive notifications for every new ticket and
              handle the service desk queue. New tickets are also visible to administrators.
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-900 text-sm">Main IT Department Roster</h3>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">{itStaff.length} IT staff accounts</span>
                {canManage && (
                  <button
                    onClick={() => setUserModal({ mode: 'create', user: { role: 'IT_STAFF' } as User })}
                    className="px-3 py-1.5 bg-sky-700 hover:bg-sky-600 text-white font-bold text-[11px] rounded-lg transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add IT Staff</span>
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 p-4">
              {itStaff.length === 0 && (
                <div className="lg:col-span-2 p-8 text-center text-slate-400 text-xs">
                  No IT staff accounts yet. Click "Add IT Staff" to create one.
                </div>
              )}
              {itStaff.map((s) => (
                <div key={s.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-amber-600 text-white font-bold flex items-center justify-center shrink-0 border border-amber-300/40">
                        {s.name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 text-sm">{s.name}</div>
                        <div className="font-mono text-[11px] text-slate-500">{s.username}</div>
                        <div className="text-[11px] text-slate-600 mt-1 flex items-center gap-1">
                          <UserCheck className="w-3 h-3 text-amber-600" />
                          {s.department || 'Main IT Department'}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono mt-0.5">{s.email}</div>
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
                          onClick={() => setUserModal({ mode: 'edit', user: s })}
                          className="p-1.5 rounded bg-white hover:bg-sky-700 hover:text-white text-slate-600 border border-slate-200 transition cursor-pointer"
                          title="Edit IT staff"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget({ type: 'user', id: s.id, name: s.name })}
                          className="p-1.5 rounded bg-white hover:bg-red-700 hover:text-white text-slate-600 border border-slate-200 transition cursor-pointer"
                          title="Remove IT staff"
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
                          const expired = new Date(a.expiresAt).getTime() < Date.now();
                          return (
                            <div
                              key={a.branchId}
                              className={`px-2.5 py-1.5 rounded-lg border text-[11px] flex items-center gap-1.5 ${
                                expired
                                  ? 'bg-red-50 border-red-200 text-red-800'
                                  : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                              }`}
                            >
                              <Building className="w-3 h-3 shrink-0" />
                              <span className="font-semibold">{a.branchName}</span>
                              <span className="opacity-70">•</span>
                              <span className="flex items-center gap-1 font-medium">
                                <CalendarClock className="w-3 h-3" />
                                {a.durationMonths} mo
                              </span>
                              <span className="opacity-60">
                                (until {new Date(a.expiresAt).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })})
                              </span>
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
                        Not assigned to any branch — handles the general IT queue.
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
      {activeTab === 'branches' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
            <h3 className="font-bold text-slate-900 text-sm">Bayanihan Bank Branches Directory</h3>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">{branches.length} bank locations</span>
              {canManage && (
                <button
                  onClick={() => setBranchModal({ mode: 'create' })}
                  className="px-3 py-1.5 bg-indigo-700 hover:bg-indigo-600 text-white font-bold text-[11px] rounded-lg transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Branch</span>
                </button>
              )}
            </div>
          </div>
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider">
              <tr>
                <th className="p-3">Branch Code</th>
                <th className="p-3">Branch Name</th>
                <th className="p-3">Location</th>
                <th className="p-3">Staff Users</th>
                <th className="p-3">Status</th>
                {canManage && <th className="p-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {branches.map((b) => (
                <tr key={b.id} className="hover:bg-slate-50">
                  <td className="p-3 font-mono font-bold text-blue-900">{b.code}</td>
                  <td className="p-3 font-bold text-slate-900">{b.name}</td>
                  <td className="p-3 text-slate-600">{b.location}</td>
                  <td className="p-3 text-slate-700 font-medium">{b.userCount} users</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      b.status === 'Active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                    }`}>
                      {b.status}
                    </span>
                  </td>
                  {canManage && (
                    <td className="p-3 text-right whitespace-nowrap">
                      <button
                        onClick={() => setBranchModal({ mode: 'edit', branch: b })}
                        className="p-1.5 rounded bg-slate-100 hover:bg-indigo-700 hover:text-white text-slate-600 transition inline-flex cursor-pointer"
                        title="Edit branch"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget({ type: 'branch', id: b.id, name: b.name })}
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
      )}

      {/* Categories Tab */}
      {activeTab === 'categories' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
            <h3 className="font-bold text-slate-900 text-sm">IT Request Categories Taxonomy</h3>
            <span className="text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded font-semibold border border-amber-200">
              Taxonomy & SLAs: TBD — For Confirmation
            </span>
          </div>
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            {categories.map((c) => (
              <div key={c.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-900 text-sm">{c.name}</h4>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                    SLA Target: {c.slaTargetHours}
                  </span>
                </div>
                <p className="text-xs text-slate-600">{c.description}</p>
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
  }));

  const [error, setError] = useState('');

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
    code: initial?.code || '',
    name: initial?.name || '',
    location: initial?.location || '',
    status: initial?.status || 'Active',
    userCount: initial?.userCount ?? 0,
  }));

  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code.trim() || !form.name.trim() || !form.location.trim()) {
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
              <label className={labelClass}>Branch Code <span className="text-red-500">*</span></label>
              <input
                type="text"
                required
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                placeholder="e.g. UNQ-07"
                className={inputClass}
              />
            </div>

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
            <span>Assign Branches — {staff.name}</span>
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
                      {b.code} • {b.location}
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
