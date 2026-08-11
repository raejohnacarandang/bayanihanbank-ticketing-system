import React from 'react';
import { User } from '../types';
import { User as UserIcon, Building, Mail, ShieldCheck, Key } from 'lucide-react';

interface ProfileViewProps {
  currentUser: User;
}

export const ProfileView: React.FC<ProfileViewProps> = ({ currentUser }) => {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 bg-slate-900 text-white flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-blue-600 text-white font-black text-2xl flex items-center justify-center border-2 border-blue-400/40">
            {currentUser.name.charAt(0)}
          </div>
          <div>
            <h1 className="text-xl font-bold">{currentUser.name}</h1>
            <p className="text-xs text-blue-200 mt-0.5">
              {currentUser.branchName || currentUser.department || 'Bayanihan Bank'}
            </p>
            <span className="inline-block mt-2 text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800">
              {currentUser.role}
            </span>
          </div>
        </div>

        <div className="p-6 space-y-4 text-xs text-slate-700">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Username
              </span>
              <span className="font-mono font-bold text-slate-900">{currentUser.username}</span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Email Address
              </span>
              <span className="font-mono text-slate-900">{currentUser.email}</span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Assigned Branch / Dept
              </span>
              <span className="font-bold text-slate-900">
                {currentUser.branchName || currentUser.department}
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Authentication Status
              </span>
              <span className="font-bold text-emerald-700 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                Demo Session Active
              </span>
            </div>
          </div>

          <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-blue-900">
            <h4 className="font-bold mb-1">Bayanihan Bank Security Policy Disclaimer</h4>
            <p className="text-[11px] leading-relaxed text-blue-950">
              This account profile is part of the initial IT Service Desk prototype built on August 7, 2026 for internal supervisor review. In production, employee accounts will synchronize with Bayanihan Bank&apos;s Active Directory / LDAP servers.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
