import React, { useState, useMemo } from 'react';
import confetti from 'canvas-confetti';
import { TaskItem, User } from '../../types';
import {
  Calendar,
  MessageCircle,
  Paperclip,
  MoreHorizontal,
  Building2,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Layers,
  Sparkles,
  ChevronRight,
  Filter,
  Check,
  Repeat,
  X
} from 'lucide-react';
import { UserAvatar } from './avatarUtils';
import { isModuleAllowed, MODULE_IDS } from '../../utils/rbac';
import { pushNotificationService } from '../../services/pushNotificationService';
import { realtimeSync } from '../../services/realtimeSync';
import { googleSheetSync } from '../../services/googleSheetSync';

interface MobileTaskDashboardProps {
  tasks: TaskItem[];
  setTasks?: React.Dispatch<React.SetStateAction<TaskItem[]>>;
  users: User[];
  activeUser: User;
  onOpenTaskDetails: (task: TaskItem) => void;
  onNavigateToDelegate: (taskToEdit?: TaskItem) => void;
  onNavigateToDelayed: () => void;
}

// Circular SVG Progress Ring component for Today Tasks
const CircularProgressRing: React.FC<{ percentage: number; size?: number; strokeWidth?: number }> = ({
  percentage,
  size = 50,
  strokeWidth = 4.5,
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (Math.min(Math.max(percentage, 0), 100) / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg className="w-full h-full transform -rotate-90" viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#E2E8F0"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#6C70FF"
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <span className="absolute text-[10px] font-bold text-slate-800 font-mono">
        {Math.round(percentage)}%
      </span>
    </div>
  );
};

export const MobileTaskDashboard: React.FC<MobileTaskDashboardProps> = ({
  tasks,
  setTasks,
  users,
  activeUser,
  onOpenTaskDetails,
  onNavigateToDelegate,
  onNavigateToDelayed,
}) => {
  const [filterMode, setFilterMode] = useState<'ALL' | 'MINE' | 'PENDING' | 'COMPLETED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [taskPendingCompletion, setTaskPendingCompletion] = useState<TaskItem | null>(null);

  const todayStr = new Date().toISOString().split('T')[0];

  const handleExecuteComplete = () => {
    if (!taskPendingCompletion || !setTasks) return;
    const targetTask = taskPendingCompletion;

    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
    });
    pushNotificationService.playNotificationChime(true);

    const completedTime = new Date().toLocaleString();
    const completedSubtasks = targetTask.Subtasks.map((st) => ({
      ...st,
      completed: true,
      completedAt: st.completedAt || completedTime,
      completedBy: st.completedBy || activeUser.Email,
    }));

    const completedTask: TaskItem = {
      ...targetTask,
      Status: 'Completed',
      Progress_Percentage: 100,
      Completed_At: completedTime,
      Subtasks: completedSubtasks,
    };

    setTasks((prev) => prev.map((t) => (t.Task_ID === targetTask.Task_ID ? completedTask : t)));

    realtimeSync.broadcastTaskMutation('COMPLETE', completedTask, activeUser);
    googleSheetSync.syncRecord('TASK_HUB', completedTask, activeUser.Email, 'ARCHIVE_COMPLETED');

    setTaskPendingCompletion(null);
  };

  // Base visibility: Admin sees all tasks; non-admin ONLY sees their assigned active (non-completed) tasks
  const visibleTasks = useMemo(() => {
    if (activeUser.Role === 'Admin') return tasks;
    return tasks.filter((t) => {
      if (t.Status === 'Completed') return false; // Hide completed tasks from standard user UI
      const emailMatch =
        t.Assigned_To_Email?.toLowerCase() === activeUser.Email.toLowerCase() ||
        t.Assigned_By_Email?.toLowerCase() === activeUser.Email.toLowerCase();
      const nameMatch =
        t.Assigned_To?.toLowerCase() === activeUser.Full_Name.toLowerCase() ||
        t.Assigned_To_Name?.toLowerCase() === activeUser.Full_Name.toLowerCase();
      return emailMatch || nameMatch;
    });
  }, [tasks, activeUser]);

  // Filtered tasks based on search & quick filters
  const filteredTasks = useMemo(() => {
    return visibleTasks.filter((t) => {
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = t.Task_Name.toLowerCase().includes(q);
        const matchDept = t.Department?.toLowerCase().includes(q);
        const matchAssignee = (t.Assigned_To || t.Assigned_To_Name || '').toLowerCase().includes(q);
        const matchId = t.Task_ID.toLowerCase().includes(q);
        if (!matchTitle && !matchDept && !matchAssignee && !matchId) return false;
      }

      // Quick filter
      if (filterMode === 'MINE') {
        const isMine =
          t.Assigned_To_Email.toLowerCase() === activeUser.Email.toLowerCase() ||
          t.Assigned_To?.toLowerCase() === activeUser.Full_Name.toLowerCase();
        if (!isMine) return false;
      } else if (filterMode === 'PENDING') {
        if (t.Status === 'Completed') return false;
      } else if (filterMode === 'COMPLETED') {
        if (t.Status !== 'Completed') return false;
      }

      return true;
    });
  }, [visibleTasks, searchQuery, filterMode, activeUser]);

  // Metric counts
  const pendingCount = useMemo(() => visibleTasks.filter((t) => t.Status !== 'Completed').length, [visibleTasks]);
  const completedCount = useMemo(() => visibleTasks.filter((t) => t.Status === 'Completed').length, [visibleTasks]);
  const overdueCount = useMemo(
    () =>
      visibleTasks.filter(
        (t) => (t.Due_Date < todayStr && t.Status !== 'Completed') || t.Status === 'Overdue'
      ).length,
    [visibleTasks, todayStr]
  );

  return (
    <div className="bg-white rounded-t-[32px] -mt-5 pt-6 px-4 pb-32 min-h-screen shadow-sm space-y-5 animate-fadeIn">
      {/* Quick Summary Metric Cards */}
      <div className="grid grid-cols-3 gap-2">
        <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-2xl text-center">
          <p className="text-[10px] font-bold text-[#6C70FF] uppercase tracking-wider">Total Tasks</p>
          <p className="text-lg font-black text-slate-900 mt-0.5">{visibleTasks.length}</p>
        </div>
        <div className="p-3 bg-amber-50/70 border border-amber-100 rounded-2xl text-center">
          <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">In Progress</p>
          <p className="text-lg font-black text-slate-900 mt-0.5">{pendingCount}</p>
        </div>
        <div className="p-3 bg-emerald-50/70 border border-emerald-100 rounded-2xl text-center">
          <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Completed</p>
          <p className="text-lg font-black text-slate-900 mt-0.5">{completedCount}</p>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="space-y-3">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4 text-slate-400" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tasks, SOPs, or ID..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-[#6C70FF] transition shadow-2xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>

        {/* Quick Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 text-xs">
          <button
            type="button"
            onClick={() => setFilterMode('ALL')}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition cursor-pointer min-h-[36px] ${
              filterMode === 'ALL'
                ? 'bg-[#6C70FF] text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All ({visibleTasks.length})
          </button>
          {activeUser.Role === 'Admin' && (
            <button
              type="button"
              onClick={() => setFilterMode('MINE')}
              className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition cursor-pointer min-h-[36px] ${
                filterMode === 'MINE'
                  ? 'bg-[#6C70FF] text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              My Tasks
            </button>
          )}
          <button
            type="button"
            onClick={() => setFilterMode('PENDING')}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition cursor-pointer min-h-[36px] ${
              filterMode === 'PENDING'
                ? 'bg-[#6C70FF] text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Pending ({pendingCount})
          </button>
          {activeUser.Role === 'Admin' && (
            <button
              type="button"
              onClick={() => setFilterMode('COMPLETED')}
              className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition cursor-pointer min-h-[36px] ${
                filterMode === 'COMPLETED'
                  ? 'bg-[#6C70FF] text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Done ({completedCount})
            </button>
          )}
        </div>
      </div>

      {/* Task List (Clean Single Unified Section) */}
      <div className="space-y-3.5">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <span>Operational Tasks</span>
            <span className="text-xs font-normal text-slate-400">({filteredTasks.length})</span>
          </h2>
          {overdueCount > 0 && isModuleAllowed(activeUser, MODULE_IDS.DELAYED_TASKS) && (
            <button
              type="button"
              onClick={onNavigateToDelayed}
              className="text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200/60 px-2.5 py-1 rounded-lg hover:bg-rose-100 transition cursor-pointer flex items-center space-x-1"
            >
              <Clock className="w-3 h-3 text-rose-500" />
              <span>{overdueCount} Delayed</span>
            </button>
          )}
        </div>

        {filteredTasks.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 rounded-3xl border border-slate-100 text-slate-400 text-xs space-y-1">
            <CheckCircle2 className="w-6 h-6 mx-auto text-emerald-500 mb-1" />
            <p className="font-bold text-slate-700">No tasks found</p>
            <p className="text-[11px]">
              {activeUser.Role !== 'Admin'
                ? 'You do not have any assigned tasks matching this filter.'
                : 'No tasks match your filter criteria.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredTasks.map((t) => {
              const subDone = t.Subtasks?.filter((s) => s.completed).length || 0;
              const subTotal = t.Subtasks?.length || 0;
              const percent =
                t.Status === 'Completed'
                  ? 100
                  : subTotal > 0
                  ? Math.round((subDone / subTotal) * 100)
                  : t.Progress_Percentage || 0;

              const isOverdue = (t.Due_Date < todayStr && t.Status !== 'Completed') || t.Status === 'Overdue';

              return (
                <div
                  key={t.Task_ID}
                  onClick={() => onOpenTaskDetails(t)}
                  className="bg-white rounded-2xl border border-slate-100/90 p-4 shadow-[0_2px_14px_rgba(0,0,0,0.03)] hover:shadow-md transition cursor-pointer flex items-center justify-between gap-3"
                >
                  {/* Left Icon + Title + Assignees */}
                  <div className="flex items-center space-x-3.5 min-w-0 flex-1">
                    <div
                      className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-2xs border ${
                        t.Status === 'Completed'
                          ? 'bg-emerald-50 text-emerald-600 border-emerald-100/60'
                          : isOverdue
                          ? 'bg-rose-50 text-rose-600 border-rose-100/60'
                          : 'bg-indigo-50 text-[#6C70FF] border-indigo-100/50'
                      }`}
                    >
                      <Building2 className="w-6 h-6" />
                    </div>

                    <div className="min-w-0 space-y-1 flex-1">
                      <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                        <span className="text-[10px] font-bold font-mono text-[#6C70FF] bg-indigo-50 px-1.5 py-0.2 rounded">
                          {t.Task_ID}
                        </span>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                            t.Priority === 'High'
                              ? 'bg-rose-100 text-rose-700'
                              : t.Priority === 'Medium'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}
                        >
                          {t.Priority}
                        </span>
                        {t.Frequency && t.Frequency !== 'One-Time' && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-purple-50 text-purple-700 border border-purple-100 inline-flex items-center gap-0.5">
                            <Repeat className="w-2.5 h-2.5" />
                            <span>{t.Frequency} Routine</span>
                          </span>
                        )}
                      </div>

                      <h4 className="text-sm font-bold text-slate-900 truncate leading-snug">
                        {t.Task_Name}
                      </h4>

                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        {/* Assignee Avatar */}
                        <div className="flex items-center space-x-1">
                          <UserAvatar
                            name={t.Assigned_To_Name || t.Assigned_To || 'User'}
                            email={t.Assigned_To_Email}
                            size="sm"
                          />
                          <span className="text-[11px] text-slate-600 font-medium truncate max-w-[90px]">
                            {t.Assigned_To_Name || t.Assigned_To}
                          </span>
                        </div>

                        {/* Checklist counter */}
                        {subTotal > 0 && (
                          <div className="flex items-center space-x-1 text-[11px] text-slate-500 font-mono bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                            <Check className="w-3 h-3 text-emerald-600" />
                            <span>{subDone}/{subTotal}</span>
                          </div>
                        )}

                        {/* Due Date */}
                        <span
                          className={`text-[10px] font-mono ml-auto ${
                            isOverdue ? 'text-rose-600 font-bold' : 'text-slate-400'
                          }`}
                        >
                          {t.Due_Date}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Circular Progress Ring & Done Button */}
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <CircularProgressRing percentage={percent} size={44} strokeWidth={4} />
                    {t.Status !== 'Completed' && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setTaskPendingCompletion(t);
                        }}
                        className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 text-emerald-700 border border-emerald-200 rounded-lg text-[11px] font-bold flex items-center gap-1 transition shadow-2xs cursor-pointer"
                      >
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span>Done</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Complete Task Confirmation Modal */}
      {taskPendingCompletion && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 space-y-4 animate-scaleUp">
            <div className="flex items-start space-x-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="space-y-1 min-w-0">
                <h4 className="text-sm font-bold text-slate-900">Confirm Task Completion</h4>
                <p className="text-xs text-slate-500 font-mono">{taskPendingCompletion.Task_ID}</p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5 text-xs text-slate-700">
              <p className="font-bold text-slate-900">{taskPendingCompletion.Task_Name}</p>
              <div className="flex justify-between text-slate-500 text-[11px]">
                <span>Assignee: {taskPendingCompletion.Assigned_To || taskPendingCompletion.Assigned_To_Email}</span>
                <span>Due: {taskPendingCompletion.Due_Date}</span>
              </div>
              {taskPendingCompletion.Frequency && taskPendingCompletion.Frequency !== 'One-Time' && (
                <div className="text-[11px] text-purple-700 bg-purple-50 p-2 rounded-lg border border-purple-100 font-medium">
                  🔁 Recurring {taskPendingCompletion.Frequency}: Next scheduled cycle will auto-generate on its due date.
                </div>
              )}
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to mark this task as Completed? It will be signed off, saved to the database, and archived from active tasks.
            </p>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setTaskPendingCompletion(null)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer min-h-[38px]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteComplete}
                className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-xl transition flex items-center space-x-1.5 cursor-pointer shadow-xs min-h-[38px]"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Yes, Complete Task</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
