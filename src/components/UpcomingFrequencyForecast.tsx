import React, { useState, useMemo } from 'react';
import { TaskItem, User, TaskFrequency, TaskPriority, Department } from '../types';
import {
  Calendar,
  Clock,
  Repeat,
  Sparkles,
  Search,
  Filter,
  CheckCircle2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  Eye,
  Layers,
  Zap,
  ArrowRight,
  TrendingUp,
  AlertCircle,
  LayoutGrid,
  List,
  Calendar as CalendarIcon,
  CheckSquare,
  Shield,
  Tag,
  Building2,
  User as UserIcon,
  X
} from 'lucide-react';
import { UserAvatar } from './mobile/avatarUtils';
import { saveCloudTask } from '../services/firebaseClient';
import { realtimeSync } from '../services/realtimeSync';
import { googleSheetSync } from '../services/googleSheetSync';
import { pushNotificationService } from '../services/pushNotificationService';
import { canUserSpawnForecast } from '../utils/rbac';
import confetti from 'canvas-confetti';

interface UpcomingFrequencyForecastProps {
  tasks: TaskItem[];
  setTasks: React.Dispatch<React.SetStateAction<TaskItem[]>>;
  users: User[];
  activeUser: User;
  onOpenTaskDetails?: (task: TaskItem) => void;
  onNavigateToDelegate?: (taskToEdit?: TaskItem) => void;
}

export type HorizonPreset = 'today' | 'tomorrow' | '7days' | '14days' | '30days' | '90days' | 'custom';

export interface ForecastOccurrence {
  occurrenceId: string;
  sourceTaskId: string;
  taskName: string;
  description?: string;
  frequency: TaskFrequency;
  priority: TaskPriority;
  department?: Department;
  assignedToEmail: string;
  assignedToName?: string;
  assignedByEmail: string;
  assignedByName?: string;
  projectedDate: string; // YYYY-MM-DD
  dueTime: string;
  subtasks: { id: string; title: string; completed: boolean }[];
  turnaroundHours?: number;
  tags?: string[];
  daysFromToday: number;
  isToday: boolean;
  isTomorrow: boolean;
  isExistingActiveTask: boolean;
  existingTaskId?: string;
  existingTaskStatus?: string;
  sourceTask: TaskItem;
}

