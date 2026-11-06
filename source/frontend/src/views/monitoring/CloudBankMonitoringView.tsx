import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowLeftRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  Filter,
  RefreshCw,
  Search,
  ShieldAlert,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import type { User } from "../../types";

interface CloudBankSnapshot {
  id: string;
  snapshot_date: string;
  sheet_name: string;
  source_file?: string;
  imported_at?: string;
}

interface CloudBankUserRow {
  user_id: string;
  username: string;
  first_name: string;
  last_name: string;
  role: string;
  branch_before: string;
  branch_after: string;
  date_change: string;
  created_val: string;
  active_status: string;
  action: string;
  source_row_number?: number;
}

interface CloudBankTimelineEntry extends CloudBankUserRow {
  snapshot_id: string;
  snapshot_date: string;
  sheet_name: string;
}

interface SnapshotListResponse {
  snapshots: CloudBankSnapshot[];
}

interface SnapshotUsersResponse {
  users: CloudBankUserRow[];
}

interface TimelineResponse {
  timeline: CloudBankTimelineEntry[];
}

const PAGE_SIZE = 50;
const TOKEN_KEY = "bb_it_token";

async function cloudBankGet<T>(url: string): Promise<T> {
  const token = window.localStorage.getItem(TOKEN_KEY);
  if (!token) throw new Error("Your session is missing. Sign in again, then reopen this page.");

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    credentials: "same-origin",
  });

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`The monitoring API returned an unreadable response (${response.status}).`);
  }

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
        ? payload.error
        : `Monitoring request failed (${response.status}).`;
    throw new Error(message);
  }
  return payload as T;
}

function text(value: unknown): string {
  return value == null ? "" : String(value).trim();
}

function formatDate(value: string | undefined): string {
  const raw = text(value);
  if (!raw) return "—";
  const datePart = raw.slice(0, 10);
  const date = new Date(`${datePart}T00:00:00`);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "2-digit" });
}

function normalized(value: string | undefined): string {
  return text(value).toLocaleLowerCase();
}

function csvValue(value: unknown): string {
  let raw = text(value);
  // Prevent spreadsheet formula execution when exported values begin with a formula marker.
  if (/^[=+\-@\t\r]/.test(raw)) raw = `'${raw}`;
  return `"${raw.replace(/"/g, '""')}"`;
}

