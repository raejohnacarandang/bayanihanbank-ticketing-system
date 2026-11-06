import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { User, ActiveView } from '../../types';
import { AdminTab } from '../../routes';
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
  BarChart3,
  HelpCircle,
  BookOpen,
  Activity,
} from 'lucide-react';

interface SidebarProps {
  currentUser: User;
  activeView: ActiveView;
  adminTab: AdminTab;
  newTicketCount: number;
  onNavigate: (view: ActiveView) => void;
  onLogout: () => void | Promise<void>;
  isOpen: boolean;
  onCloseMobile: () => void;
  myOpenTicketCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentUser,
  activeView,
  adminTab,
  newTicketCount,
  onNavigate,
  onLogout,
  isOpen,
  onCloseMobile,
  myOpenTicketCount,
}) => {
  const [loggingOut, setLoggingOut] = useState(false);

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
    return `w-full flex items-center justify-between pl-5 pr-4 py-3 rounded-lg text-sm font-semibold transition-all duration-150 cursor-pointer relative ${
      isActive
        ? 'bg-gradient-to-r from-emerald-800 to-emerald-900 text-amber-300 shadow-sm border border-emerald-700/60 border-l-2 border-l-amber-400'
        : 'text-slate-400 hover:bg-slate-800/70 hover:text-white hover:translate-x-0.5'
    }`;
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      <AnimatePresence>
      {isOpen && (
        <motion.div
          onClick={onCloseMobile}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-20 bg-slate-900/50 backdrop-blur-xs md:hidden"
        />
      )}
      </AnimatePresence>

      {/* Sidebar Container */}
      <aside
        className={`print:hidden fixed md:sticky top-16 left-0 z-20 h-[calc(100vh-4rem)] w-64 bg-slate-900 border-r border-slate-800 text-slate-300 flex flex-col justify-between p-4 transition-transform duration-200 ease-in-out shrink-0 overflow-y-auto ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="space-y-6">
          {/* User Profile Summary Box */}
          <div className="bg-emerald-900/40 p-3 rounded-xl border border-emerald-800/60 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-800 text-white font-bold flex items-center justify-center shrink-0 border border-emerald-300/40 shadow-sm">
              {currentUser.name.charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-white truncate">{currentUser.name}</div>
              <div className="text-[11px] text-emerald-300 font-medium truncate">
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
            <button type="button"
              onClick={() => {
                onNavigate('dashboard');
                onCloseMobile();
              }}
              className={navItemClass('dashboard')}
            >
              <div className="flex items-center gap-2.5">
                <LayoutDashboard className="w-4 h-4 text-emerald-400" />
                <span>Dashboard</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 opacity-40" />
            </button>

            {/* BRANCH USER SPECIFIC NAVIGATION */}
            {isBranchUser && (
              <>
                <button type="button"
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

                <button type="button"
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

                <button type="button"
                  onClick={() => {
                    onNavigate('branch_monitor');
                    onCloseMobile();
                  }}
                  className={navItemClass('branch_monitor')}
                >
                  <div className="flex items-center gap-2.5">
                    <Activity className="w-4 h-4 text-emerald-400" />
                    <span>Branch System Monitor</span>
                  </div>
                </button>
              </>
            )}

            {/* IT STAFF SPECIFIC NAVIGATION */}
            {isITStaff && (
              <>
                <button type="button"
                  onClick={() => {
                    onNavigate('all_tickets');
                    onCloseMobile();
                  }}
                  className={navItemClass('all_tickets')}
                >
                  <div className="flex items-center gap-2.5">
                    <Inbox className="w-4 h-4 text-emerald-400" />
                    <span>All IT Tickets</span>
                  </div>
                  {newTicketCount > 0 && (
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded-full">
                      {newTicketCount}
                    </span>
                  )}
                </button>

                <button type="button"
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

                <button type="button"
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

                <button type="button"
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

                <button type="button"
                  onClick={() => {
                    onNavigate('branch_monitor');
                    onCloseMobile();
                  }}
                  className={navItemClass('branch_monitor')}
                >
                  <div className="flex items-center gap-2.5">
                    <Activity className="w-4 h-4 text-emerald-400" />
                    <span>Branch Monitoring</span>
                  </div>
                </button>
              </>
            )}

            {/* ADMINISTRATOR SPECIFIC NAVIGATION */}
            {isAdmin && (
              <>
                <button type="button"
                  onClick={() => {
                    onNavigate('all_tickets');
                    onCloseMobile();
                  }}
                  className={navItemClass('all_tickets')}
                >
                  <div className="flex items-center gap-2.5">
                    <TicketIcon className="w-4 h-4 text-emerald-400" />
                    <span>All Tickets</span>
                  </div>
                  {newTicketCount > 0 && (
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded-full">
                      {newTicketCount}
                    </span>
                  )}
                </button>

                <button type="button"
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

                <button type="button"
                  onClick={() => {
                    onNavigate('it_staff');
                    onCloseMobile();
                  }}
                  className={navItemClass('it_staff')}
                >
                  <div className="flex items-center gap-2.5">
                    <UserCheck className="w-4 h-4 text-sky-400" />
                    <span>IT Specialist Settings</span>
                  </div>
                </button>

                <button type="button"
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

                <button type="button"
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

                <button type="button"
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

                <button type="button"
                  onClick={() => {
                    onNavigate('reports');
                    onCloseMobile();
                  }}
                  className={navItemClass('reports')}
                >
                  <div className="flex items-center gap-2.5">
                    <BarChart3 className="w-4 h-4 text-emerald-400" />
                    <span>Reports & Analytics</span>
                  </div>
                </button>

                <button type="button"
                  onClick={() => {
                    onNavigate('cloud_bank_monitoring');
                    onCloseMobile();
                  }}
                  className={navItemClass('cloud_bank_monitoring')}
                >
                  <div className="flex items-center gap-2.5">
                    <BarChart3 className="w-4 h-4 text-emerald-400" />
                    <span>Cloud Bank Users</span>
                  </div>
                </button>

                <button type="button"
                  onClick={() => {
                    onNavigate('branch_monitor');
                    onCloseMobile();
                  }}
                  className={navItemClass('branch_monitor')}
                >
                  <div className="flex items-center gap-2.5">
                    <Activity className="w-4 h-4 text-emerald-400" />
                    <span>Branch Monitoring</span>
                  </div>
                </button>
              </>
            )}

            {/* AUDITOR SPECIFIC NAVIGATION (View-Only) */}
            {isAuditor && (
              <>
                <button type="button"
                  onClick={() => {
                    onNavigate('all_tickets');
                    onCloseMobile();
                  }}
                  className={navItemClass('all_tickets')}
                >
                  <div className="flex items-center gap-2.5">
                    <TicketIcon className="w-4 h-4 text-emerald-400" />
                    <span>All Tickets</span>
                  </div>
                  <span className="text-[10px] bg-teal-500/20 text-teal-300 font-bold px-1.5 py-0.5 rounded">
                    View
                  </span>
                </button>

                <button type="button"
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

                <button type="button"
                  onClick={() => {
                    onNavigate('reports');
                    onCloseMobile();
                  }}
                  className={navItemClass('reports')}
                >
                  <div className="flex items-center gap-2.5">
                    <BarChart3 className="w-4 h-4 text-emerald-400" />
                    <span>Reports & Analytics</span>
                  </div>
                </button>

                <button type="button"
                  onClick={() => {
                    onNavigate('branch_monitor');
                    onCloseMobile();
                  }}
                  className={navItemClass('branch_monitor')}
                >
                  <div className="flex items-center gap-2.5">
                    <Activity className="w-4 h-4 text-emerald-400" />
                    <span>Branch Monitoring</span>
                  </div>
                </button>
              </>
            )}

            {/* Notifications & Profile */}
            <div className="pt-4 mt-4 border-t border-slate-800 space-y-1">
              <div className="px-3 text-[10px] font-bold tracking-wider uppercase text-slate-500 mb-2">
                Personal & System
              </div>

              <button type="button"
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

              <button type="button"
                onClick={() => {
                  onNavigate('help_center');
                  onCloseMobile();
                }}
                className={navItemClass('help_center')}
              >
                <div className="flex items-center gap-2.5">
                  <HelpCircle className="w-4 h-4 text-sky-400" />
                  <span>Help Center</span>
                </div>
              </button>

              <button type="button"
                onClick={() => {
                  onNavigate('knowledge_base');
                  onCloseMobile();
                }}
                className={navItemClass('knowledge_base')}
              >
                <div className="flex items-center gap-2.5">
                  <BookOpen className="w-4 h-4 text-emerald-400" />
                  <span>Knowledge Base</span>
                </div>
              </button>

              <button type="button"
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

              <button type="button"
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
            Bayanihan Bank IT Service Desk (August 2026)
          </div>

          <button type="button"
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-red-950/40 hover:bg-red-900/70 text-red-300 text-xs font-semibold transition border border-red-900/40 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Log Out</span>
          </button>
        </div>
      </aside>
    </>
  );
};
