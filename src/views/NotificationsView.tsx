import React from 'react';
import { NotificationItem } from '../types';
import { Bell, CheckCircle2, Ticket as TicketIcon, Clock, ExternalLink } from 'lucide-react';

interface NotificationsViewProps {
  notifications: NotificationItem[];
  onMarkRead: (id: string) => void;
  onNavigateTicket: (ticketId: string) => void;
}

export const NotificationsView: React.FC<NotificationsViewProps> = ({
  notifications,
  onMarkRead,
  onNavigateTicket,
}) => {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Bell className="w-6 h-6 text-blue-600" />
            <span>Notification Center</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            System alerts, status changes, and IT assignment updates
          </p>
        </div>

        <span className="text-xs font-mono font-bold text-slate-500">
          {notifications.length} alerts
        </span>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden divide-y divide-slate-100">
        {notifications.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            No notifications available.
          </div>
        ) : (
          notifications.map((n) => (
            <div
              key={n.id}
              onClick={() => {
                onMarkRead(n.id);
                onNavigateTicket(n.ticketId);
              }}
              className={`p-4 sm:p-5 hover:bg-blue-50/40 transition cursor-pointer flex items-start justify-between gap-4 ${
                !n.read ? 'bg-blue-50/60' : ''
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                    n.type === 'success'
                      ? 'bg-emerald-100 text-emerald-600'
                      : 'bg-blue-100 text-blue-600'
                  }`}
                >
                  {n.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-slate-900">{n.title}</h4>
                    {!n.read && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-600 text-white uppercase tracking-wider">
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

              <button className="text-xs text-blue-700 font-bold hover:underline flex items-center gap-1 shrink-0">
                <span>View Ticket</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
