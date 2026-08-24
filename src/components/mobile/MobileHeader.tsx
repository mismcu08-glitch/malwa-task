import React from 'react';
import { User, OnlinePresenceUser } from '../../types';
import { Menu, Bell } from 'lucide-react';
import { UserAvatar } from './avatarUtils';

interface MobileHeaderProps {
  activeUser: User;
  onToggleSidebar: () => void;
  onOpenNotifications: () => void;
  unreadCount?: number;
  onlineUsers?: OnlinePresenceUser[];
  onOpenProfile?: () => void;
}

export const MobileHeader: React.FC<MobileHeaderProps> = ({
  activeUser,
  onToggleSidebar,
  onOpenNotifications,
  unreadCount = 0,
  onOpenProfile,
}) => {
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning!';
    if (hour < 17) return 'Good Afternoon!';
    return 'Good Evening!';
  };

  const firstName = activeUser.Full_Name.split(' ')[0] || activeUser.Full_Name;

  return (
    <div className="bg-gradient-to-r from-[#6568FE] via-[#6E71FE] to-[#797DFF] text-white pt-5 pb-9 px-5">
      <div className="flex items-center justify-between">
        {/* Left: User Avatar & Greeting */}
        <div className="flex items-center space-x-3 min-w-0">
          <div
            onClick={onOpenProfile}
            className="cursor-pointer hover:opacity-90 transition shrink-0"
          >
            <UserAvatar
              name={activeUser.Full_Name}
              email={activeUser.Email}
              size="md"
              isOnline={true}
            />
          </div>

          <div className="min-w-0">
            <h2 className="text-base font-bold text-white tracking-tight truncate leading-tight">
              {activeUser.Full_Name}
            </h2>
            <p className="text-xs text-white/80 font-medium truncate">
              Hi {firstName}, {getGreeting()}
            </p>
          </div>
        </div>

        {/* Right: Hamburger Menu & Notification Bell */}
        <div className="flex items-center space-x-2 shrink-0">
          <button
            type="button"
            onClick={onToggleSidebar}
            className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 active:scale-95 text-white flex items-center justify-center transition cursor-pointer"
            aria-label="Navigation Menu"
          >
            <Menu className="w-5 h-5 text-white" />
          </button>

          <button
            type="button"
            onClick={onOpenNotifications}
            className="relative w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 active:scale-95 text-white flex items-center justify-center transition cursor-pointer"
            aria-label="Notifications"
          >
            <Bell className="w-4.5 h-4.5 text-white" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-[#6E71FE]" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
