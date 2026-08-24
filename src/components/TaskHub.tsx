import React, { useState, useMemo } from 'react';
import { TaskItem, User, OnlinePresenceUser } from '../types';
import {
  Plus,
  Filter,
  CheckCircle2,
  Calendar,
  Clock,
  AlertTriangle,
  Search,
  MessageSquare,
  Check,
  Eye,
  Trash2,
  Edit3,
  LayoutGrid,
  List,
  RotateCcw,
  X,
  AlertCircle,
  Repeat
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { googleSheetSync } from '../services/googleSheetSync';
import { realtimeSync } from '../services/realtimeSync';
import { pushNotificationService } from '../services/pushNotificationService';
import { createNextRecurringInstance } from '../utils/recurringTaskManager';

interface TaskHubProps {
  tasks: TaskItem[];
  setTasks: React.Dispatch<React.SetStateAction<TaskItem[]>>;
  users: User[];
  activeUser: User;
  onOpenTaskDetails: (task: TaskItem) => void;
  onlineUsers?: OnlinePresenceUser[];
  onNavigateToDelegate?: (taskToEdit?: TaskItem) => void;
  onDeleteTask?: (taskId: string) => void;
}

export const TaskHub: React.FC<TaskHubProps> = ({
  tasks,
  setTasks,
  users,
  activeUser,
  onOpenTaskDetails,
  onNavigateToDelegate,
  onDeleteTask,
}) => {
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [frequencyFilter, setFrequencyFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'GRID' | 'TABLE'>('GRID');
  const [notice, setNotice] = useState<string>('');
  
  const [taskPendingDeletion, setTaskPendingDeletion] = useState<TaskItem | null>(null);
  const [taskPendingCompletion, setTaskPendingCompletion] = useState<TaskItem | null>(null);
  const [recentlyDeletedTask, setRecentlyDeletedTask] = useState<TaskItem | null>(null);

  const todayStr = new Date().toISOString().split('T')[0];

  const getSlaBadge = (dueDateStr: string, isCompleted: boolean) => {
    if (isCompleted) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
          <CheckCircle2 className="w-3 h-3" />
          Completed
        </span>
      );
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(dueDateStr);
    target.setHours(0, 0, 0, 0);

    const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md">
          <AlertTriangle className="w-3 h-3" />
          Overdue ({Math.abs(diffDays)}d)
        </span>
      );
    } else if (diffDays === 0) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md">
          <Clock className="w-3 h-3" />
          Due Today
        </span>
      );
    } else if (diffDays === 1) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">
          <Clock className="w-3 h-3" />
          Tomorrow
        </span>
      );
    } else {
      return (
        <span className="text-[11px] text-slate-500 font-medium">
          {diffDays}d left
        </span>
      );
    }
  };

  const handleToggleSubtask = (taskId: string, subtaskId: string) => {
    const updated = tasks.map((t) => {
      if (t.Task_ID === taskId) {
        const newSubtasks = t.Subtasks.map((st) =>
          st.id === subtaskId
            ? {
                ...st,
                completed: !st.completed,
                completedAt: !st.completed ? new Date().toLocaleString() : undefined,
                completedBy: !st.completed ? activeUser.Email : undefined,
              }
            : st
        );
        const completedCount = newSubtasks.filter((st) => st.completed).length;
        const total = newSubtasks.length;
        const progress = total > 0 ? Math.round((completedCount / total) * 100) : 0;
        // DO NOT auto-complete task when checklist reaches 100% - requires explicit completion button + confirmation
        const newStatus =
          t.Status === 'Completed'
            ? ('Completed' as const)
            : progress > 0
            ? ('In_Progress' as const)
            : ('Pending' as const);

        const updatedTask: TaskItem = {
          ...t,
          Subtasks: newSubtasks,
          Progress_Percentage: progress,
          Status: newStatus,
          Completed_At: newStatus === 'Completed' ? t.Completed_At : undefined,
        };

        realtimeSync.broadcastTaskMutation('SUBTASK_TOGGLE', updatedTask, activeUser);
        googleSheetSync.syncRecord('TASK_HUB', updatedTask, activeUser.Email, 'UPSERT_RECORD');

        return updatedTask;
      }
      return t;
    });

    setTasks(updated);
  };

  const handleRequestComplete = (task: TaskItem) => {
    setTaskPendingCompletion(task);
  };

  const handleExecuteComplete = () => {
    if (!taskPendingCompletion) return;
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

    const updated = tasks.map((t) => (t.Task_ID === targetTask.Task_ID ? completedTask : t));
    setTasks(updated);

    realtimeSync.broadcastTaskMutation('COMPLETE', completedTask, activeUser);
    googleSheetSync.syncRecord('TASK_HUB', completedTask, activeUser.Email, 'ARCHIVE_COMPLETED');

    setTaskPendingCompletion(null);
    setNotice(`✅ Task ${targetTask.Task_ID} marked completed and archived to database.`);
    setTimeout(() => setNotice(''), 4500);
  };

  const handleRequestDelete = (task: TaskItem) => {
    setTaskPendingDeletion(task);
  };

  const handleExecuteDelete = () => {
    if (!taskPendingDeletion) return;
    const taskToDelete = taskPendingDeletion;
    const remaining = tasks.filter((t) => t.Task_ID !== taskToDelete.Task_ID);
    
    setTasks(remaining);
    setRecentlyDeletedTask(taskToDelete);
    setTaskPendingDeletion(null);

    realtimeSync.broadcastTaskMutation('DELETE', taskToDelete, activeUser);
    googleSheetSync.syncRecord('TASK_HUB', taskToDelete, activeUser.Email, 'DELETE_RECORD');

    if (onDeleteTask) {
      onDeleteTask(taskToDelete.Task_ID);
    }

    setNotice(`Task ${taskToDelete.Task_ID} deleted.`);
    setTimeout(() => setNotice(''), 4000);
  };

  const handleUndoDelete = () => {
    if (!recentlyDeletedTask) return;
    const restored = recentlyDeletedTask;
    setTasks((prev) => [restored, ...prev]);
    setRecentlyDeletedTask(null);

    realtimeSync.broadcastTaskMutation('CREATE', restored, activeUser);
    googleSheetSync.syncRecord('TASK_HUB', restored, activeUser.Email, 'UPSERT_RECORD');
    setNotice(`Task ${restored.Task_ID} restored.`);
    setTimeout(() => setNotice(''), 3000);
  };

  const generateWhatsAppUrl = (task: TaskItem) => {
    const text = encodeURIComponent(
      `*MALWA CONCRETE TASK*\n` +
      `Task ID: ${task.Task_ID}\n` +
      `Task: ${task.Task_Name}\n` +
      `Due Date: ${task.Due_Date}\n` +
      `Priority: ${task.Priority}\n` +
      `Progress: ${task.Progress_Percentage}%\n` +
      `Assignee: ${task.Assigned_To_Name || task.Assigned_To_Email}`
    );
    return `https://wa.me/?text=${text}`;
  };

  // Scoped tasks based on user role: Admin sees all; non-admin ONLY sees their assigned active (non-completed) tasks
  const userScopedTasks = useMemo(() => {
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

  const visibleTasks = useMemo(() => {
    return userScopedTasks.filter((t) => {
      if (statusFilter !== 'ALL') {
        if (statusFilter === 'Overdue') {
          const isPast = t.Due_Date < todayStr && t.Status !== 'Completed';
          if (!isPast && t.Status !== 'Overdue') return false;
        } else if (t.Status !== statusFilter) {
          return false;
        }
      }

      if (priorityFilter !== 'ALL' && t.Priority !== priorityFilter) return false;
      if (frequencyFilter !== 'ALL' && t.Frequency !== frequencyFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = (t.Task_Name || '').toLowerCase().includes(q);
        const matchesId = (t.Task_ID || '').toLowerCase().includes(q);
        const matchesEmail = (t.Assigned_To_Email || '').toLowerCase().includes(q);
        const matchesAssignee = (t.Assigned_To || '').toLowerCase().includes(q);
        const matchesSubtask = (t.Subtasks || []).some((st) => (st.title || '').toLowerCase().includes(q));
        return matchesName || matchesId || matchesEmail || matchesAssignee || matchesSubtask;
      }

      return true;
    });
  }, [userScopedTasks, statusFilter, priorityFilter, frequencyFilter, searchQuery, todayStr]);

  const stats = useMemo(() => {
    const total = userScopedTasks.length;
    const completed = userScopedTasks.filter((t) => t.Status === 'Completed').length;
    const overdue = userScopedTasks.filter(
      (t) => (t.Due_Date < todayStr && t.Status !== 'Completed') || t.Status === 'Overdue'
    ).length;
    const inProgress = userScopedTasks.filter(
      (t) => t.Status === 'In_Progress' || (t.Status === 'Pending' && t.Due_Date >= todayStr)
    ).length;
    return { total, completed, overdue, inProgress };
  }, [userScopedTasks, todayStr]);

  return (
    <div className="space-y-5">
      {/* Action Header & Summary Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
            Task & Routine Hub
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage factory routines, checklists, and assignments
          </p>
        </div>

        <div className="flex items-center space-x-3 shrink-0">
          {/* Clean Metric Chips */}
          <div className="flex items-center gap-1.5 bg-slate-100/90 p-1 rounded-2xl text-xs">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${
                statusFilter === 'ALL' ? 'bg-[#6C70FF] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All <span className="font-semibold ml-0.5">({stats.total})</span>
            </button>
            <button
              onClick={() => setStatusFilter('In_Progress')}
              className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${
                statusFilter === 'In_Progress' ? 'bg-[#6C70FF] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Active <span className="font-semibold ml-0.5">({stats.inProgress})</span>
            </button>
            {activeUser.Role === 'Admin' && (
              <button
                onClick={() => setStatusFilter('Completed')}
                className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${
                  statusFilter === 'Completed' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Done <span className="font-semibold ml-0.5">({stats.completed})</span>
              </button>
            )}
            {stats.overdue > 0 && (
              <button
                onClick={() => setStatusFilter('Overdue')}
                className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${
                  statusFilter === 'Overdue' ? 'bg-rose-600 text-white shadow-xs' : 'text-rose-600 hover:text-rose-800'
                }`}
              >
                Overdue <span className="font-semibold ml-0.5">({stats.overdue})</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Notice Banner */}
      {notice && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-medium rounded-2xl flex items-center justify-between gap-2 animate-fadeIn shadow-2xs">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{notice}</span>
          </div>
          {recentlyDeletedTask && (
            <button
              onClick={handleUndoDelete}
              className="inline-flex items-center space-x-1 text-xs font-bold text-emerald-800 hover:text-emerald-950 bg-emerald-200/60 px-2 py-0.5 rounded-lg transition cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Undo</span>
            </button>
          )}
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tasks, task ID, assignee, or checklist items..."
            className="w-full bg-slate-50 focus:bg-white border border-slate-200 focus:border-[#6C70FF] rounded-xl pl-10 pr-8 py-2.5 text-xs text-slate-800 placeholder-slate-400 outline-none transition"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Dropdowns */}
        <div className="flex items-center gap-2">
          {/* Priority */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 focus:border-[#6C70FF] rounded-xl px-3 py-2.5 text-xs text-slate-700 outline-none cursor-pointer"
          >
            <option value="ALL">All Priorities</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>

          {/* Frequency */}
          <select
            value={frequencyFilter}
            onChange={(e) => setFrequencyFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 focus:border-[#6C70FF] rounded-xl px-3 py-2.5 text-xs text-slate-700 outline-none cursor-pointer"
          >
            <option value="ALL">All Frequencies</option>
            <option value="One-Time">One-Time</option>
            <option value="Daily">Daily</option>
            <option value="Weekly">Weekly</option>
            <option value="Monthly">Monthly</option>
          </select>

          {/* View Mode Toggle */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setViewMode('GRID')}
              title="Grid View"
              className={`p-1.5 rounded-lg transition cursor-pointer ${
                viewMode === 'GRID' ? 'bg-white shadow-2xs text-[#6C70FF]' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('TABLE')}
              title="Table View"
              className={`p-1.5 rounded-lg transition cursor-pointer ${
                viewMode === 'TABLE' ? 'bg-white shadow-2xs text-[#6C70FF]' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Grid View */}
      {viewMode === 'GRID' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleTasks.length === 0 ? (
            <div className="col-span-full py-16 text-center bg-white rounded-2xl border border-dashed border-slate-200 text-slate-400 space-y-2">
              <p className="text-sm font-medium text-slate-600">No tasks found matching your filters</p>
            </div>
          ) : (
            visibleTasks.map((t) => {
              const isCompleted = t.Status === 'Completed';
              const isHighPriority = t.Priority === 'High';
              const isMediumPriority = t.Priority === 'Medium';
              const completedCount = (t.Subtasks || []).filter((s) => s.completed).length;
              const totalSubtasks = (t.Subtasks || []).length;

              return (
                <div
                  key={t.Task_ID}
                  className="bg-white rounded-2xl border border-slate-200/90 p-4.5 shadow-2xs flex flex-col justify-between hover:border-slate-300 transition group space-y-3.5"
                >
                  <div className="space-y-3">
                    {/* Header Row */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                          {t.Task_ID}
                        </span>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-md uppercase ${
                            isHighPriority
                              ? 'bg-rose-50 text-rose-700'
                              : isMediumPriority
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {t.Priority}
                        </span>
                      </div>
                      {t.Frequency && t.Frequency !== 'One-Time' ? (
                        <span className="text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-200/60 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                          <Repeat className="w-2.5 h-2.5" />
                          <span>{t.Frequency} Routine</span>
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400 font-medium">
                          One-Time
                        </span>
                      )}
                    </div>

                    {/* Title */}
                    <h3 className="text-sm font-bold text-slate-900 leading-snug break-words">
                      {t.Task_Name}
                    </h3>

                    {/* Assignee & SLA */}
                    <div className="space-y-1 text-xs">
                      <div className="flex items-center justify-between text-slate-500">
                        <span className="truncate">
                          Assignee: <span className="font-medium text-slate-800">{t.Assigned_To_Name || t.Assigned_To_Email.split('@')[0]}</span>
                        </span>
                        {getSlaBadge(t.Due_Date, isCompleted)}
                      </div>
                    </div>

                    {/* Subtasks Checklist */}
                    {t.Subtasks && t.Subtasks.length > 0 && (
                      <div className="bg-slate-50/80 rounded-xl p-3 space-y-2 border border-slate-100">
                        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500">
                          <span>Checklist ({completedCount}/{totalSubtasks})</span>
                          <span>{t.Progress_Percentage}%</span>
                        </div>
                        <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                          {t.Subtasks.map((st) => (
                            <label
                              key={st.id}
                              className="flex items-start space-x-2 text-xs text-slate-700 cursor-pointer select-none group/st hover:text-slate-900 transition"
                            >
                              <input
                                type="checkbox"
                                checked={st.completed}
                                onChange={() => handleToggleSubtask(t.Task_ID, st.id)}
                                className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer shrink-0"
                              />
                              <span
                                className={`break-words ${
                                  st.completed ? 'line-through text-slate-400' : 'text-slate-700'
                                }`}
                              >
                                {st.title}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Card Bottom: Progress bar & Clean Actions */}
                  <div className="pt-2 border-t border-slate-100 space-y-2.5">
                    {/* Progress Bar */}
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          isCompleted ? 'bg-emerald-500' : 'bg-blue-600'
                        }`}
                        style={{ width: `${t.Progress_Percentage}%` }}
                      />
                    </div>

                    {/* Action Row */}
                    <div className="flex items-center justify-between pt-0.5">
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => onOpenTaskDetails(t)}
                          title="View Details"
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-slate-50 rounded-lg transition cursor-pointer"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {onNavigateToDelegate && (
                          <button
                            onClick={() => onNavigateToDelegate(t)}
                            title="Edit Task"
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-slate-50 rounded-lg transition cursor-pointer"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                        )}
                        <a
                          href={generateWhatsAppUrl(t)}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Send WhatsApp Alert"
                          className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-slate-50 rounded-lg transition cursor-pointer"
                        >
                          <MessageSquare className="w-4 h-4" />
                        </a>
                        <button
                          onClick={() => handleRequestDelete(t)}
                          title="Delete Task"
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-50 rounded-lg transition cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {!isCompleted ? (
                        <button
                          onClick={() => handleRequestComplete(t)}
                          className="text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-lg transition flex items-center space-x-1 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Complete</span>
                        </button>
                      ) : (
                        <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                          Done
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Table View */}
      {viewMode === 'TABLE' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Task ID</th>
                  <th className="py-3 px-4">Task Name</th>
                  <th className="py-3 px-4">Assignee</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4">Frequency</th>
                  <th className="py-3 px-4">Due Date</th>
                  <th className="py-3 px-4">Progress</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleTasks.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400 text-sm">
                      No tasks found matching your filter criteria.
                    </td>
                  </tr>
                ) : (
                  visibleTasks.map((t) => {
                    const isCompleted = t.Status === 'Completed';
                    return (
                      <tr key={t.Task_ID} className="hover:bg-slate-50 transition">
                        <td className="py-3 px-4 font-mono font-bold text-slate-700">
                          {t.Task_ID}
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-900 max-w-xs truncate">
                          {t.Task_Name}
                        </td>
                        <td className="py-3 px-4 text-slate-600 truncate">
                          {t.Assigned_To_Name || t.Assigned_To_Email.split('@')[0]}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded uppercase ${
                              t.Priority === 'High'
                                ? 'bg-rose-50 text-rose-700'
                                : t.Priority === 'Medium'
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {t.Priority}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-600 font-medium">
                          {t.Frequency}
                        </td>
                        <td className="py-3 px-4 text-slate-600 font-mono">
                          {t.Due_Date}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-slate-800">
                          {t.Progress_Percentage}%
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end space-x-1">
                            <button
                              onClick={() => onOpenTaskDetails(t)}
                              className="p-1 text-slate-400 hover:text-blue-600 rounded transition cursor-pointer"
                              title="Details"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleRequestDelete(t)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded transition cursor-pointer"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {taskPendingDeletion && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-xl border border-slate-200 space-y-4 animate-scaleUp">
            <div className="flex items-start space-x-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-slate-900">Delete Task</h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Are you sure you want to delete <span className="font-semibold text-slate-800">{taskPendingDeletion.Task_ID} - "{taskPendingDeletion.Task_Name}"</span>?
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setTaskPendingDeletion(null)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteDelete}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Complete Task Confirmation Modal */}
      {taskPendingCompletion && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-xl border border-slate-200 space-y-4 animate-scaleUp">
            <div className="flex items-start space-x-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="space-y-1 min-w-0">
                <h4 className="text-sm font-bold text-slate-900">Confirm Task Completion</h4>
                <p className="text-xs text-slate-500 font-mono">{taskPendingCompletion.Task_ID}</p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5 text-xs text-slate-700">
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
              Are you sure you want to mark this task as Completed? It will be signed off, saved to the cloud database, and archived from active task boards.
            </p>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setTaskPendingCompletion(null)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteComplete}
                className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-xl transition flex items-center space-x-1.5 cursor-pointer shadow-xs"
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
