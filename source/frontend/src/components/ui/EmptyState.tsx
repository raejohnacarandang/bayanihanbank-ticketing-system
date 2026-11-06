import React from 'react';
import { 
  Ticket as TicketIcon, 
  Building2, 
  Users, 
  Search, 
  Plus, 
  Filter, 
  Bell, 
  FileText,
  MessageSquare,
  Calendar,
  ShieldCheck
} from 'lucide-react';
import { Button } from './Button';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary' | 'outline';
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
  illustration?: 'tickets' | 'branches' | 'users' | 'search' | 'notifications' | 'reports' | 'comments' | 'calendar' | 'security';
}

const illustrations: Record<string, React.ReactNode> = {
  tickets: <TicketIcon className="w-16 h-16 text-slate-300" />,
  branches: <Building2 className="w-16 h-16 text-slate-300" />,
  users: <Users className="w-16 h-16 text-slate-300" />,
  search: <Search className="w-16 h-16 text-slate-300" />,
  notifications: <Bell className="w-16 h-16 text-slate-300" />,
  reports: <FileText className="w-16 h-16 text-slate-300" />,
  comments: <MessageSquare className="w-16 h-16 text-slate-300" />,
  calendar: <Calendar className="w-16 h-16 text-slate-300" />,
  security: <ShieldCheck className="w-16 h-16 text-slate-300" />,
};

export function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  className = '',
  illustration,
}: EmptyStateProps) {
  const Illustration = illustration ? illustrations[illustration] : null;

  return (
    <div className={`flex flex-col items-center justify-center text-center py-12 px-4 ${className}`}>
      <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mb-5">
        {icon || Illustration || <FileText className="w-10 h-10 text-slate-400" />}
      </div>
      
      <h3 className="text-lg font-bold text-slate-900 mb-2">{title}</h3>
      
      {description && (
        <p className="text-slate-500 text-sm max-w-md mx-auto mb-6 leading-relaxed">
          {description}
        </p>
      )}

      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full max-w-xs">
        {action && (
          <Button
            variant={action.variant || 'primary'}
            onClick={action.onClick}
            className="w-full sm:w-auto"
          >
            {action.label}
          </Button>
        )}
        
        {secondaryAction && (
          <Button
            variant="secondary"
            onClick={secondaryAction.onClick}
            className="w-full sm:w-auto"
          >
            {secondaryAction.label}
          </Button>
        )}
      </div>
    </div>
  );
}

export function EmptyTickets({ onCreate, onClearFilters }: { onCreate?: () => void; onClearFilters?: () => void }) {
  return (
    <EmptyState
      illustration="tickets"
      title="No tickets found"
      description="No tickets match your current filters. Try adjusting your search or create a new ticket."
      action={onCreate ? { label: 'Create New Ticket', onClick: onCreate } : undefined}
      secondaryAction={onClearFilters ? { label: 'Clear Filters', onClick: onClearFilters } : undefined}
    />
  );
}

export function EmptyBranches({ onCreate }: { onCreate?: () => void }) {
  return (
    <EmptyState
      illustration="branches"
      title="No branches found"
      description="There are no branches configured yet. Add your first branch to get started."
      action={onCreate ? { label: 'Add Branch', onClick: onCreate } : undefined}
    />
  );
}

export function EmptyUsers({ onCreate }: { onCreate?: () => void }) {
  return (
    <EmptyState
      illustration="users"
      title="No users found"
      description="No users match your search criteria. Try a different search term or add a new user."
      action={onCreate ? { label: 'Add User', onClick: onCreate } : undefined}
    />
  );
}

export function EmptySearch({ onClearFilters }: { onClearFilters?: () => void }) {
  return (
    <EmptyState
      illustration="search"
      title="No results found"
      description="Your search didn't match any records. Try different keywords or clear your filters."
      secondaryAction={onClearFilters ? { label: 'Clear Filters', onClick: onClearFilters } : undefined}
    />
  );
}

export function EmptyNotifications() {
  return (
    <EmptyState
      illustration="notifications"
      title="No notifications"
      description="You're all caught up! New notifications will appear here."
    />
  );
}

export function EmptyReports() {
  return (
    <EmptyState
      illustration="reports"
      title="No data available"
      description="There's no data to display for the selected period. Try changing the date range."
    />
  );
}

export function EmptyComments({ onAdd }: { onAdd?: () => void }) {
  return (
    <EmptyState
      illustration="comments"
      title="No comments yet"
      description="Be the first to add a comment or update on this ticket."
      action={onAdd ? { label: 'Add Comment', onClick: onAdd } : undefined}
    />
  );
}

export function EmptyCalendar() {
  return (
    <EmptyState
      illustration="calendar"
      title="No scheduled items"
      description="No events or deadlines for this period."
    />
  );
}

export function EmptySecurity() {
  return (
    <EmptyState
      illustration="security"
      title="No security events"
      description="No security-related events to display."
    />
  );
}