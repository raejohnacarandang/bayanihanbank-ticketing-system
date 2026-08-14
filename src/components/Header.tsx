import React, { useEffect, useRef, useState } from 'react';
import { User, NotificationItem, UserRole } from '../types';
import { BayanihanLogo } from './BayanihanLogo';
import {
  Bell,
  Menu,
  X,
  ChevronDown,
  LogOut,
  User as UserIcon,
  Building,
  ShieldCheck,
  RefreshCcw,
  Check,
  ExternalLink
} from 'lucide-react';

interface HeaderProps {
  currentUser: User;
  allUsers: User[];
  notifications: NotificationItem[];
  unreadCount: number;
  onSwitchUser: (user: User) => void;
  onLogout: () => void;
  onOpenNotifications: () => void;
  onMarkAllRead: () => void;
  onMarkNotificationRead: (id: string) => void;
  onNavigateTicket: (ticketId: string) => void;
  onNavigateProfile: () => void;
  onToggleSidebar: () => void;
  isSidebarOpen: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  allUsers,
  notifications,
  unreadCount,
  onSwitchUser,
  onLogout,
  onOpenNotifications,
  onMarkAllRead,
  onMarkNotificationRead,
  onNavigateTicket,
  onNavigateProfile,
  onToggleSidebar,
  isSidebarOpen,
}) => {
  const [showRoleSwitcher, setShowRoleSwitcher] = useState(false);
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const headerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const closeMenus = () => {
      setShowRoleSwitcher(false);
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
    switch (role) {
      case 'BRANCH_USER':
        return <span className="bg-emerald-100 text-emerald-900 text-[11px] font-semibold px-2 py-0.5 rounded border border-emerald-300">Branch User</span>;
      case 'IT_STAFF':
        return <span className="bg-amber-100 text-amber-900 text-[11px] font-semibold px-2 py-0.5 rounded border border-amber-300">Main IT Specialist</span>;
      case 'ADMINISTRATOR':
        return <span className="bg-purple-100 text-purple-900 text-[11px] font-semibold px-2 py-0.5 rounded border border-purple-200">Administrator</span>;
      case 'AUDITOR':
        return <span className="bg-teal-100 text-teal-900 text-[11px] font-semibold px-2 py-0.5 rounded border border-teal-300">Auditor (View-Only)</span>;
    }
  };

  return (
    <header ref={headerRef} className="bg-gradient-to-r from-emerald-950 via-emerald-900 to-emerald-950 text-white border-b border-emerald-800/80 sticky top-0 z-30 shadow-md">
      <div className="px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Left Section: Mobile Menu Button & Brand Identity */}
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleSidebar}
            className="md:hidden text-emerald-200 hover:text-white p-2 rounded-lg hover:bg-emerald-900 transition"
            aria-label="Toggle navigation menu"
          >
            {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <BayanihanLogo size="md" showSubtitle subtitleText="IT Service Desk" hideTextOnMobile />
        </div>

        {/* Right Section: Role Quick Switcher, Notifications, User Menu */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Quick Role Switcher Button for Demo Convenience */}
          <div className="relative">
            <button
              onClick={() => {
                setShowRoleSwitcher(!showRoleSwitcher);
                setShowNotifMenu(false);
                setShowUserMenu(false);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-900/70 hover:bg-emerald-800 border border-emerald-700/60 text-emerald-50 text-xs font-medium transition cursor-pointer shadow-sm"
              title="Quickly switch demo persona"
            >
              <RefreshCcw className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden lg:inline text-slate-400">Persona:</span>
              <span className="hidden sm:inline font-semibold text-white">{currentUser.name.split(' ')[0]}</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {/* Role Switcher Dropdown */}
            {showRoleSwitcher && (
              <div className="absolute right-0 mt-2 w-72 max-w-[calc(100vw-2rem)] bg-white rounded-xl shadow-[var(--shadow-pop)] border border-slate-200 text-slate-800 z-50 p-2 overflow-hidden">
                <div className="px-3 py-2 bg-slate-50 rounded-lg mb-2 border border-slate-100">
                  <div className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Demo Role Switcher
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Switch user to test role-specific features immediately:
                  </div>
                </div>

                <div className="space-y-1">
                  {allUsers.map((u) => {
                    const isSelected = u.id === currentUser.id;
                    return (
                      <button
                        key={u.id}
                        onClick={() => {
                          onSwitchUser(u);
                          setShowRoleSwitcher(false);
                        }}
                        className={`w-full text-left p-2 rounded-lg transition flex items-center justify-between cursor-pointer ${
                          isSelected ? 'bg-emerald-50 border border-emerald-200 text-emerald-900' : 'hover:bg-slate-100 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
                            u.role === 'BRANCH_USER' ? 'bg-emerald-100 text-emerald-800' : u.role === 'IT_STAFF' ? 'bg-amber-100 text-amber-800' : u.role === 'AUDITOR' ? 'bg-teal-100 text-teal-800' : 'bg-purple-100 text-purple-800'
                          }`}>
                            {u.name.charAt(0)}
                          </div>
                          <div>
                            <div className="text-xs font-semibold">{u.name}</div>
                            <div className="text-[10px] text-slate-500">
                              {u.branchName || u.department}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {getRoleBadge(u.role)}
                          {isSelected && <Check className="w-4 h-4 text-emerald-600 ml-1" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Notifications Dropdown */}
          <div className="relative">
            <button
              onClick={() => {
                const opening = !showNotifMenu;
                setShowNotifMenu(opening);
                setShowRoleSwitcher(false);
                setShowUserMenu(false);
                if (opening) onMarkAllRead();
              }}
              className="relative p-2 text-slate-300 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
              title="Notifications"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-red-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Notifications Menu */}
            {showNotifMenu && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 max-w-[calc(100vw-2rem)] bg-white rounded-xl shadow-[var(--shadow-pop)] border border-slate-200 text-slate-800 z-50 overflow-hidden">
                <div className="px-4 py-3 bg-emerald-950 text-white flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-amber-400" />
                    <span className="text-sm font-bold">Notifications</span>
                  </div>
                  <button
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
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => {
                          onMarkNotificationRead(n.id);
                          onNavigateTicket(n.ticketId);
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
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User Menu */}
          <div className="relative">
            <button
              onClick={() => {
                setShowUserMenu(!showUserMenu);
                setShowRoleSwitcher(false);
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

            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-[var(--shadow-pop)] border border-slate-200 text-slate-800 z-50 p-2 overflow-hidden">
                <div className="p-3 border-b border-slate-100 mb-1">
                  <div className="text-xs font-bold text-slate-900">{currentUser.name}</div>
                  <div className="text-[11px] text-slate-500">{currentUser.email}</div>
                  <div className="mt-1">{getRoleBadge(currentUser.role)}</div>
                </div>

                <button
                  onClick={() => {
                    onNavigateProfile();
                    setShowUserMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition flex items-center gap-2 cursor-pointer"
                >
                  <UserIcon className="w-4 h-4" />
                  <span>My Profile &amp; Password</span>
                </button>

                <button
                  onClick={() => {
                    onLogout();
                    setShowUserMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition flex items-center gap-2 cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Log Out (Demo)</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
