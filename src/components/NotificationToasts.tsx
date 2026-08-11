import React from 'react';
import { NotificationItem } from '../types';
import { Bell, CheckCircle2, X, Ticket as TicketIcon } from 'lucide-react';

export interface ToastItem {
  id: string;
  notification: NotificationItem;
}

interface NotificationToastsProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
  onOpen: (notification: NotificationItem) => void;
}

export const NotificationToasts: React.FC<NotificationToastsProps> = ({
  toasts,
  onDismiss,
  onOpen,
}) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[70] flex flex-col gap-2 w-80 max-w-[calc(100vw-2rem)]">
      {toasts.map(({ id, notification }) => (
        <div
          key={id}
          className="bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden animate-[toastIn_.25s_ease-out]"
          style={{
            animation: 'toastIn 0.25s ease-out',
          }}
        >
          <div
            className={`flex items-start gap-1.5 px-3 py-2 text-white text-[11px] font-bold ${
              notification.type === 'success' ? 'bg-emerald-700' : 'bg-blue-800'
            }`}
          >
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-3.5 h-3.5" />
            ) : (
              <Bell className="w-3.5 h-3.5" />
            )}
            <span className="flex-1 uppercase tracking-wider">New Notification</span>
            <button
              onClick={() => onDismiss(id)}
              className="text-white/80 hover:text-white cursor-pointer"
              title="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <button
            onClick={() => onOpen(notification)}
            className="w-full text-left p-3 hover:bg-slate-50 transition cursor-pointer"
          >
            <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <TicketIcon className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span className="truncate">{notification.title}</span>
            </div>
            <p className="text-xs text-slate-600 mt-1 line-clamp-2">{notification.message}</p>
          </button>
        </div>
      ))}
    </div>
  );
};
