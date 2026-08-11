import React, { useState } from 'react';
import { Ticket, User } from '../types';
import { StatusBadge } from '../components/Badge';
import {
  Ticket as TicketIcon,
  AlertCircle,
  PlayCircle,
  CheckCircle2,
  Clock,
  UserCheck,
  Eye,
  Building,
  BarChart3,
  Search,
  Filter,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';

interface ItDashboardViewProps {
  currentUser: User;
  tickets: Ticket[];
  onNavigateTicketDetail: (ticketId: string) => void;
  onNavigateAllTickets: () => void;
}

export const ItDashboardView: React.FC<ItDashboardViewProps> = ({
  currentUser,
  tickets,
  onNavigateTicketDetail,
  onNavigateAllTickets,
}) => {
  const [branchFilter, setBranchFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const totalCount = tickets.length;
  const assignedCount = tickets.filter((t) => t.status === 'Assigned').length;
  const inProgressCount = tickets.filter((t) => t.status === 'In Progress').length;
  const pendingCount = tickets.filter((t) => t.status === 'Pending').length;
  const resolvedCount = tickets.filter((t) => t.status === 'Resolved').length;

  // Branch names list
  const branchesList = Array.from(new Set(tickets.map((t) => t.branchName)));

  // Tickets requiring immediate IT attention
  const attentionTickets = tickets.filter((t) => {
    const isUnclosed = t.status !== 'Closed';
    const matchesBranch = branchFilter === 'ALL' || t.branchName === branchFilter;
    const matchesStatus =
      statusFilter === 'ALL' ||
      t.status === statusFilter;
    return isUnclosed && matchesBranch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* IT Header Banner */}
      <div className="bg-slate-900 text-white p-6 sm:p-8 rounded-2xl shadow-lg border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-semibold mb-3">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
            <span>Main IT Department Portal</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            IT Service Desk Dashboard
          </h1>
          <p className="text-sm text-slate-300 mt-1">
            Real-time branch IT ticket monitoring, triage, and resolution management
          </p>
        </div>

        <button
          onClick={onNavigateAllTickets}
          className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition shadow-md flex items-center gap-2 cursor-pointer self-start md:self-auto"
        >
          <span>View All IT Queue</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div
          onClick={() => setStatusFilter('ALL')}
          className={`p-3.5 rounded-xl border transition cursor-pointer ${
            statusFilter === 'ALL'
              ? 'bg-slate-900 text-white border-slate-800 shadow-md ring-2 ring-emerald-500'
              : 'bg-white border-slate-200 shadow-2xs'
          }`}
        >
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
            <span>Total</span>
            <TicketIcon className={`w-3.5 h-3.5 ${statusFilter === 'ALL' ? 'text-emerald-300' : 'text-slate-400'}`} />
          </div>
          <div className="text-2xl font-black mt-1">{totalCount}</div>
        </div>

        <div
          onClick={() => setStatusFilter('Assigned')}
          className={`p-3.5 rounded-xl border transition cursor-pointer ${
            statusFilter === 'Assigned'
              ? 'bg-indigo-900 text-white border-indigo-800 shadow-md ring-2 ring-indigo-400'
              : 'bg-indigo-50/70 border-indigo-200 shadow-2xs'
          }`}
        >
          <div className={`text-[10px] font-bold uppercase tracking-wider flex items-center justify-between ${
            statusFilter === 'Assigned' ? 'text-indigo-300' : 'text-indigo-700'
          }`}>
            <span>Assigned</span>
            <UserCheck className={`w-3.5 h-3.5 ${statusFilter === 'Assigned' ? 'text-indigo-300' : 'text-indigo-600'}`} />
          </div>
          <div className={`text-2xl font-black mt-1 ${statusFilter === 'Assigned' ? 'text-indigo-50' : 'text-indigo-900'}`}>{assignedCount}</div>
        </div>

        <div
          onClick={() => setStatusFilter('In Progress')}
          className={`p-3.5 rounded-xl border transition cursor-pointer ${
            statusFilter === 'In Progress'
              ? 'bg-amber-900 text-white border-amber-800 shadow-md ring-2 ring-amber-400'
              : 'bg-amber-50/70 border-amber-200 shadow-2xs'
          }`}
        >
          <div className={`text-[10px] font-bold uppercase tracking-wider flex items-center justify-between ${
            statusFilter === 'In Progress' ? 'text-amber-300' : 'text-amber-800'
          }`}>
            <span>In Progress</span>
            <PlayCircle className={`w-3.5 h-3.5 ${statusFilter === 'In Progress' ? 'text-amber-300' : 'text-amber-600'}`} />
          </div>
          <div className={`text-2xl font-black mt-1 ${statusFilter === 'In Progress' ? 'text-amber-50' : 'text-amber-900'}`}>{inProgressCount}</div>
        </div>

        <div
          onClick={() => setStatusFilter('Pending')}
          className={`p-3.5 rounded-xl border transition cursor-pointer ${
            statusFilter === 'Pending'
              ? 'bg-purple-900 text-white border-purple-800 shadow-md ring-2 ring-purple-400'
              : 'bg-purple-50/70 border-purple-200 shadow-2xs'
          }`}
        >
          <div className={`text-[10px] font-bold uppercase tracking-wider flex items-center justify-between ${
            statusFilter === 'Pending' ? 'text-purple-300' : 'text-purple-700'
          }`}>
            <span>Pending</span>
            <Clock className={`w-3.5 h-3.5 ${statusFilter === 'Pending' ? 'text-purple-300' : 'text-purple-600'}`} />
          </div>
          <div className={`text-2xl font-black mt-1 ${statusFilter === 'Pending' ? 'text-purple-50' : 'text-purple-900'}`}>{pendingCount}</div>
        </div>

        <div
          onClick={() => setStatusFilter('Resolved')}
          className={`p-3.5 rounded-xl border transition cursor-pointer ${
            statusFilter === 'Resolved'
              ? 'bg-emerald-900 text-white border-emerald-800 shadow-md ring-2 ring-emerald-400'
              : 'bg-emerald-50/70 border-emerald-200 shadow-2xs'
          }`}
        >
          <div className={`text-[10px] font-bold uppercase tracking-wider flex items-center justify-between ${
            statusFilter === 'Resolved' ? 'text-emerald-300' : 'text-emerald-700'
          }`}>
            <span>Resolved</span>
            <CheckCircle2 className={`w-3.5 h-3.5 ${statusFilter === 'Resolved' ? 'text-emerald-300' : 'text-emerald-600'}`} />
          </div>
          <div className={`text-2xl font-black mt-1 ${statusFilter === 'Resolved' ? 'text-emerald-50' : 'text-emerald-900'}`}>{resolvedCount}</div>
        </div>
      </div>

      {/* Tickets Requiring IT Attention */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/60">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-600" />
              <span>Tickets Requiring IT Attention</span>
            </h3>
            <p className="text-xs text-slate-500">
              Active tickets needing triage, assignment, or resolution
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-xl text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-600"
            >
              <option value="ALL">All Branches</option>
              {branchesList.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          {attentionTickets.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs">
              No pending IT tickets require attention at this time.
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Ticket #</th>
                  <th className="py-3 px-4">Branch</th>
                  <th className="py-3 px-4">Subject</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Assigned To</th>
                  <th className="py-3 px-4">Submitted</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {attentionTickets.map((ticket) => (
                  <tr
                    key={ticket.id}
                    onClick={() => onNavigateTicketDetail(ticket.id)}
                    className="hover:bg-emerald-50/40 transition cursor-pointer group"
                  >
                    <td className="py-3 px-4 font-mono font-bold text-emerald-900 group-hover:underline">
                      #{ticket.id}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-800 whitespace-nowrap">
                      {ticket.branchName}
                    </td>
                    <td className="py-3 px-4 max-w-xs truncate font-medium text-slate-900">
                      {ticket.subject}
                    </td>
                    <td className="py-3 px-4 text-slate-600">{ticket.category}</td>
                    <td className="py-3 px-4">
                      <StatusBadge status={ticket.status} size="sm" />
                    </td>
                    <td className="py-3 px-4 text-slate-700 whitespace-nowrap">
                      {ticket.assignedToName || (
                        <span className="text-amber-700 font-semibold italic">Unassigned</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                      {ticket.createdAt}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onNavigateTicketDetail(ticket.id);
                        }}
                        className="px-2.5 py-1 rounded bg-emerald-900 text-white hover:bg-emerald-800 font-bold transition inline-flex items-center gap-1 cursor-pointer"
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
    </div>
  );
};
