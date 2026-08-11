import React from 'react';
import { Ticket, TicketStatus, TicketPriority } from '../types';
import { SlaInfo, slaInfoFor } from '../services/store';
import {
  AlertCircle,
  Clock,
  CheckCircle2,
  XCircle,
  RotateCcw,
  UserCheck,
  PlayCircle,
  PauseCircle,
  ShieldAlert,
  ArrowUp,
  ArrowDown,
  Minus,
  AlarmClockOff,
  Timer
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
    case 'New':
      return (
        <span className={`inline-flex items-center rounded-full bg-slate-100 text-slate-700 border border-slate-300 font-bold uppercase tracking-wider ${sizeClasses}`}>
          <AlertCircle className="w-3.5 h-3.5 text-slate-500" />
          <span>New</span>
        </span>
      );
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
    case 'Reopened':
      return (
        <span className={`inline-flex items-center rounded-full bg-rose-50 text-rose-700 border border-rose-200 font-bold uppercase tracking-wider ${sizeClasses}`}>
          <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
          <span>Reopened</span>
        </span>
      );
    case 'Cancelled':
      return (
        <span className={`inline-flex items-center rounded-full bg-slate-100 text-slate-500 border border-slate-200 font-bold uppercase tracking-wider ${sizeClasses}`}>
          <XCircle className="w-3.5 h-3.5 text-slate-400" />
          <span>Cancelled</span>
        </span>
      );
    default:
      return null;
  }
};

interface PriorityBadgeProps {
  priority: TicketPriority;
  size?: 'sm' | 'md';
}

export const PriorityBadge: React.FC<PriorityBadgeProps> = ({ priority, size = 'md' }) => {
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs gap-1' : 'px-2.5 py-1 text-xs font-semibold gap-1';

  switch (priority) {
    case 'Critical':
      return (
        <span className={`inline-flex items-center rounded-md bg-red-100 text-red-800 border border-red-300 ${sizeClasses}`}>
          <ShieldAlert className="w-3.5 h-3.5 text-red-600" />
          <span>Critical</span>
        </span>
      );
    case 'High':
      return (
        <span className={`inline-flex items-center rounded-md bg-orange-100 text-orange-800 border border-orange-200 ${sizeClasses}`}>
          <ArrowUp className="w-3.5 h-3.5 text-orange-600" />
          <span>High</span>
        </span>
      );
    case 'Medium':
      return (
        <span className={`inline-flex items-center rounded-md bg-amber-50 text-amber-800 border border-amber-200 ${sizeClasses}`}>
          <Minus className="w-3.5 h-3.5 text-amber-600" />
          <span>Medium</span>
        </span>
      );
    case 'Low':
      return (
        <span className={`inline-flex items-center rounded-md bg-slate-100 text-slate-700 border border-slate-200 ${sizeClasses}`}>
          <ArrowDown className="w-3.5 h-3.5 text-slate-500" />
          <span>Low</span>
        </span>
      );
  }
};

interface SlaBadgeProps {
  ticket: Ticket;
  size?: 'sm' | 'md';
}

export const SlaBadge: React.FC<SlaBadgeProps> = ({ ticket, size = 'sm' }) => {
  const info: SlaInfo = slaInfoFor(ticket);
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-[10px] gap-1' : 'px-2.5 py-1 text-xs font-semibold gap-1';

  if (info.status === 'na') {
    return (
      <span className={`inline-flex items-center rounded-md bg-slate-100 text-slate-500 border border-slate-200 ${sizeClasses}`}>
        <Clock className="w-3 h-3 text-slate-400" />
        <span>SLA —</span>
      </span>
    );
  }

  if (info.status === 'breached') {
    return (
      <span className={`inline-flex items-center rounded-md bg-red-100 text-red-800 border border-red-300 ${sizeClasses}`} title={info.label}>
        <AlarmClockOff className="w-3 h-3 text-red-600" />
        <span>Breached</span>
      </span>
    );
  }

  if (info.status === 'critical') {
    return (
      <span className={`inline-flex items-center rounded-md bg-amber-100 text-amber-800 border border-amber-300 ${sizeClasses}`} title={info.label}>
        <Timer className="w-3 h-3 text-amber-600" />
        <span>{info.label}</span>
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 ${sizeClasses}`} title={info.label}>
      <Clock className="w-3 h-3 text-emerald-600" />
      <span>{info.label}</span>
    </span>
  );
};
