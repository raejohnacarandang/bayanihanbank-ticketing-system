import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import {
  Branch,
  BranchHealth,
  BranchSystem,
  InternetSpeedLog,
  MonitorFilter,
  SystemHealthStatus,
  User,
} from '../../types';
import { BRANCH_SYSTEMS, deriveHealthStatus, isAssignmentActive, shouldTrackUnits, UpdateBranchHealthChanges } from '../../services/store';
import { can } from '../../services/permissions';
import { downloadCsv, formatAbsoluteTime, formatRelativeTime, parseDisplayDateTime, timestampDayKey, todayKey, toCsv } from '../../services/format';
import { errorToast, successToast } from '../../services/toast';
import { useBranchHealthStream } from '../../hooks/useBranchHealthStream';
import { storage } from '../../services/storageService';
import {
  Activity,
  Building2,
  Wifi,
  Cctv,
  Banknote,
  Monitor,
  Printer,
  Zap,
  CheckCircle2,
  XCircle,
  CircleOff,
  RefreshCw,
  Search,
  StickyNote,
  Zap as ZapIcon,
  Download,
  ChevronDown,
  Keyboard,
  CalendarCheck,
  CalendarClock,
  TriangleAlert,
  Minus,
  Plus,
  Save,
} from 'lucide-react';

interface BranchMonitorViewProps {
  currentUser: User;
  branches: Branch[];
  branchHealth: BranchHealth[];
  internetSpeedLogs: InternetSpeedLog[];
  onUpdateHealth: (branchId: string, changes: UpdateBranchHealthChanges) => Promise<void>;
  focusBranchId?: string;
}

const SYSTEM_ICONS: Record<BranchSystem, React.ReactNode> = {
  Internet: <Wifi className="w-4 h-4" />,
  CCTV: <Cctv className="w-4 h-4" />,
  ATM: <Banknote className="w-4 h-4" />,
  PC: <Monitor className="w-4 h-4" />,
  Printer: <Printer className="w-4 h-4" />,
  GenSet: <Zap className="w-4 h-4" />,
};

const SYSTEM_ORDER: BranchSystem[] = BRANCH_SYSTEMS;

interface StatusMeta {
  label: string;
  row: string;
  iconBg: string;
  pill: string;
  dot: string;
  bar: string;
}

const STATUS_META: Record<SystemHealthStatus, StatusMeta> = {
  [SystemHealthStatus.Working]: {
    label: 'Working',
    row: 'bg-white border-slate-200',
    iconBg: 'bg-emerald-100 text-emerald-700',
    pill: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    dot: 'bg-emerald-500',
    bar: 'bg-emerald-500',
  },
  [SystemHealthStatus.NotWorking]: {
    label: 'Not Working',
    row: 'bg-red-50/60 border-red-200',
    iconBg: 'bg-red-100 text-red-700',
    pill: 'bg-red-100 text-red-800 border-red-200',
    dot: 'bg-red-500',
    bar: 'bg-red-500',
  },
  [SystemHealthStatus.Offline]: {
    label: 'Offline',
    row: 'bg-slate-50 border-slate-300',
    iconBg: 'bg-slate-200 text-slate-600',
    pill: 'bg-slate-200 text-slate-700 border-slate-300',
    dot: 'bg-slate-400',
    bar: 'bg-slate-400',
  },
};

interface RowDraft {
  totalUnits: number;
  workingUnits: number;
  status: SystemHealthStatus;
  internetSpeed: string;
  notes: string;
}

const rkey = (branchId: string, system: BranchSystem) => `${branchId}:${system}`;

function draftFromHealth(entry: BranchHealth | undefined, system: BranchSystem): RowDraft {
  if (shouldTrackUnits(system)) {
    const totalUnits =
      typeof entry?.totalUnits === 'number' && entry.totalUnits > 0 ? entry.totalUnits : 1;
    const workingUnits =
      typeof entry?.workingUnits === 'number'
        ? Math.min(entry.workingUnits, totalUnits)
        : entry?.status === SystemHealthStatus.Working
        ? totalUnits
        : 0;
    return {
      totalUnits,
      workingUnits,
      status:
        deriveHealthStatus(totalUnits, workingUnits) ??
        entry?.status ??
        SystemHealthStatus.Working,
      internetSpeed: '',
      notes: entry?.notes ?? '',
    };
  }
  return {
    totalUnits: 1,
    workingUnits: 1,
    status: entry?.status ?? SystemHealthStatus.Working,
    internetSpeed: system === BranchSystem.Internet ? entry?.internetSpeed ?? '' : '',
    notes: entry?.notes ?? '',
  };
}

