import React, { useState, useEffect, useMemo } from 'react';
import {
  User,
  TaskItem,
  StageAssignmentConfig,
  InventoryItem,
  TruckGateEntry,
  PurchaseIndent,
  DispatchItem,
  ApplicationItem,
  TicketItem,
  StockTransaction,
  OnlinePresenceUser,
  SYSTEM_MODULES,
} from './types';
import {
  INITIAL_USERS,
  INITIAL_TASKS,
  INITIAL_STAGE_ASSIGNMENTS,
  INITIAL_INVENTORY,
} from './data/initialData';
import { TaskHub } from './components/TaskHub';
import { DelegateTaskView } from './components/DelegateTaskView';
import { Module8DelayedTasks } from './components/Module8DelayedTasks';
import { Module10AdminControl } from './components/Module10AdminControl';
import { GoogleSheetsSyncModal } from './components/GoogleSheetsSyncModal';
import { AnalyticsDashboardModal } from './components/AnalyticsDashboardModal';
import { TaskDetailModal } from './components/TaskDetailModal';
import { CollaborativeHeader } from './components/CollaborativeHeader';
import { Sidebar, NavigationTab } from './components/Sidebar';
import { LoginPage } from './components/LoginPage';
import { MobileBottomNav, MobileTab } from './components/mobile/MobileBottomNav';
import { MobileHeader } from './components/mobile/MobileHeader';
import { MobileProfileView } from './components/mobile/MobileProfileView';
import { MobileInboxView } from './components/mobile/MobileInboxView';
import { MobileTaskDashboard } from './components/mobile/MobileTaskDashboard';
import { MobileSearchView } from './components/mobile/MobileSearchView';
import { Lock, ShieldAlert } from 'lucide-react';
import { realtimeSync } from './services/realtimeSync';
import { dataSyncBus } from './services/dataSyncBus';
import { pushNotificationService } from './services/pushNotificationService';
import { googleSheetSync } from './services/googleSheetSync';
import { isModuleAllowed, MODULE_IDS, getModuleInfo } from './utils/rbac';
import { createNextRecurringInstance, checkAndSyncRecurringRoutines } from './utils/recurringTaskManager';

