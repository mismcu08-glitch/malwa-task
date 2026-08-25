import React, { useState } from 'react';
import {
  User,
  Role,
  Department,
  StageAssignmentConfig,
  TaskItem,
  SYSTEM_MODULES,
} from '../types';
import {
  Sliders,
  UserPlus,
  Edit2,
  Trash2,
  KeyRound,
  CheckCircle2,
  AlertTriangle,
  Users as UsersIcon,
  Shield,
  X,
  Lock,
  Unlock,
  CheckSquare,
  Square
} from 'lucide-react';
import { googleSheetSync } from '../services/googleSheetSync';
import { dataSyncBus } from '../services/dataSyncBus';
import { saveCloudUser, deleteCloudUser } from '../services/firebaseClient';

interface Module10AdminControlProps {
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  stageConfig?: StageAssignmentConfig;
  setStageConfig?: React.Dispatch<React.SetStateAction<StageAssignmentConfig>>;
  webhookUrl?: string;
  setWebhookUrl?: (url: string) => void;
  activeUser: User;
  tasks?: TaskItem[];
  setTasks?: React.Dispatch<React.SetStateAction<TaskItem[]>>;
  onOpenSheetsModal?: () => void;
  onSwitchUser?: (email: string) => void;
  setActiveUserEmail?: (email: string) => void;
  setCurrentAuthUserEmail?: (email: string | null) => void;
}

const ALL_ROLES: Role[] = [
  'Admin',
  'Manager',
  'Executive',
  'Production_Operator',
  'Storekeeper',
  'Driver',
  'Auditor',
  'Security',
];

const ALL_DEPARTMENTS: Department[] = [
  'Executive Systems',
  'Purchase & Ops',
  'Procurement & Stores',
  'Logistics & Dispatch',
  'Factory Ops',
  'Inventory & Store',
  'Fleet',
  'Quality & Compliance',
  'Security & Gate',
];

