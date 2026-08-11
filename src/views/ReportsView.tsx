import React from 'react';
import { Ticket, TicketStatus, Branch, User } from '../types';
import {
  BarChart3,
  Ticket as TicketIcon,
  CheckCircle2,
  Clock,
  Building,
  Layers,
  Flag,
  Download
} from 'lucide-react';

interface ReportsViewProps {
  tickets: Ticket[];
  branches: Branch[];
  categories: { id: string; name: string }[];
  users: User[];
}

const STATUS_COLORS: Record<string, string> = {
  Assigned: 'bg-indigo-600',
  'In Progress': 'bg-amber-500',
  Pending: 'bg-purple-600',
  Resolved: 'bg-emerald-600',
  Closed: 'bg-slate-500',
};

const STATUS_ORDER: TicketStatus[] = [
  'Assigned',
  'In Progress',
  'Pending',
  'Resolved',
  'Closed',
];

function computeCategoryCounts(tickets: Ticket[]): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const t of tickets) counts.set(t.category, (counts.get(t.category) || 0) + 1);
  return [...counts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
}

function computeBranchCounts(tickets: Ticket[], branches: Branch[]): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const t of tickets) counts.set(t.branchName, (counts.get(t.branchName) || 0) + 1);
  const list = [...counts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  const total = branches.length;
  return list.slice(0, Math.max(5, total));
}

function computeDailyCounts(tickets: Ticket[]): { date: string; label: string; count: number }[] {
  const days: { date: string; label: string; count: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    days.push({
      date: key,
      label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      count: 0,
    });
  }
  for (const t of tickets) {
    if (!t.createdAtISO) continue;
    const d = new Date(t.createdAtISO);
    if (Number.isNaN(d.getTime())) continue;
    const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    const found = days.find((x) => x.date === key);
    if (found) found.count += 1;
  }
  return days;
}

function Bar({ value, max, className, label }: { value: number; max: number; className: string; label?: string }) {
  const width = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
      <div
        className={`h-full rounded-full ${className}`}
        style={{ width: `${width}%` }}
        title={label}
      />
    </div>
  );
}

