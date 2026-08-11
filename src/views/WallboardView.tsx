import React, { useEffect, useState } from 'react';
import { Ticket, User, NotificationItem } from '../types';
import { UserCheck, PlayCircle, Clock, CheckCircle2 } from 'lucide-react';

interface WallboardViewProps {
  staff: User | null;
  tickets: Ticket[];
  notifications: NotificationItem[];
}

function useNow(intervalMs = 1000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

export const WallboardView: React.FC<WallboardViewProps> = ({ staff, tickets, notifications }) => {
  const now = useNow();

  if (!staff) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-400 flex flex-col items-center justify-center gap-3 p-8">
        <div className="w-20 h-20 rounded-full bg-slate-800 flex items-center justify-center">
          <UserCheck className="w-10 h-10 text-slate-600" />
        </div>
        <p className="text-sm font-semibold">No IT specialist found for this monitor.</p>
        <p className="text-xs text-slate-600">
          Check the staff id in the address bar, e.g. /#/wallboard/staff-002
        </p>
      </div>
    );
  }

  const staffTickets = tickets.filter((t) => t.assignedToId === staff.id);
  const inProgressCount = staffTickets.filter((t) => t.status === 'In Progress').length;
  const pendingCount = staffTickets.filter((t) => t.status === 'Pending').length;
  const resolvedCount = staffTickets.filter((t) => t.status === 'Resolved').length;
  const assignedCount = staffTickets.filter((t) => t.status === 'Assigned').length;
  const newNotificationCount = notifications.filter((n) => n.userId === staff.id && !n.read).length;

  const clock = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const date = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 text-white flex flex-col p-6 sm:p-10">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-slate-700/60 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-b from-emerald-800 to-emerald-950 border border-emerald-600/40 flex items-center justify-center">
            <UserCheck className="w-5 h-5 text-emerald-300" />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">
              BB IT Service Desk — Live Staff Monitor
            </div>
            <div className="text-sm font-bold text-slate-200">
              Bayanihan Bank Main IT Department
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl sm:text-3xl font-black font-mono tabular-nums">{clock}</div>
          <div className="text-[11px] text-slate-400">{date}</div>
        </div>
      </header>

      {/* Staff Card */}
      <main className="flex-1 flex items-center justify-center py-6">
        <div className="w-full max-w-3xl bg-slate-900/80 border border-slate-700 rounded-3xl shadow-2xl overflow-hidden">
          {/* Staff Identity */}
          <div className="p-6 sm:p-8 border-b border-slate-700/60 bg-gradient-to-r from-emerald-900/40 via-slate-900 to-transparent flex flex-col sm:flex-row items-start sm:items-center gap-5">
            <div className="relative">
              <div className="w-24 h-24 rounded-2xl bg-amber-600 text-white font-black text-4xl flex items-center justify-center border-2 border-amber-400/50 shadow-lg">
                {staff.name.charAt(0)}
              </div>
              {newNotificationCount > 0 && (
                <div className="absolute -top-2 -right-2 min-w-8 h-8 px-2 rounded-full bg-red-600 text-white text-sm font-black flex items-center justify-center border-2 border-red-400/60 shadow-lg">
                  {newNotificationCount}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-3xl sm:text-4xl font-black truncate">{staff.name}</h1>
              <div className="text-sm text-slate-400 font-mono mt-1">@{staff.username}</div>
              <div className="inline-flex items-center gap-1.5 mt-3 px-3 py-1 rounded-full bg-sky-500/15 border border-sky-500/40 text-sky-300 text-xs font-bold">
                <UserCheck className="w-3.5 h-3.5" />
                IT STAFF — ONLINE
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Workload
              </div>
              <div className="text-4xl font-black text-slate-100 mt-1 tabular-nums">
                {staffTickets.length}
              </div>
              <div className="text-[11px] text-slate-400">assigned tickets</div>
            </div>
          </div>

          {/* Status Counts */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-6 sm:p-8">
            <div className="p-5 rounded-2xl bg-indigo-950/60 border border-indigo-500/40 text-center">
              <PlayCircle className="w-6 h-6 text-indigo-400 mx-auto" />
              <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-300 mt-2">
                Assigned
              </div>
              <div className="text-4xl sm:text-5xl font-black text-white mt-1 tabular-nums">
                {assignedCount}
              </div>
            </div>
            <div className="p-5 rounded-2xl bg-amber-950/60 border border-amber-500/40 text-center">
              <Clock className="w-6 h-6 text-amber-400 mx-auto" />
              <div className="text-[10px] font-bold uppercase tracking-wider text-amber-300 mt-2">
                In Progress
              </div>
              <div className="text-4xl sm:text-5xl font-black text-white mt-1 tabular-nums">
                {inProgressCount}
              </div>
            </div>
            <div className="p-5 rounded-2xl bg-purple-950/60 border border-purple-500/40 text-center">
              <Clock className="w-6 h-6 text-purple-400 mx-auto" />
              <div className="text-[10px] font-bold uppercase tracking-wider text-purple-300 mt-2">
                Pending
              </div>
              <div className="text-4xl sm:text-5xl font-black text-white mt-1 tabular-nums">
                {pendingCount}
              </div>
            </div>
            <div className="p-5 rounded-2xl bg-emerald-950/60 border border-emerald-500/40 text-center">
              <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto" />
              <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-300 mt-2">
                Resolved
              </div>
              <div className="text-4xl sm:text-5xl font-black text-white mt-1 tabular-nums">
                {resolvedCount}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="flex items-center justify-between border-t border-slate-700/60 pt-4">
        <div className="text-[11px] text-slate-500">
          Auto-refreshing every 30 seconds
        </div>
        <div className="text-[11px] text-slate-500">
          Live status feed for {staff.name}
        </div>
      </footer>
    </div>
  );
};