function downloadCsv(rows: CloudBankUserRow[], snapshotDate: string): void {
  const columns: Array<[string, keyof CloudBankUserRow]> = [
    ["User ID", "user_id"],
    ["Username", "username"],
    ["First Name", "first_name"],
    ["Last Name", "last_name"],
    ["Role", "role"],
    ["Branch Before", "branch_before"],
    ["Branch After", "branch_after"],
    ["Date Change", "date_change"],
    ["Created", "created_val"],
    ["Active", "active_status"],
    ["Action", "action"],
    ["Source Row", "source_row_number"],
  ];
  const csv = [
    columns.map(([label]) => csvValue(label)).join(","),
    ...rows.map((row) => columns.map(([, key]) => csvValue(row[key])).join(",")),
  ].join("\r\n");
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `cloud-bank-users-${text(snapshotDate).replace(/[^0-9-]/g, "") || "snapshot"}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

const MetricCard: React.FC<{
  label: string;
  value: number;
  note: string;
  icon: React.ReactNode;
}> = ({ label, value, note, icon }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        <p className="mt-2 text-2xl font-extrabold tabular-nums text-slate-900">{value.toLocaleString("en-PH")}</p>
        <p className="mt-1 text-xs text-slate-500">{note}</p>
      </div>
      <div className="rounded-xl bg-emerald-50 p-2.5 text-emerald-800">{icon}</div>
    </div>
  </div>
);

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/10";
const labelClass = "mb-1.5 block text-xs font-semibold text-slate-600";

export const CloudBankMonitoringView: React.FC<{ currentUser: User }> = ({ currentUser }) => {
  const [snapshots, setSnapshots] = useState<CloudBankSnapshot[]>([]);
  const [snapshotId, setSnapshotId] = useState("");
  const [users, setUsers] = useState<CloudBankUserRow[]>([]);
  const [loadingSnapshots, setLoadingSnapshots] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [error, setError] = useState("");
  const [refreshCounter, setRefreshCounter] = useState(0);
  const [userIdFilter, setUserIdFilter] = useState("");
  const [usernameFilter, setUsernameFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [branchBeforeFilter, setBranchBeforeFilter] = useState("");
  const [branchAfterFilter, setBranchAfterFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [page, setPage] = useState(1);
  const [historyUser, setHistoryUser] = useState<CloudBankUserRow | null>(null);
  const [timeline, setTimeline] = useState<CloudBankTimelineEntry[]>([]);
  const [loadingTimeline, setLoadingTimeline] = useState(false);
  const [timelineError, setTimelineError] = useState("");

  const isAdmin = currentUser.role === "ADMINISTRATOR";

  const loadSnapshots = useCallback(async () => {
    setLoadingSnapshots(true);
    setError("");
    try {
      const result = await cloudBankGet<SnapshotListResponse>("/api/cloud-bank/snapshots");
      const available = Array.isArray(result.snapshots) ? result.snapshots : [];
      setSnapshots(available);
      setSnapshotId((current) => (current && available.some((item) => item.id === current) ? current : available[0]?.id ?? ""));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load Cloud Bank snapshots.");
    } finally {
      setLoadingSnapshots(false);
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    void loadSnapshots();
  }, [isAdmin, loadSnapshots, refreshCounter]);

  useEffect(() => {
    if (!isAdmin || !snapshotId) {
      setUsers([]);
      return;
    }
    let cancelled = false;
    setLoadingUsers(true);
    setError("");
    cloudBankGet<SnapshotUsersResponse>(`/api/cloud-bank/snapshots/${encodeURIComponent(snapshotId)}/users`)
      .then((result) => {
        if (!cancelled) setUsers(Array.isArray(result.users) ? result.users : []);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setUsers([]);
          setError(err instanceof Error ? err.message : "Unable to load user records for this snapshot.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingUsers(false);
      });
    return () => { cancelled = true; };
  }, [isAdmin, snapshotId]);

  useEffect(() => {
    setPage(1);
  }, [snapshotId, userIdFilter, usernameFilter, roleFilter, branchBeforeFilter, branchAfterFilter, activeFilter, actionFilter]);

  const roles = useMemo(() => Array.from(new Set(users.map((row) => text(row.role)).filter(Boolean))).sort(), [users]);
  const branchesBefore = useMemo(() => Array.from(new Set(users.map((row) => text(row.branch_before)).filter(Boolean))).sort(), [users]);
  const branchesAfter = useMemo(() => Array.from(new Set(users.map((row) => text(row.branch_after)).filter(Boolean))).sort(), [users]);
  const actions = useMemo(() => Array.from(new Set(users.map((row) => text(row.action)).filter(Boolean))).sort(), [users]);
  const activeStatuses = useMemo(() => Array.from(new Set(users.map((row) => text(row.active_status)).filter(Boolean))).sort(), [users]);

  const filteredUsers = useMemo(() => {
    const userId = normalized(userIdFilter);
    const username = normalized(usernameFilter);
    const role = normalized(roleFilter);
    const before = normalized(branchBeforeFilter);
    const after = normalized(branchAfterFilter);
    const active = normalized(activeFilter);
    const action = normalized(actionFilter);
    return users.filter((row) =>
      (!userId || normalized(row.user_id).includes(userId)) &&
      (!username || normalized(row.username).includes(username)) &&
      (!role || normalized(row.role) === role) &&
      (!before || normalized(row.branch_before) === before) &&
      (!after || normalized(row.branch_after) === after) &&
      (!active || normalized(row.active_status) === active) &&
      (!action || normalized(row.action) === action),
    );
  }, [users, userIdFilter, usernameFilter, roleFilter, branchBeforeFilter, branchAfterFilter, activeFilter, actionFilter]);

  const pageCount = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageRows = filteredUsers.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const selectedSnapshot = snapshots.find((item) => item.id === snapshotId);

  const summary = useMemo(() => {
    const active = users.filter((row) => normalized(row.active_status) === "yes").length;
    const inactive = users.filter((row) => normalized(row.active_status) === "no").length;
    const actionsNorm = users.map((row) => normalized(row.action));
    const isTransfer = (action: string) => action.includes("transfer of branch");
    const isRoleChange = (action: string) => action.includes("change of role") || action.includes("change role & branch");
    const isBlocked = (action: string) => action.includes("block user") || action.includes("blocked user");
    const recognized = (action: string) => action === "new user" || isTransfer(action) || isRoleChange(action) || isBlocked(action);
    return {
      total: users.length,
      active,
      inactive,
      newUsers: actionsNorm.filter((action) => action === "new user").length,
      transfers: actionsNorm.filter(isTransfer).length,
      roleChanges: actionsNorm.filter(isRoleChange).length,
      blocked: actionsNorm.filter(isBlocked).length,
      other: actionsNorm.filter((action) => Boolean(action) && action !== "remain" && !recognized(action)).length,
    };
  }, [users]);

  const clearFilters = () => {
    setUserIdFilter("");
    setUsernameFilter("");
    setRoleFilter("");
    setBranchBeforeFilter("");
    setBranchAfterFilter("");
    setActiveFilter("");
    setActionFilter("");
  };

  const openTimeline = async (row: CloudBankUserRow) => {
    setHistoryUser(row);
    setTimeline([]);
    setTimelineError("");
    setLoadingTimeline(true);
    try {
      const result = await cloudBankGet<TimelineResponse>(`/api/cloud-bank/users/${encodeURIComponent(row.user_id)}/timeline`);
      setTimeline(Array.isArray(result.timeline) ? result.timeline : []);
    } catch (err) {
      setTimelineError(err instanceof Error ? err.message : "Unable to load this user's history.");
    } finally {
      setLoadingTimeline(false);
    }
  };

  if (!isAdmin) {
    return (
      <section className="mx-auto max-w-3xl p-6 md:p-10">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-950">
          <div className="flex items-center gap-3"><ShieldAlert className="h-6 w-6" /><h1 className="text-lg font-bold">Administrator access required</h1></div>
          <p className="mt-2 text-sm">Cloud Bank user records are restricted to authorized administrators.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6 p-4 md:p-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-emerald-800"><Activity className="h-4 w-4" /> Admin monitoring</div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 md:text-3xl">Cloud Bank Users Daily Monitoring</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Review historical user snapshots, account status, and recorded changes. Account status is not a measure of whether a user logged in today.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="min-w-64">
            <label className={labelClass} htmlFor="cloud-bank-snapshot">Daily snapshot</label>
            <div className="relative">
              <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <select id="cloud-bank-snapshot" value={snapshotId} onChange={(event) => setSnapshotId(event.target.value)} className={`${inputClass} pl-9`} disabled={loadingSnapshots || snapshots.length === 0}>
                {snapshots.length === 0 && <option value="">No snapshots available</option>}
                {snapshots.map((item) => <option key={item.id} value={item.id}>{item.sheet_name || formatDate(item.snapshot_date)}</option>)}
              </select>
            </div>
          </div>
          <button type="button" onClick={() => setRefreshCounter((value) => value + 1)} disabled={loadingSnapshots || loadingUsers} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${(loadingSnapshots || loadingUsers) ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="flex flex-col gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900 sm:flex-row sm:items-center sm:justify-between">
          <span>{error}</span>
          <button type="button" onClick={() => setRefreshCounter((value) => value + 1)} className="shrink-0 font-bold underline underline-offset-2">Retry</button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="User records" value={summary.total} note="Rows in selected snapshot" icon={<Users className="h-5 w-5" />} />
        <MetricCard label="Active accounts" value={summary.active} note="Account status recorded as Yes" icon={<Activity className="h-5 w-5" />} />
        <MetricCard label="Inactive accounts" value={summary.inactive} note="Account status recorded as No" icon={<ShieldAlert className="h-5 w-5" />} />
        <MetricCard label="New users" value={summary.newUsers} note="Action recorded as New User" icon={<UserPlus className="h-5 w-5" />} />
        <MetricCard label="Branch transfers" value={summary.transfers} note="Action recorded as Transfer of Branch" icon={<ArrowLeftRight className="h-5 w-5" />} />
        <MetricCard label="Role changes" value={summary.roleChanges} note="Includes role and branch changes" icon={<Users className="h-5 w-5" />} />
        <MetricCard label="Blocked users" value={summary.blocked} note="Based on recorded action" icon={<ShieldAlert className="h-5 w-5" />} />
        <MetricCard label="Other actions" value={summary.other} note="Other non-empty actions, excluding Remain" icon={<Filter className="h-5 w-5" />} />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-bold text-slate-900">Search and filters</h2>
            <p className="mt-1 text-xs text-slate-500">{selectedSnapshot ? `${selectedSnapshot.sheet_name} · ${users.length.toLocaleString("en-PH")} source records` : "Choose a snapshot to begin."}</p>
          </div>
          <button type="button" onClick={clearFilters} className="inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"><X className="h-4 w-4" /> Clear filters</button>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div><label className={labelClass} htmlFor="cb-user-id">User ID</label><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input id="cb-user-id" value={userIdFilter} onChange={(event) => setUserIdFilter(event.target.value)} className={`${inputClass} pl-9`} placeholder="Search user ID" /></div></div>
          <div><label className={labelClass} htmlFor="cb-username">Username</label><input id="cb-username" value={usernameFilter} onChange={(event) => setUsernameFilter(event.target.value)} className={inputClass} placeholder="Search username" /></div>
          <div><label className={labelClass} htmlFor="cb-role">Role</label><select id="cb-role" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} className={inputClass}><option value="">All roles</option>{roles.map((value) => <option key={value}>{value}</option>)}</select></div>
          <div><label className={labelClass} htmlFor="cb-active">Active status</label><select id="cb-active" value={activeFilter} onChange={(event) => setActiveFilter(event.target.value)} className={inputClass}><option value="">All statuses</option>{activeStatuses.map((value) => <option key={value}>{value}</option>)}</select></div>
          <div><label className={labelClass} htmlFor="cb-branch-before">Branch before</label><select id="cb-branch-before" value={branchBeforeFilter} onChange={(event) => setBranchBeforeFilter(event.target.value)} className={inputClass}><option value="">All branches</option>{branchesBefore.map((value) => <option key={value}>{value}</option>)}</select></div>
          <div><label className={labelClass} htmlFor="cb-branch-after">Branch after</label><select id="cb-branch-after" value={branchAfterFilter} onChange={(event) => setBranchAfterFilter(event.target.value)} className={inputClass}><option value="">All branches</option>{branchesAfter.map((value) => <option key={value}>{value}</option>)}</select></div>
          <div className="sm:col-span-2"><label className={labelClass} htmlFor="cb-action">Recorded action</label><select id="cb-action" value={actionFilter} onChange={(event) => setActionFilter(event.target.value)} className={inputClass}><option value="">All actions</option>{actions.map((value) => <option key={value}>{value}</option>)}</select></div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between md:px-5">
          <div><h2 className="font-bold text-slate-900">Daily user records</h2><p className="mt-1 text-xs text-slate-500">Showing {filteredUsers.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filteredUsers.length)} of {filteredUsers.length.toLocaleString("en-PH")} matching records</p></div>
          <button type="button" onClick={() => downloadCsv(filteredUsers, selectedSnapshot?.snapshot_date ?? "snapshot")} disabled={filteredUsers.length === 0} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-800 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-40"><Download className="h-4 w-4" /> Export filtered CSV</button>
        </div>
        {loadingUsers || loadingSnapshots ? (
          <div className="flex items-center justify-center gap-3 p-12 text-sm text-slate-500"><RefreshCw className="h-5 w-5 animate-spin" /> Loading monitoring records…</div>
        ) : pageRows.length === 0 ? (
          <div className="p-12 text-center"><Users className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-3 font-semibold text-slate-700">No matching records</p><p className="mt-1 text-sm text-slate-500">Adjust your filters or choose another snapshot.</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[1120px] w-full text-left text-sm">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500"><tr>
                <th className="px-4 py-3 font-bold">User ID</th><th className="px-4 py-3 font-bold">Username / Name</th><th className="px-4 py-3 font-bold">Role</th><th className="px-4 py-3 font-bold">Branch before</th><th className="px-4 py-3 font-bold">Branch after</th><th className="px-4 py-3 font-bold">Active</th><th className="px-4 py-3 font-bold">Action</th><th className="px-4 py-3 text-right font-bold">History</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {pageRows.map((row, index) => (
                  <tr key={`${row.user_id}-${row.source_row_number ?? index}`} className="align-top transition hover:bg-slate-50/70">
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs font-semibold text-slate-600">{text(row.user_id) || "—"}</td>
                    <td className="px-4 py-3"><div className="font-semibold text-slate-900">{text(row.username) || "—"}</div><div className="mt-0.5 text-xs text-slate-500">{[text(row.first_name), text(row.last_name)].filter(Boolean).join(" ") || "—"}</div></td>
                    <td className="px-4 py-3 text-slate-700">{text(row.role) || "—"}</td>
                    <td className="max-w-48 px-4 py-3 text-slate-600">{text(row.branch_before) || "—"}</td>
                    <td className="max-w-48 px-4 py-3 text-slate-600">{text(row.branch_after) || "—"}</td>
                    <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${normalized(row.active_status) === "yes" ? "bg-emerald-50 text-emerald-800" : normalized(row.active_status) === "no" ? "bg-rose-50 text-rose-700" : "bg-slate-100 text-slate-600"}`}>{text(row.active_status) || "Unknown"}</span></td>
                    <td className="px-4 py-3"><div className="max-w-56 text-slate-700">{text(row.action) || <span className="text-slate-400">—</span>}</div>{row.date_change && <div className="mt-1 text-[11px] text-slate-500">{formatDate(row.date_change)}</div>}</td>
                    <td className="px-4 py-3 text-right"><button type="button" onClick={() => void openTimeline(row)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-emerald-800 hover:border-emerald-300 hover:bg-emerald-50"><Eye className="h-3.5 w-3.5" /> View</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 md:px-5">
          <p className="text-xs text-slate-500">Page {safePage} of {pageCount}</p>
          <div className="flex items-center gap-2"><button type="button" aria-label="Previous page" disabled={safePage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button><button type="button" aria-label="Next page" disabled={safePage >= pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button></div>
        </div>
      </div>

      {historyUser && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-3 backdrop-blur-sm sm:p-6" role="dialog" aria-modal="true" aria-labelledby="cloud-bank-history-title" onMouseDown={(event) => { if (event.target === event.currentTarget) setHistoryUser(null); }}>
          <div className="max-h-[88vh] w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-5">
              <div><p className="text-xs font-bold uppercase tracking-wider text-emerald-800">User history</p><h2 id="cloud-bank-history-title" className="mt-1 text-xl font-extrabold text-slate-900">{text(historyUser.username) || text(historyUser.user_id)}</h2><p className="mt-1 text-sm text-slate-500">{[text(historyUser.first_name), text(historyUser.last_name)].filter(Boolean).join(" ")} · User ID {text(historyUser.user_id)}</p></div>
              <button type="button" aria-label="Close user history" onClick={() => setHistoryUser(null)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="max-h-[calc(88vh-90px)] overflow-auto p-5">
              {timelineError && <div role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{timelineError}</div>}
              {loadingTimeline ? <div className="p-10 text-center text-sm text-slate-500">Loading user history…</div> : timeline.length === 0 ? <div className="p-10 text-center text-sm text-slate-500">No historical records found for this user ID.</div> : (
                <div className="space-y-3">
                  {timeline.map((entry, index) => <article key={`${entry.snapshot_id}-${entry.source_row_number ?? index}`} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><p className="font-bold text-slate-900">{entry.sheet_name || formatDate(entry.snapshot_date)}</p><p className="mt-1 text-xs text-slate-500">Snapshot date: {formatDate(entry.snapshot_date)}</p></div><span className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-bold ${normalized(entry.active_status) === "yes" ? "bg-emerald-50 text-emerald-800" : normalized(entry.active_status) === "no" ? "bg-rose-50 text-rose-700" : "bg-slate-100 text-slate-600"}`}>Active: {text(entry.active_status) || "Unknown"}</span></div>
                    <div className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3"><div><p className="text-xs text-slate-500">Role</p><p className="mt-1 font-semibold text-slate-800">{text(entry.role) || "—"}</p></div><div><p className="text-xs text-slate-500">Branch before → after</p><p className="mt-1 font-semibold text-slate-800">{text(entry.branch_before) || "—"} → {text(entry.branch_after) || "—"}</p></div><div><p className="text-xs text-slate-500">Recorded action</p><p className="mt-1 font-semibold text-slate-800">{text(entry.action) || "—"}</p></div></div>
                  </article>)}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
