import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowDownUp,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  FileSpreadsheet,
  Layers,
  Printer,
  RefreshCw,
  Search,
  Server,
  TrendingUp,
  TriangleAlert,
} from 'lucide-react';
import {
  Branch,
  BranchHealthDaily,
  BranchSystem,
  SystemHealthStatus,
  DailySnapshotDate,
} from '../../types';
import { BRANCH_SYSTEMS } from '../../services/store';
import { downloadCsv, toCsv } from '../../services/format';
import { successToast, errorToast } from '../../services/toast';

export interface DailySnapshotResult {
  date: string;
  previousDate: string;
  availableDates: DailySnapshotDate[];
  snapshots: BranchHealthDaily[];
  previousSnapshots: BranchHealthDaily[];
}

export interface ReportsViewProps {
  branches: Branch[];
  onLoadDailySnapshot: (date?: string) => Promise<DailySnapshotResult>;
}

type ReportTab = 'daily';

type SnapSortKey = 'branch' | 'system' | 'status' | 'utilization' | 'change';

/** Rows per page in the daily-snapshot grid. */
const SNAP_PAGE_SIZE = 25;

const CHANGE_RANK: Record<'same' | 'fixed' | 'broke' | 'new', number> = {
  broke: 0,
  new: 1,
  same: 2,
  fixed: 3,
};

const HEALTH_STYLES: Record<SystemHealthStatus, { tile: string; text: string; label: string }> = {
  [SystemHealthStatus.Working]: {
    tile: 'bg-emerald-50 text-emerald-700',
    text: 'text-emerald-700',
    label: 'Working',
  },
  [SystemHealthStatus.NotWorking]: {
    tile: 'bg-red-50 text-red-700',
    text: 'text-red-700',
    label: 'Not Working',
  },
  [SystemHealthStatus.Offline]: {
    tile: 'bg-slate-100 text-slate-600',
    text: 'text-slate-600',
    label: 'Offline',
  },
};

function pct(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 100);
}

