import React from 'react';
import { TicketStatus } from '../types';
import {
  Clock,
  CheckCircle2,
  UserCheck,
  PlayCircle,
  PauseCircle
} from 'lucide-react';

interface StatusBadgeProps {
  status: TicketStatus;
  size?: 'sm' | 'md' | 'lg';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-[10px] gap-1',
    md: 'px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider gap-1.5',
    lg: 'px-3 py-1.5 text-xs font-bold uppercase tracking-wider gap-1.5',
  }[size];

  switch (status) {
    case 'Assigned':
      return (
        <span className={`inline-flex items-center rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold uppercase tracking-wider ${sizeClasses}`}>
          <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
          <span>Assigned</span>
        </span>
      );
    case 'In Progress':
      return (
        <span className={`inline-flex items-center rounded-full bg-blue-50 text-blue-600 border border-blue-200 font-bold uppercase tracking-wider ${sizeClasses}`}>
          <PlayCircle className="w-3.5 h-3.5 text-blue-600" />
          <span>In Progress</span>
        </span>
      );
    case 'Pending':
      return (
        <span className={`inline-flex items-center rounded-full bg-purple-50 text-purple-700 border border-purple-200 font-bold uppercase tracking-wider ${sizeClasses}`}>
          <PauseCircle className="w-3.5 h-3.5 text-purple-600" />
          <span>Pending</span>
        </span>
      );
    case 'Resolved':
      return (
        <span className={`inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold uppercase tracking-wider ${sizeClasses}`}>
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          <span>Resolved</span>
        </span>
      );
    case 'Closed':
      return (
        <span className={`inline-flex items-center rounded-full bg-slate-100 text-slate-600 border border-slate-200 font-bold uppercase tracking-wider ${sizeClasses}`}>
          <Clock className="w-3.5 h-3.5 text-slate-500" />
          <span>Closed</span>
        </span>
      );
    default:
      return null;
  }
};
