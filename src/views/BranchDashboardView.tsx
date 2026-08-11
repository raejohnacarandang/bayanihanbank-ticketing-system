import React, { useState } from 'react';
import { Ticket, User, TicketStatus } from '../types';
import { StatusBadge } from '../components/Badge';
import { PlusCircle, Ticket as TicketIcon, CheckCircle2, PlayCircle, Eye, Search } from 'lucide-react';

interface BranchDashboardViewProps {
  currentUser: User;
  tickets: Ticket[];
  onNavigateNewRequest: () => void;
  onNavigateTicketDetail: (ticketId: string) => void;
}

export const BranchDashboardView: React.FC<BranchDashboardViewProps> = ({
  currentUser,
  tickets,
  onNavigateNewRequest,
  onNavigateTicketDetail,
}) => {
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Filter tickets for current branch (or user)
  const branchTickets = tickets.filter(
    (t) => t.branchId === currentUser.branchId || t.requesterId === currentUser.id
  );

  const totalCount = branchTickets.length;
  const inProgressCount = branchTickets.filter((t) => t.status === 'In Progress' || t.status === 'Assigned').length;
  const resolvedCount = branchTickets.filter((t) => t.status === 'Resolved').length;

  const filteredTickets = branchTickets.filter((t) => {
    const matchesStatus =
      selectedStatusFilter === 'ALL' ||
      (selectedStatusFilter === 'OPEN' && t.status !== 'Closed') ||
      t.status === selectedStatusFilter;

    const matchesSearch =
      searchTerm.trim() === '' ||
      t.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.category.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesStatus && matchesSearch;
  });

  const getGreetingTime = () => {
    const hour = Number(
      new Intl.DateTimeFormat('en-US', {
        hour: '2-digit',
        hourCycle: 'h23',
        timeZone: 'Asia/Manila',
      }).format(new Date())
    );
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-emerald-950 text-white p-6 sm:p-8 rounded-2xl shadow-lg border border-emerald-800/80 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-900/80 border border-emerald-700/60 text-emerald-200 text-xs font-bold mb-3">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span>Branch Portal Active</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            {getGreetingTime()}, {currentUser.name.split(' ')[0]}
          </h1>
          <p className="text-sm text-emerald-200/90 mt-1 font-medium">
            {currentUser.branchName || 'Unisan Branch'} — IT Requests & Service Dashboard
          </p>
        </div>

        <div>
          <button
            onClick={onNavigateNewRequest}
            className="w-full sm:w-auto px-6 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm rounded-xl transition shadow-lg flex items-center justify-center gap-2 cursor-pointer border border-amber-300"
          >
            <PlusCircle className="w-5 h-5 text-slate-950" />
            <span>+ New IT Request</span>
          </button>
        </div>
      </div>

      {/* Summary Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <div
          onClick={() => setSelectedStatusFilter('ALL')}
          className={`p-4 rounded-xl border transition cursor-pointer ${
            selectedStatusFilter === 'ALL'
              ? 'bg-slate-900 text-white border-slate-800 shadow-md ring-2 ring-emerald-500'
              : 'bg-white text-slate-900 border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className={`text-xs font-bold uppercase tracking-wider flex items-center justify-between ${
            selectedStatusFilter === 'ALL' ? 'text-slate-300' : 'text-slate-400'
          }`}>
            <span>Total Tickets</span>
            <TicketIcon className={`w-4 h-4 ${selectedStatusFilter === 'ALL' ? 'text-emerald-300' : 'text-emerald-500'}`} />
          </div>
          <div className="text-2xl sm:text-3xl font-black mt-2">{totalCount}</div>
          <div className={`text-[11px] mt-1 ${selectedStatusFilter === 'ALL' ? 'text-slate-400' : 'text-slate-500'}`}>Submitted from branch</div>
        </div>

        <div
          onClick={() => setSelectedStatusFilter('In Progress')}
          className={`p-4 rounded-xl border transition cursor-pointer ${
            selectedStatusFilter === 'In Progress'
              ? 'bg-amber-900 text-white border-amber-800 shadow-md ring-2 ring-amber-400'
              : 'bg-white text-slate-900 border-slate-200 hover:border-amber-200'
          }`}
        >
          <div className={`text-xs font-bold uppercase tracking-wider flex items-center justify-between ${
            selectedStatusFilter === 'In Progress' ? 'text-amber-300' : 'text-amber-700'
          }`}>
            <span>In Progress</span>
            <PlayCircle className={`w-4 h-4 ${selectedStatusFilter === 'In Progress' ? 'text-amber-300' : 'text-amber-600'}`} />
          </div>
          <div className={`text-2xl sm:text-3xl font-black mt-2 ${
            selectedStatusFilter === 'In Progress' ? 'text-amber-50' : 'text-amber-900'
          }`}>{inProgressCount}</div>
          <div className={`text-[11px] mt-1 ${selectedStatusFilter === 'In Progress' ? 'text-amber-200' : 'text-slate-500'}`}>Under IT resolution</div>
        </div>

        <div
          onClick={() => setSelectedStatusFilter('Resolved')}
          className={`p-4 rounded-xl border transition cursor-pointer ${
            selectedStatusFilter === 'Resolved'
              ? 'bg-emerald-900 text-white border-emerald-800 shadow-md ring-2 ring-emerald-400'
              : 'bg-white text-slate-900 border-slate-200 hover:border-emerald-200'
          }`}
        >
          <div className={`text-xs font-bold uppercase tracking-wider flex items-center justify-between ${
            selectedStatusFilter === 'Resolved' ? 'text-emerald-300' : 'text-emerald-700'
          }`}>
            <span>Resolved</span>
            <CheckCircle2 className={`w-4 h-4 ${selectedStatusFilter === 'Resolved' ? 'text-emerald-300' : 'text-emerald-600'}`} />
          </div>
          <div className={`text-2xl sm:text-3xl font-black mt-2 ${
            selectedStatusFilter === 'Resolved' ? 'text-emerald-50' : 'text-emerald-900'
          }`}>{resolvedCount}</div>
          <div className={`text-[11px] mt-1 ${selectedStatusFilter === 'Resolved' ? 'text-emerald-200' : 'text-slate-500'}`}>Needs branch confirmation</div>
        </div>
      </div>

      {/* Recent Tickets Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Table Header & Controls */}
        <div className="p-4 sm:p-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              {currentUser.branchName || 'Unisan Branch'} IT Request Tickets
            </h3>
            <p className="text-xs text-slate-500">
              Showing tickets submitted by staff at this branch location
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search ticket # or subject..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
              className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-600 font-medium"
            >
              <option value="ALL">All Statuses</option>
              <option value="OPEN">All Open Tickets</option>
              <option value="In Progress">In Progress</option>
              <option value="Resolved">Resolved</option>
            </select>
          </div>
        </div>

        {/* Table View */}
        <div className="overflow-x-auto">
          {filteredTickets.length === 0 ? (
            <div className="p-12 text-center max-w-sm mx-auto space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <TicketIcon className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-800">No IT requests found</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                You do not have any IT requests matching your search or filter parameters.
              </p>
              <button
                onClick={onNavigateNewRequest}
                className="px-4 py-2 bg-emerald-900 hover:bg-emerald-800 text-white font-semibold text-xs rounded-lg transition inline-flex items-center gap-1.5 cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Create Your First Request</span>
              </button>
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/80 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Ticket #</th>
                  <th className="py-3 px-4">Subject</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Submitted</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTickets.map((ticket) => (
                  <tr
                    key={ticket.id}
                    onClick={() => onNavigateTicketDetail(ticket.id)}
                    className="hover:bg-emerald-50/40 transition cursor-pointer group"
                  >
                    <td className="py-3 px-4 font-mono font-bold text-emerald-900 group-hover:underline">
                      #{ticket.id}
                    </td>
                    <td className="py-3 px-4 max-w-xs truncate font-medium text-slate-900">
                      {ticket.subject}
                    </td>
                    <td className="py-3 px-4 text-slate-600">{ticket.category}</td>
                    <td className="py-3 px-4">
                      <StatusBadge status={ticket.status} size="sm" />
                    </td>
                    <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                      {ticket.createdAt}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onNavigateTicketDetail(ticket.id);
                        }}
                        className="px-2.5 py-1 rounded bg-slate-100 hover:bg-emerald-600 hover:text-white text-slate-700 font-medium transition inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
