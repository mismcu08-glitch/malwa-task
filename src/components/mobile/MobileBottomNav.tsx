import React from 'react';
import { LayoutGrid, Search, MessageSquare, User as UserIcon, Plus, Lock } from 'lucide-react';
import { NavigationTab } from '../Sidebar';
import { User } from '../../types';
import { isModuleAllowed, MODULE_IDS } from '../../utils/rbac';

export type MobileTab = 'HOME' | 'SEARCH' | 'DELEGATE' | 'INBOX' | 'PROFILE' | 'TASKS' | 'ADMIN';

interface MobileBottomNavProps {
  currentTab: NavigationTab;
  setCurrentTab: (tab: NavigationTab) => void;
  mobileActiveTab: MobileTab;
  setMobileActiveTab: (tab: MobileTab) => void;
  unreadCount?: number;
  onQuickDelegate: () => void;
  activeUser: User;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  mobileActiveTab,
  setMobileActiveTab,
  unreadCount = 0,
  onQuickDelegate,
  activeUser,
}) => {
  const isDelegateAllowed = isModuleAllowed(activeUser, MODULE_IDS.DELEGATE_TASK);

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-lg border-t border-slate-100/90 shadow-[0_-8px_24px_rgba(108,112,255,0.08)] rounded-t-[28px] px-4 py-2.5 max-w-lg mx-auto sm:max-w-none">
      <div className="flex items-center justify-around relative">
        {/* Tab 1: Dashboard / Home (Grid Icon) */}
        <button
          type="button"
          onClick={() => setMobileActiveTab('HOME')}
          className={`flex flex-col items-center justify-center p-2.5 rounded-2xl transition cursor-pointer min-h-[44px] min-w-[44px] ${
            mobileActiveTab === 'HOME'
              ? 'text-[#6C70FF]'
              : 'text-slate-400 hover:text-slate-600'
          }`}
          aria-label="Dashboard & Task Hub"
        >
          <div className="relative">
            <LayoutGrid className="w-5 h-5" strokeWidth={mobileActiveTab === 'HOME' ? 2.5 : 2} />
          </div>
        </button>

        {/* Tab 2: Search (Search Icon) */}
        <button
          type="button"
          onClick={() => setMobileActiveTab('SEARCH')}
          className={`flex flex-col items-center justify-center p-2.5 rounded-2xl transition cursor-pointer min-h-[44px] min-w-[44px] ${
            mobileActiveTab === 'SEARCH'
              ? 'text-[#6C70FF]'
              : 'text-slate-400 hover:text-slate-600'
          }`}
          aria-label="Search Tasks & SOPs"
        >
          <Search className="w-5 h-5" strokeWidth={mobileActiveTab === 'SEARCH' ? 2.5 : 2} />
        </button>

        {/* Center Floating Elevated '+' Button - strictly shown only if user has Delegate Task permission */}
        {isDelegateAllowed && (
          <div className="relative -top-5">
            <button
              type="button"
              onClick={onQuickDelegate}
              className="w-13 h-13 rounded-full flex items-center justify-center ring-4 ring-white transition cursor-pointer bg-[#6C70FF] hover:bg-[#5B5FF5] active:scale-95 text-white shadow-[0_8px_22px_rgba(108,112,255,0.45)]"
              aria-label="Delegate New Task"
              title="Delegate Task"
            >
              <Plus className="w-6 h-6 stroke-[2.5]" />
            </button>
          </div>
        )}

        {/* Tab 4: Inbox & Notifications (Chat Bubble with Red Dot) */}
        <button
          type="button"
          onClick={() => setMobileActiveTab('INBOX')}
          className={`flex flex-col items-center justify-center p-2.5 rounded-2xl transition cursor-pointer relative min-h-[44px] min-w-[44px] ${
            mobileActiveTab === 'INBOX'
              ? 'text-[#6C70FF]'
              : 'text-slate-400 hover:text-slate-600'
          }`}
          aria-label="Team Inbox & Updates"
        >
          <div className="relative">
            <MessageSquare className="w-5 h-5" strokeWidth={mobileActiveTab === 'INBOX' ? 2.5 : 2} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full ring-2 ring-white" />
            )}
          </div>
        </button>

        {/* Tab 5: Profile & Settings (User Icon) */}
        <button
          type="button"
          onClick={() => setMobileActiveTab('PROFILE')}
          className={`flex flex-col items-center justify-center p-2.5 rounded-2xl transition cursor-pointer min-h-[44px] min-w-[44px] ${
            mobileActiveTab === 'PROFILE'
              ? 'text-[#6C70FF]'
              : 'text-slate-400 hover:text-slate-600'
          }`}
          aria-label="Profile"
        >
          <UserIcon className="w-5 h-5" strokeWidth={mobileActiveTab === 'PROFILE' ? 2.5 : 2} />
        </button>
      </div>
    </nav>
  );
};

