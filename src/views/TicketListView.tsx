import React, { useEffect, useState } from 'react';
import { Ticket, User, TicketCategory, TicketPriority, TicketStatus } from '../types';
import { StatusBadge, PriorityBadge, SlaBadge } from '../components/Badge';
import { slaInfoFor } from '../services/store';
import { Search, Filter, X, Eye, Ticket as TicketIcon, PlusCircle, Building, UserCheck, Download, ChevronLeft, ChevronRight } from 'lucide-react';

const PAGE_SIZE = 10;

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

export const TicketListView: React.FC<TicketListViewProps> = ({
  currentUser,
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
  const [statusFilter, setStatusFilter] = useState<string>(initialStatusFilter ?? 'ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [branchFilter, setBranchFilter] = useState<string>('ALL');
  const [assignedFilter, setAssignedFilter] = useState<string>('ALL');
  const [page, setPage] = useState(1);

  const categoriesList: TicketCategory[] = [
    'Hardware',
    'Software',
    'Network',
    'Account & Access',
    'Installation / Configuration',
    'IT Equipment',
    'Other IT Concern',
  ];

  const handleClearFilters = () => {
    setSearchTerm('');
    setStatusFilter('ALL');
    setPriorityFilter('ALL');
    setCategoryFilter('ALL');
    setBranchFilter('ALL');
    setAssignedFilter('ALL');
  };

  const hasActiveFilters =
    searchTerm !== '' ||
    statusFilter !== 'ALL' ||
    priorityFilter !== 'ALL' ||
    categoryFilter !== 'ALL' ||
    branchFilter !== 'ALL' ||
    assignedFilter !== 'ALL';

  const filteredTickets = tickets.filter((ticket) => {
    const matchesSearch =
      searchTerm.trim() === '' ||
      ticket.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.branchName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.requesterName.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'ALL' || ticket.status === statusFilter;
    const matchesPriority = priorityFilter === 'ALL' || ticket.priority === priorityFilter;
    const matchesCategory = categoryFilter === 'ALL' || ticket.category === categoryFilter;
    const matchesBranch = branchFilter === 'ALL' || ticket.branchId === branchFilter;
    const matchesAssigned =
      assignedFilter === 'ALL' ||
      (assignedFilter === 'UNASSIGNED' && !ticket.assignedToId) ||
      ticket.assignedToId === assignedFilter;

    return (
      matchesSearch &&
      matchesStatus &&
      matchesPriority &&
      matchesCategory &&
      matchesBranch &&
      matchesAssigned
    );
  });

  useEffect(() => {
    setPage(1);
  }, [searchTerm, statusFilter, priorityFilter, categoryFilter, branchFilter, assignedFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredTickets.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageTickets = filteredTickets.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

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
      'Priority',
      'Status',
      'SLA',
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
      t.priority,
      t.status,
      slaInfoFor(t).label,
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

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
          <p className="text-xs text-slate-500 mt-1">{subtitle}</p>
        </div>

        <div className="flex items-center gap-2">
          {onNavigateNewRequest && (
            <button
              onClick={onNavigateNewRequest}
              className="px-4 py-2 bg-blue-900 hover:bg-blue-800 text-white font-bold text-xs rounded-xl transition shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>+ New IT Request</span>
            </button>
          )}
          <button
            onClick={handleExportCsv}
            disabled={filteredTickets.length === 0}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl transition shadow-sm flex items-center gap-1.5 cursor-pointer"
            title="Download filtered tickets as CSV"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 space-y-3">
        <div className="flex flex-col lg:flex-row items-center gap-3">
          {/* Main Search Input */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search by ticket #, subject, branch, or employee..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition"
            />
          </div>

          {/* Filter Dropdowns Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:flex items-center gap-2 w-full lg:w-auto">
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="ALL">Status: All</option>
              <option value="New">New</option>
              <option value="Assigned">Assigned</option>
              <option value="In Progress">In Progress</option>
              <option value="Pending">Pending</option>
              <option value="Resolved">Resolved</option>
              <option value="Closed">Closed</option>
              <option value="Reopened">Reopened</option>
            </select>

            {/* Priority Filter */}
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="px-2.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="ALL">Priority: All</option>
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>

            {/* Category Filter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-2.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="ALL">Category: All</option>
              {categoriesList.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>

            {/* Branch Filter (For IT / Admin) */}
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="px-2.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="ALL">Branch: All</option>
              {allBranches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Clear Filters Toolbar */}
        {hasActiveFilters && (
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
            <span className="text-slate-500">
              Found <strong>{filteredTickets.length}</strong> matching tickets
            </span>
            <button
              onClick={handleClearFilters}
              className="text-red-600 hover:text-red-800 font-bold flex items-center gap-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Clear Filters</span>
            </button>
          </div>
        )}
      </div>

      {/* Ticket Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          {filteredTickets.length === 0 ? (
            <div className="p-12 text-center max-w-sm mx-auto space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <TicketIcon className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-800">No tickets found</h4>
              <p className="text-xs text-slate-500">
                Try clearing search or filter parameters to view tickets.
              </p>
              {hasActiveFilters && (
                <button
                  onClick={handleClearFilters}
                  className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold rounded-lg transition"
                >
                  Reset Filters
                </button>
              )}
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/90 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-4">Ticket #</th>
                  <th className="py-3.5 px-4">Branch</th>
                  <th className="py-3.5 px-4">Subject</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4">Priority</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">SLA</th>
                  <th className="py-3.5 px-4">Assigned IT</th>
                  <th className="py-3.5 px-4">Submitted</th>
                  <th className="py-3.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pageTickets.map((ticket) => (
                  <tr
                    key={ticket.id}
                    onClick={() => onNavigateTicketDetail(ticket.id)}
                    className="hover:bg-blue-50/40 transition cursor-pointer group"
                  >
                    <td className="py-3.5 px-4 font-mono font-bold text-blue-900 group-hover:underline">
                      #{ticket.id}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-800 whitespace-nowrap">
                      {ticket.branchName}
                    </td>
                    <td className="py-3.5 px-4 max-w-xs truncate font-medium text-slate-900">
                      {ticket.subject}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">{ticket.category}</td>
                    <td className="py-3.5 px-4">
                      <PriorityBadge priority={ticket.priority} size="sm" />
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={ticket.status} size="sm" />
                    </td>
                    <td className="py-3.5 px-4">
                      <SlaBadge ticket={ticket} size="sm" />
                    </td>
                    <td className="py-3.5 px-4 text-slate-700 whitespace-nowrap">
                      {ticket.assignedToName ? (
                        <span className="font-medium text-slate-800">{ticket.assignedToName}</span>
                      ) : (
                        <span className="text-slate-400 italic">Unassigned</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                      {ticket.createdAt}
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onNavigateTicketDetail(ticket.id);
                        }}
                        className="px-2.5 py-1 rounded bg-slate-100 hover:bg-blue-900 hover:text-white text-slate-700 font-semibold transition inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Manage</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Pagination */}
      {filteredTickets.length > PAGE_SIZE && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="text-xs text-slate-500">
            Showing{' '}
            <strong>
              {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filteredTickets.length)}
            </strong>{' '}
            of <strong>{filteredTickets.length}</strong> tickets
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 font-semibold text-xs inline-flex items-center gap-1 cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Prev</span>
            </button>
            <span className="px-3 py-1.5 rounded-lg bg-blue-900 text-white font-bold text-xs">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 font-semibold text-xs inline-flex items-center gap-1 cursor-pointer"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