function escapeHtml(value: string | number): string {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

type Cell = string | number | null | undefined;

// ---------------------------------------------------------------------------
// Export helpers
// ---------------------------------------------------------------------------

function tableToHtml(title: string, headers: string[], rows: Cell[][]): string {
  const head = headers.map((h) => `<th style="background:#1e293b;color:#fff;padding:4px 6px">${escapeHtml(h)}</th>`).join('');
  const body = rows.map((row) => `<tr>${row.map((c) => `<td style="padding:4px 6px">${escapeHtml(c ?? '')}</td>`).join('')}</tr>`).join('');
  return `<table border="1" style="border-collapse:collapse;font-family:Calibri,Arial"><caption style="font-weight:bold">${escapeHtml(title)}</caption><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function downloadExcel(title: string, headers: string[], rows: Cell[][]): void {
  const html =
    '<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8">' +
    '<style>td,th{border:1px solid #94a3b8;font-size:11pt}</style></head><body>' +
    tableToHtml(title, headers, rows) +
    '</body></html>';
  const blob = new Blob(['\ufeff' + html], {
    type: 'application/vnd.ms-excel;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${title.replace(/[^\w.-]+/g, '-').toLowerCase()}.xls`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
  successToast('Excel file downloaded');
}

async function copyTable(title: string, headers: string[], rows: Cell[][]): Promise<void> {
  const tsv = [headers, ...rows].map((row) => row.map((c) => String(c ?? '').replace(/[\t\r\n]+/g, ' ')).join('\t')).join('\n');
  try {
    await navigator.clipboard.writeText(tsv);
    successToast('Table copied to clipboard');
  } catch {
    errorToast('Clipboard access was blocked by the browser');
  }
}

function printTable(title: string, headers: string[], rows: Cell[][]): void {
  const win = window.open('', '_blank', 'width=1100,height=800');
  if (!win) {
    errorToast('Allow pop-ups to print this report');
    return;
  }
  win.document.write(
    '<!doctype html><html><head><meta charset="utf-8"><title>' +
      escapeHtml(title) +
      '</title><style>body{font-family:Calibri,Arial,sans-serif;padding:24px}h1{font-size:18px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #94a3b8;padding:4px 6px;font-size:11pt}th{background:#1e293b;color:#fff;text-align:left}</style></head><body><h1>' +
      escapeHtml(title) +
      '</h1>' +
      tableToHtml(title, headers, rows) +
      '</body></html>',
  );
  win.document.close();
  win.focus();
  win.print();
}

// ---------------------------------------------------------------------------
// Presentational helpers
// ---------------------------------------------------------------------------

function Bar({ value, max, className, label }: { value: number; max: number; className: string; label?: string }) {
  const width = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
      <motion.div
        className={`h-full rounded-full ${className}`}
        initial={{ width: 0 }}
        animate={{ width: `${width}%` }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
        title={label}
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
  icon,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  tone: string;
  icon?: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="bg-white p-4 rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-sm transition">
      <span className={`text-[10px] font-bold uppercase tracking-wide flex items-center gap-1 ${tone}`}>
        {icon}
        {label}
      </span>
      <div className="text-2xl font-black text-slate-900 mt-1 tabular-nums">{value}</div>
      {hint ? <div className="text-[10px] text-slate-400 mt-0.5 truncate">{hint}</div> : null}
    </div>
  );
}

/** Consistent "nothing here" state instead of a bare grey sentence. */
function EmptyState({ icon, message, hint }: { icon: React.ReactNode; message: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1.5 py-8 text-center">
      <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center">{icon}</div>
      <p className="text-xs font-semibold text-slate-500">{message}</p>
      {hint ? <p className="text-[11px] text-slate-400 max-w-xs">{hint}</p> : null}
    </div>
  );
}

function RowSkeleton({ cols }: { cols: number }) {
  return (
    <tr className="border-t border-slate-100">
      {Array.from({ length: cols }, (_, i) => (
        <td key={i} className="px-3 py-2.5">
          <div className="h-3 rounded bg-slate-100 animate-pulse" style={{ width: `${45 + ((i * 17) % 40)}%` }} />
        </td>
      ))}
    </tr>
  );
}

function SortHeader({
  label,
  sortKey,
  active,
  onToggle,
}: {
  label: string;
  sortKey: SnapSortKey;
  active: { key: SnapSortKey; dir: 'asc' | 'desc' };
  onToggle: (key: SnapSortKey) => void;
}) {
  const isActive = active.key === sortKey;
  return (
    <button type="button"
      onClick={() => onToggle(sortKey)}
      aria-sort={isActive ? (active.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={`inline-flex items-center gap-1 uppercase tracking-wide text-[10px] font-bold transition cursor-pointer hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
        isActive ? 'text-slate-900' : 'text-slate-500'
      }`}
      title={`Sort by ${label}`}
    >
      {label}
      <ArrowDownUp className={`w-2.5 h-2.5 ${isActive ? 'opacity-100' : 'opacity-30'}`} />
    </button>
  );
}

const primaryButton =
  'px-3 py-2 bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs rounded-lg transition inline-flex items-center gap-1.5 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1';

const TABS: { id: ReportTab; label: string; icon: React.ReactNode }[] = [
  {
    id: 'daily',
    label: 'Daily Snapshot',
    icon: <CalendarDays className="w-3.5 h-3.5" />,
  },
];

// ---------------------------------------------------------------------------

export const ReportsView: React.FC<ReportsViewProps> = ({ branches, onLoadDailySnapshot }) => {
  const [tab] = useState<ReportTab>('daily');
  const [exportOpen, setExportOpen] = useState(false);
  const [snapSearch, setSnapSearch] = useState('');
  const [snapSort, setSnapSort] = useState<{
    key: SnapSortKey;
    dir: 'asc' | 'desc';
  }>({ key: 'branch', dir: 'asc' });
  const [snapPage, setSnapPage] = useState(1);

  // --- daily snapshot -----------------------------------------------------
  const [snapDate, setSnapDate] = useState<string>('');
  const [snap, setSnap] = useState<DailySnapshotResult | null>(null);
  const [snapLoading, setSnapLoading] = useState(false);
  const [snapSystems, setSnapSystems] = useState<Set<BranchSystem>>(new Set(BRANCH_SYSTEMS));

  const loadSnapshot = useCallback(
    async (date?: string) => {
      setSnapLoading(true);
      try {
        setSnap(await onLoadDailySnapshot(date));
      } catch {
        errorToast('Could not load the daily snapshot');
      } finally {
        setSnapLoading(false);
      }
    },
    [onLoadDailySnapshot],
  );

  useEffect(() => {
    void loadSnapshot(snapDate || undefined);
  }, [loadSnapshot, snapDate]);

  const snapRows = useMemo(() => {
    if (!snap) return [];
    const previous = new Map(snap.previousSnapshots.map((p) => [`${p.branchId}|${p.system}`, p]));
    const out: {
      branch: string;
      system: BranchSystem;
      status: SystemHealthStatus;
      total: number | null;
      working: number | null;
      speed: string;
      notes: string;
      change: 'same' | 'fixed' | 'broke' | 'new';
    }[] = [];
    for (const b of branches) {
      for (const system of BRANCH_SYSTEMS) {
        if (!snapSystems.has(system)) continue;
        const row = snap.snapshots.find((s) => s.branchId === b.id && s.system === system);
        const before = previous.get(`${b.id}|${system}`);
        let change: 'same' | 'fixed' | 'broke' | 'new' = 'same';
        if (row && !before) change = 'new';
        else if (row && before && row.status !== before.status) {
          change = row.status === SystemHealthStatus.Working ? 'fixed' : 'broke';
        } else if (!row && before) change = 'broke';
        out.push({
          branch: b.name,
          system,
          status: row?.status ?? SystemHealthStatus.Offline,
          total: row?.totalUnits ?? null,
          working: row?.workingUnits ?? null,
          speed: row?.internetSpeed ?? '',
          notes: row?.notes ?? '',
          change,
        });
      }
    }
    return out;
  }, [snap, branches, snapSystems]);

  /** Rows after the on-grid search box and the active column sort. */
  const snapVisibleRows = useMemo(() => {
    const needle = snapSearch.trim().toLowerCase();
    const filteredRows = needle
      ? snapRows.filter(
          (r) =>
            r.branch.toLowerCase().includes(needle) ||
            r.system.toLowerCase().includes(needle) ||
            r.status.toLowerCase().includes(needle) ||
            (r.notes || '').toLowerCase().includes(needle),
        )
      : snapRows;

    const dir = snapSort.dir === 'asc' ? 1 : -1;
    const sorted = [...filteredRows].sort((a, b) => {
      switch (snapSort.key) {
        case 'system':
          return dir * (BRANCH_SYSTEMS.indexOf(a.system) - BRANCH_SYSTEMS.indexOf(b.system));
        case 'status':
          return dir * a.status.localeCompare(b.status);
        case 'change':
          return dir * (CHANGE_RANK[a.change] - CHANGE_RANK[b.change]);
        case 'utilization':
          return dir * (pct(a.working ?? 0, a.total ?? 0) - pct(b.working ?? 0, b.total ?? 0));
        case 'branch':
        default:
          return dir * a.branch.localeCompare(b.branch);
      }
    });
    return sorted;
  }, [snapRows, snapSearch, snapSort]);

  // Reset to the first page whenever the row set, filters, or sort change.
  useEffect(() => {
    setSnapPage(1);
  }, [snapSearch, snapSort, snapSystems, snap, snapDate]);

  const snapPageCount = Math.max(1, Math.ceil(snapVisibleRows.length / SNAP_PAGE_SIZE));
  const snapCurrentPage = Math.min(snapPage, snapPageCount);
  const snapPagedRows = useMemo(() => {
    const start = (snapCurrentPage - 1) * SNAP_PAGE_SIZE;
    return snapVisibleRows.slice(start, start + SNAP_PAGE_SIZE);
  }, [snapVisibleRows, snapCurrentPage]);

  const toggleSnapSort = (key: SnapSortKey) => {
    setSnapSort((prev) => (prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
  };

  const snapSummary = useMemo(() => {
    const total = snapRows.length;
    const working = snapRows.filter((r) => r.status === SystemHealthStatus.Working).length;
    const notWorking = snapRows.filter((r) => r.status === SystemHealthStatus.NotWorking).length;
    const offline = snapRows.filter((r) => r.status === SystemHealthStatus.Offline).length;
    const degraded = snapRows.filter((r) => r.change === 'broke').length;
    return {
      total,
      working,
      notWorking,
      offline,
      degraded,
      max: Math.max(1, total),
    };
  }, [snapRows]);

  const toggleSnapSystem = (system: BranchSystem) => {
    setSnapSystems((prev) => {
      const next = new Set(prev);
      if (next.has(system)) next.delete(system);
      else next.add(system);
      return next;
    });
  };

  // --- export payloads ----------------------------------------------------
  const snapHeaders = ['Branch', 'System', 'Status', 'Total Units', 'Working Units', 'Internet Speed', 'Notes', 'Change vs Previous'];
  // CSV: branch name only on first row per branch
  const snapData: Cell[][] = snapRows.map((r, i) => {
    const prev = i > 0 ? snapRows[i - 1] : null;
    const showBranch = !prev || prev.branch !== r.branch;
    return [showBranch ? r.branch : '', r.system, r.status, r.total, r.working, r.speed, r.notes, r.change];
  });

  const selectStyles =
    'px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 bg-white text-slate-700 cursor-pointer transition hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500';

  /** Per-tab export payloads, so the header export menu always matches what is on screen. */
  const tabExports: Record<ReportTab, { title: string; headers: string[]; rows: Cell[][] }> = {
    daily: {
      title: `Daily Snapshot ${snap?.date || 'latest'}`,
      headers: snapHeaders,
      rows: snapData,
    },
  };

  const activeExport = tabExports[tab];
  const runExport = (kind: 'csv' | 'excel' | 'copy' | 'print') => {
    const { title, headers, rows } = activeExport;
    const stamp = new Date().toISOString().slice(0, 10);
    if (kind === 'csv') {
      downloadCsv(`${title.replace(/[^\w]+/g, '-').toLowerCase()}-${stamp}.csv`, toCsv(headers, rows));
      successToast('CSV downloaded');
    } else if (kind === 'excel') {
      downloadExcel(title, headers, rows);
    } else if (kind === 'copy') {
      void copyTable(title, headers, rows);
    } else {
      printTable(title, headers, rows);
    }
    setExportOpen(false);
  };

  return (
    <div className="space-y-5 print:space-y-3">
      {/* Header */}
      <div className="bg-slate-900 text-white p-5 sm:p-6 rounded-2xl border border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4 print:hidden">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded border border-emerald-700 bg-emerald-900/60 text-emerald-200 text-[10px] font-bold uppercase tracking-wider mb-2">
            <BarChart3 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Reports &amp; Analytics</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black">IT Service Desk Reports</h1>
          <p className="text-xs text-slate-300 mt-1">
            End-of-day infrastructure snapshot of every Bayanihan Bank branch and system
          </p>
        </div>

        <div className="relative shrink-0">
          <button type="button" onClick={() => setExportOpen((v) => !v)} className={primaryButton} aria-haspopup="menu" aria-expanded={exportOpen}>
            <Download className="w-4 h-4" />
            <span>Export {TABS.find((t) => t.id === tab)?.label}</span>
            <ChevronDown className={`w-3.5 h-3.5 transition ${exportOpen ? 'rotate-180' : ''}`} />
          </button>
          {exportOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setExportOpen(false)} aria-hidden />
              <div
                role="menu"
                className="absolute right-0 z-20 mt-1.5 w-52 bg-white rounded-xl border border-slate-200 shadow-lg py-1 overflow-hidden"
              >
                {(
                  [
                    {
                      id: 'excel',
                      label: 'Excel workbook',
                      icon: <FileSpreadsheet className="w-3.5 h-3.5" />,
                    },
                    {
                      id: 'csv',
                      label: 'CSV file',
                      icon: <Download className="w-3.5 h-3.5" />,
                    },
                    {
                      id: 'copy',
                      label: 'Copy table',
                      icon: <Copy className="w-3.5 h-3.5" />,
                    },
                    {
                      id: 'print',
                      label: 'Print / PDF',
                      icon: <Printer className="w-3.5 h-3.5" />,
                    },
                  ] as const
                ).map((opt) => (
                  <button type="button"
                    key={opt.id}
                    role="menuitem"
                    onClick={() => runExport(opt.id)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition cursor-pointer text-left"
                  >
                    <span className="text-slate-400">{opt.icon}</span>
                    {opt.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div
        role="tablist"
        aria-label="Report sections"
        className="flex flex-wrap gap-1.5 p-1.5 bg-white rounded-2xl border border-slate-200 shadow-sm sticky top-2 z-10 print:hidden"
      >
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button type="button"
              key={t.id}
              role="tab"
              aria-selected={active}
              onClick={() => {}}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition flex items-center gap-1.5 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                active ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ================= DAILY SNAPSHOT ================= */}
      {tab === 'daily' ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/60 flex flex-col lg:flex-row lg:items-center gap-3 justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-slate-400" />
                Branch Infrastructure Daily Snapshot
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">End-of-day record of every branch and system, with the change against the previous day</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select className={selectStyles} value={snapDate} onChange={(e) => setSnapDate(e.target.value)} disabled={snapLoading}>
                <option value="">Latest available</option>
                {(snap?.availableDates ?? []).map((d) => (
                  <option key={d.snapshotDate} value={d.snapshotDate}>
                    {d.snapshotDate} ({d.rowCount} rows)
                  </option>
                ))}
              </select>
              <button type="button"
                onClick={() => void loadSnapshot(snapDate || undefined)}
                disabled={snapLoading}
                className="px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-800 hover:bg-slate-700 text-white flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${snapLoading ? 'animate-spin' : ''}`} /> Refresh
              </button>
            </div>
          </div>

          <div className="p-4 sm:p-5 space-y-4">
            {/* system filter */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mr-1">Systems</span>
              {BRANCH_SYSTEMS.map((system) => {
                const active = snapSystems.has(system);
                return (
                  <button type="button"
                    key={system}
                    onClick={() => toggleSnapSystem(system)}
                    aria-pressed={active}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                      active ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-500 border-slate-300 hover:border-slate-500'
                    }`}
                  >
                    {system}
                  </button>
                );
              })}
              {snapSystems.size !== BRANCH_SYSTEMS.length && (
                <button type="button"
                  onClick={() => setSnapSystems(new Set(BRANCH_SYSTEMS))}
                  className="px-2.5 py-1 text-[11px] font-bold rounded-lg text-slate-500 hover:text-slate-800 transition cursor-pointer"
                >
                  Select all
                </button>
              )}
            </div>

            {/* summary */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <StatCard
                label="Cells"
                value={snapSummary.total}
                tone="text-slate-500"
                icon={<Layers className="w-3 h-3" />}
                hint="Branch × system"
              />
              <StatCard
                label="Working"
                value={snapSummary.working}
                tone="text-emerald-700"
                icon={<CheckCircle2 className="w-3 h-3" />}
                hint={`${pct(snapSummary.working, snapSummary.total)}% of cells`}
              />
              <StatCard
                label="Not Working"
                value={snapSummary.notWorking}
                tone="text-amber-700"
                icon={<TriangleAlert className="w-3 h-3" />}
                hint="Reported faulty"
              />
              <StatCard label="Offline" value={snapSummary.offline} tone="text-slate-500" icon={<Server className="w-3 h-3" />} hint="No reading" />
              <StatCard
                label="Degraded Today"
                value={snapSummary.degraded}
                tone={snapSummary.degraded > 0 ? 'text-red-700' : 'text-emerald-700'}
                icon={<TrendingUp className="w-3 h-3" />}
                hint="Worse than yesterday"
              />
            </div>

            {/* toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <div className="relative flex-1 min-w-0">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  value={snapSearch}
                  onChange={(e) => setSnapSearch(e.target.value)}
                  placeholder="Search branch, system, status, or notes…"
                  aria-label="Search snapshot rows"
                  className="w-full pl-8 pr-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 bg-white text-slate-700 placeholder:text-slate-400 placeholder:font-normal transition hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <p className="text-[11px] text-slate-400 shrink-0 sm:ml-2">
                <span className="font-bold text-slate-700 tabular-nums">{snapVisibleRows.length}</span>
                {snapVisibleRows.length !== snapSummary.total ? ` of ${snapSummary.total}` : ''} rows
                {snap && ` · ${snap.date}`}
              </p>
            </div>

            {/* grid */}
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-xs min-w-[820px]">
                <thead className="bg-slate-100">
                  <tr className="text-left text-[10px] uppercase text-slate-600">
                    <th scope="col" className="px-3 py-2 sticky left-0 top-0 z-10 bg-slate-100">
                      <SortHeader label="Branch" sortKey="branch" active={snapSort} onToggle={toggleSnapSort} />
                    </th>
                    <th scope="col" className="px-3 py-2 sticky top-0 z-10 bg-slate-100">
                      <SortHeader label="System" sortKey="system" active={snapSort} onToggle={toggleSnapSort} />
                    </th>
                    <th scope="col" className="px-3 py-2 sticky top-0 z-10 bg-slate-100">
                      <SortHeader label="Status" sortKey="status" active={snapSort} onToggle={toggleSnapSort} />
                    </th>
                    <th scope="col" className="px-3 py-2 sticky top-0 z-10 bg-slate-100">
                      <SortHeader label="Units" sortKey="utilization" active={snapSort} onToggle={toggleSnapSort} />
                    </th>
                    <th scope="col" className="px-3 py-2 sticky top-0 z-10 bg-slate-100">
                      Internet Speed
                    </th>
                    <th scope="col" className="px-3 py-2 sticky top-0 z-10 bg-slate-100">
                      <SortHeader label="Change" sortKey="change" active={snapSort} onToggle={toggleSnapSort} />
                    </th>
                    <th scope="col" className="px-3 py-2 sticky top-0 z-10 bg-slate-100">
                      Notes
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {snapLoading && snapRows.length === 0 ? (
                    <>
                      {Array.from({ length: 6 }, (_, i) => (
                        <RowSkeleton key={i} cols={7} />
                      ))}
                    </>
                  ) : snapVisibleRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-2">
                        <EmptyState
                          icon={snapSearch ? <Search className="w-4 h-4" /> : <Layers className="w-4 h-4" />}
                          message={
                            snapSearch
                              ? `No rows match "${snapSearch}"`
                              : snapRows.length === 0
                                ? 'No snapshot rows for the selected date and systems'
                                : 'All systems are hidden'
                          }
                          hint={
                            snapSearch ? 'Clear the search box, or pick a different date.' : 'Change the date or re-enable at least one system above.'
                          }
                        />
                      </td>
                    </tr>
                  ) : (
                    snapPagedRows.map((r, i) => {
                      const prev = i > 0 ? snapPagedRows[i - 1] : null;
                      const showBranch = !prev || prev.branch !== r.branch;
                      const styles = HEALTH_STYLES[r.status];
                      const changeStyles =
                        r.change === 'fixed'
                          ? 'text-emerald-700'
                          : r.change === 'broke'
                            ? 'text-red-700'
                            : r.change === 'new'
                              ? 'text-amber-700'
                              : 'text-slate-400';
                      const changeLabel =
                        r.change === 'fixed' ? 'Recovered' : r.change === 'broke' ? 'Degraded' : r.change === 'new' ? 'New' : 'Unchanged';
                      const hasUnits = r.total !== null || r.working !== null;
                      const util = pct(r.working ?? 0, r.total ?? 0);
                      return (
                        <tr
                          key={`${r.branch}-${r.system}`}
                          className={`border-t border-slate-100 transition hover:bg-emerald-50/40 ${i % 2 === 1 ? 'bg-slate-50/40' : ''}`}
                        >
                          <td className="px-3 py-2 font-semibold text-slate-800 sticky left-0 z-[5] bg-white whitespace-nowrap">{showBranch ? r.branch : ''}</td>
                          <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{r.system}</td>
                          <td className="px-3 py-2">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${styles.tile}`}>{styles.label}</span>
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {hasUnits ? (
                              <div className="flex items-center gap-2">
                                <span className="text-slate-600 tabular-nums w-12">
                                  {r.working ?? 0} / {r.total ?? 0}
                                </span>
                                <div className="w-16">
                                  <Bar
                                    value={r.working ?? 0}
                                    max={r.total ?? 0}
                                    className={util >= 100 ? 'bg-emerald-500' : util >= 60 ? 'bg-amber-500' : 'bg-red-500'}
                                    label={`${util}% utilized`}
                                  />
                                </div>
                              </div>
                            ) : (
                              <span className="text-slate-400">--</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-slate-600 whitespace-nowrap tabular-nums">{r.speed || '--'}</td>
                          <td className={`px-3 py-2 font-bold whitespace-nowrap ${changeStyles}`}>{changeLabel}</td>
                          <td className="px-3 py-2 text-slate-500 max-w-[220px] truncate" title={r.notes}>
                            {r.notes || '--'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            {snapVisibleRows.length > SNAP_PAGE_SIZE && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 print:hidden">
                <span className="text-[11px] text-slate-500">
                  Showing{' '}
                  <strong className="tabular-nums">
                    {(snapCurrentPage - 1) * SNAP_PAGE_SIZE + 1}–{Math.min(snapCurrentPage * SNAP_PAGE_SIZE, snapVisibleRows.length)}
                  </strong>{' '}
                  of <strong className="tabular-nums">{snapVisibleRows.length}</strong> rows
                </span>
                <div className="flex items-center gap-1.5">
                  <button type="button"
                    onClick={() => setSnapPage((p) => Math.max(1, p - 1))}
                    disabled={snapCurrentPage === 1}
                    className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 font-semibold text-xs inline-flex items-center gap-1 cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Prev</span>
                  </button>
                  <span className="px-3 py-1.5 rounded-lg bg-slate-800 text-white font-bold text-xs tabular-nums">
                    {snapCurrentPage} / {snapPageCount}
                  </span>
                  <button type="button"
                    onClick={() => setSnapPage((p) => Math.min(snapPageCount, p + 1))}
                    disabled={snapCurrentPage === snapPageCount}
                    className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 font-semibold text-xs inline-flex items-center gap-1 cursor-pointer"
                  >
                    <span>Next</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
            <p className="text-[10px] text-slate-400 print:hidden">
              Click a column header to sort. Use the Export menu above to download this grid, copy it, or print it.
            </p>
          </div>
        </div>
      ) : null}

      <style>{`
        @media print {
          body { background: #fff; }
          .overflow-x-auto { overflow: visible !important; }
        }
      `}</style>
    </div>
  );
};
