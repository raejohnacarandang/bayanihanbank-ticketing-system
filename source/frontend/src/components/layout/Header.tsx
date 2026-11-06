import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { User, NotificationItem, UserRole, Branch } from '../../types';
import { BayanihanLogo } from '../ui/BayanihanLogo';
import { Spinner } from '../ui/Spinner';
import {
  Bell,
  Menu,
  X,
  ChevronDown,
  LogOut,
  User as UserIcon,
  ExternalLink
} from 'lucide-react';

interface HeaderProps {
  currentUser: User;
  notifications: NotificationItem[];
  unreadCount: number;
  onLogout: () => void | Promise<void>;
  onOpenNotifications: () => void;
  onMarkAllRead: () => void;
  onMarkNotificationRead: (id: string) => void;
  onNavigateTicket: (ticketId: string) => void;
  onNavigateBranchMonitor?: (branchId?: string) => void;
  allBranches: Branch[];
  onNavigateProfile: () => void;
  onToggleSidebar: () => void;
  isSidebarOpen: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  notifications,
  unreadCount,
  onLogout,
  onOpenNotifications,
  onMarkAllRead,
  onMarkNotificationRead,
  onNavigateTicket,
  onNavigateBranchMonitor,
  allBranches,
  onNavigateProfile,
  onToggleSidebar,
  isSidebarOpen,
}) => {
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const headerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const closeMenus = () => {
      setShowNotifMenu(false);
      setShowUserMenu(false);
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) closeMenus();
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMenus();
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const getRoleBadge = (role: UserRole) => {
    const configs: Record<UserRole, { label: string; className: string }> = {
      BRANCH_USER: { label: 'Branch User', className: 'bg-slate-100 text-slate-700 border border-slate-300' },
      IT_STAFF: { label: 'IT Specialist', className: 'bg-amber-100 text-amber-800 border border-amber-300' },
      ADMINISTRATOR: { label: 'Administrator', className: 'bg-purple-100 text-purple-800 border border-purple-300' },
      AUDITOR: { label: 'Auditor', className: 'bg-teal-100 text-teal-800 border border-teal-300' },
    };
    const c = configs[role];
    return <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${c.className}`}>{c.label}</span>;
  };

  return (
    <header ref={headerRef} className="sticky top-0 z-50 bg-slate-900 text-white shadow-lg">
      <div className="max-w-full mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-3 sm:gap-4">
          {/* Left: Logo + Mobile Menu */}
          <div className="flex items-center gap-3 min-w-0">
            <button type="button"
              onClick={onToggleSidebar}
              className="lg:hidden p-2 rounded-lg hover:bg-slate-800 transition shrink-0"
              aria-label="Toggle sidebar"
            >
              <Menu className="w-6 h-6" />
            </button>
            <BayanihanLogo size="md" className="hidden lg:flex" />
            <BayanihanLogo size="xs" className="flex lg:hidden min-w-0" />
          </div>

          {/* Center: Search (hidden on mobile) */}
          <div className="hidden lg:flex-1 max-w-xl mx-4" />

          {/* Right: Notifications + User */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Notifications Bell */}
            <div className="relative">
              <button type="button"
                onClick={() => {
                  setShowNotifMenu(!showNotifMenu);
                  setShowUserMenu(false);
                }}
                className="relative p-2 rounded-lg hover:bg-slate-800 transition"
                aria-label="Notifications"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-red-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Notifications Menu */}
              <AnimatePresence>
              {showNotifMenu && (
                <motion.div
                  initial={{ opacity: 0, y: -4, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.98 }}
                  transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute right-0 mt-2 w-80 sm:w-96 max-w-[calc(100vw-2rem)] bg-white rounded-xl shadow-[var(--shadow-pop)] border border-slate-200 text-slate-800 z-50 overflow-hidden"
                >
                  <div className="px-4 py-3 bg-emerald-950 text-white flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Bell className="w-4 h-4 text-amber-400" />
                      <span className="text-sm font-bold">Notifications</span>
                    </div>
                    <button type="button"
                      onClick={() => {
                        onOpenNotifications();
                        setShowNotifMenu(false);
                      }}
                      className="text-xs text-emerald-300 hover:text-white flex items-center gap-1 transition"
                    >
                      <span>View All</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-slate-400 text-xs">
                        No notifications at this time.
                      </div>
                    ) : (
                      notifications.map((n) => {
                        // Extract branch name from message if branchId is missing
                        // Message format: "BranchName — System is now Status"
                        let targetBranchId = n.branchId;
                        if (!targetBranchId && n.message) {
                          const branchName = n.message.split(' — ')[0]?.trim();
                          if (branchName) {
                            const match = allBranches.find(
                              (b) => b.name.toLowerCase() === branchName.toLowerCase()
                            );
                            if (match) targetBranchId = match.id;
                          }
                        }
                        return (
                          <div
                            key={n.id}
                            onClick={() => {
                              onMarkNotificationRead(n.id);
                              if (n.ticketId && n.ticketId.trim()) {
                                onNavigateTicket(n.ticketId);
                              } else if (onNavigateBranchMonitor && targetBranchId) {
                                onNavigateBranchMonitor(targetBranchId);
                              }
                              setShowNotifMenu(false);
                            }}
                            className={`p-3 hover:bg-slate-50 transition cursor-pointer ${
                              !n.read ? 'bg-emerald-50/50' : ''
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <h5 className="text-xs font-bold text-slate-900">{n.title}</h5>
                              <span className="text-[10px] text-slate-400 shrink-0">{n.timestamp}</span>
                            </div>
                            <p className="text-xs text-slate-600 mt-1">{n.message}</p>
                          </div>
                        );
                      })
                    )}
                  </div>
                </motion.div>
              )}
              </AnimatePresence>
            </div>

            {/* User Menu */}
            <div className="relative">
              <button type="button"
                onClick={() => {
                  setShowUserMenu(!showUserMenu);
                  setShowNotifMenu(false);
                }}
                className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-900 text-white font-bold text-xs flex items-center justify-center border border-emerald-300/40 shadow-sm">
                  {currentUser.name.charAt(0)}
                </div>
                <div className="hidden sm:block text-left">
                  <div className="text-xs font-bold text-white">{currentUser.name}</div>
                  <div className="text-[10px] text-slate-400">
                    {currentUser.branchName || currentUser.department}
                  </div>
                </div>
                <ChevronDown className="w-4 h-4 text-slate-400 hidden sm:block" />
              </button>

              <AnimatePresence>
              {showUserMenu && (
                <motion.div
                  initial={{ opacity: 0, y: -4, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.98 }}
                  transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-[var(--shadow-pop)] border border-slate-200 text-slate-800 z-50 p-2 overflow-hidden"
                >
                  <div className="p-3 border-b border-slate-100 mb-1">
                    <div className="text-xs font-bold text-slate-900">{currentUser.name}</div>
                    <div className="text-[11px] text-slate-500">{currentUser.email}</div>
                    <div className="mt-1">{getRoleBadge(currentUser.role)}</div>
                  </div>

                  <button type="button"
                    onClick={() => {
                      onNavigateProfile();
                      setShowUserMenu(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition flex items-center gap-2 cursor-pointer"
                  >
                    <UserIcon className="w-4 h-4" />
                    <span>My Profile & Password</span>
                  </button>

                  <button type="button"
                    onClick={() => {
                      if (loggingOut) return;
                      setLoggingOut(true);
                      const result = onLogout();
                      if (result && typeof result.then === 'function') {
                        result.then(() => {
                          setLoggingOut(false);
                          setShowUserMenu(false);
                        });
                      } else {
                        setLoggingOut(false);
                        setShowUserMenu(false);
                      }
                    }}
                    disabled={loggingOut}
                    className="w-full text-left px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>{loggingOut ? 'Signing out...' : 'Sign Out'}</span>
                  </button>
                </motion.div>
              )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};