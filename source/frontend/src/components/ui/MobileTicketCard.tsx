import React from 'react';
import { motion } from 'motion/react';
import {
  AlertTriangle,
  ArrowUpRight,
  Building2,
  CalendarClock,
  Tag,
  UserCheck,
  UserRound,
} from 'lucide-react';
import { StatusBadge } from './Badge';

interface MobileTicketCardProps {
  ticket: {
    id: string;
    subject: string;
    description: string;
    status: 'In Progress' | 'Resolved';
    priority: 'Critical' | 'High' | 'Medium' | 'Low';
    category: string;
    subcategory?: string;
    branch: string;
    reporter: { name: string; avatar?: string };
    assignee?: { name: string; avatar?: string; id: string };
    createdAt: string;
    createdAtISO?: string;
    slaDeadline?: string;
    isOverSLA?: boolean;
  };
  onClick: () => void;
  isSelected?: boolean;
  onSelect?: (id: string, multi?: boolean) => void;
}

const PRIORITY_STYLES: Record<
  MobileTicketCardProps['ticket']['priority'],
  { pill: string; dot: string }
> = {
  Critical: { pill: 'border-red-200 bg-red-50 text-red-700', dot: 'bg-red-500' },
  High: { pill: 'border-amber-200 bg-amber-50 text-amber-700', dot: 'bg-amber-500' },
  Medium: { pill: 'border-sky-200 bg-sky-50 text-sky-700', dot: 'bg-sky-500' },
  Low: { pill: 'border-slate-200 bg-slate-50 text-slate-600', dot: 'bg-slate-400' },
};

const getInitials = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');

const formatTimeAgo = (dateStr: string): string => {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '';

  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60_000);
  const hours = Math.floor(diffMs / 3_600_000);
  const days = Math.floor(diffMs / 86_400_000);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const isTicketOverdue = (ticket: MobileTicketCardProps['ticket']): boolean => {
  if (ticket.isOverSLA !== undefined) return ticket.isOverSLA;
  if (ticket.status === 'Resolved' || !ticket.slaDeadline) return false;
  const deadline = new Date(ticket.slaDeadline);
  return !Number.isNaN(deadline.getTime()) && deadline.getTime() < Date.now();
};

const formatDeadline = (dateStr: string): string => {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

export function MobileTicketCard({
  ticket,
  onClick,
  isSelected = false,
  onSelect,
}: MobileTicketCardProps) {
  const priorityStyle = PRIORITY_STYLES[ticket.priority] ?? PRIORITY_STYLES.Low;
  const submitted = ticket.createdAtISO || ticket.createdAt;
  const isOverdue = isTicketOverdue(ticket);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      role="button"
      tabIndex={0}
      aria-label={`Open ticket ${ticket.id}: ${ticket.subject}`}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick();
        }
      }}
      className={`cursor-pointer rounded-xl border bg-white p-4 shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 ${
        isSelected
          ? 'border-emerald-300 bg-emerald-50/60 ring-1 ring-emerald-500/20'
          : 'border-slate-200 hover:border-emerald-200 hover:shadow-md'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          {onSelect && (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onSelect(ticket.id)}
              onClick={(event) => event.stopPropagation()}
              className="h-4 w-4 shrink-0 rounded border-slate-300 text-emerald-600 focus:ring-2 focus:ring-emerald-500"
              aria-label={`Select ticket ${ticket.id}`}
            />
          )}
          <span
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${priorityStyle.pill}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${priorityStyle.dot}`} aria-hidden="true" />
            {ticket.priority || 'Unset'}
          </span>
          <StatusBadge status={ticket.status} size="sm" />
          {isOverdue && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700">
              <AlertTriangle className="h-3 w-3" />
              Over SLA
            </span>
          )}
        </div>
        <span className="shrink-0 text-[10px] font-medium text-slate-400">
          {formatTimeAgo(submitted)}
        </span>
      </div>

      <h3 className="mt-3 line-clamp-2 text-sm font-semibold leading-snug text-slate-900">
        {ticket.subject}
      </h3>
      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500">
        {ticket.description}
      </p>

      <div className="mt-3 grid grid-cols-1 gap-1.5 text-[11px] text-slate-600 sm:grid-cols-2">
        <span className="flex min-w-0 items-center gap-1.5">
          <Tag className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          <span className="truncate">
            {ticket.category}
            {ticket.subcategory && (
              <span className="text-slate-400"> / {ticket.subcategory}</span>
            )}
          </span>
        </span>
        <span className="flex min-w-0 items-center gap-1.5">
          <Building2 className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          <span className="truncate">{ticket.branch}</span>
        </span>
        <span className="flex min-w-0 items-center gap-1.5">
          <UserCheck className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          <span className={`truncate ${ticket.assignee ? '' : 'text-slate-400'}`}>
            {ticket.assignee?.name || 'Unassigned'}
          </span>
        </span>
        <span className="flex min-w-0 items-center gap-1.5">
          <UserRound className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          <span className="truncate">{ticket.reporter.name}</span>
        </span>
      </div>

      {ticket.slaDeadline && (
        <div
          className={`mt-3 flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium ${
            isOverdue
              ? 'border-red-200 bg-red-50 text-red-700'
              : 'border-slate-200 bg-slate-50 text-slate-600'
          }`}
        >
          <CalendarClock className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">SLA due {formatDeadline(ticket.slaDeadline)}</span>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
        <span className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-[9px] font-bold text-white">
            {getInitials(ticket.reporter.name)}
          </span>
          <span className="text-[11px] font-medium text-slate-500">Requested by {ticket.reporter.name}</span>
        </span>
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-900">
          View ticket
          <ArrowUpRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </motion.div>
  );
}
