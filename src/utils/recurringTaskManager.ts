import { TaskItem, TaskFrequency, User } from '../types';

/**
 * Computes the next calendar due date based on frequency.
 * @param currentDueDate Date string (YYYY-MM-DD)
 * @param frequency 'One-Time' | 'Daily' | 'Weekly' | 'Monthly' | 'Yearly'
 */
export const computeNextDueDate = (
  currentDueDate: string,
  frequency: TaskFrequency
): string => {
  const base = currentDueDate ? new Date(currentDueDate) : new Date();
  const validDate = isNaN(base.getTime()) ? new Date() : base;
  const next = new Date(validDate);

  if (frequency === 'Daily') {
    next.setDate(next.getDate() + 1);
  } else if (frequency === 'Weekly') {
    next.setDate(next.getDate() + 7);
  } else if (frequency === 'Monthly') {
    next.setMonth(next.getMonth() + 1);
  } else if (frequency === 'Yearly') {
    next.setFullYear(next.getFullYear() + 1);
  } else {
    return currentDueDate;
  }

  return next.toISOString().split('T')[0];
};

/**
 * Formats a friendly human-readable recurrence label.
 */
export const getFrequencyLabel = (frequency: TaskFrequency): string => {
  switch (frequency) {
    case 'Daily':
      return 'Daily Routine (Repeats every 24h on scheduled date)';
    case 'Weekly':
      return 'Weekly Routine (Repeats every 7 days on scheduled date)';
    case 'Monthly':
      return 'Monthly Routine (Repeats every month on scheduled date)';
    case 'Yearly':
      return 'Yearly Routine (Repeats annually on scheduled date)';
    case 'One-Time':
    default:
      return 'One-Time Task (No recurrence)';
  }
};

/**
 * Automatically creates the next recurring task instance when a recurring task is completed.
 */
export const createNextRecurringInstance = (
  completedTask: TaskItem,
  completedBy: User
): TaskItem | null => {
  if (!completedTask || completedTask.Frequency === 'One-Time') {
    return null;
  }

  const nextDueDate = computeNextDueDate(completedTask.Due_Date, completedTask.Frequency);
  const newTaskId = `TSK-R${Math.floor(100 + Math.random() * 899)}`;
  const now = new Date();
  const formattedTimestamp = now.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  // Clone and uncheck all subtasks for the new routine cycle
  const resetSubtasks = (completedTask.Subtasks || []).map((st, idx) => ({
    id: `${Date.now()}-${idx + 1}`,
    title: st.title,
    completed: false,
  }));

  const nextInstance: TaskItem = {
    ...completedTask,
    Task_ID: newTaskId,
    Due_Date: nextDueDate,
    Due_Time: completedTask.Due_Time || '18:00',
    Status: 'Pending',
    Progress_Percentage: 0,
    Completed_At: undefined,
    Subtasks: resetSubtasks,
    Comments: [
      {
        id: `c-rec-${Date.now()}`,
        authorEmail: 'scheduler@malwaconcrete.com',
        authorName: 'Auto-Routine Engine',
        text: `🔁 Auto-scheduled next ${completedTask.Frequency} cycle (Due: ${nextDueDate}). Previous cycle ${completedTask.Task_ID} completed by ${completedBy.Full_Name}.`,
        createdAt: formattedTimestamp,
      },
    ],
    Created_At: now.toISOString(),
    Tags: [
      'Auto-Routine',
      completedTask.Frequency,
      completedTask.Department || 'Factory Ops',
    ],
  };

  return nextInstance;
};

/**
 * Checks for completed recurring tasks that need an active instance spawned because their scheduled date has arrived.
 */
export const checkAndSyncRecurringRoutines = (
  allTasks: TaskItem[],
  systemUser: User
): { updatedTasks: TaskItem[]; createdTasks: TaskItem[] } => {
  const createdTasks: TaskItem[] = [];
  const taskMap = new Map<string, TaskItem[]>();
  const todayStr = new Date().toISOString().split('T')[0];

  // Group tasks by normalized Routine Name + Assignee
  allTasks.forEach((t) => {
    if (t.Frequency && t.Frequency !== 'One-Time') {
      const groupKey = `${t.Task_Name.trim().toLowerCase()}_${(t.Assigned_To_Email || '').toLowerCase()}`;
      if (!taskMap.has(groupKey)) {
        taskMap.set(groupKey, []);
      }
      taskMap.get(groupKey)!.push(t);
    }
  });

  // For each recurring routine group, verify if there is an active instance
  taskMap.forEach((groupTasks) => {
    const hasActiveInstance = groupTasks.some((t) => t.Status === 'Pending' || t.Status === 'In_Progress' || t.Status === 'Overdue');
    
    if (!hasActiveInstance) {
      // Find latest completed task
      const latestCompleted = groupTasks
        .filter((t) => t.Status === 'Completed')
        .sort((a, b) => new Date(b.Due_Date).getTime() - new Date(a.Due_Date).getTime())[0];

      if (latestCompleted) {
        const nextDueDate = computeNextDueDate(latestCompleted.Due_Date, latestCompleted.Frequency);
        
        // ONLY spawn the next instance when its scheduled due date has arrived (today >= nextDueDate)
        if (nextDueDate <= todayStr) {
          const nextInstance = createNextRecurringInstance(latestCompleted, systemUser);
          if (nextInstance) {
            createdTasks.push(nextInstance);
          }
        }
      }
    }
  });

  if (createdTasks.length > 0) {
    return {
      updatedTasks: [...createdTasks, ...allTasks],
      createdTasks,
    };
  }

  return {
    updatedTasks: allTasks,
    createdTasks: [],
  };
};
