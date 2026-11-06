import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Ticket, User, TicketCategory, TicketPriority, TicketStatus } from '../../types';
import { StatusBadge } from '../../components/ui/Badge';
import {
  AlertTriangle,
  ArrowUpRight,
  Building2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Clock3,
  Download,
  ListFilter,
  PlusCircle,
  RotateCcw,
  Search,
  Tag,
  Ticket as TicketIcon,
  UserCheck,
  UserRound,
  X,
} from 'lucide-react';
import { MobileTicketCard } from '../../components/ui/MobileTicketCard';

const PAGE_SIZE = 10;

const STATUS_ORDER: TicketStatus[] = ['In Progress', 'Resolved'];

const PRIORITY_STYLES: Record<TicketPriority, { dot: string }> = {
  Critical: { dot: 'bg-red-500' },
  High: { dot: 'bg-amber-500' },
  Medium: { dot: 'bg-sky-500' },
  Low: { dot: 'bg-slate-400' },
};

interface TicketListViewProps {
  currentUser: User;
  tickets: Ticket[];
  allBranches: { id: string; name: string }[];
  allStaff: User[];
  title: string;
  subtitle: string;
  onNavigateTicketDetail: (ticketId: string) => void;
  onNavigateNewRequest?: () => void;
  initialStatusFilter?: string;
}

const getInitials = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');