/** Read-only pill shown to auditors or as a status summary. */
const StatusPill: React.FC<{ status: SystemHealthStatus }> = ({ status }) => {
  const meta = STATUS_META[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[11px] font-bold ${meta.pill}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
};

/** Big one-tap status selector for single-unit systems. */
const StatusSegmented: React.FC<{
  value: SystemHealthStatus;
  disabled?: boolean;
  onSelect: (status: SystemHealthStatus) => void;
}> = ({ value, disabled, onSelect }) => {
  const options = [
    SystemHealthStatus.Working,
    SystemHealthStatus.NotWorking,
    SystemHealthStatus.Offline,
  ];
  return (
    <div className="inline-flex rounded-lg border border-slate-300 bg-white overflow-hidden">
      {options.map((opt) => {
        const active = value === opt;
        const activeCls =
          opt === SystemHealthStatus.Working
            ? 'bg-emerald-600 text-white'
            : opt === SystemHealthStatus.NotWorking
            ? 'bg-red-600 text-white'
            : 'bg-slate-600 text-white';
        return (
          <button
            key={opt}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(opt)}
            className={`px-3 py-1.5 text-xs font-bold transition border-r border-slate-200 last:border-r-0 cursor-pointer disabled:opacity-50 ${
              active ? activeCls : 'bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {STATUS_META[opt].label}
          </button>
        );
      })}
    </div>
  );
};

/** Compact −/+ counter used for unit-count systems. */
const Stepper: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}> = ({ label, value, min, max, disabled, onChange }) => (
  <div className="inline-flex items-center gap-1.5">
    <span className="text-[11px] font-semibold text-slate-500">{label}</span>
    <div className="inline-flex items-center rounded-lg border border-slate-300 bg-white overflow-hidden">
      <button
        type="button"
        disabled={disabled || value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
        className="px-2 py-1 text-slate-600 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
        aria-label={`${label} minus`}
      >
        <Minus className="w-3.5 h-3.5" />
      </button>
      <span className="w-8 text-center text-sm font-bold tabular-nums text-slate-800">{value}</span>
      <button
        type="button"
        disabled={disabled || value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
        className="px-2 py-1 text-slate-600 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
        aria-label={`${label} plus`}
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  </div>
);

export const BranchMonitorView: React.FC<BranchMonitorViewProps> = ({
  currentUser,
  branches,
  branchHealth,
  internetSpeedLogs,
  onUpdateHealth,
  focusBranchId,
}) => {
  const [filter, setFilter] = useState<MonitorFilter>(MonitorFilter.All);
  const [search, setSearch] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [collapsedBranches, setCollapsedBranches] = useState<Set<string>>(() =>
    new Set(branches.filter((b) => b.status === 'Active').map((b) => b.id)),
  );
  const touchStartX = useRef<number | null>(null);
  const branchCardRefs = useRef<Record<string, HTMLDivElement>>({});

  // Scroll to focused branch on mount or when focusBranchId changes
  useEffect(() => {
    if (!focusBranchId) return;

    const scrollToBranch = () => {
      const el = branchCardRefs.current[focusBranchId];
      if (el) {
        // Auto-expand if collapsed
        if (collapsedBranches.has(focusBranchId)) {
          setCollapsedBranches((prev) => {
            const next = new Set(prev);
            next.delete(focusBranchId);
            return next;
          });
        }
        // Small delay to allow expansion animation
        setTimeout(() => {
          const element = branchCardRefs.current[focusBranchId];
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            element.classList.add('ring-2', 'ring-indigo-500');
            setTimeout(() => element.classList.remove('ring-2', 'ring-indigo-500'), 3000);
          }
        }, 150);
      }
    };

    // If branch is filtered out by search, clear search to reveal it
    const branch = branches.find((b) => b.id === focusBranchId);
    if (branch && search.trim()) {
      const matchesSearch =
        branch.name.toLowerCase().includes(search.toLowerCase()) ||
        (branch.location ?? '').toLowerCase().includes(search.toLowerCase());
      if (!matchesSearch) {
        setSearch('');
      }
    }
    // If branch is filtered out by filter, set filter to 'All'
    if (branch && filter !== MonitorFilter.All) {
      setFilter(MonitorFilter.All);
    }

    scrollToBranch();
  }, [focusBranchId, collapsedBranches, search, filter, branches]);

  // Per-row unsaved edits, keyed by `${branchId}:${system}`. A row with no
  // entry is simply mirroring the stored value (and re-syncs automatically
  // after a successful save because we delete the entry).
  const [drafts, setDrafts] = useState<Record<string, RowDraft>>({});
  const [savingKeys, setSavingKeys] = useState<Set<string>>(new Set());
  const [openNote, setOpenNote] = useState<Set<string>>(new Set());
  const [openSpeed, setOpenSpeed] = useState<Set<string>>(new Set());

  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkForm, setBulkForm] = useState<{
    system: BranchSystem;
    status: SystemHealthStatus;
    totalUnits: number;
    workingUnits: number;
    internetSpeed: string;
    notes: string;
    targetBranches: 'all' | 'selected';
    selectedBranchIds: string[];
  }>({
    system: BranchSystem.Internet,
    status: SystemHealthStatus.Working,
    totalUnits: 1,
    workingUnits: 1,
    internetSpeed: '',
    notes: '',
    targetBranches: 'all',
    selectedBranchIds: [],
  });
  const [bulkSaving, setBulkSaving] = useState(false);

  const role = currentUser.role;

  // Real-time branch health via SSE
  const [liveHealth, setLiveHealth] = useState<BranchHealth[]>(branchHealth);
  const handleLiveUpdate = useCallback((health: BranchHealth[]) => {
    setLiveHealth((prev) => {
      const merged = new Map(prev.map((h) => [`${h.branchId}:${h.system}`, h]));
      for (const h of health) merged.set(`${h.branchId}:${h.system}`, h);
      return Array.from(merged.values());
    });
  }, []);
  useBranchHealthStream(
    role === 'BRANCH_USER' ? currentUser.branchId : undefined,
    handleLiveUpdate,
    role !== 'AUDITOR',
  );

  // Resolve which branches this viewer can monitor.
  const visibleBranches = useMemo(() => {
    let ids: Set<string>;
    if (role === 'IT_STAFF') {
      ids = new Set(
        (currentUser.assignments ?? [])
          .filter((a) => isAssignmentActive(a))
          .map((a) => a.branchId),
      );
    } else if (role === 'BRANCH_USER') {
      ids = new Set(currentUser.branchId ? [currentUser.branchId] : []);
    } else {
      ids = new Set(branches.map((b) => b.id));
    }
    return branches.filter((b) => ids.has(b.id) && b.status === 'Active');
  }, [branches, currentUser, role]);

  const canUpdate = can(currentUser, 'updateMonitor');
  const canBulkUpdate = can(currentUser, 'bulkUpdateMonitor');
  const canExport = can(currentUser, 'exportData');

  const health = useMemo(() => {
    const map = new Map<string, BranchHealth>();
    for (const h of liveHealth) map.set(`${h.branchId}:${h.system}`, h);
    return map;
  }, [liveHealth]);

  const statusOf = (branchId: string, system: BranchSystem): SystemHealthStatus =>
    health.get(`${branchId}:${system}`)?.status ?? SystemHealthStatus.Working;

  // --- Daily update coverage -------------------------------------------------
  const today = todayKey();

  const confirmedToday = useMemo(() => {
    let confirmed = 0;
    let total = 0;
    let lastConfirmedAt: string | undefined;
    let lastConfirmedMs = -Infinity;
    for (const b of visibleBranches) {
      for (const system of SYSTEM_ORDER) {
        total++;
        const entry = health.get(`${b.id}:${system}`);
        if (!entry) continue;
        if (timestampDayKey(entry.updatedAt) === today) {
          confirmed++;
          const ms = parseDisplayDateTime(entry.updatedAt)?.getTime() ?? -Infinity;
          if (ms > lastConfirmedMs) {
            lastConfirmedMs = ms;
            lastConfirmedAt = entry.updatedAt;
          }
        }
      }
    }
    return { confirmed, total, lastConfirmedAt };
  }, [health, visibleBranches, today]);

  const isConfirmedToday = (branchId: string, system: BranchSystem): boolean =>
    timestampDayKey(health.get(`${branchId}:${system}`)?.updatedAt) === today;

  const outstandingToday = confirmedToday.total - confirmedToday.confirmed;
  const dailyCoveragePct =
    confirmedToday.total > 0
      ? Math.round((confirmedToday.confirmed / confirmedToday.total) * 100)
      : 0;

  const branchMetrics = (branchId: string) => {
    let working = 0;
    let down = 0;
    for (const system of SYSTEM_ORDER) {
      if (statusOf(branchId, system) === SystemHealthStatus.Working) working++;
      else down++;
    }
    return { working, down, score: Math.round((working / SYSTEM_ORDER.length) * 100) };
  };

  const aggregate = (() => {
    let systems = 0;
    let working = 0;
    let notWorking = 0;
    let offline = 0;
    for (const b of visibleBranches) {
      for (const system of SYSTEM_ORDER) {
        systems++;
        const s = statusOf(b.id, system);
        if (s === SystemHealthStatus.Working) working++;
        else if (s === SystemHealthStatus.NotWorking) notWorking++;
        else offline++;
      }
    }
    return { systems, working, notWorking, offline, down: notWorking + offline };
  })();

  const filteredBranches = visibleBranches
    .filter((b) => {
      const matchesSearch =
        search.trim() === '' ||
        b.name.toLowerCase().includes(search.toLowerCase()) ||
        (b.location ?? '').toLowerCase().includes(search.toLowerCase());
      const matchesFilter =
        filter === MonitorFilter.All ||
        (filter === MonitorFilter.Good ? branchMetrics(b.id).down === 0 : branchMetrics(b.id).down > 0);
      return matchesSearch && matchesFilter;
    })
    .sort((a, b) => branchMetrics(a.id).score - branchMetrics(b.id).score);

  const toggleCollapse = (branchId: string) => {
    setCollapsedBranches((prev) => {
      const next = new Set(prev);
      if (next.has(branchId)) next.delete(branchId);
      else next.add(branchId);
      return next;
    });
  };

  const onTouchStartCard = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };

  const onTouchEndCard = (branchId: string) => (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const delta = (e.changedTouches[0]?.clientX ?? touchStartX.current) - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(delta) > 48) toggleCollapse(branchId);
  };

  const toggleIn = (setter: React.Dispatch<React.SetStateAction<Set<string>>>, key: string) =>
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  // --- Row editing helpers ---------------------------------------------------
  const getRowDraft = (branchId: string, system: BranchSystem): RowDraft => {
    const k = rkey(branchId, system);
    return drafts[k] ?? draftFromHealth(health.get(k), system);
  };

  const setRowDraft = (branchId: string, system: BranchSystem, patch: Partial<RowDraft>) => {
    const k = rkey(branchId, system);
    setDrafts((prev) => ({
      ...prev,
      [k]: { ...(prev[k] ?? draftFromHealth(health.get(k), system)), ...patch },
    }));
  };

  const rowDirty = (branchId: string, system: BranchSystem): boolean => {
    const k = rkey(branchId, system);
    const d = drafts[k];
    if (!d) return false;
    const base = draftFromHealth(health.get(k), system);
    return (
      d.status !== base.status ||
      d.totalUnits !== base.totalUnits ||
      d.workingUnits !== base.workingUnits ||
      (d.internetSpeed || '') !== (base.internetSpeed || '') ||
      (d.notes || '') !== (base.notes || '')
    );
  };

  const doCommit = async (
    branchId: string,
    system: BranchSystem,
    changes: UpdateBranchHealthChanges,
  ) => {
    const k = rkey(branchId, system);
    setSavingKeys((prev) => new Set(prev).add(k));
    try {
      await onUpdateHealth(branchId, changes);
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[k];
        return next;
      });
      successToast(`${system} updated.`);
    } catch (err) {
      console.error('Failed to update branch health:', err);
      errorToast(err instanceof Error ? err.message : 'Failed to update branch health.');
    } finally {
      setSavingKeys((prev) => {
        const next = new Set(prev);
        next.delete(k);
        return next;
      });
    }
  };

  /** One-tap status change for single-unit systems (and Internet speed). */
  const quickStatus = (branchId: string, system: BranchSystem, status: SystemHealthStatus) => {
    const d = getRowDraft(branchId, system);
    const changes: UpdateBranchHealthChanges = { system, status, notes: d.notes || undefined };
    if (system === BranchSystem.Internet && d.internetSpeed) changes.internetSpeed = d.internetSpeed;
    void doCommit(branchId, system, changes);
  };

  /** Save the edited draft (unit counts, Internet speed, or notes). */
  const saveRow = (branchId: string, system: BranchSystem) => {
    const d = getRowDraft(branchId, system);
    const changes: UpdateBranchHealthChanges = shouldTrackUnits(system)
      ? { system, totalUnits: d.totalUnits, workingUnits: d.workingUnits, notes: d.notes || undefined }
      : {
          system,
          status: d.status,
          notes: d.notes || undefined,
          ...(system === BranchSystem.Internet ? { internetSpeed: d.internetSpeed } : {}),
        };
    void doCommit(branchId, system, changes);
  };

  const exportHealthCsv = () => {
const headers = [
      'Branch Name',
      'Location',
      'System',
      'Status',
      'Total Units',
      'Working Units',
      'Internet Speed',
      'Last Updated',
      'Notes',
    ];
    // Branch name & location only shown on first system row per branch (blank for subsequent rows)
    const rows = filteredBranches.flatMap((b) =>
      SYSTEM_ORDER.map((system, sysIdx) => {
        const entry = health.get(`${b.id}:${system}`);
        return [
          sysIdx === 0 ? b.name : '',
          sysIdx === 0 ? (b.location ?? '') : '',
          system,
          entry?.status ?? '',
          entry?.totalUnits ?? '',
          entry?.workingUnits ?? '',
          entry?.internetSpeed ?? '',
          entry?.updatedAt ?? '',
          entry?.notes ?? '',
        ];
      }),
    );
    downloadCsv(
      `branch-health-monitor-${new Date().toISOString().slice(0, 10)}.csv`,
      toCsv(headers, rows),
    );
    successToast(`Exported ${rows.length} health records to CSV.`);
  };

  const handleBulkSave = async () => {
    if (!bulkForm.system) return;
    setBulkSaving(true);
    try {
      const payload: {
        system: BranchSystem;
        status?: SystemHealthStatus;
        totalUnits?: number | null;
        workingUnits?: number | null;
        internetSpeed?: string | null;
        notes?: string | null;
        branchIds?: string[];
      } = { system: bulkForm.system };

      if (shouldTrackUnits(bulkForm.system)) {
        payload.totalUnits = bulkForm.totalUnits;
        payload.workingUnits = bulkForm.workingUnits;
      } else {
        payload.status = bulkForm.status;
      }
      if (bulkForm.system === BranchSystem.Internet && bulkForm.internetSpeed) {
        payload.internetSpeed = bulkForm.internetSpeed;
      }
      if (bulkForm.notes) payload.notes = bulkForm.notes;
      if (bulkForm.targetBranches === 'selected' && bulkForm.selectedBranchIds.length > 0) {
        payload.branchIds = bulkForm.selectedBranchIds;
      }

      await storage.bulkUpdateBranchHealth(payload.system, payload);
      setBulkModalOpen(false);
      successToast(
        `Bulk update applied to ${bulkForm.targetBranches === 'selected' ? `${bulkForm.selectedBranchIds.length} branch(es)` : 'all active branches'} — ${bulkForm.system} set.`,
      );
    } catch (err) {
      console.error('Bulk update failed:', err);
      errorToast(err instanceof Error ? err.message : 'Bulk update failed.');
    } finally {
      setBulkSaving(false);
    }
  };

  // Keyboard shortcut: S focuses search, Esc clears it.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
      if ((e.key === 's' || e.key === 'S') && !typing) {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'Escape' && typing) {
        (e.target as HTMLElement).blur();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const scopeLabel =
    role === 'IT_STAFF'
      ? 'your assigned branches'
      : role === 'BRANCH_USER'
      ? 'your branch'
      : 'all branches';

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 text-white p-6 sm:p-8 rounded-2xl shadow-lg border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 text-xs font-semibold mb-3">
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            <span>Branch Infrastructure Monitor</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Systems Health Monitor
          </h1>
          <p className="text-sm text-slate-300 mt-1">
            Live status of Internet, CCTV, ATM, PC, Printer &amp; GenSet across {scopeLabel}.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0 flex-wrap">
          <div className="px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-center">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Branches
            </div>
            <div className="text-2xl font-black tabular-nums">{visibleBranches.length}</div>
          </div>
          <button type="button"
            onClick={() => {
              setFilter(MonitorFilter.All);
              setSearch('');
            }}
            className="px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition inline-flex items-center gap-2 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Reset view</span>
          </button>
          {canExport && (
            <button type="button"
              onClick={exportHealthCsv}
              className="px-4 py-3 bg-white border border-slate-300 text-slate-700 hover:border-slate-400 font-bold text-xs rounded-xl transition inline-flex items-center gap-2 cursor-pointer"
              title="Export visible branch health to CSV"
            >
              <Download className="w-4 h-4" />
              <span>Export CSV</span>
            </button>
          )}
          {canBulkUpdate && (
            <button type="button"
              onClick={() => setBulkModalOpen(true)}
              className="px-4 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition inline-flex items-center gap-2 cursor-pointer"
            >
              <ZapIcon className="w-4 h-4" />
              <span>Bulk Update</span>
            </button>
          )}
        </div>
      </div>

      {/* Daily update banner */}
      <div
        className={`rounded-2xl border p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${
          outstandingToday === 0
            ? 'bg-emerald-50 border-emerald-200'
            : dailyCoveragePct >= 50
            ? 'bg-amber-50 border-amber-200'
            : 'bg-red-50 border-red-200'
        }`}
      >
        <div className="flex items-start gap-3 min-w-0">
          <div
            className={`p-2.5 rounded-xl shrink-0 ${
              outstandingToday === 0
                ? 'bg-emerald-600 text-white'
                : dailyCoveragePct >= 50
                ? 'bg-amber-500 text-white'
                : 'bg-red-600 text-white'
            }`}
          >
            {outstandingToday === 0 ? (
              <CalendarCheck className="w-5 h-5" />
            ) : (
              <CalendarClock className="w-5 h-5" />
            )}
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Daily Update —{' '}
              {new Date().toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </div>
            <div className="text-lg font-black text-slate-900 mt-0.5">
              {confirmedToday.confirmed} of {confirmedToday.total} systems confirmed today
            </div>
            <div className="text-xs text-slate-600 mt-0.5">
              {outstandingToday === 0 ? (
                <>
                  Every system in scope has been updated today. Last update{' '}
                  {formatAbsoluteTime(confirmedToday.lastConfirmedAt)}.
                </>
              ) : (
                <>
                  <strong className="font-bold">{outstandingToday}</strong> still carrying an earlier
                  day&apos;s status. Last update{' '}
                  {formatAbsoluteTime(confirmedToday.lastConfirmedAt)}
                  {confirmedToday.lastConfirmedAt
                    ? ` (${formatRelativeTime(confirmedToday.lastConfirmedAt)})`
                    : ''}
                  .
                </>
              )}
            </div>
          </div>
        </div>
        <div className="shrink-0 lg:w-64">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase text-slate-500 mb-1">
            <span>TODAY&apos;S COVERAGE</span>
            <span className="tabular-nums">{dailyCoveragePct}%</span>
          </div>
          <div className="h-2.5 bg-white border border-slate-300 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                dailyCoveragePct === 100
                  ? 'bg-emerald-500'
                  : dailyCoveragePct >= 50
                  ? 'bg-amber-500'
                  : 'bg-red-500'
              }`}
              style={{ width: `${dailyCoveragePct}%` }}
            />
          </div>
          {outstandingToday > 0 && canUpdate && (
            <p className="text-[10px] text-slate-500 mt-1.5">
              Tap a status button to update — the status and the date save together.
            </p>
          )}
        </div>
      </div>

      {/* Aggregate Status Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: 'Systems Working',
            value: aggregate.working,
            cls: 'bg-emerald-50 border-emerald-200 text-emerald-700',
            icon: <CheckCircle2 className="w-4 h-4 text-emerald-600" />,
          },
          {
            label: 'Systems Not Working',
            value: aggregate.notWorking,
            cls: 'bg-red-50 border-red-200 text-red-700',
            icon: <XCircle className="w-4 h-4 text-red-600" />,
          },
          {
            label: 'Systems Offline',
            value: aggregate.offline,
            cls: 'bg-slate-100 border-slate-300 text-slate-700',
            icon: <CircleOff className="w-4 h-4 text-slate-500" />,
          },
          {
            label: 'Branches w/ Issues',
            value: visibleBranches.filter((b) => branchMetrics(b.id).down > 0).length,
            cls: 'bg-amber-50 border-amber-200 text-amber-700',
            icon: <TriangleAlert className="w-4 h-4 text-amber-600" />,
          },
        ].map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.05, duration: 0.3 }}
            className={`p-4 rounded-xl border shadow-sm ${card.cls}`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider">{card.label}</span>
              {card.icon}
            </div>
            <div className="text-3xl font-black tabular-nums mt-1">{card.value}</div>
          </motion.div>
        ))}
      </div>

      {/* Toolbar: legend + filters + search */}
      <div className="bg-white rounded-2xl border border-slate-200 p-3 sm:p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {[MonitorFilter.All, MonitorFilter.Good, MonitorFilter.Attention].map((f) => (
            <button type="button"
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${
                filter === f
                  ? 'bg-slate-900 text-white border-slate-800'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
              }`}
            >
              {f === MonitorFilter.All ? 'All Branches' : f}
            </button>
          ))}

          <span className="hidden sm:block w-px h-5 bg-slate-200 mx-1" />

          <div className="flex items-center gap-3 text-[11px] font-semibold text-slate-500">
            {[
              { label: 'Working', dot: 'bg-emerald-500' },
              { label: 'Not Working', dot: 'bg-red-500' },
              { label: 'Offline', dot: 'bg-slate-400' },
            ].map((l) => (
              <span key={l.label} className="inline-flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${l.dot}`} />
                {l.label}
              </span>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative min-w-0 sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              ref={searchInputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search branch..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600 font-medium"
            />
          </div>
          <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-semibold text-slate-400">
            <Keyboard className="w-3.5 h-3.5" />
            <kbd className="px-1 py-0.5 rounded bg-slate-200 text-slate-600">S</kbd>
          </span>
        </div>
      </div>

      {/* Branch Cards */}
      {filteredBranches.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <Building2 className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="mt-3 text-sm font-semibold text-slate-500">
            {visibleBranches.length === 0
              ? role === 'IT_STAFF'
                ? 'You have no assigned branches yet. Ask an administrator to assign branches to you.'
                : 'No branches to monitor.'
              : 'No branches match the current filter.'}
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {filteredBranches.map((branch, i) => {
            const metrics = branchMetrics(branch.id);
            const healthy = metrics.down === 0;
            const collapsed = collapsedBranches.has(branch.id);
            return (
              <motion.div
                key={branch.id}
                ref={(el) => { if (el) branchCardRefs.current[branch.id] = el; }}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 + i * 0.04, duration: 0.3 }}
                onTouchStart={onTouchStartCard}
                onTouchEnd={onTouchEndCard(branch.id)}
                className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden"
              >
                {/* Branch header */}
                <div
                  onClick={() => toggleCollapse(branch.id)}
                  className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center gap-4 cursor-pointer select-none"
                  role="button"
                  aria-expanded={!collapsed}
                  title={collapsed ? 'Expand branch (tap)' : 'Collapse branch (tap)'}
                >
                  <div className="w-11 h-11 rounded-xl bg-slate-900 text-emerald-300 flex items-center justify-center shrink-0">
                    <Building2 className="w-5 h-5" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-900 text-base">{branch.name}</span>
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                          healthy
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-red-50 text-red-700 border-red-200'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            healthy ? 'bg-emerald-500' : 'bg-red-500 animate-pulse'
                          }`}
                        />
                        {healthy ? 'All systems OK' : `${metrics.down} issue${metrics.down > 1 ? 's' : ''}`}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 truncate mt-0.5">
                      {branch.location} &middot; {metrics.working}/{SYSTEM_ORDER.length} systems working
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <div className="hidden sm:block w-40">
                      <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                        <span>Health</span>
                        <span className="tabular-nums">{metrics.score}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            healthy ? 'bg-emerald-500' : 'bg-amber-500'
                          }`}
                          style={{ width: `${metrics.score}%` }}
                        />
                      </div>
                    </div>
                    <ChevronDown
                      className={`w-5 h-5 text-slate-400 transition-transform ${
                        collapsed ? '' : 'rotate-180'
                      }`}
                    />
                  </div>
                </div>

                {!collapsed && (
                  <div className="p-3 sm:p-4 space-y-2">
                    {SYSTEM_ORDER.map((system) => {
                      const k = rkey(branch.id, system);
                      const entry = health.get(k);
                      const storedStatus = entry?.status ?? SystemHealthStatus.Working;
                      const trackUnits = shouldTrackUnits(system);
                      const isInternet = system === BranchSystem.Internet;
                      const draft = getRowDraft(branch.id, system);
                      const liveStatus = trackUnits
                        ? deriveHealthStatus(draft.totalUnits, draft.workingUnits) ?? draft.status
                        : draft.status;
                      const displayStatus = canUpdate && rowDirty(branch.id, system) ? liveStatus : storedStatus;
                      const meta = STATUS_META[displayStatus];
                      const dirty = rowDirty(branch.id, system);
                      const isSaving = savingKeys.has(k);
                      const confirmed = isConfirmedToday(branch.id, system);
                      const branchLogs = isInternet
                        ? internetSpeedLogs.filter((l) => l.branchId === branch.id).slice(0, 3)
                        : [];

                      return (
                        <div
                          key={system}
                          className={`rounded-xl border p-3 transition ${meta.row}`}
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${meta.iconBg}`}
                            >
                              {SYSTEM_ICONS[system]}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-slate-900">{system}</span>
                                <span className={`inline-flex items-center gap-1 text-[11px] font-bold ${meta.pill.split(' ').pop()}`}>
                                  <StatusPill status={displayStatus} />
                                </span>
                                {confirmed ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700">
                                    <CalendarCheck className="w-3 h-3" /> Today
                                  </span>
                                ) : (
                                  <span
                                    className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700"
                                    title={formatAbsoluteTime(entry?.updatedAt)}
                                  >
                                    <TriangleAlert className="w-3 h-3" /> Not updated today
                                  </span>
                                )}
                              </div>

                              <div className="text-[11px] text-slate-500 mt-1 flex flex-wrap items-center gap-x-2">
                                {trackUnits && (
                                  <span className="font-semibold text-slate-600 tabular-nums">
                                    {draft.workingUnits}/{draft.totalUnits} OK
                                  </span>
                                )}
                                {isInternet && entry?.internetSpeed && (
                                  <span className="font-semibold text-emerald-700">
                                    {entry.internetSpeed}
                                  </span>
                                )}
                                <span title={formatAbsoluteTime(entry?.updatedAt)}>
                                  Updated {formatRelativeTime(entry?.updatedAt)}
                                </span>
                              </div>

                              {entry?.notes && (
                                <div className="text-[11px] text-slate-500 mt-1 truncate" title={entry.notes}>
                                  {entry.notes}
                                </div>
                              )}

                              {isInternet && branchLogs.length > 0 && (
                                <div className="text-[10px] text-slate-400 mt-1 space-y-0.5">
                                  {branchLogs.map((log) => (
                                    <div key={log.id}>
                                      {log.recordedAt} — {log.speed}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Controls */}
                            {canUpdate && (
                              <div className="shrink-0 max-w-full">
                                {trackUnits ? (
                                  <div className="flex items-center gap-2 flex-wrap justify-end">
                                    <Stepper
                                      label="Working"
                                      value={draft.workingUnits}
                                      min={0}
                                      max={draft.totalUnits}
                                      disabled={isSaving}
                                      onChange={(v) => setRowDraft(branch.id, system, { workingUnits: v })}
                                    />
                                    <Stepper
                                      label="Total"
                                      value={draft.totalUnits}
                                      min={1}
                                      max={99}
                                      disabled={isSaving}
                                      onChange={(v) =>
                                        setRowDraft(branch.id, system, {
                                          totalUnits: v,
                                          workingUnits: Math.min(draft.workingUnits, v),
                                        })
                                      }
                                    />
                                    <button
                                      type="button"
                                      disabled={!dirty || isSaving}
                                      onClick={() => saveRow(branch.id, system)}
                                      className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
                                    >
                                      <Save className="w-3.5 h-3.5" />
                                      {isSaving ? 'Saving' : 'Save'}
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2 flex-wrap justify-end">
                                    <StatusSegmented
                                      value={liveStatus}
                                      disabled={isSaving}
                                      onSelect={(s) => quickStatus(branch.id, system, s)}
                                    />
                                    {isInternet && (
                                      <button
                                        type="button"
                                        onClick={() => toggleIn(setOpenSpeed, k)}
                                        className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${
                                          openSpeed.has(k)
                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                            : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                                        }`}
                                      >
                                        Speed
                                      </button>
                                    )}
                                  </div>
                                )}

                                <div className="flex items-center gap-2 justify-end mt-2">
                                  <button
                                    type="button"
                                    onClick={() => toggleIn(setOpenNote, k)}
                                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition cursor-pointer ${
                                      openNote.has(k) || dirty
                                        ? 'bg-amber-50 text-amber-700 border-amber-300'
                                        : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                                    }`}
                                  >
                                    <StickyNote className="w-3.5 h-3.5" />
                                    Note
                                  </button>
                                  {!trackUnits && dirty && (
                                    <button
                                      type="button"
                                      disabled={isSaving}
                                      onClick={() => saveRow(branch.id, system)}
                                      className="px-3 py-1 rounded-lg bg-slate-900 text-white text-[11px] font-bold hover:bg-slate-800 transition cursor-pointer disabled:opacity-40 inline-flex items-center gap-1.5"
                                    >
                                      <Save className="w-3.5 h-3.5" />
                                      {isSaving ? 'Saving' : 'Save'}
                                    </button>
                                  )}
                                </div>

                                {(isInternet && openSpeed.has(k)) && (
                                  <div className="mt-2 flex items-center gap-2 justify-end">
                                    <span className="text-[11px] font-semibold text-slate-500">Speed</span>
                                    <input
                                      type="text"
                                      value={draft.internetSpeed}
                                      onChange={(e) =>
                                        setRowDraft(branch.id, system, { internetSpeed: e.target.value })
                                      }
                                      placeholder="e.g. 50 Mbps"
                                      maxLength={100}
                                      className="w-32 px-2 py-1 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                                    />
                                  </div>
                                )}

                                {openNote.has(k) && (
                                  <div className="mt-2 flex items-center gap-2 justify-end">
                                    <StickyNote className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                    <input
                                      value={draft.notes}
                                      onChange={(e) =>
                                        setRowDraft(branch.id, system, { notes: e.target.value })
                                      }
                                      placeholder="Add a note (optional)"
                                      className="w-full sm:w-56 px-2 py-1 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                                    />
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {role === 'AUDITOR' && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-500">
          Auditor view — system statuses are read-only.
        </div>
      )}

      {/* Bulk Update Modal */}
      {bulkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden">
            <div className="p-4 sm:p-6 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <ZapIcon className="w-5 h-5 text-indigo-600" />
                Bulk Update
              </h3>
              <p className="text-xs text-slate-500 mt-1">Apply changes to multiple branches at once</p>
            </div>
            <div className="p-4 sm:p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">System</label>
                <select
                  value={bulkForm.system}
                  onChange={(e) => setBulkForm((f) => ({ ...f, system: e.target.value as BranchSystem }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                >
                  {SYSTEM_ORDER.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {shouldTrackUnits(bulkForm.system) ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Total Units</label>
                    <input
                      type="number"
                      min={1}
                      max={999}
                      value={bulkForm.totalUnits}
                      onChange={(e) => setBulkForm((f) => ({ ...f, totalUnits: Math.max(1, Number(e.target.value) || 1) }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Working Units</label>
                    <input
                      type="number"
                      min={0}
                      max={bulkForm.totalUnits}
                      value={bulkForm.workingUnits}
                      onChange={(e) => setBulkForm((f) => ({ ...f, workingUnits: Math.max(0, Math.min(f.totalUnits, Number(e.target.value) || 0)) }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
                  <div className="grid grid-cols-3 gap-1">
                    {[
                      SystemHealthStatus.Working,
                      SystemHealthStatus.NotWorking,
                      SystemHealthStatus.Offline,
                    ].map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setBulkForm((f) => ({ ...f, status: opt }))}
                        className={`px-2 py-2 rounded-lg text-xs font-bold border transition cursor-pointer ${
                          bulkForm.status === opt
                            ? opt === SystemHealthStatus.Working
                              ? 'bg-emerald-500 text-white border-emerald-600'
                              : opt === SystemHealthStatus.NotWorking
                              ? 'bg-red-500 text-white border-red-600'
                              : 'bg-slate-500 text-white border-slate-600'
                            : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {STATUS_META[opt].label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {bulkForm.system === BranchSystem.Internet && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Internet Speed</label>
                  <input
                    type="text"
                    value={bulkForm.internetSpeed}
                    onChange={(e) => setBulkForm((f) => ({ ...f, internetSpeed: e.target.value }))}
                    placeholder="e.g. 100 Mbps"
                    maxLength={100}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Notes (optional)</label>
                <textarea
                  value={bulkForm.notes}
                  onChange={(e) => setBulkForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Notes for all updated branches"
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">Target Branches</label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="bulk-target"
                      value="all"
                      checked={bulkForm.targetBranches === 'all'}
                      onChange={() => setBulkForm((f) => ({ ...f, targetBranches: 'all', selectedBranchIds: [] }))}
                      className="w-4 h-4 text-indigo-600 border-slate-300 focus:ring-indigo-500"
                    />
                    <span className="text-sm text-slate-700">All active branches ({visibleBranches.length})</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="bulk-target"
                      value="selected"
                      checked={bulkForm.targetBranches === 'selected'}
                      onChange={() => setBulkForm((f) => ({ ...f, targetBranches: 'selected' }))}
                      className="w-4 h-4 text-indigo-600 border-slate-300 focus:ring-indigo-500"
                    />
                    <span className="text-sm text-slate-700">Selected branches only</span>
                  </label>
                  {bulkForm.targetBranches === 'selected' && (
                    <div className="ml-6 mt-2 space-y-1 max-h-40 overflow-y-auto border border-slate-200 rounded-lg p-2 bg-slate-50">
                      {visibleBranches.map((b) => (
                        <label key={b.id} className="flex items-center gap-2 cursor-pointer text-sm">
                          <input
                            type="checkbox"
                            checked={bulkForm.selectedBranchIds.includes(b.id)}
                            onChange={(e) =>
                              setBulkForm((f) => ({
                                ...f,
                                selectedBranchIds: e.target.checked
                                  ? [...f.selectedBranchIds, b.id]
                                  : f.selectedBranchIds.filter((id) => id !== b.id),
                              }))
                            }
                            className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                          />
                          <span className="text-slate-700">{b.name}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="px-4 py-3 border-t border-slate-200 flex gap-2 justify-end">
              <button type="button"
                onClick={() => setBulkModalOpen(false)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button type="button"
                disabled={bulkSaving}
                onClick={handleBulkSave}
                className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 transition disabled:opacity-50"
              >
                {bulkSaving ? 'Applying...' : 'Apply to Branches'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