export const Module10AdminControl: React.FC<Module10AdminControlProps> = ({
  users,
  setUsers,
  activeUser,
  tasks = [],
  setTasks,
  onSwitchUser,
}) => {
  const [notice, setNotice] = useState<string>('');

  // User creation / edit state
  const [isCreatingUser, setIsCreatingUser] = useState<boolean>(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState<boolean>(false);

  // Form fields
  const [fullName, setFullName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [role, setRole] = useState<Role>('Executive');
  const [department, setDepartment] = useState<Department>('Procurement & Stores');
  const [phone, setPhone] = useState<string>('+91 98260 ');
  const [allowedModules, setAllowedModules] = useState<number[]>([1, 2, 3]);

  const handleOpenCreateUser = () => {
    setEditingUserId(null);
    setFullName('');
    setEmail('');
    setPassword('user123');
    setRole('Executive');
    setDepartment('Procurement & Stores');
    setPhone('+91 98260 ');
    setAllowedModules([1, 2, 3]);
    setIsCreatingUser(true);
  };

  const handleOpenEditUser = (u: User) => {
    setIsCreatingUser(false);
    setEditingUserId(u.User_ID);
    setFullName(u.Full_Name);
    setEmail(u.Email);
    setPassword(u.Password || (u.Role === 'Admin' ? 'admin' : 'user123'));
    setRole(u.Role);
    setDepartment(u.Department);
    setPhone(u.Phone_Number || '+91 98260 ');
    setAllowedModules(u.Allowed_Modules || (u.Role === 'Admin' ? [1, 2, 3, 4, 5, 6] : [1, 2, 3]));
  };

  const toggleModuleAccess = (moduleId: number) => {
    if (allowedModules.includes(moduleId)) {
      setAllowedModules(allowedModules.filter((m) => m !== moduleId));
    } else {
      setAllowedModules([...allowedModules, moduleId]);
    }
  };

  const handleSelectAllModules = () => {
    setAllowedModules(SYSTEM_MODULES.map((m) => m.id));
  };

  const handleClearAllModules = () => {
    setAllowedModules([]);
  };

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim() || !password.trim()) return;

    if (isCreatingUser) {
      const exists = users.some((u) => u.Email.toLowerCase() === email.toLowerCase().trim());
      if (exists) {
        alert('A user with this login email already exists in the system.');
        return;
      }

      // Generate a collision-free unique user ID
      let newUserId = `USR-${Math.floor(100 + Math.random() * 899)}`;
      while (users.some((u) => u.User_ID === newUserId)) {
        newUserId = `USR-${Math.floor(100 + Math.random() * 899)}`;
      }

      const newUser: User = {
        User_ID: newUserId,
        Full_Name: fullName.trim(),
        Email: email.toLowerCase().trim(),
        Password: password.trim(),
        Role: role,
        Department: department,
        Phone_Number: phone.trim(),
        Status: 'Active',
        Allowed_Modules: allowedModules,
      };

      const updated = [
        ...users.filter(
          (u) =>
            u.User_ID !== newUser.User_ID &&
            u.Email.toLowerCase().trim() !== newUser.Email.toLowerCase().trim()
        ),
        newUser,
      ];
      setUsers(updated);
      try {
        localStorage.setItem('malwa_fms_users', JSON.stringify(updated));
      } catch {}

      saveCloudUser(newUser);
      googleSheetSync.syncRecord('USER_RBAC', newUser, activeUser.Email, 'UPSERT_RECORD');
      dataSyncBus.broadcast('USER_CREATED', { newUser });
      setNotice(`New employee ${newUser.Full_Name} (${newUser.User_ID}) added.`);
    } else if (editingUserId) {
      const existing = users.find((u) => u.User_ID === editingUserId);
      if (!existing) return;

      const editedUser: User = {
        ...existing,
        Full_Name: fullName.trim(),
        Password: password.trim(),
        Role: role,
        Department: department,
        Phone_Number: phone.trim(),
        Allowed_Modules: allowedModules,
      };

      const updated = users.map((u) => (u.User_ID === editingUserId ? editedUser : u));
      setUsers(updated);
      try {
        localStorage.setItem('malwa_fms_users', JSON.stringify(updated));
      } catch {}

      saveCloudUser(editedUser);
      googleSheetSync.syncRecord('USER_RBAC', editedUser, activeUser.Email, 'UPSERT_RECORD');
      dataSyncBus.broadcast('USER_UPDATED', { updatedUser: editedUser });
      setNotice(`User ${editedUser.Full_Name} permissions updated.`);
    }

    setIsCreatingUser(false);
    setEditingUserId(null);
    setTimeout(() => setNotice(''), 4000);
  };

  const handleDeleteUserClick = (targetUser: User) => {
    if (targetUser.Email.toLowerCase() === activeUser.Email.toLowerCase()) {
      alert('Security Protection: You cannot delete your currently active administrator account.');
      return;
    }
    setUserToDelete(targetUser);
  };

  const handleConfirmDeleteUser = () => {
    if (!userToDelete) return;
    setIsDeletingUser(true);

    const targetUser = userToDelete;
    const fallback = users.find((u) => u.Role === 'Admin' && u.User_ID !== targetUser.User_ID) || users[0];

    const updatedUsers = users.filter(
      (u) => u.User_ID !== targetUser.User_ID && u.Email.toLowerCase() !== targetUser.Email.toLowerCase()
    );
    setUsers(updatedUsers);
    try {
      localStorage.setItem('malwa_fms_users', JSON.stringify(updatedUsers));
    } catch {}

    deleteCloudUser(targetUser.User_ID);

    // Cascade tasks in Task Hub
    if (setTasks && tasks.length > 0) {
      const updatedTasks = tasks.map((t) => {
        const isAssigned =
          t.Assigned_To?.toLowerCase() === targetUser.Full_Name.toLowerCase() ||
          t.Assigned_To_Email.toLowerCase() === targetUser.Email.toLowerCase();
        if (isAssigned) {
          return {
            ...t,
            Assigned_To: fallback.Full_Name,
            Assigned_To_Email: fallback.Email,
            Notes: `[Reassigned from deleted employee ${targetUser.Full_Name}]`,
          };
        }
        return t;
      });
      setTasks(updatedTasks);
    }

    googleSheetSync.syncRecord(
      'USER_RBAC',
      {
        User_ID: targetUser.User_ID,
        Email: targetUser.Email,
        Status: 'Deleted',
      },
      activeUser.Email,
      'DELETE_RECORD'
    );

    dataSyncBus.broadcast('USER_DELETED', {
      userId: targetUser.User_ID,
      userEmail: targetUser.Email,
    });

    setIsDeletingUser(false);
    setUserToDelete(null);
    setNotice(`Employee ${targetUser.Full_Name} deleted successfully.`);
    setTimeout(() => setNotice(''), 4000);
  };

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-slate-200 pb-3">
        <div>
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <Sliders className="w-5 h-5" />
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              Admin Control Panel & Granular RBAC
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Provision user accounts, configure credentials, and manage role-based access
          </p>
        </div>

        <div>
          <button
            onClick={handleOpenCreateUser}
            className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-xs px-3.5 py-2 rounded-xl transition flex items-center space-x-1.5 shadow-xs cursor-pointer min-h-[38px]"
          >
            <UserPlus className="w-4 h-4" />
            <span>Create New User</span>
          </button>
        </div>
      </div>

      {/* Notice Banner */}
      {notice && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-medium rounded-xl flex items-center space-x-2 animate-fadeIn shadow-2xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* Create / Edit User Form Card */}
      {(isCreatingUser || editingUserId) && (
        <div className="bg-white p-5 sm:p-6 rounded-2xl border-2 border-blue-500/40 shadow-sm space-y-4 animate-fadeIn">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <div className="flex items-center space-x-2">
              <KeyRound className="w-4 h-4 text-blue-600" />
              <h4 className="text-sm font-bold text-slate-900">
                {isCreatingUser ? 'Provision New Employee Account' : `Edit User Details: ${editingUserId}`}
              </h4>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsCreatingUser(false);
                setEditingUserId(null);
              }}
              className="text-xs text-slate-500 hover:text-slate-800 bg-slate-100 px-2.5 py-1 rounded-lg transition cursor-pointer"
            >
              Cancel
            </button>
          </div>

          <form onSubmit={handleSaveUser} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">Full Name *</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  required
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-xl bg-slate-50 focus:bg-white focus:border-blue-600 outline-none text-slate-900 min-h-[40px]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">Email (Login) *</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@malwaconcrete.com"
                  required
                  disabled={!isCreatingUser}
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-xl bg-slate-50 focus:bg-white focus:border-blue-600 outline-none disabled:opacity-60 text-slate-900 min-h-[40px]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">
                  Password *
                </label>
                <input
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  required
                  className="w-full text-xs font-mono font-bold p-2.5 border border-slate-300 rounded-xl bg-slate-50 focus:bg-white focus:border-blue-600 outline-none text-blue-700 min-h-[40px]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">Role *</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as Role)}
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-xl bg-slate-50 focus:bg-white focus:border-blue-600 outline-none font-medium text-slate-800 cursor-pointer min-h-[40px]"
                >
                  {ALL_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">Department *</label>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value as Department)}
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-xl bg-slate-50 focus:bg-white focus:border-blue-600 outline-none font-medium text-slate-800 cursor-pointer min-h-[40px]"
                >
                  {ALL_DEPARTMENTS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">Phone Number</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98260 00000"
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-xl bg-slate-50 focus:bg-white focus:border-blue-600 outline-none font-mono text-slate-900 min-h-[40px]"
                />
              </div>
            </div>

            {/* Granular Module Access Control */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <label className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                  <Shield className="w-4 h-4 text-blue-600" />
                  <span>Module Access Permissions (RBAC Lock)</span>
                </label>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={handleSelectAllModules}
                    className="text-[10px] font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded cursor-pointer transition"
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={handleClearAllModules}
                    className="text-[10px] font-bold text-slate-500 hover:text-slate-700 bg-slate-200/70 hover:bg-slate-200 px-2 py-0.5 rounded cursor-pointer transition"
                  >
                    Clear All
                  </button>
                  <span className="text-[11px] font-mono text-slate-500 font-bold ml-1">
                    {allowedModules.length}/{SYSTEM_MODULES.length}
                  </span>
                </div>
              </div>
              <p className="text-[11px] text-slate-500">
                Check modules this employee is permitted to view & operate. Unchecked modules are strictly locked.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                {SYSTEM_MODULES.map((mod) => {
                  const isChecked = allowedModules.includes(mod.id);
                  return (
                    <button
                      key={mod.id}
                      type="button"
                      onClick={() => toggleModuleAccess(mod.id)}
                      className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex items-center space-x-2.5 ${
                        isChecked
                          ? 'bg-blue-50 border-blue-300 text-blue-900 shadow-2xs'
                          : 'bg-white border-slate-200 text-slate-500 opacity-60 hover:opacity-100'
                      }`}
                    >
                      {isChecked ? (
                        <CheckSquare className="w-4 h-4 text-blue-600 shrink-0" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400 shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold truncate flex items-center justify-between">
                          <span>{mod.name}</span>
                          <span className="text-[10px] font-mono font-bold text-blue-700 bg-blue-100/60 px-1.5 py-0.2 rounded">Mod {mod.id}</span>
                        </div>
                        <p className="text-[10px] text-slate-500 truncate">{mod.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setIsCreatingUser(false);
                  setEditingUserId(null);
                }}
                className="text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 px-4 py-2 rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-5 py-2 rounded-xl transition shadow-2xs cursor-pointer"
              >
                {isCreatingUser ? 'Create User Account' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* User Directory: Mobile Cards & Desktop Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <UsersIcon className="w-4 h-4 text-blue-600" />
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Registered Employees ({users.length})
            </h3>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            Active Administrator: {activeUser.Full_Name}
          </span>
        </div>

        {/* Mobile Cards View (Visible on < md) */}
        <div className="block md:hidden divide-y divide-slate-100">
          {users.map((u, idx) => (
            <div key={`user-card-${u.User_ID}-${u.Email}-${idx}`} className="p-4 space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                      {u.User_ID}
                    </span>
                    <span
                      className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${
                        u.Role === 'Admin'
                          ? 'bg-purple-100 text-purple-800'
                          : u.Role === 'Manager'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {u.Role}
                    </span>
                  </div>
                  <h4 className="font-bold text-slate-900 text-sm mt-1">{u.Full_Name}</h4>
                  <p className="text-xs font-mono text-slate-500">{u.Email}</p>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Password</span>
                  <span className="text-xs font-mono font-bold text-blue-700 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                    {u.Password || (u.Role === 'Admin' ? 'admin' : 'user123')}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-600">
                <div>
                  <span className="text-slate-400">Department: </span>
                  <span className="font-medium text-slate-800">{u.Department}</span>
                </div>
                <div className="flex items-center space-x-1 text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200/60">
                  <Shield className="w-3 h-3 text-blue-600" />
                  <span>{u.Role === 'Admin' ? '6/6' : `${u.Allowed_Modules?.length ?? 3}/6`} Modules</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-50">
                {onSwitchUser && u.User_ID !== activeUser.User_ID && (
                  <button
                    onClick={() => onSwitchUser(u.Email)}
                    className="px-3 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition cursor-pointer min-h-[34px]"
                  >
                    Login As
                  </button>
                )}
                <button
                  onClick={() => handleOpenEditUser(u)}
                  className="p-2 text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 rounded-lg cursor-pointer min-w-[34px] min-h-[34px] flex items-center justify-center"
                  title="Edit User"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                {u.User_ID !== activeUser.User_ID && (
                  <button
                    onClick={() => handleDeleteUserClick(u)}
                    className="p-2 text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 rounded-lg cursor-pointer min-w-[34px] min-h-[34px] flex items-center justify-center"
                    title="Delete User"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Desktop Table View (Visible on >= md) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                <th className="p-3">User ID</th>
                <th className="p-3">Employee Name</th>
                <th className="p-3">Email (Login)</th>
                <th className="p-3">Password</th>
                <th className="p-3">Role</th>
                <th className="p-3">Department</th>
                <th className="p-3">Module Access</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u, idx) => (
                <tr key={`user-row-${u.User_ID}-${u.Email}-${idx}`} className="hover:bg-slate-50 transition">
                  <td className="p-3 font-mono font-bold text-blue-700">{u.User_ID}</td>
                  <td className="p-3 font-bold text-slate-900">{u.Full_Name}</td>
                  <td className="p-3 font-mono text-slate-600">{u.Email}</td>
                  <td className="p-3">
                    <span className="font-mono font-bold text-blue-700 bg-slate-100 px-2 py-1 rounded border border-slate-200">
                      {u.Password || (u.Role === 'Admin' ? 'admin' : 'user123')}
                    </span>
                  </td>
                  <td className="p-3">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${
                        u.Role === 'Admin'
                          ? 'bg-purple-100 text-purple-800'
                          : u.Role === 'Manager'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {u.Role}
                    </span>
                  </td>
                  <td className="p-3 text-slate-600">{u.Department}</td>
                  <td className="p-3">
                    <span className="inline-flex items-center space-x-1 text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200/60">
                      <Shield className="w-3 h-3 text-blue-600" />
                      <span>{u.Role === 'Admin' ? '6/6' : `${u.Allowed_Modules?.length ?? 3}/6`} Modules</span>
                    </span>
                  </td>
                  <td className="p-3 text-right space-x-1 whitespace-nowrap">
                    {onSwitchUser && u.User_ID !== activeUser.User_ID && (
                      <button
                        onClick={() => onSwitchUser(u.Email)}
                        title={`Switch active session to ${u.Full_Name}`}
                        className="px-2.5 py-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition cursor-pointer"
                      >
                        Login As
                      </button>
                    )}
                    <button
                      onClick={() => handleOpenEditUser(u)}
                      title="Edit User & Permissions"
                      className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    {u.User_ID !== activeUser.User_ID && (
                      <button
                        onClick={() => handleDeleteUserClick(u)}
                        title="Delete User"
                        className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete User Confirmation Modal */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2 text-rose-600">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="text-sm font-bold text-slate-900">Confirm Employee Deletion</h3>
              </div>
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600">
              <p>
                Are you sure you want to delete the employee account for{' '}
                <strong className="text-slate-900 font-bold">{userToDelete.Full_Name}</strong>?
              </p>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5 font-mono text-[11px]">
                <div><span className="text-slate-400">User ID:</span> {userToDelete.User_ID}</div>
                <div><span className="text-slate-400">Email:</span> {userToDelete.Email}</div>
                <div><span className="text-slate-400">Role:</span> {userToDelete.Role}</div>
                <div><span className="text-slate-400">Department:</span> {userToDelete.Department}</div>
              </div>

              <p className="text-[11px] text-amber-700 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                ⚠️ Any tasks assigned to this employee in the Task Hub will be reassigned to the administrator.
              </p>
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                disabled={isDeletingUser}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteUser}
                disabled={isDeletingUser}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 rounded-xl transition shadow-2xs cursor-pointer flex items-center space-x-1.5 disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeletingUser ? 'Deleting...' : 'Delete Employee'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