const formatSubmittedDate = (ticket: Ticket): string => {
  const value = ticket.createdAtISO || ticket.createdAt;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return ticket.createdAt;
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const formatRelativeTime = (ticket: Ticket): string => {
  const value = ticket.createdAtISO || ticket.createdAt;
  const date = new Date(value);
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

const isSlaOverdue = (ticket: Ticket): boolean => {
  if (!ticket.slaDeadline || ticket.status === 'Resolved') return false;
  const deadline = new Date(ticket.slaDeadline);
  return !Number.isNaN(deadline.getTime()) && deadline.getTime() < Date.now();
};

export const TicketListView: React.FC<TicketListViewProps> = ({
  tickets,
  allBranches,
  allStaff,
  title,
  subtitle,
  onNavigateTicketDetail,
  onNavigateNewRequest,
  initialStatusFilter,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(() =>
    initialStatusFilter &&
    STATUS_ORDER.includes(initialStatusFilter as TicketStatus)
      ? initialStatusFilter
      : 'ALL',
  );
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [branchFilter, setBranchFilter] = useState<string>('ALL');
  const [assignedFilter, setAssignedFilter] = useState<string>('ALL');
  const [page, setPage] = useState(1);
  const searchRef = useRef<HTMLInputElement>(null);
  const filterId = React.useId();

  const categoriesList: TicketCategory[] = [
    'Hardware',
    'Software',
    'Network',
    'Account & Access',
    'Installation / Configuration',
    'IT Equipment',
    'Other IT Concern',
  ];

  const itStaff = useMemo(
    () => allStaff.filter((staff) => staff.role === 'IT_STAFF'),
    [allStaff],
  );

  const handleClearFilters = () => {
    setSearchTerm('');
    setStatusFilter('ALL');
    setCategoryFilter('ALL');
    setBranchFilter('ALL');
    setAssignedFilter('ALL');
  };

  const activeFilterCount = [
    searchTerm !== '',
    statusFilter !== 'ALL',
    categoryFilter !== 'ALL',
    branchFilter !== 'ALL',
    assignedFilter !== 'ALL',
  ].filter(Boolean).length;
  const hasActiveFilters = activeFilterCount > 0;

  const filteredTickets = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return tickets.filter((ticket) => {
      const inAllowedStatus = STATUS_ORDER.includes(ticket.status);
      const matchesSearch =
        term === '' ||
        ticket.id.toLowerCase().includes(term) ||
        ticket.subject.toLowerCase().includes(term) ||
        ticket.branchName.toLowerCase().includes(term) ||
        ticket.requesterName.toLowerCase().includes(term) ||
        (ticket.assignedToName?.toLowerCase().includes(term) ?? false);

      const matchesStatus = statusFilter === 'ALL' || ticket.status === statusFilter;
      const matchesCategory = categoryFilter === 'ALL' || ticket.category === categoryFilter;
      const matchesBranch = branchFilter === 'ALL' || ticket.branchId === branchFilter;
      const matchesAssigned =
        assignedFilter === 'ALL' ||
        (assignedFilter === 'UNASSIGNED' && !ticket.assignedToId) ||
        ticket.assignedToId === assignedFilter;

      return (
        inAllowedStatus &&
        matchesSearch &&
        matchesStatus &&
        matchesCategory &&
        matchesBranch &&
        matchesAssigned
      );
    });
  }, [tickets, searchTerm, statusFilter, categoryFilter, branchFilter, assignedFilter]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, statusFilter, categoryFilter, branchFilter, assignedFilter]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isTyping =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable;
      if (e.key === '/' && !isTyping) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const totalPages = Math.max(1, Math.ceil(filteredTickets.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageTickets = filteredTickets.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  const pageNumbers = useMemo(() => {
    const start = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
    const end = Math.min(totalPages, start + 4);
    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
  }, [currentPage, totalPages]);

  const clearSearch = () => {
    setSearchTerm('');
    searchRef.current?.focus();
  };

  const csvEscape = (value: string): string => {
    const safe = value.replace(/"/g, '""');
    return /[",\n]/.test(safe) ? `"${safe}"` : safe;
  };

  const handleExportCsv = () => {
    const headers = [
      'Ticket #',
      'Subject',
      'Description',
      'Category',
      'Status',
      'Branch',
      'Requester',
      'Assigned To',
      'Submitted',
      'Updated',
    ];
    const rows = filteredTickets.map((t) => [
      t.id,
      t.subject,
      t.description,
      t.category,
      t.status,
      t.branchName,
      t.requesterName,
      t.assignedToName || 'Unassigned',
      t.createdAt,
      t.updatedAt,
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => csvEscape(String(cell))).join(','))
      .join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tickets-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const filterSelectClass = (isActive: boolean) =>
    `h-11 w-full cursor-pointer appearance-none rounded-xl border px-3 pr-9 text-base font-medium shadow-sm transition focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600 sm:text-sm ${
      isActive
        ? 'border-emerald-300 bg-emerald-50/60 text-emerald-950'
        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
    }`;

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Page header */}
      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800">
              <ListFilter className="h-3.5 w-3.5" />
              Ticket workspace
            </div>
            <h1 className="mt-3 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              {title}
            </h1>
            <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-500">
              {subtitle}
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center lg:shrink-0">
            <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-emerald-700 ring-1 ring-slate-200">
                <TicketIcon className="h-4 w-4" />
              </span>
              <span className="leading-tight">
                <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Total tickets
                </span>
                <span className="block text-sm font-bold tabular-nums text-slate-900">
                  {tickets.length}
                </span>
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {onNavigateNewRequest && (
                <button
                  type="button"
                  onClick={onNavigateNewRequest}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-900 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
                >
                  <PlusCircle className="h-4 w-4" />
                  New IT Request
                </button>
              )}
              <button
                type="button"
                onClick={handleExportCsv}
                disabled={filteredTickets.length === 0}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
                title="Download filtered tickets as CSV"
              >
                <Download className="h-4 w-4" />
                Export CSV
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Search and filters */}
      <section
        aria-label="Search and filter tickets"
        className="rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm backdrop-blur sm:p-5 lg:sticky lg:top-20 lg:z-20"
      >
        <div className="flex flex-col gap-4">
          <div role="search" className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              ref={searchRef}
              type="text"
              name="search"
              aria-label="Search tickets"
              placeholder="Search tickets by ID, subject, branch, requester, or assignee"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-12 text-base font-medium text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-emerald-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 sm:text-sm"
            />
            {searchTerm ? (
              <button
                type="button"
                onClick={clearSearch}
                aria-label="Clear search"
                className="absolute right-1.5 top-1/2 inline-flex h-9 w-9 min-h-0 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
              >
                <X className="h-4 w-4" />
              </button>
            ) : (
              <kbd className="pointer-events-none absolute right-3 top-1/2 hidden h-6 -translate-y-1/2 items-center rounded-md border border-slate-200 bg-slate-50 px-1.5 font-mono text-[10px] font-semibold text-slate-400 lg:inline-flex">
                /
              </kbd>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <label htmlFor={`${filterId}-status`} className="block">
              <span className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
                <CircleDot className="h-3 w-3" />
                Status
              </span>
              <div className="relative">
                <select
                  id={`${filterId}-status`}
                  name="status"
                  aria-label="Filter by status"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className={filterSelectClass(statusFilter !== 'ALL')}
                >
                  <option value="ALL">All statuses</option>
                  {STATUS_ORDER.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>
            </label>

            <label htmlFor={`${filterId}-category`} className="block">
              <span className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
                <Tag className="h-3 w-3" />
                Category
              </span>
              <div className="relative">
                <select
                  id={`${filterId}-category`}
                  name="category"
                  aria-label="Filter by category"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className={filterSelectClass(categoryFilter !== 'ALL')}
                >
                  <option value="ALL">All categories</option>
                  {categoriesList.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>
            </label>

            <label htmlFor={`${filterId}-branch`} className="block">
              <span className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
                <Building2 className="h-3 w-3" />
                Branch
              </span>
              <div className="relative">
                <select
                  id={`${filterId}-branch`}
                  name="branch"
                  aria-label="Filter by branch"
                  value={branchFilter}
                  onChange={(e) => setBranchFilter(e.target.value)}
                  className={filterSelectClass(branchFilter !== 'ALL')}
                >
                  <option value="ALL">All branches</option>
                  {allBranches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>
            </label>

            <label htmlFor={`${filterId}-assignee`} className="block">
              <span className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
                <UserCheck className="h-3 w-3" />
                Assignee
              </span>
              <div className="relative">
                <select
                  id={`${filterId}-assignee`}
                  name="assignee"
                  aria-label="Filter by assignee"
                  value={assignedFilter}
                  onChange={(e) => setAssignedFilter(e.target.value)}
                  className={filterSelectClass(assignedFilter !== 'ALL')}
                >
                  <option value="ALL">All assignees</option>
                  <option value="UNASSIGNED">Unassigned</option>
                  {itStaff.map((staff) => (
                    <option key={staff.id} value={staff.id}>
                      {staff.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>
            </label>
          </div>
        </div>

        {hasActiveFilters && (
          <div
            role="status"
            aria-live="polite"
            className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 font-semibold text-emerald-800">
                <ListFilter className="h-3.5 w-3.5" />
                {activeFilterCount} active {activeFilterCount === 1 ? 'filter' : 'filters'}
              </span>
              <span>
                Showing{' '}
                <strong className="font-semibold text-slate-900">
                  {filteredTickets.length}
                </strong>{' '}
                of{' '}
                <strong className="font-semibold text-slate-900">{tickets.length}</strong>{' '}
                tickets
              </span>
            </div>
            <button
              type="button"
              onClick={handleClearFilters}
              className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Clear filters
            </button>
          </div>
        )}
      </section>

      {/* Ticket list */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
              <ListFilter className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Ticket list</h2>
              <p className="text-[11px] text-slate-500">
                {filteredTickets.length === 0
                  ? 'No results in this view'
                  : `${filteredTickets.length} ${
                      filteredTickets.length === 1 ? 'ticket' : 'tickets'
                    } in this view`}
              </p>
            </div>
          </div>
          {hasActiveFilters && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold text-slate-600">
              <ListFilter className="h-3 w-3" />
              Filtered
            </span>
          )}
        </div>

        {filteredTickets.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 ring-1 ring-slate-200">
              <TicketIcon className="h-7 w-7" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-slate-900">
              {hasActiveFilters ? 'No tickets match these filters' : 'No tickets in this queue yet'}
            </h3>
            <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-slate-500">
              {hasActiveFilters
                ? 'Try a broader search or clear the filters to see every ticket in this queue.'
                : 'New IT requests will appear here as soon as they are submitted.'}
            </p>
            <div className="mt-5 flex flex-col items-center justify-center gap-2 sm:flex-row">
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
                >
                  <RotateCcw className="h-4 w-4" />
                  Clear filters
                </button>
              )}
              {!hasActiveFilters && onNavigateNewRequest && (
                <button
                  type="button"
                  onClick={onNavigateNewRequest}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-900 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
                >
                  <PlusCircle className="h-4 w-4" />
                  New IT Request
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Mobile card list */}
            <div className="space-y-3 p-3 sm:p-4 md:hidden">
              {pageTickets.map((ticket) => (
                <MobileTicketCard
                  key={ticket.id}
                  ticket={{
                    ...ticket,
                    branch: ticket.branchName,
                    reporter: { name: ticket.requesterName },
                    assignee: ticket.assignedToName
                      ? { name: ticket.assignedToName, id: ticket.assignedToId ?? '' }
                      : undefined,
                  }}
                  onClick={() => onNavigateTicketDetail(ticket.id)}
                />
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block">
              <div className="overflow-x-auto">
                <table
                  className="w-full min-w-[1000px] text-left"
                  aria-label={`${title} ticket list`}
                >
                  <thead className="border-b border-slate-200 bg-slate-50/80">
                    <tr>
                      <th
                        scope="col"
                        className="whitespace-nowrap px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500"
                      >
                        Ticket
                      </th>
                      <th
                        scope="col"
                        className="whitespace-nowrap px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500"
                      >
                        Subject
                      </th>
                      <th
                        scope="col"
                        className="whitespace-nowrap px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500"
                      >
                        Branch
                      </th>
                      <th
                        scope="col"
                        className="whitespace-nowrap px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500"
                      >
                        Status
                      </th>
                      <th
                        scope="col"
                        className="whitespace-nowrap px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500"
                      >
                        Assignee
                      </th>
                      <th
                        scope="col"
                        className="whitespace-nowrap px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500"
                      >
                        Requester
                      </th>
                      <th
                        scope="col"
                        className="whitespace-nowrap px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500"
                      >
                        Submitted
                      </th>
                      <th
                        scope="col"
                        className="whitespace-nowrap px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500"
                      >
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pageTickets.map((ticket, index) => {
                      const priority = PRIORITY_STYLES[ticket.priority] ?? PRIORITY_STYLES.Low;
                      const overdue = isSlaOverdue(ticket);

                      return (
                        <motion.tr
                          key={ticket.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: Math.min(index * 0.02, 0.15), duration: 0.2 }}
                          onClick={() => onNavigateTicketDetail(ticket.id)}
                          className="group cursor-pointer transition-colors hover:bg-slate-50/80"
                        >
                          <td className="whitespace-nowrap px-5 py-4 align-middle">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-bold text-emerald-900 group-hover:underline group-hover:underline-offset-2">
                                #{ticket.id}
                              </span>
                              {overdue && (
                                <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">
                                  <AlertTriangle className="h-3 w-3" />
                                  SLA
                                </span>
                              )}
                            </div>
                            <div className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${priority.dot}`}
                                aria-hidden="true"
                              />
                              {ticket.priority || 'Unset'}
                            </div>
                          </td>

                          <td className="px-5 py-4 align-middle">
                            <div className="max-w-[340px]">
                              <p className="truncate text-sm font-semibold text-slate-900">
                                {ticket.subject}
                              </p>
                              <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500">
                                <Tag className="h-3 w-3 shrink-0" />
                                <span className="truncate">
                                  {ticket.category}
                                  {ticket.subcategory && (
                                    <span className="text-slate-400">
                                      {' '}
                                      / {ticket.subcategory}
                                    </span>
                                  )}
                                </span>
                              </div>
                            </div>
                          </td>

                          <td className="whitespace-nowrap px-5 py-4 align-middle">
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700">
                              <Building2 className="h-3.5 w-3.5 text-slate-400" />
                              {ticket.branchName}
                            </span>
                          </td>

                          <td className="whitespace-nowrap px-5 py-4 align-middle">
                            <StatusBadge status={ticket.status} size="sm" />
                          </td>

                          <td className="whitespace-nowrap px-5 py-4 align-middle">
                            {ticket.assignedToName ? (
                              <div className="flex items-center gap-2">
                                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white">
                                  {getInitials(ticket.assignedToName)}
                                </span>
                                <span className="text-xs font-medium text-slate-700">
                                  {ticket.assignedToName}
                                </span>
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400">
                                <UserRound className="h-3.5 w-3.5" />
                                Unassigned
                              </span>
                            )}
                          </td>

                          <td className="whitespace-nowrap px-5 py-4 align-middle text-xs font-medium text-slate-700">
                            {ticket.requesterName}
                          </td>

                          <td className="whitespace-nowrap px-5 py-4 align-middle">
                            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                              <Clock3 className="h-3 w-3 text-slate-400" />
                              {formatSubmittedDate(ticket)}
                            </div>
                            {formatRelativeTime(ticket) && (
                              <div className="mt-0.5 text-[11px] text-slate-400">
                                {formatRelativeTime(ticket)}
                              </div>
                            )}
                          </td>

                          <td className="whitespace-nowrap px-5 py-4 text-right align-middle">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onNavigateTicketDetail(ticket.id);
                              }}
                              className="inline-flex h-8 min-h-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-600 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                            >
                              Open
                              <ArrowUpRight className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </section>

      {/* Pagination */}
      {filteredTickets.length > PAGE_SIZE && (
        <nav
          aria-label="Ticket pagination"
          className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="text-xs text-slate-500">
            Showing{' '}
            <strong className="font-semibold text-slate-900">
              {(currentPage - 1) * PAGE_SIZE + 1}–
              {Math.min(currentPage * PAGE_SIZE, filteredTickets.length)}
            </strong>{' '}
            of <strong className="font-semibold text-slate-900">{filteredTickets.length}</strong>{' '}
            matching tickets
          </p>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPage((previous) => Math.max(1, previous - 1))}
              disabled={currentPage === 1}
              aria-label="Previous page"
              className="inline-flex h-9 min-h-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Prev
            </button>

            <div className="flex items-center gap-1">
              {pageNumbers.map((pageNumber) => {
                const isCurrent = pageNumber === currentPage;
                return (
                  <button
                    key={pageNumber}
                    type="button"
                    onClick={() => setPage(pageNumber)}
                    aria-label={`Go to page ${pageNumber}`}
                    aria-current={isCurrent ? 'page' : undefined}
                    className={`inline-flex h-9 w-9 min-h-0 items-center justify-center rounded-lg text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${
                      isCurrent
                        ? 'bg-emerald-900 text-white shadow-sm'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {pageNumber}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setPage((previous) => Math.min(totalPages, previous + 1))}
              disabled={currentPage === totalPages}
              aria-label="Next page"
              className="inline-flex h-9 min-h-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </nav>
      )}
    </div>
  );
};
