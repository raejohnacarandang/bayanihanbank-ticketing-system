import React, { useState } from 'react';
import { User } from '../types';
import { BayanihanLogo } from '../components/BayanihanLogo';
import { ShieldCheck, Lock, User as UserIcon, AlertCircle, ArrowRight, CheckCircle2, Building, Key } from 'lucide-react';

interface LoginViewProps {
  allUsers: User[];
  onLogin: (username: string, password: string) => Promise<void>;
}

export const LoginView: React.FC<LoginViewProps> = ({ allUsers, onLogin }) => {
  const [username, setUsername] = useState('branch.user');
  const [password, setPassword] = useState('password123');
  const [rememberMe, setRememberMe] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [showForgotModal, setShowForgotModal] = useState(false);

  const performLogin = async (user: string, pass: string) => {
    setErrorMessage('');
    try {
      await onLogin(user, pass);
    } catch {
      setErrorMessage(
        'Invalid username or password. Please use one of the demo accounts listed below.'
      );
    }
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void performLogin(username, password);
  };

  const handleSelectQuickAccount = (user: User) => {
    setUsername(user.username);
    setPassword('password123');
    void performLogin(user.username, 'password123');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-950 via-slate-950 to-emerald-950 text-slate-100 flex flex-col justify-between p-4 sm:p-6 lg:p-8">
      {/* Top Corporate Disclaimer Bar */}
      <div className="max-w-md sm:max-w-2xl mx-auto w-full bg-emerald-900/60 border border-emerald-700/60 text-emerald-200 px-4 py-2.5 rounded-xl text-xs flex items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>
            <strong>PROTOTYPE DEMONSTRATION MODE:</strong> Fictional Bayanihan Bank IT Service Desk UI.
          </span>
        </div>
        <span className="text-[10px] font-mono bg-emerald-950 px-2 py-0.5 rounded text-amber-300 font-bold border border-emerald-800">
          AUG 2026
        </span>
      </div>

      {/* Main Login Card Container */}
      <div className="my-auto max-w-md mx-auto w-full space-y-6 pt-6 pb-8">
        {/* Bank Brand Identity Header */}
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <BayanihanLogo size="xl" showSubtitle subtitleText="IT Service Desk Portal" />
          </div>
          <p className="text-xs text-emerald-200/80 max-w-xs mx-auto leading-relaxed">
            Centralized IT Support & Service Management for Branches and Main IT
          </p>
        </div>

        {/* Login Form Card */}
        <div className="bg-white text-slate-900 rounded-2xl shadow-2xl p-6 sm:p-8 border border-slate-200">
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            {errorMessage && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Username
              </label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. branch.user or it.staff"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:bg-white transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:bg-white transition"
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-xs">
              <label className="flex items-center gap-2 text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span>Remember me</span>
              </label>

              <button
                type="button"
                onClick={() => setShowForgotModal(true)}
                className="text-emerald-700 hover:text-emerald-900 font-bold cursor-pointer"
              >
                Forgot Password?
              </button>
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-emerald-900 hover:bg-emerald-800 text-amber-300 font-extrabold text-sm rounded-xl transition shadow-md flex items-center justify-center gap-2 cursor-pointer border border-emerald-700"
            >
              <span>Access IT Portal</span>
              <ArrowRight className="w-4 h-4 text-amber-400" />
            </button>
          </form>

          {/* Quick Demo Credentials Assistant */}
          <div className="mt-6 pt-5 border-t border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-amber-600" />
                Select Demo Account:
              </span>
              <span className="text-[10px] text-slate-500 font-mono">Password: password123</span>
            </div>

            <div className="space-y-2">
              {allUsers.map((u) => (
                <button
                  key={u.id}
                  onClick={() => handleSelectQuickAccount(u)}
                  className="w-full text-left p-2.5 rounded-lg border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/50 transition flex items-center justify-between group cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
                        u.role === 'BRANCH_USER'
                          ? 'bg-emerald-100 text-emerald-900'
                          : u.role === 'IT_STAFF'
                          ? 'bg-amber-100 text-amber-900'
                          : u.role === 'AUDITOR'
                          ? 'bg-teal-100 text-teal-900'
                          : 'bg-purple-100 text-purple-900'
                      }`}
                    >
                      {u.name.charAt(0)}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-800 group-hover:text-emerald-950">
                        {u.name}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {u.username} ({u.branchName || u.department})
                      </div>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                      u.role === 'BRANCH_USER'
                        ? 'bg-emerald-100 text-emerald-800'
                        : u.role === 'IT_STAFF'
                        ? 'bg-amber-100 text-amber-900'
                        : u.role === 'AUDITOR'
                        ? 'bg-teal-100 text-teal-900'
                        : 'bg-purple-100 text-purple-900'
                    }`}
                  >
                    {u.role === 'BRANCH_USER' ? 'Branch' : u.role === 'IT_STAFF' ? 'Main IT' : u.role === 'AUDITOR' ? 'Auditor' : 'Admin'}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal (Prototype Element) */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white text-slate-900 rounded-xl max-w-sm w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center gap-2 text-emerald-900 font-bold text-base">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              <span>Password Reset (Prototype)</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              In the eventual production system, password resets will be routed through Bayanihan Bank&apos;s Active Directory / Main IT Helpdesk authorization workflow.
            </p>
            <div className="p-3 bg-slate-100 rounded-lg text-xs font-mono text-slate-700">
              Demo Credentials:<br />
              Password for all accounts: <strong>password123</strong>
            </div>
            <button
              onClick={() => setShowForgotModal(false)}
              className="w-full py-2 bg-emerald-950 text-white font-semibold text-xs rounded-lg hover:bg-emerald-900 transition"
            >
              Close Notice
            </button>
          </div>
        </div>
      )}

      {/* Footer Disclaimer */}
      <footer className="text-center text-emerald-300/70 text-[11px] py-4 border-t border-emerald-900/80">
        Bayanihan Bank IT Service Desk Prototype — Internal Trainee Project (August 7, 2026)
      </footer>
    </div>
  );
};
