import React, { useState, useEffect } from 'react';
import { User, NotificationItem, OnlinePresenceUser } from '../types';
import { NavigationTab } from './Sidebar';
import {
  Building2,
  Bell,
  LogOut,
  ChevronDown,
  Check,
  X,
  Menu,
  Plus,
  BarChart3,
  FileSpreadsheet,
  CheckSquare,
  ClockAlert,
  Shield,
  Layers
} from 'lucide-react';
import { pushNotificationService } from '../services/pushNotificationService';
import { UserAvatar } from './mobile/avatarUtils';

interface CollaborativeHeaderProps {
  activeUser: User;
  users: User[];
  onSwitchUser: (email: string) => void;
  onLogout: () => void;
  currentTab: NavigationTab;
  setCurrentTab: (tab: NavigationTab) => void;
  onOpenAnalytics: () => void;
  onOpenSheetsModal: () => void;
  overdueCount: number;
  onlineUsers: OnlinePresenceUser[];
  onToggleSidebar: () => void;
}

export const CollaborativeHeader: React.FC<CollaborativeHeaderProps> = ({
  activeUser,
  users,
  onSwitchUser,
  onLogout,
  currentTab,
  setCurrentTab,
  onOpenAnalytics,
  onOpenSheetsModal,
  overdueCount,
  onlineUsers,
  onToggleSidebar,
}) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isNotifOpen, setIsNotifOpen] = useState<boolean>(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState<boolean>(false);

  useEffect(() => {
    const unsub = pushNotificationService.subscribe((list) => {
      setNotifications(list);
    });
    return () => unsub();
  }, []);

  const unreadCount = notifications.filter(
    (n) => !n.read && (n.targetEmail === 'ALL' || n.targetEmail.toLowerCase() === activeUser.Email.toLowerCase())
  ).length;

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-2xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16 gap-3">
          {/* Left: Hamburger & Brand */}
          <div className="flex items-center space-x-3 min-w-0">
            <button
              onClick={onToggleSidebar}
              className="p-2 -ml-1.5 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
              title="Menu"
              aria-label="Toggle navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#6C70FF] to-[#8C8EFF] flex items-center justify-center text-white shrink-0 shadow-[0_4px_12px_rgba(108,112,255,0.35)]">
                <Building2 className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h1 className="font-extrabold text-base text-slate-900 tracking-tight truncate leading-tight flex items-center gap-1.5">
                  <span>Malwa Concrete</span>
                  <span className="text-[10px] font-bold text-[#6C70FF] bg-[#6C70FF]/10 px-1.5 py-0.2 rounded-md font-mono hidden sm:inline">
                    FMS
                  </span>
                </h1>
              </div>
            </div>
          </div>

          {/* Right Actions */}
          <div className="flex items-center space-x-2 shrink-0">
            {/* Notification Bell */}
            <div className="relative">
              <button
                onClick={() => {
                  setIsNotifOpen(!isNotifOpen);
                  setIsUserMenuOpen(false);
                }}
                className="relative p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
                title="Notifications"
                aria-label="Notifications"
              >
                <Bell className="w-5 h-5 text-slate-700" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-rose-500 rounded-full ring-2 ring-white" />
                )}
              </button>

              {isNotifOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsNotifOpen(false)}
                  />
                  <div className="fixed inset-x-3 top-14 sm:absolute sm:inset-auto sm:right-0 sm:mt-2 w-auto sm:w-80 bg-white rounded-2xl shadow-xl border border-slate-200/90 py-2.5 z-50 animate-scaleUp text-xs">
                    <div className="flex items-center justify-between px-3.5 pb-2 border-b border-slate-100">
                      <span className="font-bold text-slate-900">Notifications</span>
                      <button
                        onClick={() => pushNotificationService.markAllAsRead(activeUser.Email)}
                        className="text-[11px] text-[#6C70FF] font-bold hover:underline cursor-pointer"
                      >
                        Mark all read
                      </button>
                    </div>

                    <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
                      {notifications.length === 0 ? (
                        <div className="p-6 text-center text-slate-400">No new notifications</div>
                      ) : (
                        notifications.slice(0, 10).map((n) => (
                          <div
                            key={n.id}
                            className={`p-3 space-y-0.5 ${!n.read ? 'bg-indigo-50/40' : 'hover:bg-slate-50'}`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-slate-900">{n.title}</span>
                              <span className="text-[10px] text-slate-400 font-mono">{n.createdAt}</span>
                            </div>
                            <p className="text-slate-600 text-[11px] leading-relaxed">{n.message}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* User Dropdown with UserAvatar */}
            <div className="relative">
              <button
                onClick={() => {
                  setIsUserMenuOpen(!isUserMenuOpen);
                  setIsNotifOpen(false);
                }}
                className="flex items-center space-x-2 p-1.5 pl-2 rounded-2xl hover:bg-slate-100 transition cursor-pointer border border-slate-200/80"
              >
                <UserAvatar
                  name={activeUser.Full_Name}
                  email={activeUser.Email}
                  size="sm"
                  isOnline={true}
                />
                <div className="text-left hidden md:block pr-1">
                  <div className="text-xs font-bold text-slate-900 leading-tight">
                    {activeUser.Full_Name.split(' ')[0]}
                  </div>
                  <div className="text-[10px] text-slate-400 font-medium">
                    {activeUser.Role}
                  </div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              </button>

              {isUserMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsUserMenuOpen(false)}
                  />
                  <div className="fixed inset-x-3 top-14 sm:absolute sm:inset-auto sm:right-0 sm:mt-2 w-auto sm:w-64 bg-white rounded-2xl shadow-xl border border-slate-200/90 py-2 z-50 animate-scaleUp text-xs">
                    <div className="px-3.5 py-2 border-b border-slate-100">
                      <div className="font-bold text-slate-900 text-xs">{activeUser.Full_Name}</div>
                      <div className="text-[11px] text-slate-500 font-mono truncate">{activeUser.Email}</div>
                      <div className="text-[10px] text-[#6C70FF] font-bold mt-0.5">
                        {activeUser.Role} • {activeUser.Department}
                      </div>
                    </div>

                    {activeUser.Role === 'Admin' && (
                      <div className="py-1 border-t border-slate-100">
                        <div className="px-3.5 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Switch User (Admin):
                        </div>
                        {users.map((u, idx) => (
                          <button
                            key={`switch-${u.Email}-${u.User_ID || idx}`}
                            onClick={() => {
                              onSwitchUser(u.Email);
                              setIsUserMenuOpen(false);
                            }}
                            className={`w-full text-left px-3.5 py-2 flex items-center justify-between hover:bg-slate-50 transition cursor-pointer ${
                              u.Email === activeUser.Email ? 'font-bold text-[#6C70FF] bg-indigo-50/50' : 'text-slate-700'
                            }`}
                          >
                            <span className="truncate">{u.Full_Name}</span>
                            {u.Email === activeUser.Email && <Check className="w-3.5 h-3.5 text-[#6C70FF] shrink-0" />}
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="pt-1 border-t border-slate-100">
                      <button
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          onLogout();
                        }}
                        className="w-full text-left px-3.5 py-2 text-rose-600 hover:bg-rose-50 flex items-center space-x-2 font-semibold cursor-pointer"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Log Out</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
