import React from 'react';
import { User, OnlinePresenceUser } from '../types';
import {
  Building2,
  CheckSquare,
  PlusCircle,
  ClockAlert,
  BarChart3,
  FileSpreadsheet,
  Sliders,
  LogOut,
  X
} from 'lucide-react';
import { UserAvatar } from './mobile/avatarUtils';
import { isModuleAllowed, MODULE_IDS } from '../utils/rbac';
import { MobileTab } from './mobile/MobileBottomNav';

export type NavigationTab = 'TASK_HUB' | 'DELEGATE_TASK' | 'DELAYED_TASKS' | 'ADMIN';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  currentTab: NavigationTab;
  setCurrentTab: (tab: NavigationTab) => void;
  onMobileTabChange?: (tab: MobileTab) => void;
  onOpenAnalytics: () => void;
  onOpenSheetsModal: () => void;
  activeUser: User;
  onLogout: () => void;
  overdueCount: number;
  onlineUsers: OnlinePresenceUser[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  currentTab,
  setCurrentTab,
  onMobileTabChange,
  onOpenAnalytics,
  onOpenSheetsModal,
  activeUser,
  onLogout,
  overdueCount,
}) => {
  const handleNavClick = (tab: NavigationTab) => {
    setCurrentTab(tab);
    if (onMobileTabChange) {
      if (tab === 'TASK_HUB') onMobileTabChange('HOME');
      else if (tab === 'DELEGATE_TASK') onMobileTabChange('DELEGATE');
      else if (tab === 'DELAYED_TASKS') onMobileTabChange('TASKS');
      else if (tab === 'ADMIN') onMobileTabChange('ADMIN');
    }
    onClose();
  };

  const handleActionClick = (action: () => void, moduleId: number) => {
    if (!isModuleAllowed(activeUser, moduleId)) return;
    action();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden animate-fadeIn">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <aside className="fixed top-0 bottom-0 left-0 z-50 bg-white text-slate-900 flex flex-col justify-between w-72 max-w-[85vw] border-r border-slate-200 shadow-2xl animate-slideRight">
        {/* Top Header */}
        <div>
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center space-x-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#6C70FF] to-[#8C8EFF] flex items-center justify-center text-white shrink-0 shadow-sm">
                <Building2 className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h2 className="font-extrabold text-sm text-slate-900 truncate">
                  Malwa Concrete
                </h2>
                <p className="text-[10px] text-slate-400 font-medium">
                  FMS Operations & SOPs
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-100 transition cursor-pointer"
              aria-label="Close navigation"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* User Profile Mini Banner */}
          <div className="p-3.5 mx-3 mt-3 rounded-2xl bg-indigo-50/60 border border-indigo-100/80 flex items-center space-x-3">
            <UserAvatar name={activeUser.Full_Name} email={activeUser.Email} size="sm" isOnline={true} />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-900 truncate">{activeUser.Full_Name}</p>
              <p className="text-[10px] text-slate-500 font-medium truncate">{activeUser.Role} • {activeUser.Department}</p>
            </div>
          </div>

          {/* Navigation Items */}
          <div className="p-3 space-y-1.5">
            {isModuleAllowed(activeUser, MODULE_IDS.TASK_HUB) && (
              <button
                onClick={() => handleNavClick('TASK_HUB')}
                className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  currentTab === 'TASK_HUB'
                    ? 'bg-[#6C70FF] text-white shadow-sm'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <CheckSquare className={`w-4 h-4 ${currentTab === 'TASK_HUB' ? 'text-white' : 'text-[#6C70FF]'}`} />
                <span>Task & Routine Hub</span>
              </button>
            )}

            {isModuleAllowed(activeUser, MODULE_IDS.DELEGATE_TASK) && (
              <button
                onClick={() => handleNavClick('DELEGATE_TASK')}
                className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  currentTab === 'DELEGATE_TASK'
                    ? 'bg-[#6C70FF] text-white shadow-sm'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <PlusCircle className={`w-4 h-4 ${currentTab === 'DELEGATE_TASK' ? 'text-white' : 'text-emerald-600'}`} />
                <span>Delegate Task</span>
              </button>
            )}

            {isModuleAllowed(activeUser, MODULE_IDS.DELAYED_TASKS) && (
              <button
                onClick={() => handleNavClick('DELAYED_TASKS')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  currentTab === 'DELAYED_TASKS'
                    ? 'bg-rose-500 text-white shadow-sm'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <ClockAlert className={`w-4 h-4 ${currentTab === 'DELAYED_TASKS' ? 'text-white' : 'text-rose-600'}`} />
                  <span>Delayed MIS</span>
                </div>
                {overdueCount > 0 && (
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full font-mono ${
                      currentTab === 'DELAYED_TASKS' ? 'bg-white text-rose-600' : 'bg-rose-600 text-white'
                    }`}
                  >
                    {overdueCount}
                  </span>
                )}
              </button>
            )}

            {(isModuleAllowed(activeUser, MODULE_IDS.ANALYTICS) ||
              isModuleAllowed(activeUser, MODULE_IDS.SHEETS_SYNC)) && (
              <div className="pt-3 pb-1 px-3.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Tools & Data
              </div>
            )}

            {isModuleAllowed(activeUser, MODULE_IDS.ANALYTICS) && (
              <button
                onClick={() => handleActionClick(onOpenAnalytics, MODULE_IDS.ANALYTICS)}
                className="w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
              >
                <BarChart3 className="w-4 h-4 text-[#6C70FF] shrink-0" />
                <span>Operational Analytics</span>
              </button>
            )}

            {isModuleAllowed(activeUser, MODULE_IDS.SHEETS_SYNC) && (
              <button
                onClick={() => handleActionClick(onOpenSheetsModal, MODULE_IDS.SHEETS_SYNC)}
                className="w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Google Sheets DB Sync</span>
              </button>
            )}

            {isModuleAllowed(activeUser, MODULE_IDS.ADMIN) && (
              <>
                <div className="pt-3 pb-1 px-3.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Administration
                </div>
                <button
                  onClick={() => handleNavClick('ADMIN')}
                  className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    currentTab === 'ADMIN'
                      ? 'bg-[#6C70FF] text-white shadow-sm'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Sliders className={`w-4 h-4 ${currentTab === 'ADMIN' ? 'text-white' : 'text-[#6C70FF]'}`} />
                  <span>Admin & RBAC Control</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-100 space-y-2">
          <div className="px-3 py-1 flex items-center justify-between text-[11px] text-slate-500">
            <span className="flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Cloud Realtime</span>
            </span>
            <span className="font-mono text-[10px] font-semibold text-[#6C70FF] bg-indigo-50 px-2 py-0.5 rounded-md">
              {activeUser.Role}
            </span>
          </div>

          <button
            onClick={onLogout}
            className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 transition cursor-pointer"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span>Log Out</span>
          </button>
        </div>
      </aside>
    </div>
  );
};
