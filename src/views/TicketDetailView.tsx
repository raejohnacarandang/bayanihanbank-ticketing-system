import React, { useState } from 'react';
import {
  Ticket,
  User,
  Comment as CommentType,
  TimelineEvent,
  TicketStatus
} from '../types';
import { StatusBadge } from '../components/Badge';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  UserCheck,
  Building,
  Send,
  Lock,
  MessageSquare,
  History,
  FileText,
  AlertTriangle,
  ShieldCheck,
  Paperclip,
  Check
} from 'lucide-react';

interface TicketDetailViewProps {
  ticket: Ticket;
  comments: CommentType[];
  timeline: TimelineEvent[];
  currentUser: User;
  onNavigateBack: () => void;
  onUpdateStatus: (ticketId: string, status: TicketStatus, notes?: string) => void;
  onAddComment: (ticketId: string, content: string, isInternal: boolean) => void;
}

export const TicketDetailView: React.FC<TicketDetailViewProps> = ({
  ticket,
  comments,
  timeline,
  currentUser,
  onNavigateBack,
  onUpdateStatus,
  onAddComment,
}) => {
  const [commentText, setCommentText] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [resolutionText, setResolutionText] = useState('');
  const [showResolveModal, setShowResolveModal] = useState(false);

  const isITOrAdmin = currentUser.role === 'IT_STAFF' || currentUser.role === 'ADMINISTRATOR';
  const isBranchUser = currentUser.role === 'BRANCH_USER';
  const isAuditor = currentUser.role === 'AUDITOR';
  const isReadOnly = isAuditor;

  // Branch users should not see internal IT comments; auditors (read-only) may view everything.
  const visibleComments = comments.filter((c) => {
    if (c.isInternal && !isITOrAdmin && !isAuditor) return false;
    return true;
  });

  const handleCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    onAddComment(ticket.id, commentText.trim(), isInternalNote);
    setCommentText('');
    setIsInternalNote(false);
  };

  const handleResolveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolutionText.trim()) return;
    onUpdateStatus(ticket.id, 'Resolved', resolutionText.trim());
    setShowResolveModal(false);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Navigation Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <button
          onClick={onNavigateBack}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition cursor-pointer self-start"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Ticket Queue</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-mono">
            Ticket ID: <strong className="text-slate-900 font-bold">#{ticket.id}</strong>
          </span>
          <StatusBadge status={ticket.status} size="sm" />
        </div>
      </div>

      {/* BRANCH CONFIRMATION PROMPT BANNER (PROPOSED WORKFLOW) */}
      {ticket.status === 'Resolved' && (
        <div className="bg-emerald-900 text-white rounded-2xl p-5 sm:p-6 shadow-lg border border-emerald-700 space-y-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-300 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-lg font-bold">Ticket Resolved by Main IT</h3>
              <p className="text-xs text-emerald-100 mt-1 leading-relaxed">
                IT Specialist has recorded resolution: &quot;
                <strong className="text-white italic">{ticket.resolutionNotes || 'Request handled.'}</strong>
                &quot;. Please confirm whether the issue has been resolved at your branch.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-emerald-800">
            {isBranchUser && (
              <>
                <button
                  onClick={() => onUpdateStatus(ticket.id, 'Closed', 'Branch confirmed resolution.')}
                  className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl transition shadow-md flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Confirm Resolution (Close Ticket)</span>
                </button>
              </>
            )}

            <span className="text-[10px] text-emerald-300 italic ml-auto">
              PROPOSED WORKFLOW DEMONSTRATION
            </span>
          </div>
        </div>
      )}

      {/* Main Ticket Summary Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Ticket Header & Subject */}
        <div className="p-6 border-b border-slate-200 bg-slate-900 text-white space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-emerald-300 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
                #{ticket.id}
              </span>
              <span className="text-xs font-semibold text-slate-300">
                {ticket.category}
                {ticket.subcategory && (
                  <span className="ml-2 text-[10px] font-mono text-emerald-300 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
                    {ticket.subcategory}
                  </span>
                )}
              </span>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">
              Submitted: {ticket.createdAt}
            </span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-white">{ticket.subject}</h1>
        </div>

        {/* Metadata Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-6 bg-slate-50 border-b border-slate-200 text-xs">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Requesting Branch
            </span>
            <span className="font-bold text-slate-900 mt-0.5 block flex items-center gap-1">
              <Building className="w-3.5 h-3.5 text-emerald-600" />
              {ticket.branchName}
            </span>
          </div>

          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Requester
            </span>
            <span className="font-semibold text-slate-800 mt-0.5 block">
              {ticket.requesterName}
            </span>
          </div>

          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Category
            </span>
            <span className="font-bold text-slate-900 mt-0.5 block">
              {ticket.category}
            </span>
          </div>

          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Subcategory
            </span>
            <span className="font-semibold text-slate-800 mt-0.5 block">
              {ticket.subcategory || '—'}
            </span>
          </div>

          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Assigned IT Specialist
            </span>
            <span className="font-semibold text-slate-800 mt-0.5 block">
              {ticket.assignedToName ? (
                <span className="text-emerald-900 font-bold flex items-center gap-1">
                  <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                  {ticket.assignedToName}
                </span>
              ) : (
                <span className="text-amber-700 italic">Unassigned</span>
              )}
            </span>
          </div>

          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Last Updated
            </span>
            <span className="font-medium text-slate-600 mt-0.5 block">
              {ticket.updatedAt}
            </span>
          </div>
        </div>

        {/* Description Body & Attachment */}
        <div className="p-6 space-y-4">
          <div>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Problem Description
            </h3>
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-slate-800 text-sm leading-relaxed whitespace-pre-line">
              {ticket.description}
            </div>
          </div>

          {ticket.attachments && ticket.attachments.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Attached Files
              </h3>
              <div className="flex flex-wrap gap-2">
                {ticket.attachments.map((att) => (
                  <div
                    key={att.id}
                    className="p-2.5 bg-emerald-50/80 border border-emerald-200 rounded-lg text-xs font-medium text-emerald-900 flex items-center gap-2"
                  >
                    <Paperclip className="w-4 h-4 text-emerald-600" />
                    <span>{att.filename}</span>
                    <span className="text-[10px] text-slate-400">({att.filesize})</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {ticket.resolutionNotes && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1">
              <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5 uppercase tracking-wider">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Recorded Resolution
              </span>
              <p className="text-xs text-slate-800 leading-relaxed font-medium">
                {ticket.resolutionNotes}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* IT MANAGEMENT CONTROLS BAR (FOR IT STAFF / ADMIN) */}
      {isITOrAdmin && (
        <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-md border border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold tracking-wide uppercase text-amber-400 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" />
              IT Management Toolbar (Main IT Department)
            </h3>
            <span className="text-[10px] text-slate-400 font-mono">IT Specialist Controls</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Change Status */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Update Status:
              </label>
              <select
                value={ticket.status}
                onChange={(e) => {
                  const val = e.target.value as TicketStatus;
                  if (val === 'Resolved') {
                    setShowResolveModal(true);
                  } else {
                    onUpdateStatus(ticket.id, val);
                  }
                }}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs font-medium text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
              >
                <option value="Assigned">Assigned</option>
                <option value="In Progress">In Progress</option>
                <option value="Pending">Pending</option>
                <option value="Resolved">Resolved</option>
                <option value="Closed">Closed</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* GRID: COMMENTS & TIMELINE */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Comments Thread & Add Comment */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-emerald-600" />
                <span>Conversation & Progress Notes</span>
              </h3>
              <span className="text-xs font-semibold text-slate-500">
                {visibleComments.length} comments
              </span>
            </div>

            {/* Comments Stream */}
            <div className="space-y-4 max-h-96 overflow-y-auto pr-1">
              {visibleComments.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-xs">
                  No public comments on this ticket yet.
                </div>
              ) : (
                visibleComments.map((c) => (
                  <div
                    key={c.id}
                    className={`p-4 rounded-xl border ${
                      c.isInternal
                        ? 'bg-amber-50/80 border-amber-300 text-amber-950'
                        : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-900">{c.authorName}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">
                          {c.authorRole}
                        </span>
                        {c.isInternal && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-200 text-amber-900 flex items-center gap-1">
                            <Lock className="w-3 h-3" />
                            Internal IT Note
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400">{c.timestamp}</span>
                    </div>
                    <p className="text-xs leading-relaxed whitespace-pre-line">{c.content}</p>
                  </div>
                ))
              )}
            </div>

            {/* Add Comment Form */}
            {isReadOnly ? (
              <div className="pt-3 border-t border-slate-200">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-500 flex items-center gap-2">
                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                  <span>
                    <strong className="text-slate-700">Read-Only Access:</strong> Auditor accounts can only
                    view tickets, comments, and audit logs. Posting comments is disabled.
                  </span>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCommentSubmit} className="space-y-3 pt-3 border-t border-slate-200">
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Add a Comment or Update
                </label>
                <textarea
                  rows={3}
                  required
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Type your message or response..."
                  className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:bg-white transition"
                />

                <div className="flex flex-wrap items-center justify-between gap-3">
                  {isITOrAdmin ? (
                    <label className="flex items-center gap-2 text-xs font-semibold text-amber-900 bg-amber-50 px-2.5 py-1 rounded border border-amber-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isInternalNote}
                        onChange={(e) => setIsInternalNote(e.target.checked)}
                        className="rounded text-amber-600 focus:ring-amber-500"
                      />
                      <Lock className="w-3.5 h-3.5 text-amber-600" />
                      <span>Internal IT Note — Not visible to Branch User</span>
                    </label>
                  ) : (
                    <span className="text-[11px] text-slate-400 italic">
                      Comments are visible to Main IT Specialist.
                    </span>
                  )}

                  <button
                    type="submit"
                    className="px-5 py-2 bg-emerald-900 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl transition shadow-sm flex items-center gap-1.5 ml-auto cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Post Comment</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Right Column: Ticket Activity Timeline */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <History className="w-4 h-4 text-slate-600" />
                <span>Ticket Timeline</span>
              </h3>
              <span className="text-[10px] text-slate-400 font-mono">Audit Trace</span>
            </div>

            <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
              {timeline.map((event) => (
                <div key={event.id} className="relative text-xs">
                  {/* Timeline Dot Indicator */}
                  <div className="absolute -left-6 top-0.5 w-3 h-3 rounded-full bg-emerald-600 border-2 border-white shadow-xs" />

                  <div className="font-bold text-slate-900">{event.action}</div>
                  <div className="text-[10px] text-slate-500">
                    By {event.actorName} ({event.actorRole}) • {event.timestamp}
                  </div>
                  {event.details && (
                    <div className="text-[11px] text-slate-600 mt-1 bg-slate-50 p-2 rounded border border-slate-200/80">
                      {event.details}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* RESOLUTION RECORD MODAL FOR IT STAFF */}
      {showResolveModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs p-4 flex overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 m-auto shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-2 text-emerald-900 font-bold text-base">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span>Record IT Resolution Notes</span>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Please enter the technical resolution details. The requesting branch will be notified to test and confirm the resolution.
            </p>

            <form onSubmit={handleResolveSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
                  Resolution Summary <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={4}
                  required
                  value={resolutionText}
                  onChange={(e) => setResolutionText(e.target.value)}
                  placeholder="e.g. Printer driver reinstalled and network printer configuration corrected."
                  className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowResolveModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-bold text-xs rounded-lg hover:bg-slate-200 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg transition shadow-md"
                >
                  Mark as Resolved
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
