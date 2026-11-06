import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Ticket,
  User,
  Comment as CommentType,
  TimelineEvent,
  TicketStatus
} from '../../types';
import { StatusBadge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Spinner';
import { Button } from '../../components/ui/Button';
import {
  ArrowLeft,
  CheckCircle2,
  UserCheck,
  Building,
  Send,
  Lock,
  MessageSquare,
  History,
  FileText,
  ShieldCheck,
  Paperclip,
  Check,
  Flag,
  Circle,
  PauseCircle,
  CheckCheck,
  Printer,
  ChevronRight,
  Trash2
} from 'lucide-react';
import { DeleteConfirmModal } from '../../components/admin/DeleteConfirmModal';

interface TicketDetailViewProps {
  ticket: Ticket;
  comments: CommentType[];
  timeline: TimelineEvent[];
  currentUser: User;
  allUsers?: User[];
  allTickets?: Ticket[];
  onNavigateBack: () => void;
  onUpdateStatus: (
    ticketId: string,
    status: TicketStatus,
    notes?: string,
  ) => void | Promise<void>;
  onAddComment: (
    ticketId: string,
    content: string,
    isInternal: boolean,
  ) => void | Promise<void>;
  onDeleteTicket?: (ticketId: string) => void | Promise<void>;
  onAssignTicket?: (ticketId: string, staffUserId: string) => void | Promise<void>;
}

export const TicketDetailView: React.FC<TicketDetailViewProps> = ({
  ticket,
  comments,
  timeline,
  currentUser,
  allUsers = [],
  allTickets = [],
  onNavigateBack,
  onUpdateStatus,
  onAddComment,
  onDeleteTicket,
  onAssignTicket,
}) => {
  const [commentText, setCommentText] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [resolutionText, setResolutionText] = useState('');
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [resolveSubmitting, setResolveSubmitting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingTicket, setDeletingTicket] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<TicketStatus>(ticket.status);
  const [statusSaving, setStatusSaving] = useState(false);
  const [pendingAssigneeId, setPendingAssigneeId] = useState<string | undefined>(ticket.assignedToId);
  const [assignmentSaving, setAssignmentSaving] = useState(false);

  // Keep the picker in sync when the ticket's saved status changes (e.g. after
  // a refresh) so the dropdown never shows a stale value.
  useEffect(() => {
    setPendingStatus(ticket.status);
  }, [ticket.status]);

  useEffect(() => {
    setPendingAssigneeId(ticket.assignedToId);
  }, [ticket.assignedToId]);

  const canDelete = Boolean(onDeleteTicket) && currentUser.role === 'ADMINISTRATOR';

  const handleDelete = async () => {
    if (!onDeleteTicket) return;
    setDeletingTicket(true);
    try {
      await onDeleteTicket(ticket.id);
    } finally {
      setDeletingTicket(false);
      setShowDeleteModal(false);
    }
  };

  const isITOrAdmin = currentUser.role === 'IT_STAFF' || currentUser.role === 'ADMINISTRATOR';
  const isAuditor = currentUser.role === 'AUDITOR';
  const isReadOnly = isAuditor;

  const filteredMentionUsers = allUsers.filter(
    (u) =>
      u.id !== currentUser.id &&
      (u.username.toLowerCase().includes(mentionQuery.toLowerCase()) ||
        u.name.toLowerCase().includes(mentionQuery.toLowerCase())),
  );

  const handleCommentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setCommentText(value);

    const lastAtIndex = value.lastIndexOf('@');
    if (lastAtIndex >= 0 && (lastAtIndex === 0 || value[lastAtIndex - 1] === ' ' || value[lastAtIndex - 1] === '\n')) {
      const query = value.slice(lastAtIndex + 1);
      if (!query.includes(' ') || query.length < 20) {
        setMentionQuery(query);
        setShowMentions(true);
        setMentionIndex(0);
        return;
      }
    }
    setShowMentions(false);
  };

  const insertMention = (user: User) => {
    const lastAtIndex = commentText.lastIndexOf('@');
    const before = commentText.slice(0, lastAtIndex);
    const after = commentText.slice(lastAtIndex + 1 + mentionQuery.length);
    setCommentText(`${before}@${user.username} ${after}`);
    setShowMentions(false);
  };

  const handleCommentKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showMentions || filteredMentionUsers.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setMentionIndex((i) => (i + 1) % filteredMentionUsers.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setMentionIndex((i) => (i - 1 + filteredMentionUsers.length) % filteredMentionUsers.length);
    } else if (e.key === 'Enter' && showMentions) {
      e.preventDefault();
      insertMention(filteredMentionUsers[mentionIndex]);
    } else if (e.key === 'Escape') {
      setShowMentions(false);
    }
  };

  // Branch users should not see internal IT comments; auditors (read-only) may view everything.
  const visibleComments = comments.filter((c) => {
    if (c.isInternal && !isITOrAdmin && !isAuditor) return false;
    return true;
  });

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || commentSubmitting) return;
    setCommentSubmitting(true);
    try {
      await onAddComment(ticket.id, commentText.trim(), isInternalNote);
      setCommentText('');
      setIsInternalNote(false);
    } catch {
      // Keep the comment text so the user can retry.
    } finally {
      setCommentSubmitting(false);
    }
  };

  const handleResolveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolutionText.trim() || resolveSubmitting) return;
    setResolveSubmitting(true);
    try {
      await onUpdateStatus(ticket.id, 'Resolved', resolutionText.trim());
      setShowResolveModal(false);
    } catch {
      // Leave the modal open so the user can retry.
    } finally {
      setResolveSubmitting(false);
    }
  };

  // Applies the status chosen in the picker. Resolving needs a note first, so
  // that selection hands off to the resolve modal; everything else is saved
  // here. Saving "In Progress" is what moves the ticket into the In Progress tab.
  const statusDirty = pendingStatus !== ticket.status;

  const handleSaveStatus = async () => {
    if (!statusDirty || statusSaving) return;
    if (pendingStatus === 'Resolved') {
      setShowResolveModal(true);
      return;
    }
    setStatusSaving(true);
    try {
      await onUpdateStatus(ticket.id, pendingStatus);
    } catch {
      // Leave the selection so the specialist can retry.
    } finally {
      setStatusSaving(false);
    }
  };

  const isAdmin = currentUser.role === 'ADMINISTRATOR';

  const assignableStaff = allUsers.filter(
    (u) =>
      (u.role === 'IT_STAFF' || u.role === 'ADMINISTRATOR') &&
      (isAdmin || (u.assignments ?? []).some(
        (a) => a.branchId === ticket.branchId && new Date(a.expiresAt) > new Date()
      ))
  );

  const openTicketsByStaff = new Map<string, number>();
  for (const t of allTickets) {
    if (t.status === 'In Progress' && t.assignedToId) {
      openTicketsByStaff.set(t.assignedToId, (openTicketsByStaff.get(t.assignedToId) ?? 0) + 1);
    }
  }

  const assignmentDirty = pendingAssigneeId !== ticket.assignedToId;

  const handleSaveAssignment = async () => {
    if (!assignmentDirty || assignmentSaving || !onAssignTicket) return;
    setAssignmentSaving(true);
    try {
      await onAssignTicket(ticket.id, pendingAssigneeId);
    } catch {
      // Leave the selection so the admin can retry.
    } finally {
      setAssignmentSaving(false);
    }
  };

  // STATUS STEPPER CONFIG — the two-stage lifecycle a ticket travels through.
  const statusSteps: { key: TicketStatus; label: string; color: string; activeColor: string }[] = [
    { key: 'In Progress', label: 'In Progress', color: 'bg-amber-500', activeColor: 'text-amber-700' },
    { key: 'Resolved', label: 'Resolved', color: 'bg-emerald-500', activeColor: 'text-emerald-700' },
  ];
  const currentStepIndex = statusSteps.findIndex((s) => s.key === ticket.status);

  // STATUS ACCENT COLOR — used for the card's left border.
  const statusAccent: Record<string, string> = {
    'In Progress': 'border-l-amber-500',
    'Resolved': 'border-l-emerald-500',
  };

  // TIMELINE NODE COLOR — color-codes each event by its type.
  const timelineNodeColor: Record<string, { bg: string; text: string; border: string }> = {
    creation: { bg: 'bg-slate-500', text: 'text-slate-600', border: 'border-slate-300' },
    system: { bg: 'bg-slate-500', text: 'text-slate-600', border: 'border-slate-300' },
    assignment: { bg: 'bg-indigo-500', text: 'text-indigo-700', border: 'border-indigo-200' },
    status_change: { bg: 'bg-amber-500', text: 'text-amber-700', border: 'border-amber-200' },
    comment: { bg: 'bg-blue-500', text: 'text-blue-700', border: 'border-blue-200' },
    resolution: { bg: 'bg-emerald-500', text: 'text-emerald-700', border: 'border-emerald-200' },
    confirmation: { bg: 'bg-emerald-500', text: 'text-emerald-700', border: 'border-emerald-200' },
  };

  const getNodeStyle = (type: string) => timelineNodeColor[type] ?? timelineNodeColor['system'];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Navigation Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden">
        <div className="flex flex-col gap-1">
          {/* Breadcrumbs */}
          <nav className="flex items-center gap-1.5 text-xs text-slate-500" aria-label="Breadcrumb">
            <button type="button"
              onClick={onNavigateBack}
              className="hover:text-emerald-700 transition cursor-pointer font-medium"
            >
              Ticket Queue
            </button>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
            <span className="flex items-center gap-1 text-slate-400">
              <FileText className="w-3.5 h-3.5" />
              <span className="truncate max-w-[16rem]">{ticket.subject}</span>
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300 hidden sm:block" />
            <span className="hidden sm:inline-flex font-mono text-emerald-700 font-bold">#{ticket.id}</span>
          </nav>

          <button type="button"
            onClick={onNavigateBack}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition cursor-pointer self-start"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Ticket Queue</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {canDelete && (
            <button type="button"
              onClick={() => setShowDeleteModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold rounded-xl transition cursor-pointer"
              title="Permanently delete this ticket"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </button>
          )}
          <button type="button"
            onClick={() => window.print()}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition cursor-pointer"
            title="Print-friendly ticket record"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print</span>
          </button>
          <span className="text-xs text-slate-500 font-mono">
            Ticket ID: <strong className="text-slate-900 font-bold">#{ticket.id}</strong>
          </span>
          <StatusBadge status={ticket.status} size="sm" />
        </div>
      </div>

      {/* RESOLVED NOTICE */}
      {ticket.status === 'Resolved' && (
        <div className="bg-emerald-900 text-white rounded-2xl p-5 sm:p-6 shadow-lg border border-emerald-700">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-300 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-lg font-bold">Ticket Resolved by Main IT</h3>
              <p className="text-xs text-emerald-100 mt-1 leading-relaxed">
                IT Specialist has recorded resolution: &quot;
                <strong className="text-white italic">{ticket.resolutionNotes || 'Request handled.'}</strong>
                &quot;. No further action is required.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* STATUS STEPPER — horizontal progress indicator of the ticket's journey */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Flag className="w-3.5 h-3.5 text-slate-400" />
            Ticket Journey
          </span>
          <span className="text-[10px] font-mono text-slate-400">
            Current: <strong className="text-slate-700">{ticket.status}</strong>
          </span>
        </div>
        <div className="flex items-center">
          {statusSteps.map((step, i) => {
            const isReached = currentStepIndex >= i;
            const isCurrent = i === currentStepIndex;
            return (
              <React.Fragment key={step.key}>
                <div className="flex flex-col items-center flex-1 min-w-0">
                  <div
                    className={`flex items-center justify-center rounded-full transition h-8 w-8 border-2 ${
                      isCurrent
                        ? `${step.color} border-white shadow-md ring-2 ring-offset-1 ${step.color} ring-offset-white`
                        : isReached
                        ? `${step.color} border-white shadow-sm`
                        : 'bg-white border-slate-300'
                    }`}
                  >
                    {isReached ? (
                      <Check className={`w-4 h-4 ${isCurrent ? 'text-white' : 'text-white'}`} />
                    ) : (
                      <Circle className="w-4 h-4 text-slate-300" />
                    )}
                  </div>
                  <span
                    className={`mt-1.5 text-center text-[10px] font-semibold leading-tight truncate w-full ${
                      isCurrent ? step.activeColor : isReached ? 'text-slate-700' : 'text-slate-400'
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
                {i < statusSteps.length - 1 && (
                  <div className="flex-1 relative top-[-13px] mx-1 sm:mx-2 h-0.5 rounded-full overflow-hidden bg-slate-200">
                    <div
                      className={`h-full ${step.color} transition-all duration-500 ${
                        currentStepIndex > i ? 'opacity-100' : 'opacity-0'
                      }`}
                    />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Main Ticket Summary Card */}
      <div className={`bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden border-l-4 ${statusAccent[ticket.status] ?? 'border-l-slate-300'}`}>
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
        <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-md border border-slate-800 space-y-4 print:hidden">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold tracking-wide uppercase text-amber-400 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" />
              IT Management Toolbar (Main IT Department)
            </h3>
            <span className="text-[10px] text-slate-400 font-mono">IT Specialist Controls</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Assign IT Specialist (Admin only) */}
            {currentUser.role === 'ADMINISTRATOR' && onAssignTicket && assignableStaff.length > 0 && ticket.status !== 'Resolved' && (
              <div className="sm:col-span-3">
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Assign IT Specialist:
                </label>
                <div className="flex flex-wrap items-center gap-3">
                  <select
                    value={pendingAssigneeId ?? ''}
                    onChange={(e) => setPendingAssigneeId(e.target.value || undefined)}
                    className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs font-medium text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  >
                    <option value="">— Unassign —</option>
                    {assignableStaff.map((staff) => {
                      const openCount = openTicketsByStaff.get(staff.id) ?? 0;
                      const coversBranch = (staff.assignments ?? []).some(
                        (a) => a.branchId === ticket.branchId && new Date(a.expiresAt) > new Date()
                      );
                      const branchNames = staff.assignments
                        ?.filter((a) => new Date(a.expiresAt) > new Date())
                        .map((a) => a.branchName)
                        .join(', ') ?? 'No branch';
                      return (
                        <option key={staff.id} value={staff.id}>
                          {staff.name} (Open: {openCount}) — {branchNames}{coversBranch ? '' : ' (outside branch)'}
                        </option>
                      );
                    })}
                  </select>

                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    onClick={handleSaveAssignment}
                    disabled={!assignmentDirty || assignmentSaving}
                    className="shrink-0"
                  >
                    {assignmentSaving ? (
                      <>
                        <Spinner />
                        <span>Saving…</span>
                      </>
                    ) : (
                      <>
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>Assign</span>
                      </>
                    )}
                  </Button>
                </div>

                {assignmentDirty ? (
                  <p className="text-[11px] text-amber-300 mt-2">
                    Unsaved change — click <strong>Assign</strong> to reassign this ticket to{' '}
                    <strong>{assignableStaff.find((s) => s.id === pendingAssigneeId)?.name ?? 'Unassigned'}</strong>.
                  </p>
                ) : (
                  <p className="text-[11px] text-slate-400 mt-2">
                    Select an IT specialist. Admins can assign to any IT staff; those not covering this branch ({ticket.branchName}) are marked "(outside branch)".
                  </p>
                )}
              </div>
            )}

            {/* Change Status */}
            <div className="sm:col-span-3">
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Update Status:
              </label>
              <div className="flex flex-wrap items-center gap-3">
                <select
                  value={pendingStatus}
                  onChange={(e) => setPendingStatus(e.target.value as TicketStatus)}
                  className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs font-medium text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                >
                  <option value="In Progress">In Progress</option>
                  <option value="Resolved">Resolved</option>
                </select>

                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  onClick={handleSaveStatus}
                  disabled={!statusDirty || statusSaving}
                  className="shrink-0"
                >
                  {statusSaving ? (
                    <>
                      <Spinner />
                      <span>Saving…</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Save</span>
                    </>
                  )}
                </Button>
              </div>

              {statusDirty ? (
                <p className="text-[11px] text-amber-300 mt-2">
                  Unsaved change — click <strong>Save</strong> to move this ticket to the{' '}
                  <strong>{pendingStatus}</strong> queue.
                </p>
              ) : (
                <p className="text-[11px] text-slate-400 mt-2">
                  Saving to <strong>In Progress</strong> moves this ticket to the In Progress tab.
                </p>
              )}
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
            <div className="space-y-4 max-h-96 overflow-y-auto pr-1 print:max-h-none print:overflow-visible">
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
              <div className="pt-3 border-t border-slate-200 print:hidden">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-500 flex items-center gap-2">
                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                  <span>
                    <strong className="text-slate-700">Read-Only Access:</strong> Auditor accounts can only
                    view tickets, comments, and audit logs. Posting comments is disabled.
                  </span>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCommentSubmit} className="space-y-3 pt-3 border-t border-slate-200 print:hidden">
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Add a Comment or Update
                </label>
                <div className="relative">
                  <textarea
                    rows={3}
                    required
                    value={commentText}
                    onChange={handleCommentChange}
                    onKeyDown={handleCommentKeyDown}
                    onBlur={() => setTimeout(() => setShowMentions(false), 200)}
                    placeholder="Type your message or response... (Use @ to mention someone)"
                    className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:bg-white transition"
                  />
                  {showMentions && filteredMentionUsers.length > 0 && (
                    <div className="absolute bottom-full left-0 mb-1 w-64 bg-white border border-slate-200 rounded-xl shadow-lg z-10 max-h-40 overflow-y-auto">
                      {filteredMentionUsers.slice(0, 6).map((user, idx) => (
                        <button
                          key={user.id}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            insertMention(user);
                          }}
                          className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-xs cursor-pointer ${
                            idx === mentionIndex
                              ? 'bg-emerald-50 text-emerald-900'
                              : 'hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 text-[10px] font-bold">
                            {user.name.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold truncate">{user.name}</div>
                            <div className="text-[10px] text-slate-400 font-mono">@{user.username}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

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

                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    disabled={commentSubmitting}
                    className="flex items-center gap-1.5 ml-auto"
                  >
                    {commentSubmitting ? (
                      <>
                        <Spinner />
                        <span>Posting…</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>Post Comment</span>
                      </>
                    )}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Right Column: Ticket Activity Timeline */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center">
                  <History className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Ticket Timeline</h3>
                  <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Audit Trace</span>
                </div>
              </div>
              <span className="text-[10px] text-slate-400 font-mono self-start sm:self-center">{timeline.length} event{timeline.length !== 1 ? 's' : ''}</span>
            </div>

            <div className="relative pl-6 space-y-5 before:absolute before:left-[9px] before:top-2 before:bottom-2 before:w-0.5 before:bg-gradient-to-b before:from-slate-200 before:via-slate-100 before:to-slate-200">
              {timeline.map((event, i) => {
                const node = getNodeStyle(event.type);
                const isLast = i === timeline.length - 1;
                const eventIcons = {
                  creation: <Circle className="w-3 h-3 text-white" fill="currentColor" />,
                  assignment: <UserCheck className="w-3 h-3 text-white" />,
                  status_change: <PauseCircle className="w-3 h-3 text-white" />,
                  resolution: <CheckCircle2 className="w-3 h-3 text-white" />,
                  comment: <MessageSquare className="w-3 h-3 text-white" />,
                  confirmation: <CheckCheck className="w-3 h-3 text-white" />,
                  system: <Circle className="w-3 h-3 text-white" fill="currentColor" />,
                };
                return (
                  <motion.div
                    key={event.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.15 + i * 0.04, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                    className="relative"
                  >
                    {/* Timeline Connector */}
                    <div className="absolute left-[1px] top-0 bottom-0 w-0.5 bg-slate-100" />
                    {/* Timeline Node */}
                    <div className="absolute left-[1px] top-0.5 flex items-center justify-center">
                      <span
                        className={`w-[20px] h-[20px] rounded-full ${node.bg} border-3 border-white shadow-sm flex items-center justify-center relative z-10 ${isLast ? 'ring-2 ring-slate-100 ring-offset-2 ring-offset-white' : ''}`}
                      >
                        {eventIcons[event.type] ?? <Circle className="w-3 h-3 text-white" fill="currentColor" />}
                      </span>
                    </div>

                    {/* Content Card */}
                    <div className="pl-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-col sm:flex-row sm:items-baseline gap-2 flex-wrap">
                            <span className={`font-semibold text-sm ${node.text}`}>{event.action}</span>
                            <span className="text-[10px] text-slate-400 font-mono font-medium whitespace-nowrap">
                              {event.timestamp}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-slate-400 flex-wrap">
                            <span className="font-medium text-slate-500">{event.actorName}</span>
                            <span className="text-slate-300">•</span>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                                event.actorRole === 'ADMINISTRATOR' ? 'bg-purple-50 text-purple-700' :
                                event.actorRole === 'IT_STAFF' ? 'bg-amber-50 text-amber-700' :
                                event.actorRole === 'BRANCH_USER' ? 'bg-slate-50 text-slate-700' :
                                'bg-teal-50 text-teal-700'
                              }`}
                            >
                              {event.actorRole}
                            </span>
                          </div>
                        </div>
                      </div>
                      {event.details && (
                        <div
                          className={`mt-2.5 p-3 rounded-lg border bg-slate-50 ${node.border} animate-fade-in`}
                          style={{ animationDelay: `${0.15 + i * 0.04}s` }}
                        >
                          <div className="flex items-center gap-1.5 text-[10px] font-medium mb-1">
                            <span className={`text-xs font-bold ${node.text}`}>Details</span>
                          </div>
                          <div className="text-[11px] text-slate-700 leading-relaxed whitespace-pre-wrap break-words">
                            {event.details}
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
            {timeline.length === 0 && (
              <div className="text-center py-8 text-slate-400">
                <History className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                <p className="text-sm font-medium text-slate-500">No timeline events yet</p>
                <p className="text-[11px] text-slate-400 mt-1">Events will appear here as the ticket progresses</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* RESOLUTION RECORD MODAL FOR IT STAFF */}
      <AnimatePresence>
      {showResolveModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs p-4 flex overflow-y-auto"
          onClick={() => setShowResolveModal(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl max-w-md w-full p-6 m-auto shadow-2xl border border-slate-200 space-y-4"
          >
            <div className="flex items-center gap-2 text-emerald-900 font-bold text-base">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span>Record IT Resolution Notes</span>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Please enter the technical resolution details. The requesting branch will be notified that the ticket is resolved.
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
                <Button
                  type="submit"
                  variant="primary"
                  disabled={resolveSubmitting}
                >
                  {resolveSubmitting ? (
                    <>
                      <Spinner />
                      <span>Resolving…</span>
                    </>
                  ) : (
                    "Mark as Resolved"
                  )}
                </Button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>

      {showDeleteModal && canDelete && (
        <DeleteConfirmModal
          target={{
            type: 'ticket',
            id: ticket.id,
            name: ticket.subject,
            meta: `${ticket.id} · ${ticket.branchName}`,
          }}
          onClose={() => setShowDeleteModal(false)}
          onConfirm={() => void handleDelete()}
        />
      )}
    </div>
  );
};