export const ReportsView: React.FC<ReportsViewProps> = ({ tickets, branches }) => {
  const total = tickets.length;
  const open = tickets.filter((t) => t.status !== 'Closed').length;
  const resolved = tickets.filter((t) => t.status === 'Resolved' || t.status === 'Closed').length;
  const unassigned = tickets.filter((t) => !t.assignedToId && t.status !== 'Closed').length;

  const statusCounts = STATUS_ORDER.map((s) => ({ status: s, count: tickets.filter((t) => t.status === s).length }));
  const statusMax = Math.max(1, ...statusCounts.map((s) => s.count));

  const categoryRows = computeCategoryCounts(tickets);
  const catMax = Math.max(1, ...categoryRows.map((c) => c.count));

  const branchRows = computeBranchCounts(tickets, branches);
  const branchMax = Math.max(1, ...branchRows.map((b) => b.count));

  const daily = computeDailyCounts(tickets);
  const dayMax = Math.max(1, ...daily.map((d) => d.count));

  const avgResolution = (() => {
    const closed = tickets.filter((t) => t.status === 'Closed' || t.status === 'Resolved' && t.createdAtISO && t.resolvedAt);
    if (closed.length === 0) return '—';
    let ms = 0;
    for (const t of closed) {
      const start = new Date(t.createdAtISO!);
      const end = new Date(t.resolvedAt || t.createdAtISO!);
      if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) ms += end.getTime() - start.getTime();
    }
    const hrs = ms / 3600000 / closed.length;
    return hrs >= 24 ? `${(hrs / 24).toFixed(1)}d` : `${Math.round(hrs)}h`;
  })();

  const exportCsv = () => {
    const esc = (v: string) => {
      const safe = v.replace(/"/g, '""');
      return /[",\n]/.test(safe) ? `"${safe}"` : safe;
    };
    const rows = [
      ['Metric', 'Value'],
      ['Total Tickets', total],
      ['Open Tickets', open],
      ['Resolved Tickets', resolved],
      ['Unassigned Open', unassigned],
      ['Avg Resolution', avgResolution],
      [''],
      ['Status', 'Count'],
      ...statusCounts.map((s) => [s.status, s.count]),
      [''],
      ['Category', 'Count'],
      ...categoryRows.map((c) => [c.name, c.count]),
      [''],
      ['Branch', 'Count'],
      ...branchRows.map((b) => [b.name, b.count]),
    ];
    const csv = rows.map((r) => r.map((c) => esc(String(c))).join(',')).join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reports-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded border border-emerald-700 bg-emerald-900/60 text-emerald-200 text-xs font-bold uppercase tracking-wider mb-2">
            <BarChart3 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Reports & Analytics</span>
          </div>
          <h1 className="text-2xl font-black">IT Service Desk Reports</h1>
          <p className="text-xs text-slate-300 mt-1">
            Ticket volume, workload, and resolution analytics across all Bayanihan Bank branches
          </p>
        </div>
        <button
          onClick={exportCsv}
          className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl transition shadow-sm flex items-center gap-1.5 cursor-pointer self-start md:self-auto"
        >
          <Download className="w-4 h-4" />
          <span>Export Report CSV</span>
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <span className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
            <TicketIcon className="w-3 h-3" /> Total Tickets
          </span>
          <div className="text-2xl font-black text-slate-900 mt-1">{total}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <span className="text-[10px] font-bold text-amber-700 uppercase flex items-center gap-1">
            <Clock className="w-3 h-3" /> Open Tickets
          </span>
          <div className="text-2xl font-black text-amber-900 mt-1">{open}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <span className="text-[10px] font-bold text-emerald-700 uppercase flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Resolved
          </span>
          <div className="text-2xl font-black text-emerald-900 mt-1">{resolved}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <span className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
            <Flag className="w-3 h-3" /> Unassigned Open
          </span>
          <div className="text-2xl font-black text-slate-900 mt-1">{unassigned}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <span className="text-[10px] font-bold text-slate-500 uppercase">Avg Resolution</span>
          <div className="text-2xl font-black text-slate-900 mt-1">{avgResolution}</div>
        </div>
      </div>

      {/* Status */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/60">
          <h3 className="text-sm font-bold text-slate-900">Tickets by Status</h3>
          <p className="text-xs text-slate-500">Current lifecycle stage of all tickets</p>
        </div>
        <div className="p-4 sm:p-5 space-y-3">
          {statusCounts.map((s) => (
            <div key={s.status} className="flex items-center gap-3">
              <span className="w-28 shrink-0 text-xs font-semibold text-slate-700">{s.status}</span>
              <div className="flex-1">
                <Bar value={s.count} max={statusMax} className={STATUS_COLORS[s.status] || 'bg-slate-400'} label={`${s.status}: ${s.count}`} />
              </div>
              <span className="w-8 text-right text-xs font-bold text-slate-800">{s.count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Category & Branch */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/60">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-500" />
              Tickets by Category
            </h3>
            <p className="text-xs text-slate-500">Request types handled by the service desk</p>
          </div>
          <div className="p-4 sm:p-5 space-y-3">
            {categoryRows.map((c) => (
              <div key={c.name} className="flex items-center gap-3">
                <span className="w-36 shrink-0 text-xs font-semibold text-slate-700 truncate">{c.name}</span>
                <div className="flex-1">
                  <Bar value={c.count} max={catMax} className="bg-amber-500" label={`${c.name}: ${c.count}`} />
                </div>
                <span className="w-8 text-right text-xs font-bold text-slate-800">{c.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/60">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Building className="w-4 h-4 text-indigo-500" />
              Tickets by Branch
            </h3>
            <p className="text-xs text-slate-500">Volume per bank location</p>
          </div>
          <div className="p-4 sm:p-5 space-y-3">
            {branchRows.map((b) => (
              <div key={b.name} className="flex items-center gap-3">
                <span className="w-36 shrink-0 text-xs font-semibold text-slate-700 truncate">{b.name}</span>
                <div className="flex-1">
                  <Bar value={b.count} max={branchMax} className="bg-indigo-500" label={`${b.name}: ${b.count}`} />
                </div>
                <span className="w-8 text-right text-xs font-bold text-slate-800">{b.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tickets per Day */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/60">
          <h3 className="text-sm font-bold text-slate-900">Ticket Volume — Last 14 Days</h3>
          <p className="text-xs text-slate-500">Tickets created per day</p>
        </div>
        <div className="p-4 sm:p-5">
          <div className="flex items-end gap-1.5 h-40">
            {daily.map((d) => (
              <div key={d.date} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                <span className="text-[10px] font-bold text-slate-600">{d.count > 0 ? d.count : ''}</span>
                <div
                  className={`w-full rounded-t ${d.count > 0 ? 'bg-emerald-600' : 'bg-slate-100'}`}
                  style={{ height: d.count > 0 ? `${Math.max(8, Math.round((d.count / dayMax) * 100))}%` : '4px' }}
                  title={`${d.label}: ${d.count}`}
                />
                <span className="text-[9px] text-slate-400">{d.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
