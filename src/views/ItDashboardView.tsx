import React, { useState } from 'react';
import { Ticket, User } from '../types';
import { StatusBadge, PriorityBadge, SlaBadge } from '../components/Badge';
import { slaStatusFor } from '../services/store';
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
  AlarmClockOff,
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

  const totalCount = tickets.length;
  const newCount = tickets.filter((t) => t.status === 'New').length;
  const assignedCount = tickets.filter((t) => t.status === 'Assigned').length;
  const inProgressCount = tickets.filter((t) => t.status === 'In Progress').length;
  const pendingCount = tickets.filter((t) => t.status === 'Pending').length;
  const resolvedCount = tickets.filter((t) => t.status === 'Resolved').length;
  const criticalCount = tickets.filter((t) => t.priority === 'Critical' && t.status !== 'Closed').length;
  const slaBreachedCount = tickets.filter((t) => slaStatusFor(t) === 'breached').length;

  // Branch names list
  const branchesList = Array.from(new Set(tickets.map((t) => t.branchName)));

  // Tickets requiring immediate IT attention
  const attentionTickets = tickets.filter((t) => {
    const isUnclosed = t.status !== 'Closed' && t.status !== 'Cancelled';
    const matchesBranch = branchFilter === 'ALL' || t.branchName === branchFilter;
    return isUnclosed && matchesBranch;
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
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl transition shadow-md flex items-center gap-2 cursor-pointer self-start md:self-auto"
        >
          <span>View All IT Queue</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-8 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
            <span>Total</span>
            <TicketIcon className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className="text-2xl font-black text-slate-900 mt-1">{totalCount}</div>
        </div>

        <div className="bg-blue-50/70 p-3.5 rounded-xl border border-blue-200 shadow-2xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-blue-700 flex items-center justify-between">
            <span>New</span>
            <AlertCircle className="w-3.5 h-3.5 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-blue-900 mt-1">{newCount}</div>
        </div>

        <div className="bg-indigo-50/70 p-3.5 rounded-xl border border-indigo-200 shadow-2xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 flex items-center justify-between">
            <span>Assigned</span>
            <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
          </div>
          <div className="text-2xl font-black text-indigo-900 mt-1">{assignedCount}</div>
        </div>

        <div className="bg-amber-50/70 p-3.5 rounded-xl border border-amber-200 shadow-2xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-amber-800 flex items-center justify-between">
            <span>In Progress</span>
            <PlayCircle className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-900 mt-1">{inProgressCount}</div>
        </div>

        <div className="bg-purple-50/70 p-3.5 rounded-xl border border-purple-200 shadow-2xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-purple-700 flex items-center justify-between">
            <span>Pending</span>
            <Clock className="w-3.5 h-3.5 text-purple-600" />
          </div>
          <div className="text-2xl font-black text-purple-900 mt-1">{pendingCount}</div>
        </div>

        <div className="bg-emerald-50/70 p-3.5 rounded-xl border border-emerald-200 shadow-2xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 flex items-center justify-between">
            <span>Resolved</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-900 mt-1">{resolvedCount}</div>
        </div>

        <div className="bg-red-50/70 p-3.5 rounded-xl border border-red-200 shadow-2xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-red-700 flex items-center justify-between">
            <span>Critical</span>
            <ShieldAlert className="w-3.5 h-3.5 text-red-600" />
          </div>
          <div className="text-2xl font-black text-red-900 mt-1">{criticalCount}</div>
        </div>

        <div className={`p-3.5 rounded-xl border shadow-2xs ${slaBreachedCount > 0 ? 'bg-red-100/80 border-red-300' : 'bg-slate-50/70 border-slate-200'}`}>
          <div className="text-[10px] font-bold uppercase tracking-wider text-red-700 flex items-center justify-between">
            <span>SLA Breached</span>
            <AlarmClockOff className="w-3.5 h-3.5 text-red-600" />
          </div>
          <div className={`text-2xl font-black mt-1 ${slaBreachedCount > 0 ? 'text-red-900' : 'text-slate-500'}`}>{slaBreachedCount}</div>
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
              className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-xl text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600"
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
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">SLA</th>
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
                    className="hover:bg-blue-50/40 transition cursor-pointer group"
                  >
                    <td className="py-3 px-4 font-mono font-bold text-blue-900 group-hover:underline">
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
                      <PriorityBadge priority={ticket.priority} size="sm" />
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={ticket.status} size="sm" />
                    </td>
                    <td className="py-3 px-4">
                      <SlaBadge ticket={ticket} size="sm" />
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
                        className="px-2.5 py-1 rounded bg-blue-900 text-white hover:bg-blue-800 font-bold transition inline-flex items-center gap-1 cursor-pointer"
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
