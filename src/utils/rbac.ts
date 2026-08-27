import { User, SYSTEM_MODULES, SystemModule, TaskItem } from '../types';

export const MODULE_IDS = {
  TASK_HUB: 1,
  DELEGATE_TASK: 2,
  DELAYED_TASKS: 3,
  UPCOMING_FORECAST: 4,
  ANALYTICS: 5,
  SHEETS_SYNC: 6,
  ADMIN: 7,
} as const;

/**
 * Validates whether a user has permission to access a specific module.
 * Admin users have unrestricted access to all modules.
 * Standard users are checked against their Allowed_Modules array.
 */
export function isModuleAllowed(user: User | null | undefined, moduleId: number): boolean {
  if (!user) return false;
  if (user.Role === 'Admin') return true;
  if (!user.Allowed_Modules || !Array.isArray(user.Allowed_Modules)) {
    // Default standard modules: 1 (Task Hub), 2 (Delegate), 3 (Delayed), 4 (Upcoming Forecast)
    return moduleId === 1 || moduleId === 2 || moduleId === 3 || moduleId === 4;
  }
  return user.Allowed_Modules.includes(moduleId);
}

/**
 * Security Rule: Can the user delete this task?
 * ONLY the Admin or the Assigner/Creator (Assigned_By_Email) can delete a task.
 * Assignees and unrelated 3rd-party employees are STRICTLY FORBIDDEN from deleting tasks.
 */
export function canUserDeleteTask(user: User | null | undefined, task: TaskItem | null | undefined): boolean {
  if (!user || !task) return false;
  if (user.Role === 'Admin') return true;
  const userEmail = (user.Email || '').trim().toLowerCase();
  const assignerEmail = (task.Assigned_By_Email || '').trim().toLowerCase();
  return userEmail === assignerEmail;
}

/**
 * Security Rule: Can the user edit core metadata of this task (reassign, change due date, rename)?
 * ONLY Admin or Creator can edit core metadata.
 */
export function canUserEditTask(user: User | null | undefined, task: TaskItem | null | undefined): boolean {
  if (!user || !task) return false;
  if (user.Role === 'Admin') return true;
  const userEmail = (user.Email || '').trim().toLowerCase();
  const assignerEmail = (task.Assigned_By_Email || '').trim().toLowerCase();
  return userEmail === assignerEmail;
}

/**
 * Security Rule: Can the user update progress, execute checklist subtasks, or submit status?
 * Allowed for: Admin, Assigner, or the Assignee (Assigned_To_Email).
 * Unrelated users outside this task cannot modify progress.
 */
export function canUserUpdateTaskStatus(user: User | null | undefined, task: TaskItem | null | undefined): boolean {
  if (!user || !task) return false;
  if (user.Role === 'Admin') return true;
  const userEmail = (user.Email || '').trim().toLowerCase();
  const assigneeEmail = (task.Assigned_To_Email || '').trim().toLowerCase();
  const assignerEmail = (task.Assigned_By_Email || '').trim().toLowerCase();
  return userEmail === assigneeEmail || userEmail === assignerEmail;
}

/**
 * Security Rule: Can the user add or remove subtask checklist items?
 * Allowed for: Admin or Task Creator (Assigner).
 */
export function canUserModifyChecklistStructure(user: User | null | undefined, task: TaskItem | null | undefined): boolean {
  if (!user || !task) return false;
  if (user.Role === 'Admin') return true;
  const userEmail = (user.Email || '').trim().toLowerCase();
  const assignerEmail = (task.Assigned_By_Email || '').trim().toLowerCase();
  return userEmail === assignerEmail;
}

/**
 * Security Rule: Can user spawn / materialize recurring forecast item into live Task Hub?
 * Allowed for Admin, the routine's Assigner, or Assignee.
 */
export function canUserSpawnForecast(user: User | null | undefined, assignedByEmail?: string, assignedToEmail?: string): boolean {
  if (!user) return false;
  if (user.Role === 'Admin') return true;
  const userEmail = (user.Email || '').trim().toLowerCase();
  const by = (assignedByEmail || '').trim().toLowerCase();
  const to = (assignedToEmail || '').trim().toLowerCase();
  return userEmail === by || userEmail === to;
}

/**
 * Gets metadata for a system module.
 */
export function getModuleInfo(moduleId: number): SystemModule | undefined {
  return SYSTEM_MODULES.find((m) => m.id === moduleId);
}

/**
 * Returns total allowed module count for a user.
 */
export function getAllowedModuleCount(user: User | null | undefined): number {
  if (!user) return 0;
  if (user.Role === 'Admin') return SYSTEM_MODULES.length;
  if (!user.Allowed_Modules || !Array.isArray(user.Allowed_Modules)) return 4;
  return user.Allowed_Modules.length;
}

