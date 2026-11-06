import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  BookOpen,
  ChevronDown,
  FileText,
  Workflow,
  Shield,
  Phone,
  Users,
  ArrowRight,
  CheckCircle2,
  Clock,
  AlertTriangle,
  MessageSquare,
  Settings,
} from 'lucide-react';

interface GuideSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  content: string[];
  iconColor: string;
}

const GUIDES: GuideSection[] = [
  {
    id: 'workflow',
    title: 'Ticket Workflow Overview',
    icon: <Workflow className="w-5 h-5" />,
    iconColor: 'bg-emerald-100 text-emerald-700',
    content: [
      '1. Branch User submits an IT request via "New IT Request"',
      '2. System generates a unique ticket number (e.g. IT-000125)',
      '3. Ticket is auto-assigned to an IT Specialist (or assigned by an Administrator)',
      '4. IT Specialist reviews the ticket while it is "In Progress"',
      '5. IT Specialist adds comments/notes as work progresses',
      '6. IT Specialist marks ticket as "Resolved" with resolution notes',
      '7. "Resolved" is final — if the problem returns, submit a new ticket referencing the original',
    ],
  },
  {
    id: 'escalation',
    title: 'Escalation Rules',
    icon: <AlertTriangle className="w-5 h-5" />,
    iconColor: 'bg-amber-100 text-amber-700',
    content: [
      'Priority Level 1 (Critical): System-wide outage — escalate immediately to IT Manager',
      'Priority Level 2 (High): Branch operations halted — resolve within 4 hours',
      'Priority Level 3 (Medium): Degraded service — resolve within 24 hours',
      'Priority Level 4 (Low): General inquiry — resolve within 48 hours',
      'If a ticket is not resolved within SLA, it is automatically flagged for escalation',
      'Escalated tickets are visible to Administrators in the dashboard',
    ],
  },
  {
    id: 'roles',
    title: 'User Roles & Permissions',
    icon: <Users className="w-5 h-5" />,
    iconColor: 'bg-purple-100 text-purple-700',
    content: [
      'Branch User: Submit tickets, view own branch tickets, track resolution progress',
      'IT Specialist: View all tickets, assign tickets, update status, add internal notes',
      'Administrator: Full access — manage users, branches, categories, assignments',
      'Auditor: Read-only access — view tickets, comments, and audit logs',
      'Branch Users cannot see internal IT notes or other branches\' tickets',
      'Auditors cannot post comments or make any changes',
    ],
  },
  {
    id: 'comments',
    title: 'Communication & Comments',
    icon: <MessageSquare className="w-5 h-5" />,
    iconColor: 'bg-sky-100 text-sky-700',
    content: [
      'Public comments are visible to all parties on the ticket',
      'Internal IT Notes (🔒) are visible only to IT Specialists and Administrators',
      'Use @username to mention team members and send them a notification',
      'All comments are timestamped and included in the ticket timeline',
      'Attachments can be added to comments for screenshots or documentation',
    ],
  },
  {
    id: 'notifications',
    title: 'Notifications Guide',
    icon: <Settings className="w-5 h-5" />,
    iconColor: 'bg-pink-100 text-pink-700',
    content: [
      'Real-time in-app notifications for ticket updates and mentions',
      'Bell icon in header shows unread notification count',
      'Click "Notifications" in sidebar to view all notifications',
      'Notifications are marked as read when you open the notification center',
      'Push notifications available when browser permission is granted',
    ],
  },
  {
    id: 'contacts',
    title: 'IT Helpdesk Contacts',
    icon: <Phone className="w-5 h-5" />,
    iconColor: 'bg-red-100 text-red-700',
    content: [
      'Main IT Department: Available during business hours (8:00 AM - 5:00 PM)',
      'For urgent system outages: Call the IT Emergency Hotline',
      'For account/access issues: Submit a ticket under "Account & Access" category',
      'For password resets: Use "Forgot Password?" on the login page',
      'For general IT inquiries: Submit a ticket under "Other IT Concern" category',
    ],
  },
];

export const KnowledgeBaseView: React.FC = () => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-emerald-600" />
          Knowledge Base
        </h1>
        <p className="text-sm text-slate-500">
          Step-by-step guides for using the Bayanihan Bank IT Service Desk
        </p>
      </div>

      {/* Quick Status */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: <FileText className="w-4 h-4" />, label: 'Guides', value: GUIDES.length },
          { icon: <Workflow className="w-4 h-4" />, label: 'Steps', value: '40+' },
          { icon: <Users className="w-4 h-4" />, label: 'Roles', value: '4' },
          { icon: <CheckCircle2 className="w-4 h-4" />, label: 'Categories', value: '7' },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-white rounded-xl border border-slate-200 p-3 flex items-center gap-3"
          >
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              {stat.icon}
            </div>
            <div>
              <div className="text-lg font-black text-slate-900">
                {stat.value}
              </div>
              <div className="text-[10px] text-slate-500 font-medium">
                {stat.label}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Guide Sections */}
      <div className="space-y-3">
        {GUIDES.map((guide) => (
          <motion.div
            key={guide.id}
            className="bg-white rounded-xl border border-slate-200 overflow-hidden"
            initial={false}
          >
            <button type="button"
              onClick={() =>
                setExpandedId(expandedId === guide.id ? null : guide.id)
              }
              className="w-full flex items-center gap-4 p-5 text-left hover:bg-slate-50 transition cursor-pointer"
            >
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${guide.iconColor}`}
              >
                {guide.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-900">
                  {guide.title}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {guide.content.length} steps
                </p>
              </div>
              <ChevronDown
                className={`w-5 h-5 text-slate-400 transition-transform ${
                  expandedId === guide.id ? 'rotate-180' : ''
                }`}
              />
            </button>
            <AnimatePresence>
              {expandedId === guide.id && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                >
                  <div className="px-5 pb-5 pt-0">
                    <div className="bg-slate-50 rounded-xl border border-slate-100 p-4 space-y-2.5">
                      {guide.content.map((step, idx) => (
                        <div
                          key={idx}
                          className="flex items-start gap-2.5"
                        >
                          <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                            <span className="text-[9px] font-bold">
                              {idx + 1}
                            </span>
                          </div>
                          <p className="text-xs text-slate-700 leading-relaxed">
                            {step}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>

      {/* Workflow Diagram */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <Workflow className="w-4 h-4 text-emerald-600" />
          Quick Reference: Ticket Lifecycle
        </h3>
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
          {[
            { label: 'Submit', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
            { label: 'Assign', color: 'bg-sky-100 text-sky-800 border-sky-300' },
            { label: 'In Progress', color: 'bg-amber-100 text-amber-800 border-amber-300' },
            { label: 'Resolved', color: 'bg-purple-100 text-purple-800 border-purple-300' },
            { label: 'Confirmed', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
          ].map((step, idx, arr) => (
            <React.Fragment key={step.label}>
              <span
                className={`px-3 py-1.5 rounded-lg border ${step.color}`}
              >
                {step.label}
              </span>
              {idx < arr.length - 1 && (
                <ArrowRight className="w-3 h-3 text-slate-400" />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
};
