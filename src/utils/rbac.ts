import { User, SYSTEM_MODULES, SystemModule } from '../types';

export const MODULE_IDS = {
  TASK_HUB: 1,
  DELEGATE_TASK: 2,
  DELAYED_TASKS: 3,
  ANALYTICS: 4,
  SHEETS_SYNC: 5,
  ADMIN: 6,
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
    // Default standard modules: 1 (Task Hub), 2 (Delegate), 3 (Delayed)
    return moduleId === 1 || moduleId === 2 || moduleId === 3;
  }
  return user.Allowed_Modules.includes(moduleId);
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
  if (!user.Allowed_Modules || !Array.isArray(user.Allowed_Modules)) return 3;
  return user.Allowed_Modules.length;
}
