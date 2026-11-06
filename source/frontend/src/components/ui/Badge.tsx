import React from 'react';
import { TicketStatus } from '../../types';
import { CheckCircle2, PlayCircle } from 'lucide-react';

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
    case 'In Progress':
      return (
        <span className={`inline-flex items-center rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-bold uppercase tracking-wider ${sizeClasses}`}>
          <PlayCircle className="w-3.5 h-3.5 text-amber-600" />
          <span>In Progress</span>
        </span>
      );
    case 'Resolved':
      return (
        <span className={`inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold uppercase tracking-wider ${sizeClasses}`}>
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          <span>Resolved</span>
        </span>
      );
    default:
      return null;
  }
};
