import React, { useState } from 'react';
import { User, Role, Department, SYSTEM_MODULES } from '../../types';
import {
  ArrowLeft,
  Settings,
  Search,
  Sparkles,
  LifeBuoy,
  Star,
  Eye,
  LogOut,
  ChevronRight,
  Shield,
  Check,
  X,
  Phone,
  Lock,
  User as UserIcon,
  Building2,
  CheckCircle2
} from 'lucide-react';
import { UserAvatar } from './avatarUtils';
import { isModuleAllowed, MODULE_IDS, getAllowedModuleCount } from '../../utils/rbac';

interface MobileProfileViewProps {
  activeUser: User;
  users: User[];
  onBack: () => void;
  onLogout: () => void;
  onOpenSheetsModal: () => void;
  onOpenAnalytics: () => void;
  onNavigateToDelayed: () => void;
  onNavigateToAdmin: () => void;
  onSwitchUser?: (email: string) => void;
  onUpdateUser?: (updatedUser: User) => void;
}

export const MobileProfileView: React.FC<MobileProfileViewProps> = ({
  activeUser,
  users,
  onBack,
  onLogout,
  onOpenSheetsModal,
  onOpenAnalytics,
  onNavigateToDelayed,
  onNavigateToAdmin,
  onSwitchUser,
  onUpdateUser,
}) => {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSwitchUserOpen, setIsSwitchUserOpen] = useState(false);
  const [isPermissionsModalOpen, setIsPermissionsModalOpen] = useState(false);

  // Edit form state
  const [editName, setEditName] = useState(activeUser.Full_Name);
  const [editPhone, setEditPhone] = useState(activeUser.Phone_Number || '');
  const [editPassword, setEditPassword] = useState(activeUser.Password || '');

  const isSheetsAllowed = isModuleAllowed(activeUser, MODULE_IDS.SHEETS_SYNC);
  const isAnalyticsAllowed = isModuleAllowed(activeUser, MODULE_IDS.ANALYTICS);
  const isDelayedAllowed = isModuleAllowed(activeUser, MODULE_IDS.DELAYED_TASKS);
  const isAdminAllowed = isModuleAllowed(activeUser, MODULE_IDS.ADMIN);

  const allowedCount = getAllowedModuleCount(activeUser);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onUpdateUser) return;
    const updated: User = {
      ...activeUser,
      Full_Name: editName.trim() || activeUser.Full_Name,
      Phone_Number: editPhone.trim(),
      Password: editPassword.trim() || activeUser.Password,
    };
    onUpdateUser(updated);
    setIsEditModalOpen(false);
  };

  return (
    <div className="min-h-screen bg-white pb-28 animate-fadeIn">
      {/* Top Bar Header */}
      <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-slate-100">
        <button
          type="button"
          onClick={onBack}
          className="p-2 -ml-2 rounded-xl text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          aria-label="Back"
        >
          <ArrowLeft className="w-5 h-5 text-slate-800" />
        </button>

        <h1 className="text-base font-bold text-slate-900 tracking-tight">
          Profile & Access Control
        </h1>

        <div className="flex items-center space-x-1 -mr-2">
          {isAdminAllowed && (
            <button
              type="button"
              onClick={onNavigateToAdmin}
              className="p-2 rounded-xl text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              title="Admin Control"
            >
              <Settings className="w-5 h-5 text-slate-700" />
            </button>
          )}
          {isSheetsAllowed && (
            <button
              type="button"
              onClick={onOpenSheetsModal}
              className="p-2 rounded-xl text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              title="Database Sync"
            >
              <Search className="w-5 h-5 text-slate-700" />
            </button>
          )}
        </div>
      </div>

      {/* Profile Header Card */}
      <div className="pt-7 pb-4 px-6 text-center space-y-3">
        <div className="flex justify-center">
          <UserAvatar
            name={activeUser.Full_Name}
            email={activeUser.Email}
            size="xl"
            showCameraBadge={true}
            onCameraClick={() => setIsEditModalOpen(true)}
          />
        </div>

        <div className="space-y-0.5">
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
            {activeUser.Full_Name}
          </h2>
          <p className="text-xs text-slate-500 font-medium font-mono">
            {activeUser.Email}
          </p>
          <div className="flex items-center justify-center gap-1.5 pt-1">
            <span className="text-[11px] font-bold text-[#6C70FF] bg-[#6C70FF]/10 px-2.5 py-0.5 rounded-full">
              {activeUser.Role}
            </span>
            <span className="text-[11px] text-slate-500 font-medium">
              • {activeUser.Department}
            </span>
          </div>
        </div>

        {/* Live RBAC Permission Badge */}
        <div className="pt-1">
          <button
            type="button"
            onClick={() => setIsPermissionsModalOpen(true)}
            className="inline-flex items-center space-x-1.5 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100/80 px-3.5 py-1.5 rounded-xl border border-blue-200/70 transition cursor-pointer"
          >
            <Shield className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span>RBAC: {allowedCount} of {SYSTEM_MODULES.length} Modules Allowed</span>
            <ChevronRight className="w-3.5 h-3.5 text-blue-500" />
          </button>
        </div>

        {/* Primary "Edit Profile" Button */}
        <div className="pt-2">
          <button
            type="button"
            onClick={() => setIsEditModalOpen(true)}
            className="w-full py-3.5 px-6 bg-[#6C70FF] hover:bg-[#5C60FF] active:scale-[0.99] text-white font-bold text-sm rounded-2xl shadow-[0_6px_20px_rgba(108,112,255,0.35)] transition cursor-pointer"
          >
            Edit Profile
          </button>
        </div>
      </div>

      {/* Menu Options List - strictly shows only modules user has permission for */}
      <div className="px-5 divide-y divide-slate-100 mt-2">
        {/* Option 1: Google Sheets DB Live Sync (Module 5) */}
        {isSheetsAllowed && (
          <button
            type="button"
            onClick={onOpenSheetsModal}
            className="w-full py-3.5 flex items-center justify-between group -mx-2 px-2 rounded-xl transition text-left hover:bg-slate-50/70 cursor-pointer"
          >
            <div className="flex items-center space-x-3.5">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-2xs shrink-0 bg-blue-50 text-blue-600">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                  <span>Google Sheets DB Sync</span>
                </div>
                <p className="text-[11px] text-slate-400 font-medium">Module 5 • Live Spreadsheet Connection</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition" />
          </button>
        )}

        {/* Option 2: Operational Analytics MIS (Module 4) */}
        {isAnalyticsAllowed && (
          <button
            type="button"
            onClick={onOpenAnalytics}
            className="w-full py-3.5 flex items-center justify-between group -mx-2 px-2 rounded-xl transition text-left hover:bg-slate-50/70 cursor-pointer"
          >
            <div className="flex items-center space-x-3.5">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-2xs shrink-0 bg-amber-50 text-amber-600">
                <LifeBuoy className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                  <span>Operational Analytics MIS</span>
                </div>
                <p className="text-[11px] text-slate-400 font-medium">Module 4 • KPIs & Performance Metrics</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition" />
          </button>
        )}

        {/* Option 3: Delayed Tasks & Escalations (Module 3) */}
        {isDelayedAllowed && (
          <button
            type="button"
            onClick={onNavigateToDelayed}
            className="w-full py-3.5 flex items-center justify-between group -mx-2 px-2 rounded-xl transition text-left hover:bg-slate-50/70 cursor-pointer"
          >
            <div className="flex items-center space-x-3.5">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-2xs shrink-0 bg-rose-50 text-rose-600">
                <Star className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                  <span>Delayed Tasks & Escalations</span>
                </div>
                <p className="text-[11px] text-slate-400 font-medium">Module 3 • Overdue Tracker & Alerts</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition" />
          </button>
        )}

        {/* Option 4: Security & Permissions / Admin (Module 6) */}
        {isAdminAllowed && (
          <button
            type="button"
            onClick={onNavigateToAdmin}
            className="w-full py-3.5 flex items-center justify-between group -mx-2 px-2 rounded-xl transition text-left hover:bg-slate-50/70 cursor-pointer"
          >
            <div className="flex items-center space-x-3.5">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-2xs shrink-0 bg-emerald-50 text-emerald-600">
                <Eye className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                  <span>Admin & RBAC Control</span>
                </div>
                <p className="text-[11px] text-slate-400 font-medium">Module 6 • Role & Permission Management</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition" />
          </button>
        )}

        {/* Option 5: Switch User (Admin Only) */}
        {activeUser.Role === 'Admin' && onSwitchUser && (
          <button
            type="button"
            onClick={() => setIsSwitchUserOpen(true)}
            className="w-full py-3.5 flex items-center justify-between group hover:bg-slate-50/70 -mx-2 px-2 rounded-xl transition cursor-pointer text-left"
          >
            <div className="flex items-center space-x-3.5">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-2xs shrink-0">
                <Shield className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <span className="text-sm font-semibold text-slate-800">
                  Switch Active User
                </span>
                <p className="text-[11px] text-slate-400 font-medium">Admin Tool: Test RBAC as different employees</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition" />
          </button>
        )}

        {/* Option 6: Log out */}
        <button
          type="button"
          onClick={onLogout}
          className="w-full py-3.5 flex items-center justify-between group hover:bg-rose-50/70 -mx-2 px-2 rounded-xl transition cursor-pointer text-left"
        >
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shadow-2xs shrink-0">
              <LogOut className="w-5 h-5 text-rose-500" />
            </div>
            <div>
              <span className="text-sm font-bold text-rose-500">
                Log out
              </span>
              <p className="text-[11px] text-slate-400 font-medium">End current session securely</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-rose-400 group-hover:translate-x-0.5 transition" />
        </button>
      </div>

      {/* Permissions Breakdown Modal */}
      {isPermissionsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl border border-slate-100 max-w-sm w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Your RBAC Access
                  </h3>
                  <p className="text-[11px] text-slate-400">{activeUser.Full_Name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPermissionsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              The following modules are configured for your account by the System Administrator:
            </p>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {SYSTEM_MODULES.map((mod) => {
                const isAllowed = isModuleAllowed(activeUser, mod.id);
                return (
                  <div
                    key={mod.id}
                    className={`p-3 rounded-2xl border text-xs flex items-center justify-between transition ${
                      isAllowed
                        ? 'bg-emerald-50/50 border-emerald-200 text-emerald-900'
                        : 'bg-slate-50 border-slate-200 text-slate-400 opacity-60'
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <div className="font-bold flex items-center gap-1.5">
                        <span>Mod {mod.id}: {mod.name}</span>
                      </div>
                      <p className="text-[10px] text-slate-500 truncate mt-0.5">{mod.description}</p>
                    </div>
                    {isAllowed ? (
                      <span className="inline-flex items-center space-x-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full shrink-0">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Allowed</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center space-x-1 text-[10px] font-bold text-slate-500 bg-slate-200/80 px-2 py-0.5 rounded-full shrink-0">
                        <Lock className="w-3 h-3" />
                        <span>Locked</span>
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setIsPermissionsModalOpen(false)}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Profile Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl border border-slate-100 max-w-sm w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                Edit Profile Details
              </h3>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Full Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                  className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:border-[#6C70FF] outline-none text-slate-900 font-medium"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Phone Number</label>
                <input
                  type="text"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="+91 98260 00000"
                  className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:border-[#6C70FF] outline-none text-slate-900 font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Password</label>
                <input
                  type="text"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  required
                  className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:border-[#6C70FF] outline-none text-slate-900 font-mono font-bold text-[#6C70FF]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-slate-600 bg-slate-100 hover:bg-slate-200 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl text-white bg-[#6C70FF] hover:bg-[#5B5FF5] font-bold shadow-xs"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Switch User Modal (Demo Tool) */}
      {isSwitchUserOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl border border-slate-100 max-w-sm w-full p-5 shadow-2xl space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h3 className="text-sm font-bold text-slate-900">
                Switch User Session (RBAC Test)
              </h3>
              <button
                type="button"
                onClick={() => setIsSwitchUserOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-[11px] text-slate-500">
              Select any employee to immediately test their specific permissions & module restrictions on mobile and desktop:
            </p>

            <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 text-xs">
              {users.map((u, idx) => {
                const uAllowedCount = getAllowedModuleCount(u);
                return (
                  <button
                    key={`mobile-switch-${u.Email}-${u.User_ID || idx}`}
                    type="button"
                    onClick={() => {
                      if (onSwitchUser) onSwitchUser(u.Email);
                      setIsSwitchUserOpen(false);
                    }}
                    className={`w-full text-left p-3 flex items-center justify-between rounded-xl transition cursor-pointer ${
                      u.Email === activeUser.Email
                        ? 'bg-[#6C70FF]/10 font-bold text-[#6C70FF]'
                        : 'hover:bg-slate-50 text-slate-800'
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <div className="font-semibold truncate">{u.Full_Name}</div>
                      <div className="text-[10px] text-slate-400 truncate font-mono flex items-center gap-1.5 mt-0.5">
                        <span>{u.Role} — {u.Department}</span>
                        <span className="text-blue-600 font-bold">({uAllowedCount}/6 Mods)</span>
                      </div>
                    </div>
                    {u.Email === activeUser.Email && (
                      <Check className="w-4 h-4 text-[#6C70FF] shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
