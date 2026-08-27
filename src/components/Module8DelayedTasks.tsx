import React, { useState, useMemo } from 'react';
import { TaskItem, User } from '../types';
import {
  ClockAlert,
  AlertTriangle,
  Send,
  Filter,
  CheckCircle2,
  Calendar,
  Phone,
  MessageSquare,
  ChevronRight,
  Flame,
  Check
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { googleSheetSync } from '../services/googleSheetSync';
import { realtimeSync } from '../services/realtimeSync';
import { saveCloudTask } from '../services/firebaseClient';
import { canUserUpdateTaskStatus } from '../utils/rbac';

interface Module8DelayedTasksProps {
  tasks: TaskItem[];
  setTasks: React.Dispatch<React.SetStateAction<TaskItem[]>>;
  activeUser: User;
}

export const Module8DelayedTasks: React.FC<Module8DelayedTasksProps> = ({
  tasks,
  setTasks,
  activeUser,
}) => {
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [notice, setNotice] = useState<string>('');

  const todayStr = new Date().toISOString().split('T')[0];

  const overdueTasks = useMemo(() => {
    return tasks.filter((t) => {
      const isPastDue = t.Due_Date < todayStr && t.Status !== 'Completed';
      const isOverdueStatus = t.Status === 'Overdue';
      if (!isPastDue && !isOverdueStatus) return false;

      if (priorityFilter !== 'ALL' && t.Priority !== priorityFilter) return false;
      return true;
    });
  }, [tasks, todayStr, priorityFilter]);

  const generateWhatsAppUrl = (task: TaskItem) => {
    const text = encodeURIComponent(
      `🚨 *MALWA CONCRETE FMS ESCALATION NOTICE* 🚨\n\n*Task ID:* ${task.Task_ID}\n*Task:* ${task.Task_Name}\n*Due Date:* ${task.Due_Date}\n*Assigned To:* ${task.Assigned_To_Email}\n*Priority:* ${task.Priority}\n*Progress:* ${task.Progress_Percentage}%\n\nThis task is currently *OVERDUE* in the factory management system. Please resolve and update the checklist status immediately.\n\n_Generated via Malwa Concrete FMS Portal_`
    );
    return `https://wa.me/?text=${text}`;
  };

  const handleResolveTask = (taskId: string) => {
    const currentTask = tasks.find((t) => t.Task_ID === taskId);
    if (!currentTask || !canUserUpdateTaskStatus(activeUser, currentTask)) {
      alert('Security Restriction: Only the Task Assignee, Creator, or an Admin can resolve and archive this task.');
      return;
    }

    const updated = tasks.map((t) => {
      if (t.Task_ID === taskId) {
        const resolved: TaskItem = {
          ...t,
          Status: 'Completed' as const,
          Progress_Percentage: 100,
          Completed_At: new Date().toLocaleString(),
          Subtasks: t.Subtasks.map((st) => ({ ...st, completed: true })),
        };
        saveCloudTask(resolved);
        realtimeSync.broadcastTaskMutation('COMPLETE', resolved, activeUser);
        googleSheetSync.syncRecord('TASK_HUB', resolved, activeUser.Email, 'ARCHIVE_COMPLETED');
        return resolved;
      }
      return t;
    });

    confetti({
      particleCount: 70,
      spread: 60,
      origin: { y: 0.6 },
    });

    setTasks(updated);
    setNotice(`Task ${taskId} resolved and archived.`);
    setTimeout(() => setNotice(''), 3500);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-slate-200 pb-3">
        <div>
          <div className="flex items-center space-x-2">
            <ClockAlert className="w-5 h-5 text-red-600 shrink-0" />
            <h2 className="text-[17px] sm:text-[18px] font-semibold text-slate-900 font-display">
              Delayed Tasks & MIS Follow-Up System
            </h2>
          </div>
          <p className="text-[12px] sm:text-[13px] text-slate-500 mt-0.5">
            SLA breach escalations, supervisor reminders, and direct WhatsApp notification generator
          </p>
        </div>

        {/* Priority Filter */}
        <div className="flex items-center space-x-1.5 bg-white border border-slate-300 rounded-lg px-3 py-2 sm:py-1.5 text-[13px] shadow-2xs w-full sm:w-auto min-h-[40px] sm:min-h-0">
          <Filter className="w-3.5 h-3.5 text-red-600 shrink-0" />
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="bg-transparent font-medium text-slate-700 outline-none text-[13px] cursor-pointer w-full"
          >
            <option value="ALL">All Priorities</option>
            <option value="High">High Priority Only</option>
            <option value="Medium">Medium Priority</option>
            <option value="Low">Low Priority</option>
          </select>
        </div>
      </div>

      {notice && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 text-[13px] font-medium rounded-lg flex items-center space-x-2 animate-fadeIn shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* Overdue Count Overview */}
      <div className="bg-red-50/80 border border-red-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-red-600 text-white rounded-xl shadow-xs shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-[14px] sm:text-[15px] font-bold text-red-950 font-display">
              {overdueTasks.length} Critical Task Breaches Logged
            </h3>
            <p className="text-[12px] text-red-800 mt-0.5">
              Immediate follow-up required to prevent production line and procurement delays
            </p>
          </div>
        </div>
      </div>

      {/* Overdue Task List */}
      <div className="space-y-3">
        {overdueTasks.length === 0 ? (
          <div className="p-10 sm:p-12 text-center bg-white rounded-2xl border border-slate-200 text-slate-400 text-[13px] italic">
            No overdue or delayed tasks in the system! All operations are on schedule.
          </div>
        ) : (
          overdueTasks.map((t) => (
            <div
              key={t.Task_ID}
              className="bg-white rounded-2xl border border-red-200 p-4 sm:p-5 shadow-2xs flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 hover:border-red-300 transition"
            >
              <div className="space-y-1.5 flex-1 min-w-0">
                <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                  <span className="font-mono text-[11px] font-bold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded">
                    {t.Task_ID} • OVERDUE
                  </span>
                  <span className="text-[11px] font-bold bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                    {t.Priority} Priority
                  </span>
                  <span className="text-[11px] font-medium text-slate-500 font-mono">
                    Progress: {t.Progress_Percentage}%
                  </span>
                </div>
                <h4 className="text-[14px] font-bold text-slate-900 mt-1 break-words">{t.Task_Name}</h4>
                <div className="text-[12px] text-slate-500 flex flex-wrap items-center gap-2 mt-0.5">
                  <span className="break-all">
                    Assignee: <strong className="text-slate-800 font-medium font-mono">{t.Assigned_To_Email}</strong>
                  </span>
                  <span>•</span>
                  <span>
                    Due Date: <strong className="text-red-600 font-mono">{t.Due_Date}</strong>
                  </span>
                </div>

                {t.Subtasks && t.Subtasks.length > 0 && (
                  <div className="text-[11px] text-slate-600 font-mono mt-1 break-words">
                    Pending Checklist:{' '}
                    {t.Subtasks.filter((st) => !st.completed)
                      .map((st) => st.title)
                      .join(' • ')}
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full lg:w-auto shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                <a
                  href={generateWhatsAppUrl(t)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold text-[13px] px-4 py-2.5 sm:py-2 rounded-lg transition flex items-center justify-center space-x-2 shadow-xs cursor-pointer min-h-[44px] sm:min-h-0"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Send WhatsApp Alert</span>
                </a>
                {canUserUpdateTaskStatus(activeUser, t) ? (
                  <button
                    onClick={() => handleResolveTask(t.Task_ID)}
                    className="bg-slate-900 hover:bg-slate-800 active:bg-black text-white font-semibold text-[13px] px-4 py-2.5 sm:py-2 rounded-lg transition cursor-pointer min-h-[44px] sm:min-h-0 flex items-center justify-center"
                  >
                    Resolve & Archive
                  </button>
                ) : (
                  <span className="text-[12px] font-medium text-slate-400 bg-slate-100 px-3 py-2 rounded-lg text-center">
                    🔒 Assigned to {t.Assigned_To_Email.split('@')[0]}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
