import React from 'react';
import { X, CheckCircle, ArrowRight, Play, UserCheck, ShieldCheck, HelpCircle } from 'lucide-react';
import { UserRole } from '../types';

interface GuidedDemoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onQuickSwitchRole: (role: UserRole) => void;
  onNavigateView: (view: string, ticketId?: string) => void;
}

export const GuidedDemoModal: React.FC<GuidedDemoModalProps> = ({
  isOpen,
  onClose,
  onQuickSwitchRole,
  onNavigateView,
}) => {
  if (!isOpen) return null;

  const steps = [
    {
      num: 1,
      title: 'Login as Branch User',
      description: 'Log in as Juan Dela Cruz (Unisan Branch) using branch.user credentials.',
      roleNeeded: 'BRANCH_USER' as UserRole,
      actionText: 'Switch to Branch User (Juan)',
      actionView: 'dashboard',
    },
    {
      num: 2,
      title: 'Submit IT Request',
      description: 'Click "+ New IT Request", select Hardware, and enter subject "Printer is not working".',
      roleNeeded: 'BRANCH_USER' as UserRole,
      actionText: 'Go to New IT Request Form',
      actionView: 'new_request',
    },
    {
      num: 3,
      title: 'Ticket # Generation',
      description: 'Upon submission, system auto-generates a unique ID (e.g. IT-000126) and logs a timeline event.',
      roleNeeded: 'BRANCH_USER' as UserRole,
      actionText: 'View My Tickets Queue',
      actionView: 'my_tickets',
    },
    {
      num: 4,
      title: 'Switch to IT Department',
      description: 'Switch role to IT Specialist (Mark Reyes - Main IT) to view incoming tickets.',
      roleNeeded: 'IT_STAFF' as UserRole,
      actionText: 'Switch to IT Specialist (Mark Reyes)',
      actionView: 'dashboard',
    },
    {
      num: 5,
      title: 'IT Assignment & Progress',
      description: 'Open the ticket, assign to Mark Reyes, update status to "In Progress", and add a comment.',
      roleNeeded: 'IT_STAFF' as UserRole,
      actionText: 'Open All IT Tickets Queue',
      actionView: 'all_tickets',
    },
    {
      num: 6,
      title: 'Record Resolution',
      description: 'Enter resolution notes ("Printer connection restored...") and mark ticket as "Resolved".',
      roleNeeded: 'IT_STAFF' as UserRole,
      actionText: 'Go to IT Dashboard',
      actionView: 'dashboard',
    },
    {
      num: 7,
      title: 'Branch Confirmation',
      description: 'Switch back to Juan Dela Cruz (Branch User), view the ticket, and click "Confirm Resolution" to set status to "Closed".',
      roleNeeded: 'BRANCH_USER' as UserRole,
      actionText: 'Switch to Branch User & Confirm',
      actionView: 'my_tickets',
    },
    {
      num: 8,
      title: 'Audit Review (View-Only)',
      description: 'Switch to the Audit Team account to monitor tickets and review the full audit activity log. Auditor accounts cannot create, edit, or close tickets.',
      roleNeeded: 'AUDITOR' as UserRole,
      actionText: 'Switch to Auditor (Audit Team)',
      actionView: 'dashboard',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="bg-emerald-950 text-white px-6 py-4 flex items-center justify-between border-b border-emerald-800">
          <div className="flex items-center gap-2">
            <Play className="w-5 h-5 text-emerald-400 fill-emerald-400" />
            <div>
              <h2 className="text-lg font-bold">Interactive Demo Walkthrough Guide</h2>
              <p className="text-xs text-emerald-200">
                End-to-End IT Service Desk Ticket Lifecycle Simulation
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-emerald-900 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          <p className="text-xs text-slate-600 bg-emerald-50 border border-emerald-200 p-3 rounded-lg leading-relaxed">
            This guided walkthrough demonstrates the complete <strong>Branch User → Main IT → Resolution → Branch Confirmation</strong> workflow required for presentation to the IT supervisor.
          </p>

          <div className="space-y-3">
            {steps.map((step) => (
              <div
                key={step.num}
                className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 hover:border-emerald-300 transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
              >
                <div className="flex items-start gap-3">
                  <span className="w-7 h-7 rounded-full bg-emerald-900 text-white font-bold text-xs flex items-center justify-center shrink-0">
                    {step.num}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-slate-900 text-sm">{step.title}</h4>
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-slate-200 text-slate-700">
                        {step.roleNeeded}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5">{step.description}</p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    onQuickSwitchRole(step.roleNeeded);
                    onNavigateView(step.actionView);
                    onClose();
                  }}
                  className="shrink-0 px-3 py-1.5 bg-emerald-900 hover:bg-emerald-800 text-white text-xs font-medium rounded-md transition flex items-center gap-1 self-end sm:self-center"
                >
                  <span>{step.actionText}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-3 flex justify-between items-center">
          <span className="text-xs text-slate-500 italic">
            You can also switch roles anytime via topbar menu.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 text-white font-medium text-xs rounded-md hover:bg-slate-700 transition"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
};