export default function App() {
  const DEMO_EMAILS_TO_REMOVE = new Set([
    'chetan.naroliya@malwaconcrete.com',
    'arun.gour@malwaconcrete.com',
    'rahul.sharma@malwaconcrete.com',
    'sunil.verma@malwaconcrete.com',
    'vikram.patel@malwaconcrete.com',
  ]);

  const DEMO_TASK_IDS = new Set(['TSK-301', 'TSK-302', 'TSK-303', 'TSK-304']);

  // Helper to deduplicate users by unique User_ID and Email & remove old demo accounts
  const deduplicateUsers = (userList: User[]): User[] => {
    if (!Array.isArray(userList)) return INITIAL_USERS;
    const unique: User[] = [];
    const seenIds = new Set<string>();
    const seenEmails = new Set<string>();
    for (const u of userList) {
      if (!u || !u.User_ID || !u.Email) continue;
      const idKey = String(u.User_ID).trim();
      const emailKey = String(u.Email).toLowerCase().trim();
      if (DEMO_EMAILS_TO_REMOVE.has(emailKey)) continue; // Purge demo accounts
      if (!seenIds.has(idKey) && !seenEmails.has(emailKey)) {
        seenIds.add(idKey);
        seenEmails.add(emailKey);
        unique.push(u);
      }
    }
    return unique.length > 0 ? unique : INITIAL_USERS;
  };

  // State: Users & Authentication (starts clean with only Amit Meena)
  const [users, setUsers] = useState<User[]>(() => {
    try {
      const saved = localStorage.getItem('malwa_fms_users');
      const parsed: User[] = saved ? JSON.parse(saved) : INITIAL_USERS;
      return deduplicateUsers(parsed);
    } catch {
      return INITIAL_USERS;
    }
  });

  // Always show Login Page on initial app open
  const [activeUserEmail, setActiveUserEmail] = useState<string | null>(null);

  // State: Tasks (purges demo tasks)
  const [tasks, setTasks] = useState<TaskItem[]>(() => {
    try {
      const saved = localStorage.getItem('malwa_fms_tasks');
      if (saved) {
        const parsed: TaskItem[] = JSON.parse(saved);
        const filtered = parsed.filter((t) => !DEMO_TASK_IDS.has(t.Task_ID));
        return filtered;
      }
      return INITIAL_TASKS;
    } catch {
      return INITIAL_TASKS;
    }
  });

  // State: Stage Assignments & Integrations
  const [stageConfig, setStageConfig] = useState<StageAssignmentConfig>(() => {
    try {
      const saved = localStorage.getItem('malwa_fms_stage_config');
      return saved ? JSON.parse(saved) : INITIAL_STAGE_ASSIGNMENTS;
    } catch {
      return INITIAL_STAGE_ASSIGNMENTS;
    }
  });

  const [webhookUrl, setWebhookUrl] = useState<string>(() => {
    try {
      return localStorage.getItem('malwa_fms_webhook_url') || '';
    } catch {
      return '';
    }
  });

  // Navigation & Modals
  const [currentTab, setCurrentTab] = useState<NavigationTab>('TASK_HUB');
  const [mobileActiveTab, setMobileActiveTab] = useState<MobileTab>('HOME');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isSheetsModalOpen, setIsSheetsModalOpen] = useState<boolean>(false);
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState<boolean>(false);
  const [selectedTaskForDetails, setSelectedTaskForDetails] = useState<TaskItem | null>(null);
  const [taskToEditForDelegate, setTaskToEditForDelegate] = useState<TaskItem | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<OnlinePresenceUser[]>([]);

  // Find active user object (returns null when not logged in -> displays LoginPage)
  const activeUser = useMemo(() => {
    if (!activeUserEmail) return null;
    return users.find((u) => u.Email.toLowerCase() === activeUserEmail.toLowerCase()) || null;
  }, [users, activeUserEmail]);

  // Persist Users
  useEffect(() => {
    try {
      localStorage.setItem('malwa_fms_users', JSON.stringify(deduplicateUsers(users)));
    } catch (e) {
      console.warn('Error saving users', e);
    }
  }, [users]);

  // Persist Tasks
  useEffect(() => {
    try {
      localStorage.setItem('malwa_fms_tasks', JSON.stringify(tasks));
    } catch (e) {
      console.warn('Error saving tasks', e);
    }
  }, [tasks]);

  // Persist Stage Config
  useEffect(() => {
    try {
      localStorage.setItem('malwa_fms_stage_config', JSON.stringify(stageConfig));
    } catch (e) {
      console.warn('Error saving stage config', e);
    }
  }, [stageConfig]);

  // Initialize Real-Time WebSocket & Bus Listeners
  useEffect(() => {
    if (!activeUser) return;

    realtimeSync.init(activeUser);

    const unsubRealtime = realtimeSync.subscribe((event, payload) => {
      if (event === 'TASK_MUTATION' || event === 'REMOTE_TASK_MUTATION') {
        const { action, task } = payload;
        setTasks((prevTasks) => {
          if (action === 'CREATE') {
            if (prevTasks.some((t) => t.Task_ID === task.Task_ID)) return prevTasks;
            return [task, ...prevTasks];
          } else if (action === 'UPDATE' || action === 'SUBTASK_TOGGLE' || action === 'COMPLETE') {
            return prevTasks.map((t) => (t.Task_ID === task.Task_ID ? task : t));
          } else if (action === 'DELETE') {
            return prevTasks.filter((t) => t.Task_ID !== task.Task_ID);
          }
          return prevTasks;
        });
      }
    });

    const unsubPresence = realtimeSync.subscribePresence((list) => {
      setOnlineUsers(list);
    });

    const unsubBus = dataSyncBus.subscribe((event, data) => {
      if (event === 'USER_CREATED') {
        setUsers((prev) => {
          if (
            prev.some(
              (u) =>
                u.User_ID === data.newUser.User_ID ||
                u.Email.toLowerCase().trim() === data.newUser.Email.toLowerCase().trim()
            )
          ) {
            return prev;
          }
          return [...prev, data.newUser];
        });
      } else if (event === 'USER_UPDATED') {
        setUsers((prev) =>
          prev.map((u) => (u.User_ID === data.updatedUser.User_ID ? data.updatedUser : u))
        );
      } else if (event === 'USER_DELETED') {
        setUsers((prev) =>
          prev.filter(
            (u) =>
              u.User_ID !== data.userId &&
              u.Email.toLowerCase().trim() !== data.userEmail.toLowerCase().trim()
          )
        );
      }
    });

    return () => {
      unsubRealtime();
      unsubPresence();
      unsubBus();
    };
  }, [activeUser]);

  // Periodic Deadline Checker & Recurring Routines Sync
  useEffect(() => {
    if (!activeUser) return;
    pushNotificationService.checkUpcomingDeadlines(tasks, activeUser);

    // Check and generate active recurring routines
    const { updatedTasks, createdTasks } = checkAndSyncRecurringRoutines(tasks, activeUser);
    if (createdTasks.length > 0) {
      setTasks(updatedTasks);
      createdTasks.forEach((newRec) => {
        googleSheetSync.syncRecord('TASK_HUB', newRec, activeUser.Email, 'UPSERT_RECORD');
        realtimeSync.broadcastTaskMutation('CREATE', newRec, activeUser);
        pushNotificationService.notifyTaskAssigned(newRec, 'Routine Engine');
      });
    }

    const interval = setInterval(() => {
      pushNotificationService.checkUpcomingDeadlines(tasks, activeUser);
      const res = checkAndSyncRecurringRoutines(tasks, activeUser);
      if (res.createdTasks.length > 0) {
        setTasks(res.updatedTasks);
        res.createdTasks.forEach((newRec) => {
          googleSheetSync.syncRecord('TASK_HUB', newRec, activeUser.Email, 'UPSERT_RECORD');
          realtimeSync.broadcastTaskMutation('CREATE', newRec, activeUser);
          pushNotificationService.notifyTaskAssigned(newRec, 'Routine Engine');
        });
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [tasks, activeUser]);

  // Enforce Navigation Access Permission Consistency
  useEffect(() => {
    if (!activeUser) return;

    // Desktop Tab Check
    if (currentTab === 'DELEGATE_TASK' && !isModuleAllowed(activeUser, MODULE_IDS.DELEGATE_TASK)) {
      setCurrentTab('TASK_HUB');
    } else if (currentTab === 'MODULE_8' && !isModuleAllowed(activeUser, MODULE_IDS.DELAYED_TASKS)) {
      setCurrentTab('TASK_HUB');
    } else if (currentTab === 'ADMIN' && !isModuleAllowed(activeUser, MODULE_IDS.ADMIN)) {
      setCurrentTab('TASK_HUB');
    }

    // Mobile Tab Check
    if (mobileActiveTab === 'DELEGATE' && !isModuleAllowed(activeUser, MODULE_IDS.DELEGATE_TASK)) {
      setMobileActiveTab('HOME');
    } else if (mobileActiveTab === 'TASKS' && !isModuleAllowed(activeUser, MODULE_IDS.DELAYED_TASKS)) {
      setMobileActiveTab('HOME');
    } else if (mobileActiveTab === 'ADMIN' && !isModuleAllowed(activeUser, MODULE_IDS.ADMIN)) {
      setMobileActiveTab('HOME');
    }
  }, [activeUser, currentTab, mobileActiveTab]);

  const handleLogin = (user: User) => {
    setActiveUserEmail(user.Email);
    try {
      localStorage.setItem('malwa_fms_active_user_email', user.Email);
    } catch {}
    realtimeSync.init(user);
    pushNotificationService.triggerPushNotification(
      'Session Authenticated',
      `Welcome ${user.Full_Name} (${user.Role} - ${user.Department})`,
      'UPDATE',
      user.Email
    );
  };

  const handleLogout = () => {
    setActiveUserEmail(null);
    try {
      localStorage.removeItem('malwa_fms_active_user_email');
    } catch {}
  };

  const handleSwitchUser = (email: string) => {
    const target = users.find((u) => u.Email.toLowerCase() === email.toLowerCase());
    if (target) {
      setActiveUserEmail(target.Email);
      try {
        localStorage.setItem('malwa_fms_active_user_email', target.Email);
      } catch {}
      realtimeSync.init(target);
    }
  };

  const handleUpdateTaskFromModal = (updatedTask: TaskItem) => {
    const nextTasks = tasks.map((t) => (t.Task_ID === updatedTask.Task_ID ? updatedTask : t));
    setTasks(nextTasks);
    setSelectedTaskForDetails(updatedTask);
  };

  const handleDeleteTask = (taskId: string) => {
    const taskToDelete = tasks.find((t) => t.Task_ID === taskId);
    const remaining = tasks.filter((t) => t.Task_ID !== taskId);
    setTasks(remaining);
    if (taskToDelete && activeUser) {
      realtimeSync.broadcastTaskMutation('DELETE', taskToDelete, activeUser);
      googleSheetSync.syncRecord('TASK_HUB', taskToDelete, activeUser.Email, 'DELETE_RECORD');
    }
    if (selectedTaskForDetails?.Task_ID === taskId) {
      setSelectedTaskForDetails(null);
    }
  };

  const handleNavigateToDelegate = (taskToEdit?: TaskItem) => {
    if (taskToEdit) {
      setTaskToEditForDelegate(taskToEdit);
    } else {
      setTaskToEditForDelegate(null);
    }
    setCurrentTab('DELEGATE_TASK');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Calculate Overdue Task Count
  const todayStr = new Date().toISOString().split('T')[0];
  const overdueCount = useMemo(() => {
    return tasks.filter(
      (t) => (t.Due_Date < todayStr && t.Status !== 'Completed') || t.Status === 'Overdue'
    ).length;
  }, [tasks, todayStr]);

  const handleUpdateUser = (updatedUser: User) => {
    setUsers((prev) => prev.map((u) => (u.User_ID === updatedUser.User_ID ? updatedUser : u)));
    try {
      const updatedList = users.map((u) => (u.User_ID === updatedUser.User_ID ? updatedUser : u));
      localStorage.setItem('malwa_fms_users', JSON.stringify(updatedList));
    } catch {}
    dataSyncBus.broadcast('USER_UPDATED', { updatedUser });
  };

  // Notification count
  const [notifications, setNotifications] = useState<any[]>([]);
  useEffect(() => {
    const unsub = pushNotificationService.subscribe((list) => {
      setNotifications(list);
    });
    return () => unsub();
  }, []);

  const unreadNotifCount = notifications.filter(
    (n) => !n.read && (n.targetEmail === 'ALL' || n.targetEmail.toLowerCase() === activeUser?.Email.toLowerCase())
  ).length;

  if (!activeUser) {
    return <LoginPage users={users} onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Sidebar Navigation Drawer */}
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        onMobileTabChange={setMobileActiveTab}
        onOpenAnalytics={() => {
          if (isModuleAllowed(activeUser, MODULE_IDS.ANALYTICS)) {
            setIsAnalyticsOpen(true);
          }
        }}
        onOpenSheetsModal={() => {
          if (isModuleAllowed(activeUser, MODULE_IDS.SHEETS_SYNC)) {
            setIsSheetsModalOpen(true);
          }
        }}
        activeUser={activeUser}
        onLogout={handleLogout}
        overdueCount={overdueCount}
        onlineUsers={onlineUsers}
      />

      {/* ========================================================================= */}
      {/* MOBILE EXPERIENCE (< md) Matching Reference Screenshots 1, 2, and 3        */}
      {/* ========================================================================= */}
      <div className="block md:hidden min-h-screen flex flex-col">
        {/* Mobile Header: Visible on HOME & TASKS */}
        {mobileActiveTab === 'HOME' && (
          <MobileHeader
            activeUser={activeUser}
            onToggleSidebar={() => setIsSidebarOpen(true)}
            onOpenNotifications={() => setMobileActiveTab('INBOX')}
            unreadCount={unreadNotifCount}
            onlineUsers={onlineUsers}
            onOpenProfile={() => setMobileActiveTab('PROFILE')}
          />
        )}

        {/* Mobile View Content */}
        <div className="flex-1">
          {mobileActiveTab === 'HOME' && (
            (() => {
              const isAllowed = isModuleAllowed(activeUser, MODULE_IDS.TASK_HUB);
              if (!isAllowed) {
                return (
                  <div className="min-h-[70vh] bg-slate-50 p-6 flex flex-col items-center justify-center text-center space-y-4 pb-28">
                    <div className="w-16 h-16 rounded-3xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200 shadow-sm">
                      <Lock className="w-8 h-8" />
                    </div>
                    <div className="space-y-1">
                      <h2 className="text-lg font-bold text-slate-900">Task Hub Access Restricted</h2>
                      <p className="text-xs text-slate-500 max-w-xs mx-auto">
                        Your account (<strong>{activeUser.Full_Name}</strong>) does not have permission to access Module 1 (Task & Routine Hub).
                      </p>
                    </div>
                    <p className="text-[11px] text-slate-400 bg-white p-3 rounded-2xl border border-slate-200/80 max-w-xs shadow-2xs">
                      Contact your System Administrator in Admin Control Panel (Module 6) to update your access permissions.
                    </p>
                    <button
                      type="button"
                      onClick={() => setMobileActiveTab('PROFILE')}
                      className="px-5 py-2.5 bg-[#6C70FF] text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
                    >
                      View My Permissions in Profile
                    </button>
                  </div>
                );
              }

              return (
                <MobileTaskDashboard
                  tasks={tasks}
                  setTasks={setTasks}
                  users={users}
                  activeUser={activeUser}
                  onOpenTaskDetails={(task) => setSelectedTaskForDetails(task)}
                  onNavigateToDelegate={(task) => {
                    if (task) setTaskToEditForDelegate(task);
                    else setTaskToEditForDelegate(null);
                    setMobileActiveTab('DELEGATE');
                  }}
                  onNavigateToDelayed={() => setMobileActiveTab('TASKS')}
                />
              );
            })()
          )}

          {mobileActiveTab === 'TASKS' && (
            (() => {
              const isAllowed = isModuleAllowed(activeUser, MODULE_IDS.DELAYED_TASKS);
              if (!isAllowed) {
                return (
                  <div className="bg-white min-h-screen pb-28 pt-6 px-5 space-y-5">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <button
                        type="button"
                        onClick={() => setMobileActiveTab('HOME')}
                        className="text-xs font-bold text-[#6C70FF] flex items-center space-x-1"
                      >
                        <span>← Back to Dashboard</span>
                      </button>
                    </div>
                    <div className="bg-slate-50 p-8 rounded-3xl border border-slate-200 text-center space-y-4 shadow-2xs mt-4">
                      <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200">
                        <Lock className="w-7 h-7" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-base font-bold text-slate-900">Delayed Tasks Restricted</h3>
                        <p className="text-xs text-slate-500">
                          Your account (<strong>{activeUser.Full_Name}</strong>) is not authorized to access Module 3 (Delayed Tasks & MIS).
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setMobileActiveTab('HOME')}
                        className="px-4 py-2 bg-[#6C70FF] text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
                      >
                        Return to Home
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div className="bg-white min-h-screen pb-28 pt-4 px-4 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <button
                      type="button"
                      onClick={() => setMobileActiveTab('HOME')}
                      className="text-xs font-bold text-[#6C70FF] flex items-center space-x-1"
                    >
                      <span>← Back to Dashboard</span>
                    </button>
                    <h3 className="text-sm font-bold text-slate-900">Delayed MIS & Routines</h3>
                  </div>
                  <Module8DelayedTasks
                    tasks={tasks}
                    setTasks={setTasks}
                    activeUser={activeUser}
                  />
                </div>
              );
            })()
          )}

          {mobileActiveTab === 'DELEGATE' && (
            (() => {
              const isAllowed = isModuleAllowed(activeUser, MODULE_IDS.DELEGATE_TASK);
              if (!isAllowed) {
                return (
                  <div className="bg-white min-h-screen pb-28 pt-6 px-5 space-y-5">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <button
                        type="button"
                        onClick={() => {
                          setTaskToEditForDelegate(null);
                          setMobileActiveTab('HOME');
                        }}
                        className="text-xs font-bold text-[#6C70FF] flex items-center space-x-1"
                      >
                        <span>← Back to Dashboard</span>
                      </button>
                    </div>
                    <div className="bg-slate-50 p-8 rounded-3xl border border-slate-200 text-center space-y-4 shadow-2xs mt-4">
                      <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200">
                        <Lock className="w-7 h-7" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-base font-bold text-slate-900">Delegate Task Restricted</h3>
                        <p className="text-xs text-slate-500">
                          Your account (<strong>{activeUser.Full_Name}</strong>) is not authorized to create or delegate new tasks (Module 2).
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setMobileActiveTab('HOME')}
                        className="px-4 py-2 bg-[#6C70FF] text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
                      >
                        Return to Home
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div className="bg-white min-h-screen pb-28 pt-4 px-4 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <button
                      type="button"
                      onClick={() => {
                        setTaskToEditForDelegate(null);
                        setMobileActiveTab('HOME');
                      }}
                      className="text-xs font-bold text-[#6C70FF] flex items-center space-x-1"
                    >
                      <span>← Back to Dashboard</span>
                    </button>
                    <h3 className="text-sm font-bold text-slate-900">
                      {taskToEditForDelegate ? 'Edit Task' : 'Delegate New Task'}
                    </h3>
                  </div>
                  <DelegateTaskView
                    tasks={tasks}
                    setTasks={setTasks}
                    users={users}
                    activeUser={activeUser}
                    onNavigateToHub={() => {
                      setTaskToEditForDelegate(null);
                      setMobileActiveTab('HOME');
                    }}
                    onlineUsers={onlineUsers}
                    initialTaskToEdit={taskToEditForDelegate}
                    onClearEditTask={() => setTaskToEditForDelegate(null)}
                  />
                </div>
              );
            })()
          )}

          {mobileActiveTab === 'SEARCH' && (
            <MobileSearchView
              tasks={tasks}
              users={users}
              activeUser={activeUser}
              onOpenTaskDetails={(task) => setSelectedTaskForDetails(task)}
              onBack={() => setMobileActiveTab('HOME')}
            />
          )}

          {mobileActiveTab === 'INBOX' && (
            <MobileInboxView
              activeUser={activeUser}
              users={users}
              tasks={tasks}
              notifications={notifications}
              onBack={() => setMobileActiveTab('HOME')}
              onToggleSidebar={() => setIsSidebarOpen(true)}
              onSelectTask={(task) => setSelectedTaskForDetails(task)}
            />
          )}

          {mobileActiveTab === 'ADMIN' && (
            (() => {
              const isAllowed = isModuleAllowed(activeUser, MODULE_IDS.ADMIN);
              if (!isAllowed) {
                return (
                  <div className="bg-white min-h-screen pb-28 pt-6 px-5 space-y-5">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <button
                        type="button"
                        onClick={() => setMobileActiveTab('PROFILE')}
                        className="text-xs font-bold text-[#6C70FF] flex items-center space-x-1"
                      >
                        <span>← Back to Profile</span>
                      </button>
                    </div>
                    <div className="bg-slate-50 p-8 rounded-3xl border border-slate-200 text-center space-y-4 shadow-2xs mt-4">
                      <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200">
                        <Lock className="w-7 h-7" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-base font-bold text-slate-900">Admin Control Restricted</h3>
                        <p className="text-xs text-slate-500">
                          Your account (<strong>{activeUser.Full_Name}</strong>) does not have Administrator privileges (Module 6).
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setMobileActiveTab('HOME')}
                        className="px-4 py-2 bg-[#6C70FF] text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
                      >
                        Return to Home
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div className="bg-white min-h-screen pb-28 pt-4 px-4 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <button
                      type="button"
                      onClick={() => setMobileActiveTab('PROFILE')}
                      className="text-xs font-bold text-[#6C70FF] flex items-center space-x-1"
                    >
                      <span>← Back to Profile</span>
                    </button>
                    <h3 className="text-sm font-bold text-slate-900">Admin Control & RBAC</h3>
                  </div>
                  <Module10AdminControl
                    users={users}
                    setUsers={setUsers}
                    stageConfig={stageConfig}
                    setStageConfig={setStageConfig}
                    webhookUrl={webhookUrl}
                    setWebhookUrl={setWebhookUrl}
                    activeUser={activeUser}
                    tasks={tasks}
                    setTasks={setTasks}
                    onOpenSheetsModal={() => {
                      if (isModuleAllowed(activeUser, MODULE_IDS.SHEETS_SYNC)) {
                        setIsSheetsModalOpen(true);
                      }
                    }}
                    onSwitchUser={handleSwitchUser}
                    setActiveUserEmail={setActiveUserEmail}
                  />
                </div>
              );
            })()
          )}

          {mobileActiveTab === 'PROFILE' && (
            <MobileProfileView
              activeUser={activeUser}
              users={users}
              onBack={() => setMobileActiveTab('HOME')}
              onLogout={handleLogout}
              onOpenSheetsModal={() => {
                if (isModuleAllowed(activeUser, MODULE_IDS.SHEETS_SYNC)) {
                  setIsSheetsModalOpen(true);
                }
              }}
              onOpenAnalytics={() => {
                if (isModuleAllowed(activeUser, MODULE_IDS.ANALYTICS)) {
                  setIsAnalyticsOpen(true);
                }
              }}
              onNavigateToDelayed={() => {
                if (isModuleAllowed(activeUser, MODULE_IDS.DELAYED_TASKS)) {
                  setMobileActiveTab('TASKS');
                }
              }}
              onNavigateToAdmin={() => {
                if (isModuleAllowed(activeUser, MODULE_IDS.ADMIN)) {
                  setCurrentTab('ADMIN');
                  setMobileActiveTab('ADMIN');
                }
              }}
              onSwitchUser={handleSwitchUser}
              onUpdateUser={handleUpdateUser}
            />
          )}
        </div>

        {/* Floating Mobile Bottom Navigation Bar (Screenshots 1, 2, 3) */}
        <MobileBottomNav
          currentTab={currentTab}
          setCurrentTab={setCurrentTab}
          mobileActiveTab={mobileActiveTab}
          setMobileActiveTab={setMobileActiveTab}
          unreadCount={unreadNotifCount}
          onQuickDelegate={() => {
            setTaskToEditForDelegate(null);
            setMobileActiveTab('DELEGATE');
          }}
          activeUser={activeUser}
        />
      </div>

      {/* ========================================================================= */}
      {/* DESKTOP EXPERIENCE (>= md)                                                */}
      {/* ========================================================================= */}
      <div className="hidden md:flex flex-col flex-1">
        {/* Top Collaborative Navigation Header */}
        <CollaborativeHeader
          activeUser={activeUser}
          users={users}
          onSwitchUser={handleSwitchUser}
          onLogout={handleLogout}
          currentTab={currentTab}
          setCurrentTab={setCurrentTab}
          onOpenAnalytics={() => {
            if (isModuleAllowed(activeUser, MODULE_IDS.ANALYTICS)) {
              setIsAnalyticsOpen(true);
            }
          }}
          onOpenSheetsModal={() => {
            if (isModuleAllowed(activeUser, MODULE_IDS.SHEETS_SYNC)) {
              setIsSheetsModalOpen(true);
            }
          }}
          overdueCount={overdueCount}
          onlineUsers={onlineUsers}
          onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
        />

        {/* Main Content Area */}
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
          {(() => {
            const moduleIdMap: Record<NavigationTab, number> = {
              TASK_HUB: MODULE_IDS.TASK_HUB,
              DELEGATE_TASK: MODULE_IDS.DELEGATE_TASK,
              DELAYED_TASKS: MODULE_IDS.DELAYED_TASKS,
              ADMIN: MODULE_IDS.ADMIN,
            };

            const targetModuleId = moduleIdMap[currentTab];
            const isAllowed = isModuleAllowed(activeUser, targetModuleId);
            const targetModObj = getModuleInfo(targetModuleId);

            if (!isAllowed) {
              return (
                <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center max-w-md mx-auto shadow-sm space-y-4 my-8 animate-fadeIn">
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200 shadow-2xs">
                    <Lock className="w-7 h-7" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Module Access Restricted</h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Your account (<strong>{activeUser.Full_Name}</strong>) does not have permission to access <strong>{targetModObj ? targetModObj.name : `Module ${targetModuleId}`}</strong>.
                    </p>
                  </div>
                  <p className="text-[11px] text-slate-400 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    Contact your System Administrator in Admin & RBAC Control (Module 6) to grant access to this module.
                  </p>
                  <button
                    type="button"
                    onClick={() => setCurrentTab('TASK_HUB')}
                    className="px-4 py-2 bg-[#6C70FF] hover:bg-[#5B5FF5] text-white font-bold text-xs rounded-xl cursor-pointer transition shadow-2xs"
                  >
                    Return to Task Hub
                  </button>
                </div>
              );
            }

            return (
              <>
                {currentTab === 'TASK_HUB' && (
                  <TaskHub
                    tasks={tasks}
                    setTasks={setTasks}
                    users={users}
                    activeUser={activeUser}
                    onOpenTaskDetails={(task) => setSelectedTaskForDetails(task)}
                    onlineUsers={onlineUsers}
                    onNavigateToDelegate={handleNavigateToDelegate}
                    onDeleteTask={handleDeleteTask}
                  />
                )}

                {currentTab === 'DELEGATE_TASK' && (
                  <DelegateTaskView
                    tasks={tasks}
                    setTasks={setTasks}
                    users={users}
                    activeUser={activeUser}
                    onNavigateToHub={() => {
                      setTaskToEditForDelegate(null);
                      setCurrentTab('TASK_HUB');
                    }}
                    onlineUsers={onlineUsers}
                    initialTaskToEdit={taskToEditForDelegate}
                    onClearEditTask={() => setTaskToEditForDelegate(null)}
                  />
                )}

                {currentTab === 'DELAYED_TASKS' && (
                  <Module8DelayedTasks
                    tasks={tasks}
                    setTasks={setTasks}
                    activeUser={activeUser}
                  />
                )}

                {currentTab === 'ADMIN' && (
                  <Module10AdminControl
                    users={users}
                    setUsers={setUsers}
                    stageConfig={stageConfig}
                    setStageConfig={setStageConfig}
                    webhookUrl={webhookUrl}
                    setWebhookUrl={setWebhookUrl}
                    activeUser={activeUser}
                    tasks={tasks}
                    setTasks={setTasks}
                    onOpenSheetsModal={() => {
                      if (isModuleAllowed(activeUser, MODULE_IDS.SHEETS_SYNC)) {
                        setIsSheetsModalOpen(true);
                      }
                    }}
                    onSwitchUser={handleSwitchUser}
                    setActiveUserEmail={setActiveUserEmail}
                  />
                )}
              </>
            );
          })()}
        </main>

        {/* Footer */}
        <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-500 mt-auto">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
            <div>
              © Malwa Concrete — Operations & Task Hub
            </div>
            <div className="flex items-center space-x-2 text-[11px] text-slate-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>Cloud Connected</span>
            </div>
          </div>
        </footer>
      </div>

      {/* Task Collaborative Details Modal */}
      {selectedTaskForDetails && (
        <TaskDetailModal
          task={selectedTaskForDetails}
          onClose={() => setSelectedTaskForDetails(null)}
          users={users}
          activeUser={activeUser}
          onUpdateTask={handleUpdateTaskFromModal}
          onDeleteTask={handleDeleteTask}
        />
      )}

      {/* Google Sheets Live Database Modal */}
      <GoogleSheetsSyncModal
        isOpen={isSheetsModalOpen}
        onClose={() => setIsSheetsModalOpen(false)}
        users={users}
        setUsers={setUsers}
        inventory={INITIAL_INVENTORY}
        setInventory={() => {}}
        purchases={[]}
        setPurchases={() => {}}
        truckGate={[]}
        setTruckGate={() => {}}
        dispatches={[]}
        setDispatches={() => {}}
        tasks={tasks}
        setTasks={setTasks}
        applications={[]}
        setApplications={() => {}}
        tickets={[]}
        setTickets={() => {}}
        ledger={[]}
        setLedger={() => {}}
        activeUser={activeUser}
      />

      {/* Operational Analytics Modal */}
      <AnalyticsDashboardModal
        isOpen={isAnalyticsOpen}
        onClose={() => setIsAnalyticsOpen(false)}
        tasks={tasks}
        users={users}
      />
    </div>
  );
}
