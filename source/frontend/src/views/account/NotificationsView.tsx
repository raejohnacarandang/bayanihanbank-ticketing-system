import React, { useCallback } from 'react';
import { motion } from 'motion/react';
import { NotificationItem, Branch } from '../../types';
import { Bell, CheckCircle2, Ticket as TicketIcon, Clock, ExternalLink, Building2 } from 'lucide-react';

interface NotificationsViewProps {
  notifications: NotificationItem[];
  onMarkRead: (id: string) => void;
  onNavigateTicket: (ticketId: string) => void;
  onNavigateBranchMonitor?: (branchId?: string) => void;
  allBranches?: Branch[];
}

export const NotificationsView: React.FC<NotificationsViewProps> = ({
  notifications,
  onMarkRead,
  onNavigateTicket,
  onNavigateBranchMonitor,
  allBranches = [],
}) => {
  const handleNotificationClick = useCallback((n: NotificationItem) => {
    onMarkRead(n.id);
    let targetBranchId = n.branchId;
    if (!targetBranchId && n.message && allBranches.length > 0) {
      const branchName = n.message.split(' — ')[0]?.trim();
      if (branchName) {
        const match = allBranches.find(
          (b) => b.name.toLowerCase() === branchName.toLowerCase()
        );
        if (match) targetBranchId = match.id;
      }
    }
    if (n.ticketId && n.ticketId.trim()) {
      onNavigateTicket(n.ticketId);
    } else if (onNavigateBranchMonitor && targetBranchId) {
      onNavigateBranchMonitor(targetBranchId);
    }
  }, [onMarkRead, onNavigateTicket, onNavigateBranchMonitor, allBranches]);
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Bell className="w-6 h-6 text-emerald-600" />
            <span>Notification Center</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            System alerts, status changes, and IT assignment updates
          </p>
        </div>

        <span className="text-xs font-mono font-bold text-slate-500">
          {notifications.length} alerts
        </span>
      </motion.div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden divide-y divide-slate-100">
        {notifications.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            No notifications available.
          </div>
        ) : (
          notifications.map((n, i) => (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.03, duration: 0.25 }}
              onClick={() => handleNotificationClick(n)}
              className={`p-4 sm:p-5 hover:bg-emerald-50/40 transition cursor-pointer flex items-start justify-between gap-4 ${
                !n.read ? 'bg-emerald-50/60' : ''
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                    n.type === 'success'
                      ? 'bg-emerald-100 text-emerald-600'
                      : n.type === 'warning'
                      ? 'bg-amber-100 text-amber-600'
                      : 'bg-sky-100 text-sky-600'
                  }`}
                >
                  {n.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : n.type === 'warning' ? <Bell className="w-5 h-5" /> : <Building2 className="w-5 h-5" />}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-slate-900">{n.title}</h4>
                    {!n.read && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-600 text-white uppercase tracking-wider">
                        New
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 mt-1">{n.message}</p>
                  <span className="text-[10px] text-slate-400 font-mono block mt-1.5">
                    {n.timestamp}
                  </span>
                </div>
              </div>

              {n.ticketId && n.ticketId.trim() ? (
                <button type="button" className="text-xs text-emerald-700 font-bold hover:underline flex items-center gap-1 shrink-0">
                  <span>View Ticket</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              ) : onNavigateBranchMonitor ? (
                <button type="button" className="text-xs text-indigo-700 font-bold hover:underline flex items-center gap-1 shrink-0">
                  <span>Open Branch Monitor</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              ) : null}
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
};
