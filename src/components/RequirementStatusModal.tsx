import React from 'react';
import { X, CheckCircle2, Clock, ShieldAlert, FileText } from 'lucide-react';

interface RequirementStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RequirementStatusModal: React.FC<RequirementStatusModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col border border-slate-200 overflow-hidden">
        {/* Modal Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="text-lg font-bold">Requirement Status & Specification Tracker</h2>
              <p className="text-xs text-slate-300">
                Bayanihan Bank IT Service Desk — Initial Concept Review
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-slate-700 text-sm">
          {/* Confirmed Features */}
          <div className="bg-emerald-50/70 border border-emerald-200 rounded-lg p-4">
            <h3 className="font-bold text-emerald-900 flex items-center gap-2 text-base mb-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              1. Confirmed Core Prototype Features
            </h3>
            <ul className="list-disc pl-5 space-y-1 text-slate-700">
              <li>
                <strong>End-to-End Workflow:</strong> Branch Request Submission → Unique Ticket Number Generation → IT Queue Review → IT Specialist Assignment → Status Updates → IT Resolution Recording → Branch Confirmation → Closure.
              </li>
              <li>
                <strong>Role-Based User Interfaces:</strong> Distinct dashboards for <em>Branch Users</em>, <em>Main IT Specialist</em>, and <em>Administrators</em>.
              </li>
              <li>
                <strong>Ticket Interaction:</strong> Public comments thread, <em>Internal IT Notes</em> (hidden from branch users), and timestamped activity timeline.
              </li>
              <li>
                <strong>Branch Confirmation Step:</strong> Interactive prompt for branch users to click <em>Confirm Resolution</em> (closes ticket) or <em>Issue Still Exists</em> (reopens ticket).
              </li>
              <li>
                <strong>Filterable Ticket Queue:</strong> Search by ticket number, branch, subject, status, and category.
              </li>
            </ul>
          </div>

          {/* Requirements Marked TBD */}
          <div className="bg-amber-50/80 border border-amber-200 rounded-lg p-4">
            <h3 className="font-bold text-amber-900 flex items-center gap-2 text-base mb-2">
              <Clock className="w-5 h-5 text-amber-600" />
              2. Items Marked &quot;TBD — For Confirmation&quot;
            </h3>
            <p className="text-xs text-amber-800 mb-3">
              Per supervisor instructions, no unverified bank policies are assumed. The following parameters require official IT management confirmation:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="bg-white p-3 rounded border border-amber-200 shadow-2xs">
                <span className="font-semibold text-slate-900 block text-xs uppercase tracking-wide text-amber-700">
                  Exact User Roles & Permissions
                </span>
                <span className="text-xs text-slate-600">
                  TBD — For Confirmation (e.g., Branch Manager vs. Teller approval levels)
                </span>
              </div>
              <div className="bg-white p-3 rounded border border-amber-200 shadow-2xs">
                <span className="font-semibold text-slate-900 block text-xs uppercase tracking-wide text-amber-700">
                  Official IT Category Taxonomy
                </span>
                <span className="text-xs text-slate-600">
                  TBD — For Confirmation (Current categories: Hardware, Software, Network, Access, Equipment, Installation)
                </span>
              </div>
              <div className="bg-white p-3 rounded border border-amber-200 shadow-2xs">
                <span className="font-semibold text-slate-900 block text-xs uppercase tracking-wide text-amber-700">
                  Email & SMS Notification Policy
                </span>
                <span className="text-xs text-slate-600">
                  TBD — For Confirmation (SMTP server / SMS gateway integration requirements)
                </span>
              </div>
              <div className="bg-white p-3 rounded border border-amber-200 shadow-2xs">
                <span className="font-semibold text-slate-900 block text-xs uppercase tracking-wide text-amber-700">
                  Active Directory / Single Sign-On
                </span>
                <span className="text-xs text-slate-600">
                  TBD — For Confirmation (Bank AD/LDAP vs. standalone credentials)
                </span>
              </div>
              <div className="bg-white p-3 rounded border border-amber-200 shadow-2xs">
                <span className="font-semibold text-slate-900 block text-xs uppercase tracking-wide text-amber-700">
                  Production Server Infrastructure
                </span>
                <span className="text-xs text-slate-600">
                  TBD — For Confirmation (Target backend: PHP / Laravel / MySQL / On-Premise Cloud)
                </span>
              </div>
            </div>
          </div>

          {/* Security Disclaimer */}
          <div className="bg-slate-100 border border-slate-300 rounded-lg p-4 flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-slate-600 shrink-0 mt-0.5" />
            <div className="text-xs text-slate-600 leading-relaxed">
              <strong className="text-slate-900 font-semibold block mb-1">
                Security & Data Privacy Assurance
              </strong>
              This software is an internal UI/UX prototype created for demonstration purposes on August 7, 2026. All employee names (Juan Dela Cruz, Maria Santos, Mark Reyes, Ana Cruz), branch names, and ticket records are strictly fictional sample data. No actual banking credentials or customer information are stored.
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-3 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs rounded-lg transition"
          >
            Close Window
          </button>
        </div>
      </div>
    </div>
  );
};