export const UpcomingFrequencyForecast: React.FC<UpcomingFrequencyForecastProps> = ({
  tasks,
  setTasks,
  users,
  activeUser,
  onOpenTaskDetails,
  onNavigateToDelegate,
}) => {
  // Horizon Date Toggle State
  const [horizonPreset, setHorizonPreset] = useState<HorizonPreset>('30days');
  const [customStartDate, setCustomStartDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [customEndDate, setCustomEndDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });

  // Selected Day Filter from the Date Strip (null means all days in horizon range)
  const [selectedSpecificDate, setSelectedSpecificDate] = useState<string | null>(null);

  // Filters
  const [frequencyFilter, setFrequencyFilter] = useState<string>('ALL');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('ALL');
  const [departmentFilter, setDepartmentFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'TIMELINE' | 'GRID' | 'TABLE' | 'CALENDAR'>('TIMELINE');

  // Preview Modal
  const [previewOccurrence, setPreviewOccurrence] = useState<ForecastOccurrence | null>(null);
  const [notice, setNotice] = useState<string>('');

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Compute Active Date Range based on Preset
  const { startDateStr, endDateStr, rangeLabel } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let start = new Date(today);
    let end = new Date(today);
    let label = 'Next 30 Days';

    switch (horizonPreset) {
      case 'today':
        label = 'Today Only';
        break;
      case 'tomorrow':
        start.setDate(today.getDate() + 1);
        end.setDate(today.getDate() + 1);
        label = 'Tomorrow Only';
        break;
      case '7days':
        end.setDate(today.getDate() + 7);
        label = 'Next 7 Days (1 Week)';
        break;
      case '14days':
        end.setDate(today.getDate() + 14);
        label = 'Next 14 Days (2 Weeks)';
        break;
      case '30days':
        end.setDate(today.getDate() + 30);
        label = 'Next 30 Days (1 Month)';
        break;
      case '90days':
        end.setDate(today.getDate() + 90);
        label = 'Next 90 Days (Quarter)';
        break;
      case 'custom':
        return {
          startDateStr: customStartDate || todayStr,
          endDateStr: customEndDate || todayStr,
          rangeLabel: `Custom Range (${customStartDate} to ${customEndDate})`,
        };
    }

    return {
      startDateStr: start.toISOString().split('T')[0],
      endDateStr: end.toISOString().split('T')[0],
      rangeLabel: label,
    };
  }, [horizonPreset, customStartDate, customEndDate, todayStr]);

  // Generate Array of Daily Dates in Horizon Range
  const horizonDatesList = useMemo(() => {
    const dates: string[] = [];
    const curr = new Date(startDateStr);
    curr.setHours(0, 0, 0, 0);
    const end = new Date(endDateStr);
    end.setHours(0, 0, 0, 0);

    // Safety guard to avoid unbounded loops
    let safetyCounter = 0;
    while (curr <= end && safetyCounter < 366) {
      dates.push(curr.toISOString().split('T')[0]);
      curr.setDate(curr.getDate() + 1);
      safetyCounter++;
    }
    return dates;
  }, [startDateStr, endDateStr]);

  // Forecast Engine: Project all tasks according to frequency into the date horizon
  const allForecastOccurrences = useMemo(() => {
    const occurrences: ForecastOccurrence[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const horizonStart = new Date(startDateStr);
    horizonStart.setHours(0, 0, 0, 0);
    const horizonEnd = new Date(endDateStr);
    horizonEnd.setHours(0, 0, 0, 0);

    // Map of existing active tasks by "name+assignee+dueDate" to detect if already created
    const activeTasksMap = new Map<string, TaskItem>();
    tasks.forEach((t) => {
      if (t.Due_Date) {
        const key = `${t.Task_Name.trim().toLowerCase()}_${(t.Assigned_To_Email || '').toLowerCase()}_${t.Due_Date}`;
        activeTasksMap.set(key, t);
      }
    });

    tasks.forEach((task) => {
      const baseDueDateStr = task.Due_Date || todayStr;
      const baseDate = new Date(baseDueDateStr);
      baseDate.setHours(0, 0, 0, 0);

      const freq = task.Frequency || 'One-Time';

      if (freq === 'One-Time') {
        // One-time tasks: include if due date falls in horizon
        if (baseDate >= horizonStart && baseDate <= horizonEnd) {
          const diffDays = Math.round((baseDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          occurrences.push({
            occurrenceId: `occ-onetime-${task.Task_ID}`,
            sourceTaskId: task.Task_ID,
            taskName: task.Task_Name,
            description: task.Description,
            frequency: 'One-Time',
            priority: task.Priority || 'Medium',
            department: task.Department,
            assignedToEmail: task.Assigned_To_Email,
            assignedToName: task.Assigned_To_Name,
            assignedByEmail: task.Assigned_By_Email,
            assignedByName: task.Assigned_By_Name,
            projectedDate: baseDueDateStr,
            dueTime: task.Due_Time || '18:00',
            subtasks: task.Subtasks || [],
            turnaroundHours: task.Turnaround_Hours,
            tags: task.Tags,
            daysFromToday: diffDays,
            isToday: diffDays === 0,
            isTomorrow: diffDays === 1,
            isExistingActiveTask: true,
            existingTaskId: task.Task_ID,
            existingTaskStatus: task.Status,
            sourceTask: task,
          });
        }
      } else if (freq === 'Daily') {
        // Daily: generate an occurrence for every single day in horizon
        horizonDatesList.forEach((dateStr) => {
          const occDate = new Date(dateStr);
          occDate.setHours(0, 0, 0, 0);

          const diffDays = Math.round((occDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          const matchKey = `${task.Task_Name.trim().toLowerCase()}_${(task.Assigned_To_Email || '').toLowerCase()}_${dateStr}`;
          const existingLive = activeTasksMap.get(matchKey);

          occurrences.push({
            occurrenceId: `occ-daily-${task.Task_ID}-${dateStr}`,
            sourceTaskId: task.Task_ID,
            taskName: task.Task_Name,
            description: task.Description,
            frequency: 'Daily',
            priority: task.Priority || 'Medium',
            department: task.Department,
            assignedToEmail: task.Assigned_To_Email,
            assignedToName: task.Assigned_To_Name,
            assignedByEmail: task.Assigned_By_Email,
            assignedByName: task.Assigned_By_Name,
            projectedDate: dateStr,
            dueTime: task.Due_Time || '18:00',
            subtasks: task.Subtasks || [],
            turnaroundHours: task.Turnaround_Hours,
            tags: task.Tags,
            daysFromToday: diffDays,
            isToday: diffDays === 0,
            isTomorrow: diffDays === 1,
            isExistingActiveTask: !!existingLive,
            existingTaskId: existingLive?.Task_ID,
            existingTaskStatus: existingLive?.Status,
            sourceTask: task,
          });
        });
      } else if (freq === 'Weekly') {
        // Weekly: every 7 days from baseDate
        const dayOfWeek = baseDate.getDay(); // 0 = Sunday, 1 = Monday, etc.

        horizonDatesList.forEach((dateStr) => {
          const occDate = new Date(dateStr);
          occDate.setHours(0, 0, 0, 0);

          if (occDate.getDay() === dayOfWeek) {
            const diffDays = Math.round((occDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            const matchKey = `${task.Task_Name.trim().toLowerCase()}_${(task.Assigned_To_Email || '').toLowerCase()}_${dateStr}`;
            const existingLive = activeTasksMap.get(matchKey);

            occurrences.push({
              occurrenceId: `occ-weekly-${task.Task_ID}-${dateStr}`,
              sourceTaskId: task.Task_ID,
              taskName: task.Task_Name,
              description: task.Description,
              frequency: 'Weekly',
              priority: task.Priority || 'Medium',
              department: task.Department,
              assignedToEmail: task.Assigned_To_Email,
              assignedToName: task.Assigned_To_Name,
              assignedByEmail: task.Assigned_By_Email,
              assignedByName: task.Assigned_By_Name,
              projectedDate: dateStr,
              dueTime: task.Due_Time || '18:00',
              subtasks: task.Subtasks || [],
              turnaroundHours: task.Turnaround_Hours,
              tags: task.Tags,
              daysFromToday: diffDays,
              isToday: diffDays === 0,
              isTomorrow: diffDays === 1,
              isExistingActiveTask: !!existingLive,
              existingTaskId: existingLive?.Task_ID,
              existingTaskStatus: existingLive?.Status,
              sourceTask: task,
            });
          }
        });
      } else if (freq === 'Monthly') {
        // Monthly: same day of month
        const dayOfMonth = baseDate.getDate();

        horizonDatesList.forEach((dateStr) => {
          const occDate = new Date(dateStr);
          occDate.setHours(0, 0, 0, 0);

          // Check if date of month matches
          if (occDate.getDate() === dayOfMonth) {
            const diffDays = Math.round((occDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            const matchKey = `${task.Task_Name.trim().toLowerCase()}_${(task.Assigned_To_Email || '').toLowerCase()}_${dateStr}`;
            const existingLive = activeTasksMap.get(matchKey);

            occurrences.push({
              occurrenceId: `occ-monthly-${task.Task_ID}-${dateStr}`,
              sourceTaskId: task.Task_ID,
              taskName: task.Task_Name,
              description: task.Description,
              frequency: 'Monthly',
              priority: task.Priority || 'Medium',
              department: task.Department,
              assignedToEmail: task.Assigned_To_Email,
              assignedToName: task.Assigned_To_Name,
              assignedByEmail: task.Assigned_By_Email,
              assignedByName: task.Assigned_By_Name,
              projectedDate: dateStr,
              dueTime: task.Due_Time || '18:00',
              subtasks: task.Subtasks || [],
              turnaroundHours: task.Turnaround_Hours,
              tags: task.Tags,
              daysFromToday: diffDays,
              isToday: diffDays === 0,
              isTomorrow: diffDays === 1,
              isExistingActiveTask: !!existingLive,
              existingTaskId: existingLive?.Task_ID,
              existingTaskStatus: existingLive?.Status,
              sourceTask: task,
            });
          }
        });
      } else if (freq === 'Yearly') {
        // Yearly: same month and day
        const month = baseDate.getMonth();
        const dayOfMonth = baseDate.getDate();

        horizonDatesList.forEach((dateStr) => {
          const occDate = new Date(dateStr);
          occDate.setHours(0, 0, 0, 0);

          if (occDate.getMonth() === month && occDate.getDate() === dayOfMonth) {
            const diffDays = Math.round((occDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            const matchKey = `${task.Task_Name.trim().toLowerCase()}_${(task.Assigned_To_Email || '').toLowerCase()}_${dateStr}`;
            const existingLive = activeTasksMap.get(matchKey);

            occurrences.push({
              occurrenceId: `occ-yearly-${task.Task_ID}-${dateStr}`,
              sourceTaskId: task.Task_ID,
              taskName: task.Task_Name,
              description: task.Description,
              frequency: 'Yearly',
              priority: task.Priority || 'Medium',
              department: task.Department,
              assignedToEmail: task.Assigned_To_Email,
              assignedToName: task.Assigned_To_Name,
              assignedByEmail: task.Assigned_By_Email,
              assignedByName: task.Assigned_By_Name,
              projectedDate: dateStr,
              dueTime: task.Due_Time || '18:00',
              subtasks: task.Subtasks || [],
              turnaroundHours: task.Turnaround_Hours,
              tags: task.Tags,
              daysFromToday: diffDays,
              isToday: diffDays === 0,
              isTomorrow: diffDays === 1,
              isExistingActiveTask: !!existingLive,
              existingTaskId: existingLive?.Task_ID,
              existingTaskStatus: existingLive?.Status,
              sourceTask: task,
            });
          }
        });
      }
    });

    // Sort chronologically by projected date and priority
    return occurrences.sort((a, b) => {
      const dateDiff = new Date(a.projectedDate).getTime() - new Date(b.projectedDate).getTime();
      if (dateDiff !== 0) return dateDiff;
      const priorityOrder: Record<TaskPriority, number> = { High: 1, Medium: 2, Low: 3 };
      return (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2);
    });
  }, [tasks, startDateStr, endDateStr, horizonDatesList, todayStr]);

  // Date Counts Map for Horizon Date Carousel
  const dateCountsMap = useMemo(() => {
    const map = new Map<string, number>();
    allForecastOccurrences.forEach((occ) => {
      map.set(occ.projectedDate, (map.get(occ.projectedDate) || 0) + 1);
    });
    return map;
  }, [allForecastOccurrences]);

  // Filtered Occurrences according to User Controls
  const filteredOccurrences = useMemo(() => {
    return allForecastOccurrences.filter((occ) => {
      // 1. Specific Date Filter (if clicked from date strip)
      if (selectedSpecificDate && occ.projectedDate !== selectedSpecificDate) {
        return false;
      }

      // 2. Frequency Filter
      if (frequencyFilter !== 'ALL' && occ.frequency !== frequencyFilter) {
        return false;
      }

      // 3. Assignee Filter
      if (assigneeFilter !== 'ALL' && occ.assignedToEmail.toLowerCase() !== assigneeFilter.toLowerCase()) {
        return false;
      }

      // 4. Department Filter
      if (departmentFilter !== 'ALL' && occ.department !== departmentFilter) {
        return false;
      }

      // 5. Priority Filter
      if (priorityFilter !== 'ALL' && occ.priority !== priorityFilter) {
        return false;
      }

      // 6. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nameMatch = occ.taskName.toLowerCase().includes(q);
        const descMatch = (occ.description || '').toLowerCase().includes(q);
        const tagMatch = (occ.tags || []).some((t) => t.toLowerCase().includes(q));
        const assigneeMatch = (occ.assignedToName || occ.assignedToEmail).toLowerCase().includes(q);
        if (!nameMatch && !descMatch && !tagMatch && !assigneeMatch) return false;
      }

      return true;
    });
  }, [
    allForecastOccurrences,
    selectedSpecificDate,
    frequencyFilter,
    assigneeFilter,
    departmentFilter,
    priorityFilter,
    searchQuery,
  ]);

  // Group Occurrences by Projected Date (for Timeline View)
  const groupedByDate = useMemo(() => {
    const groups: { date: string; displayDate: string; relativeLabel: string; items: ForecastOccurrence[] }[] = [];
    const map = new Map<string, ForecastOccurrence[]>();

    filteredOccurrences.forEach((occ) => {
      if (!map.has(occ.projectedDate)) {
        map.set(occ.projectedDate, []);
      }
      map.get(occ.projectedDate)!.push(occ);
    });

    map.forEach((items, dateStr) => {
      const d = new Date(dateStr);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      d.setHours(0, 0, 0, 0);
      const diffDays = Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      let relativeLabel = `${diffDays} days away`;
      if (diffDays === 0) relativeLabel = 'Today';
      else if (diffDays === 1) relativeLabel = 'Tomorrow';
      else if (diffDays === -1) relativeLabel = 'Yesterday';
      else if (diffDays > 1 && diffDays <= 7) relativeLabel = `In ${diffDays} days (This Week)`;

      const displayDate = d.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: d.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
      });

      groups.push({
        date: dateStr,
        displayDate,
        relativeLabel,
        items,
      });
    });

    return groups.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [filteredOccurrences]);

  // KPI Analytics
  const stats = useMemo(() => {
    const totalOccurrences = filteredOccurrences.length;
    const dailyCount = filteredOccurrences.filter((o) => o.frequency === 'Daily').length;
    const weeklyCount = filteredOccurrences.filter((o) => o.frequency === 'Weekly').length;
    const monthlyCount = filteredOccurrences.filter((o) => o.frequency === 'Monthly').length;
    const highPriorityCount = filteredOccurrences.filter((o) => o.priority === 'High').length;

    // Find busiest day
    let busiestDay = 'N/A';
    let maxTasks = 0;
    groupedByDate.forEach((g) => {
      if (g.items.length > maxTasks) {
        maxTasks = g.items.length;
        busiestDay = `${g.displayDate} (${g.items.length} tasks)`;
      }
    });

    return {
      totalOccurrences,
      dailyCount,
      weeklyCount,
      monthlyCount,
      highPriorityCount,
      busiestDay,
    };
  }, [filteredOccurrences, groupedByDate]);

  // Action: Spawn / Instantiate a projected occurrence early as a real task
  const handleSpawnOccurrenceNow = (occ: ForecastOccurrence) => {
    const isAllowed = canUserSpawnForecast(
      activeUser,
      occ.assignedByEmail || occ.sourceTask?.Assigned_By_Email,
      occ.assignedToEmail || occ.sourceTask?.Assigned_To_Email
    );

    if (!isAllowed) {
      alert('Security Restriction: You do not have permission to spawn or instantiate routines assigned to or created by other users.');
      return;
    }

    const newTaskId = `TSK-F${Math.floor(100 + Math.random() * 899)}`;
    const now = new Date();
    const formattedTimestamp = now.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const resetSubtasks = (occ.subtasks || []).map((st, idx) => ({
      id: `${Date.now()}-${idx + 1}`,
      title: st.title,
      completed: false,
    }));

    const newTask: TaskItem = {
      ...occ.sourceTask,
      Task_ID: newTaskId,
      Task_Name: occ.taskName,
      Description: occ.description,
      Frequency: occ.frequency,
      Priority: occ.priority,
      Department: occ.department,
      Assigned_To_Email: occ.assignedToEmail,
      Assigned_To_Name: occ.assignedToName,
      Assigned_By_Email: activeUser.Email,
      Assigned_By_Name: activeUser.Full_Name,
      Due_Date: occ.projectedDate,
      Due_Time: occ.dueTime || '18:00',
      Status: 'Pending',
      Progress_Percentage: 0,
      Subtasks: resetSubtasks,
      Comments: [
        {
          id: `c-${Date.now()}`,
          authorEmail: activeUser.Email,
          authorName: activeUser.Full_Name,
          text: `⚡ Task pre-spawned from Upcoming Frequency Forecast by ${activeUser.Full_Name}. Scheduled due date: ${occ.projectedDate}.`,
          createdAt: formattedTimestamp,
        },
      ],
      Created_At: now.toISOString(),
      Tags: ['Forecast-Spawned', occ.frequency, ...(occ.tags || [])],
    };

    setTasks((prev) => [newTask, ...prev]);
    saveCloudTask(newTask);
    realtimeSync.broadcastTaskMutation('CREATE', newTask, activeUser);
    googleSheetSync.syncRecord('TASK_HUB', newTask, activeUser.Email, 'NEW_RECORD');
    pushNotificationService.notifyTaskAssigned(newTask, activeUser);

    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.7 },
    });

    setNotice(`⚡ "${newTask.Task_Name}" scheduled for ${newTask.Due_Date} has been materialized into Task Hub!`);
    setTimeout(() => setNotice(''), 4000);
    setPreviewOccurrence(null);
  };

  // Helper formatting for frequency badges
  const getFrequencyBadge = (freq: TaskFrequency) => {
    switch (freq) {
      case 'Daily':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200/80">
            <Repeat className="w-3 h-3 text-blue-600" />
            Daily SOP
          </span>
        );
      case 'Weekly':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200/80">
            <Repeat className="w-3 h-3 text-purple-600" />
            Weekly Cycle
          </span>
        );
      case 'Monthly':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/80">
            <Repeat className="w-3 h-3 text-amber-600" />
            Monthly Audit
          </span>
        );
      case 'Yearly':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200/80">
            <Repeat className="w-3 h-3 text-rose-600" />
            Annual Routine
          </span>
        );
      case 'One-Time':
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
            <Clock className="w-3 h-3 text-slate-500" />
            Scheduled One-Time
          </span>
        );
    }
  };

  // Priority Badge
  const getPriorityBadge = (priority: TaskPriority) => {
    switch (priority) {
      case 'High':
        return (
          <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
            High Priority
          </span>
        );
      case 'Medium':
        return (
          <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
            Medium
          </span>
        );
      case 'Low':
      default:
        return (
          <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
            Low
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Toast Notice */}
      {notice && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-2xl text-xs font-bold flex items-center justify-between shadow-xs animate-slideDown">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{notice}</span>
          </div>
          <button onClick={() => setNotice('')} className="p-1 text-emerald-600 hover:text-emerald-900 cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Hero Header & Horizon Toggle Controls */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 sm:p-8 rounded-3xl shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-[#6C70FF]/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-10 w-48 h-48 bg-purple-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-xs text-[#8C8EFF] text-xs font-bold border border-white/10">
                <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
                <span>Module 4 • Predictive Scheduling & Routine Planner</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2.5">
                <span>Upcoming Tasks & Frequency Forecast</span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
                Projected future operational routines, daily checklists, weekly audits, and scheduled tasks generated automatically by frequency rules.
              </p>
            </div>

            {onNavigateToDelegate && (
              <button
                type="button"
                onClick={() => onNavigateToDelegate()}
                className="self-start md:self-auto px-4 py-2.5 bg-[#6C70FF] hover:bg-[#5B5FF5] active:scale-95 text-white text-xs font-bold rounded-2xl shadow-[0_4px_16px_rgba(108,112,255,0.4)] flex items-center space-x-2 cursor-pointer transition shrink-0"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>Create New Recurring Routine</span>
              </button>
            )}
          </div>

          {/* PRIMARY DATE HORIZON TOGGLE BAR */}
          <div className="pt-2 border-t border-white/10 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2 text-xs font-bold text-slate-300">
              <span className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-[#8C8EFF]" />
                <span>Select Date Forecast Horizon:</span>
              </span>
              <span className="text-[11px] font-mono text-indigo-300 bg-white/10 px-2.5 py-0.5 rounded-lg">
                Active Horizon: {rangeLabel}
              </span>
            </div>

            {/* Quick Horizon Buttons */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              <button
                type="button"
                onClick={() => {
                  setHorizonPreset('today');
                  setSelectedSpecificDate(null);
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 flex items-center space-x-1.5 ${
                  horizonPreset === 'today'
                    ? 'bg-white text-slate-900 shadow-md font-extrabold'
                    : 'bg-white/10 hover:bg-white/20 text-white'
                }`}
              >
                <span>Today</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setHorizonPreset('tomorrow');
                  setSelectedSpecificDate(null);
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 flex items-center space-x-1.5 ${
                  horizonPreset === 'tomorrow'
                    ? 'bg-white text-slate-900 shadow-md font-extrabold'
                    : 'bg-white/10 hover:bg-white/20 text-white'
                }`}
              >
                <span>Tomorrow</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setHorizonPreset('7days');
                  setSelectedSpecificDate(null);
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 flex items-center space-x-1.5 ${
                  horizonPreset === '7days'
                    ? 'bg-white text-slate-900 shadow-md font-extrabold'
                    : 'bg-white/10 hover:bg-white/20 text-white'
                }`}
              >
                <span>Next 7 Days</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setHorizonPreset('14days');
                  setSelectedSpecificDate(null);
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 flex items-center space-x-1.5 ${
                  horizonPreset === '14days'
                    ? 'bg-white text-slate-900 shadow-md font-extrabold'
                    : 'bg-white/10 hover:bg-white/20 text-white'
                }`}
              >
                <span>Next 14 Days</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setHorizonPreset('30days');
                  setSelectedSpecificDate(null);
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 flex items-center space-x-1.5 ${
                  horizonPreset === '30days'
                    ? 'bg-[#6C70FF] text-white shadow-md font-extrabold ring-2 ring-white/30'
                    : 'bg-white/10 hover:bg-white/20 text-white'
                }`}
              >
                <span>Next 30 Days (1 Mo)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setHorizonPreset('90days');
                  setSelectedSpecificDate(null);
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 flex items-center space-x-1.5 ${
                  horizonPreset === '90days'
                    ? 'bg-white text-slate-900 shadow-md font-extrabold'
                    : 'bg-white/10 hover:bg-white/20 text-white'
                }`}
              >
                <span>Next 90 Days (Quarter)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setHorizonPreset('custom');
                  setSelectedSpecificDate(null);
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 flex items-center space-x-1.5 ${
                  horizonPreset === 'custom'
                    ? 'bg-white text-slate-900 shadow-md font-extrabold'
                    : 'bg-white/10 hover:bg-white/20 text-white'
                }`}
              >
                <CalendarIcon className="w-3.5 h-3.5" />
                <span>Custom Date Range</span>
              </button>
            </div>

            {/* Custom Date Range Selector Inputs */}
            {horizonPreset === 'custom' && (
              <div className="bg-white/10 backdrop-blur-md p-3.5 rounded-2xl border border-white/20 flex flex-wrap items-center gap-3 animate-fadeIn">
                <div className="flex items-center space-x-2">
                  <span className="text-[11px] font-bold text-slate-200">From Date:</span>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="bg-white text-slate-900 text-xs font-bold px-2.5 py-1.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#6C70FF]"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-[11px] font-bold text-slate-200">To Date:</span>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="bg-white text-slate-900 text-xs font-bold px-2.5 py-1.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#6C70FF]"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* KPI METRICS OVERVIEW STRIP */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Projected Tasks</span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-extrabold text-slate-900 font-mono">{stats.totalOccurrences}</span>
            <span className="text-[10px] font-bold text-[#6C70FF] bg-indigo-50 px-2 py-0.5 rounded-md">
              In Horizon
            </span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Daily SOP Runs</span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-extrabold text-blue-600 font-mono">{stats.dailyCount}</span>
            <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">
              Every 24h
            </span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Weekly / Monthly</span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-extrabold text-purple-600 font-mono">{stats.weeklyCount + stats.monthlyCount}</span>
            <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md">
              Cycles
            </span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">High Priority</span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-extrabold text-rose-600 font-mono">{stats.highPriorityCount}</span>
            <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md">
              Critical
            </span>
          </div>
        </div>
      </div>

      {/* INTERACTIVE DATE STRIP / DAY CAROUSEL */}
      {horizonDatesList.length > 1 && (
        <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-2xs space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center space-x-2">
              <Calendar className="w-4 h-4 text-[#6C70FF]" />
              <span className="text-xs font-extrabold text-slate-900">Day-by-Day Forecast Carousel</span>
              <span className="text-[10px] text-slate-400 font-medium">(Click any date to filter)</span>
            </div>

            {selectedSpecificDate && (
              <button
                type="button"
                onClick={() => setSelectedSpecificDate(null)}
                className="text-[11px] font-bold text-[#6C70FF] hover:underline flex items-center space-x-1 cursor-pointer"
              >
                <span>Reset to All {horizonDatesList.length} Days</span>
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-2 pt-1 scrollbar-thin">
            {horizonDatesList.map((dateStr) => {
              const d = new Date(dateStr);
              const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
              const dayNum = d.getDate();
              const monthName = d.toLocaleDateString('en-US', { month: 'short' });
              const isSelected = selectedSpecificDate === dateStr;
              const isToday = dateStr === todayStr;
              const count = dateCountsMap.get(dateStr) || 0;

              return (
                <button
                  key={dateStr}
                  type="button"
                  onClick={() => setSelectedSpecificDate(isSelected ? null : dateStr)}
                  className={`flex flex-col items-center justify-center min-w-[70px] p-2.5 rounded-2xl border transition cursor-pointer shrink-0 ${
                    isSelected
                      ? 'bg-[#6C70FF] text-white border-[#6C70FF] shadow-md ring-2 ring-indigo-200'
                      : isToday
                      ? 'bg-indigo-50/70 border-indigo-200 text-slate-800'
                      : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                  }`}
                >
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${isSelected ? 'text-indigo-100' : isToday ? 'text-[#6C70FF]' : 'text-slate-400'}`}>
                    {dayName}
                  </span>
                  <span className={`text-base font-extrabold font-mono ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                    {dayNum}
                  </span>
                  <span className={`text-[10px] font-medium ${isSelected ? 'text-indigo-100' : 'text-slate-500'}`}>
                    {monthName}
                  </span>

                  <span
                    className={`mt-1 text-[9px] font-bold px-1.5 py-0.2 rounded-full font-mono ${
                      isSelected
                        ? 'bg-white text-[#6C70FF]'
                        : count > 0
                        ? 'bg-indigo-100 text-[#6C70FF]'
                        : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    {count} {count === 1 ? 'task' : 'tasks'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* FILTER & VIEW TOOLBAR */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search upcoming tasks, SOP tags, checklists..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-[#6C70FF] focus:border-transparent transition"
            />
          </div>

          {/* Quick Frequency Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {['ALL', 'Daily', 'Weekly', 'Monthly', 'Yearly', 'One-Time'].map((freq) => {
              const active = frequencyFilter === freq;
              return (
                <button
                  key={freq}
                  type="button"
                  onClick={() => setFrequencyFilter(freq)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
                    active
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {freq === 'ALL' ? 'All Frequencies' : freq}
                </button>
              );
            })}
          </div>

          {/* View Mode Toggle Buttons */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl shrink-0 self-end lg:self-auto">
            <button
              type="button"
              onClick={() => setViewMode('TIMELINE')}
              className={`p-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center space-x-1.5 ${
                viewMode === 'TIMELINE' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-900'
              }`}
              title="Timeline Grouped View"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Timeline</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('GRID')}
              className={`p-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center space-x-1.5 ${
                viewMode === 'GRID' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-900'
              }`}
              title="Grid View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Grid</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('TABLE')}
              className={`p-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center space-x-1.5 ${
                viewMode === 'TABLE' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-900'
              }`}
              title="Table View"
            >
              <List className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Table</span>
            </button>
          </div>
        </div>

        {/* Secondary Filters Dropdowns */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
          {/* Assignee Filter */}
          <div className="flex items-center space-x-1.5">
            <UserIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              value={assigneeFilter}
              onChange={(e) => setAssigneeFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-700 focus:ring-2 focus:ring-[#6C70FF]"
            >
              <option value="ALL">All Assignees</option>
              {users.map((u) => (
                <option key={u.Email} value={u.Email}>
                  {u.Full_Name} ({u.Role})
                </option>
              ))}
            </select>
          </div>

          {/* Department Filter */}
          <div className="flex items-center space-x-1.5">
            <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-700 focus:ring-2 focus:ring-[#6C70FF]"
            >
              <option value="ALL">All Departments</option>
              <option value="Executive Systems">Executive Systems</option>
              <option value="Factory Ops">Factory Ops</option>
              <option value="Purchase & Ops">Purchase & Ops</option>
              <option value="Inventory & Store">Inventory & Store</option>
              <option value="Fleet">Fleet & Dispatch</option>
              <option value="Quality & Compliance">Quality & Compliance</option>
              <option value="Security & Gate">Security & Gate</option>
            </select>
          </div>

          {/* Priority Filter */}
          <div className="flex items-center space-x-1.5">
            <Tag className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-700 focus:ring-2 focus:ring-[#6C70FF]"
            >
              <option value="ALL">All Priorities</option>
              <option value="High">High Priority</option>
              <option value="Medium">Medium Priority</option>
              <option value="Low">Low Priority</option>
            </select>
          </div>

          {/* Results Counter */}
          <div className="ml-auto text-[11px] font-bold text-slate-500 font-mono">
            Showing {filteredOccurrences.length} projected occurrences
          </div>
        </div>
      </div>

      {/* MAIN RESULTS CONTENT AREA */}
      {filteredOccurrences.length === 0 ? (
        <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center space-y-4 shadow-2xs">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-indigo-50 text-[#6C70FF] flex items-center justify-center border border-indigo-100">
            <CalendarDays className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-900">No Upcoming Tasks in Selected Horizon</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              No tasks match your active date horizon and filters. Try selecting a broader horizon (like <strong>Next 30 Days</strong>) or creating a new recurring routine.
            </p>
          </div>
          {onNavigateToDelegate && (
            <button
              type="button"
              onClick={() => onNavigateToDelegate()}
              className="px-4 py-2 bg-[#6C70FF] hover:bg-[#5B5FF5] text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer transition"
            >
              Delegate New Routine
            </button>
          )}
        </div>
      ) : (
        <>
          {/* VIEW MODE 1: TIMELINE (Grouped Day-by-Day) */}
          {viewMode === 'TIMELINE' && (
            <div className="space-y-6">
              {groupedByDate.map((group) => (
                <div key={group.date} className="space-y-3">
                  {/* Date Section Header */}
                  <div className="flex items-center justify-between sticky top-16 z-20 bg-slate-50/90 backdrop-blur-xs py-2 px-1">
                    <div className="flex items-center space-x-2.5">
                      <div className="w-8 h-8 rounded-xl bg-[#6C70FF] text-white flex items-center justify-center font-bold text-xs font-mono shadow-2xs">
                        {new Date(group.date).getDate()}
                      </div>
                      <div>
                        <h3 className="text-sm font-extrabold text-slate-900">
                          {group.displayDate}
                        </h3>
                        <p className="text-[11px] font-bold text-[#6C70FF]">
                          {group.relativeLabel}
                        </p>
                      </div>
                    </div>

                    <span className="text-[11px] font-bold text-slate-500 bg-white border border-slate-200 px-2.5 py-0.5 rounded-full font-mono shadow-2xs">
                      {group.items.length} {group.items.length === 1 ? 'task scheduled' : 'tasks scheduled'}
                    </span>
                  </div>

                  {/* Task Cards in this Day */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                    {group.items.map((occ) => (
                      <div
                        key={occ.occurrenceId}
                        className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs hover:shadow-md transition space-y-3 flex flex-col justify-between"
                      >
                        <div className="space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            {getFrequencyBadge(occ.frequency)}
                            {getPriorityBadge(occ.priority)}
                          </div>

                          <div>
                            <h4 className="text-sm font-extrabold text-slate-900 line-clamp-2 leading-snug">
                              {occ.taskName}
                            </h4>
                            {occ.description && (
                              <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                                {occ.description}
                              </p>
                            )}
                          </div>

                          {/* Subtasks Summary */}
                          {occ.subtasks && occ.subtasks.length > 0 && (
                            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-[11px] text-slate-600 space-y-1">
                              <div className="flex items-center justify-between font-bold text-slate-700">
                                <span className="flex items-center gap-1">
                                  <CheckSquare className="w-3.5 h-3.5 text-[#6C70FF]" />
                                  Checklist SOP:
                                </span>
                                <span className="font-mono">{occ.subtasks.length} items</span>
                              </div>
                              <p className="text-slate-500 truncate">
                                • {occ.subtasks[0].title}
                                {occ.subtasks.length > 1 && ` (+${occ.subtasks.length - 1} more)`}
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Card Footer: Assignee & Action Buttons */}
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                          <div className="flex items-center space-x-2 min-w-0">
                            <UserAvatar
                              name={occ.assignedToName || occ.assignedToEmail}
                              email={occ.assignedToEmail}
                              size="sm"
                            />
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-900 truncate">
                                {occ.assignedToName || occ.assignedToEmail.split('@')[0]}
                              </p>
                              <p className="text-[10px] text-slate-400 truncate">
                                Due {occ.dueTime || '18:00'}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center space-x-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => setPreviewOccurrence(occ)}
                              className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                              title="Inspect Checklist SOP"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            {occ.isExistingActiveTask ? (
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-lg">
                                Active in Hub
                              </span>
                            ) : canUserSpawnForecast(activeUser, occ.assignedByEmail, occ.assignedToEmail) ? (
                              <button
                                type="button"
                                onClick={() => handleSpawnOccurrenceNow(occ)}
                                className="px-2.5 py-1 bg-indigo-50 hover:bg-[#6C70FF] text-[#6C70FF] hover:text-white text-[11px] font-bold rounded-lg border border-indigo-200/80 transition cursor-pointer flex items-center space-x-1 shadow-2xs"
                                title="Materialize into active Task Hub now"
                              >
                                <Zap className="w-3 h-3" />
                                <span>Spawn Now</span>
                              </button>
                            ) : (
                              <span className="text-[10px] font-medium text-slate-400 bg-slate-100 px-2 py-1 rounded-lg">
                                Projected
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* VIEW MODE 2: GRID CARDS */}
          {viewMode === 'GRID' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredOccurrences.map((occ) => (
                <div
                  key={occ.occurrenceId}
                  className="bg-white rounded-3xl border border-slate-200 p-5 shadow-2xs hover:shadow-md transition space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      {getFrequencyBadge(occ.frequency)}
                      <span className="text-[11px] font-extrabold text-[#6C70FF] bg-indigo-50 px-2 py-0.5 rounded-md font-mono">
                        {occ.projectedDate}
                      </span>
                    </div>

                    <div>
                      <h4 className="text-sm font-extrabold text-slate-900 leading-snug">
                        {occ.taskName}
                      </h4>
                      {occ.description && (
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                          {occ.description}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap text-[11px]">
                      {getPriorityBadge(occ.priority)}
                      {occ.department && (
                        <span className="text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md font-medium">
                          {occ.department}
                        </span>
                      )}
                      <span className="text-slate-400 font-mono">
                        {occ.daysFromToday === 0
                          ? 'Today'
                          : occ.daysFromToday === 1
                          ? 'Tomorrow'
                          : `in ${occ.daysFromToday}d`}
                      </span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <div className="flex items-center space-x-2 min-w-0">
                      <UserAvatar
                        name={occ.assignedToName || occ.assignedToEmail}
                        email={occ.assignedToEmail}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 truncate">
                          {occ.assignedToName || occ.assignedToEmail.split('@')[0]}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => setPreviewOccurrence(occ)}
                        className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      {occ.isExistingActiveTask ? (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-lg">
                          Active
                        </span>
                      ) : canUserSpawnForecast(activeUser, occ.assignedByEmail, occ.assignedToEmail) ? (
                        <button
                          type="button"
                          onClick={() => handleSpawnOccurrenceNow(occ)}
                          className="px-3 py-1 bg-[#6C70FF] hover:bg-[#5B5FF5] text-white text-[11px] font-bold rounded-xl transition cursor-pointer flex items-center space-x-1 shadow-2xs"
                        >
                          <Zap className="w-3 h-3" />
                          <span>Spawn</span>
                        </button>
                      ) : (
                        <span className="text-[10px] font-medium text-slate-400 bg-slate-100 px-2 py-1 rounded-lg">
                          Projected
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* VIEW MODE 3: HIGH-DENSITY TABLE */}
          {viewMode === 'TABLE' && (
            <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      <th className="p-3.5">Projected Date</th>
                      <th className="p-3.5">Task Routine</th>
                      <th className="p-3.5">Frequency</th>
                      <th className="p-3.5">Assignee</th>
                      <th className="p-3.5">Department</th>
                      <th className="p-3.5">Priority</th>
                      <th className="p-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredOccurrences.map((occ) => (
                      <tr key={occ.occurrenceId} className="hover:bg-slate-50/80 transition">
                        <td className="p-3.5 font-mono font-bold text-slate-900 whitespace-nowrap">
                          <div>{occ.projectedDate}</div>
                          <div className="text-[10px] text-[#6C70FF] font-sans">
                            {occ.daysFromToday === 0
                              ? 'Today'
                              : occ.daysFromToday === 1
                              ? 'Tomorrow'
                              : `in ${occ.daysFromToday} days`}
                          </div>
                        </td>

                        <td className="p-3.5 max-w-xs">
                          <div className="font-extrabold text-slate-900 line-clamp-1">{occ.taskName}</div>
                          {occ.description && (
                            <div className="text-[11px] text-slate-500 line-clamp-1">{occ.description}</div>
                          )}
                        </td>

                        <td className="p-3.5 whitespace-nowrap">
                          {getFrequencyBadge(occ.frequency)}
                        </td>

                        <td className="p-3.5 whitespace-nowrap">
                          <div className="flex items-center space-x-2">
                            <UserAvatar
                              name={occ.assignedToName || occ.assignedToEmail}
                              email={occ.assignedToEmail}
                              size="xs"
                            />
                            <span className="font-medium text-slate-800">
                              {occ.assignedToName || occ.assignedToEmail}
                            </span>
                          </div>
                        </td>

                        <td className="p-3.5 whitespace-nowrap text-slate-600">
                          {occ.department || 'Factory Ops'}
                        </td>

                        <td className="p-3.5 whitespace-nowrap">
                          {getPriorityBadge(occ.priority)}
                        </td>

                        <td className="p-3.5 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              type="button"
                              onClick={() => setPreviewOccurrence(occ)}
                              className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-200 transition cursor-pointer"
                              title="Inspect Details"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>

                            {occ.isExistingActiveTask ? (
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                Active
                              </span>
                            ) : canUserSpawnForecast(activeUser, occ.assignedByEmail, occ.assignedToEmail) ? (
                              <button
                                type="button"
                                onClick={() => handleSpawnOccurrenceNow(occ)}
                                className="px-2.5 py-1 bg-[#6C70FF] hover:bg-[#5B5FF5] text-white text-[11px] font-bold rounded-lg transition cursor-pointer shadow-2xs flex items-center space-x-1"
                              >
                                <Zap className="w-3 h-3" />
                                <span>Spawn</span>
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* MODAL: PREVIEW OCCURRENCE & SOP CHECKLIST */}
      {previewOccurrence && (
        <div className="fixed inset-0 z-50 overflow-hidden flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-scaleUp">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-[#6C70FF] flex items-center justify-center">
                  <CalendarDays className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900">Upcoming Routine SOP Preview</h3>
                  <p className="text-[10px] text-slate-400 font-mono">Scheduled: {previewOccurrence.projectedDate}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewOccurrence(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  {getFrequencyBadge(previewOccurrence.frequency)}
                  {getPriorityBadge(previewOccurrence.priority)}
                </div>
                <h2 className="text-base font-extrabold text-slate-900 pt-1">
                  {previewOccurrence.taskName}
                </h2>
                {previewOccurrence.description && (
                  <p className="text-xs text-slate-600 leading-relaxed pt-1">
                    {previewOccurrence.description}
                  </p>
                )}
              </div>

              {/* Assignee Card */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <UserAvatar
                    name={previewOccurrence.assignedToName || previewOccurrence.assignedToEmail}
                    email={previewOccurrence.assignedToEmail}
                    size="md"
                  />
                  <div>
                    <p className="text-xs font-bold text-slate-900">
                      {previewOccurrence.assignedToName || previewOccurrence.assignedToEmail}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {previewOccurrence.department || 'Factory Ops'} • Due {previewOccurrence.dueTime || '18:00'}
                    </p>
                  </div>
                </div>
                <span className="text-[11px] font-bold text-[#6C70FF] bg-indigo-50 px-2 py-1 rounded-lg">
                  Assignee
                </span>
              </div>

              {/* Subtasks SOP Checklist */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                  <span className="flex items-center gap-1.5">
                    <CheckSquare className="w-4 h-4 text-[#6C70FF]" />
                    <span>Checklist & Subtask Steps ({previewOccurrence.subtasks.length}):</span>
                  </span>
                </div>

                {previewOccurrence.subtasks.length === 0 ? (
                  <p className="text-xs text-slate-400 italic bg-slate-50 p-3 rounded-xl">
                    No subtasks attached to this routine.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {previewOccurrence.subtasks.map((st, i) => (
                      <div
                        key={st.id || i}
                        className="p-2.5 rounded-xl border border-slate-200 bg-white flex items-center space-x-2.5 text-xs text-slate-700"
                      >
                        <span className="w-5 h-5 rounded-full bg-indigo-50 text-[#6C70FF] font-mono text-[10px] font-bold flex items-center justify-center shrink-0">
                          {i + 1}
                        </span>
                        <span className="font-medium">{st.title}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setPreviewOccurrence(null)}
                className="px-4 py-2 bg-white border border-slate-200 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-100 transition cursor-pointer"
              >
                Close Preview
              </button>

              {previewOccurrence.isExistingActiveTask ? (
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl">
                  ✓ Task Active in Hub
                </span>
              ) : canUserSpawnForecast(activeUser, previewOccurrence.assignedByEmail, previewOccurrence.assignedToEmail) ? (
                <button
                  type="button"
                  onClick={() => handleSpawnOccurrenceNow(previewOccurrence)}
                  className="px-4 py-2 bg-[#6C70FF] hover:bg-[#5B5FF5] text-white font-bold text-xs rounded-xl transition cursor-pointer shadow-sm flex items-center space-x-1.5"
                >
                  <Zap className="w-4 h-4" />
                  <span>Spawn Into Task Hub Now</span>
                </button>
              ) : (
                <span className="text-xs text-slate-400 font-medium">
                  🔒 Managed by Assigner ({previewOccurrence.assignedByEmail})
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
