import React from 'react';
import { useLocation } from 'react-router-dom';
import { User, ActiveView } from '../types';
import { parsePath } from '../routes';
import { BayanihanLogo } from './BayanihanLogo';
import {
  LayoutDashboard,
  PlusCircle,
  Ticket as TicketIcon,
  Bell,
  User as UserIcon,
  Inbox,
  UserCheck,
  PlayCircle,
  CheckCircle2,
  Users,
  Building,
  Layers,
  History,
  FileCheck,
  Sliders,
  ChevronRight,
  LogOut,
  BarChart3
} from 'lucide-react';

interface SidebarProps {
  currentUser: User;
  newTicketCount: number;
  myOpenTicketCount: number;
  onNavigate: (view: ActiveView) => void;
  onLogout: () => void;
  isOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentUser,
  newTicketCount,
  myOpenTicketCount,
  onNavigate,
  onLogout,
  isOpen,
  onCloseMobile,
}) => {
  const location = useLocation();
  const parsed = parsePath(location.pathname);
  const activeView = parsed?.view ?? 'dashboard';
  const adminTab = parsed?.adminTab;

  const isBranchUser = currentUser.role === 'BRANCH_USER';
  const isITStaff = currentUser.role === 'IT_STAFF';
  const isAdmin = currentUser.role === 'ADMINISTRATOR';
  const isAuditor = currentUser.role === 'AUDITOR';

  const adminViews: ActiveView[] = ['users', 'it_staff', 'branches', 'categories', 'activity_logs'];

  const navItemClass = (view: ActiveView) => {
    const isActive =
      activeView === 'users' && adminViews.includes(view)
        ? adminTab === view || (view === 'users' && adminTab === 'overview')
        : activeView === view;
    return `w-full flex items-center justify-between px-4 py-3 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
      isActive
        ? 'bg-emerald-800 text-amber-300 shadow-sm border border-emerald-700/60'
        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
    }`;
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-20 bg-slate-900/50 backdrop-blur-xs md:hidden"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed md:sticky top-16 left-0 z-20 h-[calc(100vh-4rem)] w-64 bg-slate-900 border-r border-slate-800 text-slate-300 flex flex-col justify-between p-4 transition-transform duration-200 ease-in-out shrink-0 overflow-y-auto ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="space-y-6">
          {/* User Profile Summary Box */}
          <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center shrink-0 border border-blue-400/30">
              {currentUser.name.charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-white truncate">{currentUser.name}</div>
              <div className="text-[11px] text-blue-300 font-medium truncate">
                {currentUser.branchName || currentUser.department || 'Bayanihan Bank'}
              </div>
            </div>
          </div>

          {/* Navigation Sections */}
          <div className="space-y-1">
            <div className="px-3 text-[10px] font-bold tracking-wider uppercase text-slate-500 mb-2">
              Main Menu
            </div>

            {/* Dashboard */}
            <button
              onClick={() => {
                onNavigate('dashboard');
                onCloseMobile();
              }}
              className={navItemClass('dashboard')}
            >
              <div className="flex items-center gap-2.5">
                <LayoutDashboard className="w-4 h-4 text-blue-400" />
                <span>Dashboard</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 opacity-40" />
            </button>

            {/* BRANCH USER SPECIFIC NAVIGATION */}
            {isBranchUser && (
              <>
                <button
                  onClick={() => {
                    onNavigate('new_request');
                    onCloseMobile();
                  }}
                  className={navItemClass('new_request')}
                >
                  <div className="flex items-center gap-2.5">
                    <PlusCircle className="w-4 h-4 text-emerald-400" />
                    <span>New IT Request</span>
                  </div>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-bold px-1.5 py-0.5 rounded">
                    +Create
                  </span>
                </button>

                <button
                  onClick={() => {
                    onNavigate('my_tickets');
                    onCloseMobile();
                  }}
                  className={navItemClass('my_tickets')}
                >
                  <div className="flex items-center gap-2.5">
                    <TicketIcon className="w-4 h-4 text-amber-400" />
                    <span>My Branch Tickets</span>
                  </div>
                  {myOpenTicketCount > 0 && (
                    <span className="text-[10px] bg-amber-500/20 text-amber-300 font-bold px-2 py-0.5 rounded-full">
                      {myOpenTicketCount}
                    </span>
                  )}
                </button>
              </>
            )}

            {/* IT STAFF SPECIFIC NAVIGATION */}
            {isITStaff && (
              <>
                <button
                  onClick={() => {
                    onNavigate('all_tickets');
                    onCloseMobile();
                  }}
                  className={navItemClass('all_tickets')}
                >
                  <div className="flex items-center gap-2.5">
                    <Inbox className="w-4 h-4 text-blue-400" />
                    <span>All IT Tickets</span>
                  </div>
                </button>

                <button
                  onClick={() => {
                    onNavigate('assigned_tickets');
                    onCloseMobile();
                  }}
                  className={navItemClass('assigned_tickets')}
                >
                  <div className="flex items-center gap-2.5">
                    <UserCheck className="w-4 h-4 text-indigo-400" />
                    <span>My Assigned</span>
                  </div>
                </button>

                <button
                  onClick={() => {
                    onNavigate('in_progress');
                    onCloseMobile();
                  }}
                  className={navItemClass('in_progress')}
                >
                  <div className="flex items-center gap-2.5">
                    <PlayCircle className="w-4 h-4 text-amber-400" />
                    <span>In Progress</span>
                  </div>
                </button>

                <button
                  onClick={() => {
                    onNavigate('resolved_tickets');
                    onCloseMobile();
                  }}
                  className={navItemClass('resolved_tickets')}
                >
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Resolved Queue</span>
                  </div>
                </button>
              </>
            )}

            {/* ADMINISTRATOR SPECIFIC NAVIGATION */}
            {isAdmin && (
              <>
                <button
                  onClick={() => {
                    onNavigate('all_tickets');
                    onCloseMobile();
                  }}
                  className={navItemClass('all_tickets')}
                >
                  <div className="flex items-center gap-2.5">
                    <TicketIcon className="w-4 h-4 text-blue-400" />
                    <span>All Tickets</span>
                  </div>
                </button>

                <button
                  onClick={() => {
                    onNavigate('users');
                    onCloseMobile();
                  }}
                  className={navItemClass('users')}
                >
                  <div className="flex items-center gap-2.5">
                    <Users className="w-4 h-4 text-purple-400" />
                    <span>User Management</span>
                  </div>
                </button>

                <button
                  onClick={() => {
                    onNavigate('it_staff');
                    onCloseMobile();
                  }}
                  className={navItemClass('it_staff')}
                >
                  <div className="flex items-center gap-2.5">
                    <UserCheck className="w-4 h-4 text-sky-400" />
                    <span>IT Staff Settings</span>
                  </div>
                </button>

                <button
                  onClick={() => {
                    onNavigate('branches');
                    onCloseMobile();
                  }}
                  className={navItemClass('branches')}
                >
                  <div className="flex items-center gap-2.5">
                    <Building className="w-4 h-4 text-indigo-400" />
                    <span>Branch Directory</span>
                  </div>
                </button>

                <button
                  onClick={() => {
                    onNavigate('categories');
                    onCloseMobile();
                  }}
                  className={navItemClass('categories')}
                >
                  <div className="flex items-center gap-2.5">
                    <Layers className="w-4 h-4 text-amber-400" />
                    <span>IT Categories</span>
                  </div>
                </button>

                <button
                  onClick={() => {
                    onNavigate('activity_logs');
                    onCloseMobile();
                  }}
                  className={navItemClass('activity_logs')}
                >
                  <div className="flex items-center gap-2.5">
                    <History className="w-4 h-4 text-teal-400" />
                    <span>Audit Activity Logs</span>
                  </div>
                </button>

                <button
                  onClick={() => {
                    onNavigate('reports');
                    onCloseMobile();
                  }}
                  className={navItemClass('reports')}
                >
                  <div className="flex items-center gap-2.5">
                    <BarChart3 className="w-4 h-4 text-blue-400" />
                    <span>Reports & Analytics</span>
                  </div>
                </button>
              </>
            )}

            {/* AUDITOR SPECIFIC NAVIGATION (View-Only) */}
            {isAuditor && (
              <>
                <button
                  onClick={() => {
                    onNavigate('all_tickets');
                    onCloseMobile();
                  }}
                  className={navItemClass('all_tickets')}
                >
                  <div className="flex items-center gap-2.5">
                    <TicketIcon className="w-4 h-4 text-blue-400" />
                    <span>All Tickets</span>
                  </div>
                  <span className="text-[10px] bg-teal-500/20 text-teal-300 font-bold px-1.5 py-0.5 rounded">
                    View
                  </span>
                </button>

                <button
                  onClick={() => {
                    onNavigate('activity_logs');
                    onCloseMobile();
                  }}
                  className={navItemClass('activity_logs')}
                >
                  <div className="flex items-center gap-2.5">
                    <History className="w-4 h-4 text-teal-400" />
                    <span>Audit Activity Logs</span>
                  </div>
                </button>

                <button
                  onClick={() => {
                    onNavigate('reports');
                    onCloseMobile();
                  }}
                  className={navItemClass('reports')}
                >
                  <div className="flex items-center gap-2.5">
                    <BarChart3 className="w-4 h-4 text-blue-400" />
                    <span>Reports & Analytics</span>
                  </div>
                </button>
              </>
            )}

            {/* Notifications & Profile */}
            <div className="pt-4 mt-4 border-t border-slate-800 space-y-1">
              <div className="px-3 text-[10px] font-bold tracking-wider uppercase text-slate-500 mb-2">
                Personal & System
              </div>

              <button
                onClick={() => {
                  onNavigate('notifications');
                  onCloseMobile();
                }}
                className={navItemClass('notifications')}
              >
                <div className="flex items-center gap-2.5">
                  <Bell className="w-4 h-4 text-slate-400" />
                  <span>Notifications</span>
                </div>
              </button>

              <button
                onClick={() => {
                  onNavigate('profile');
                  onCloseMobile();
                }}
                className={navItemClass('profile')}
              >
                <div className="flex items-center gap-2.5">
                  <UserIcon className="w-4 h-4 text-slate-400" />
                  <span>My Profile</span>
                </div>
              </button>

              <button
                onClick={() => {
                  onNavigate('requirements');
                  onCloseMobile();
                }}
                className={navItemClass('requirements')}
              >
                <div className="flex items-center gap-2.5">
                  <FileCheck className="w-4 h-4 text-amber-400" />
                  <span>Requirements Status</span>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Bottom System Identity Notice & Logout */}
        <div className="pt-4 border-t border-slate-800 space-y-3">
          <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-[11px] text-slate-400 leading-tight">
            <span className="font-semibold text-slate-200 block mb-0.5">
              BB IT Service Desk v1.0
            </span>
            Bayanihan Bank Prototype Concept (August 2026)
          </div>

          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-red-950/50 hover:bg-red-900/80 text-red-300 text-xs font-semibold transition border border-red-900/50 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Exit Demo Session</span>
          </button>
        </div>
      </aside>
    </>
  );
};
