// Reglas sin dependencias de NestJS: las usan el servidor y también la interfaz (src/lib/tasks.ts).
import { canManageRecord } from '../common/permissions.rules';

export type TaskStatus = 'pending' | 'in_progress' | 'completed';
export type TaskPriority = 'low' | 'medium' | 'high';
export const taskStatuses: TaskStatus[] = ['pending', 'in_progress', 'completed'];
export const taskPriorities: TaskPriority[] = ['low', 'medium', 'high'];

// Solo quien creó la tarea o un administrador la editan, cambian de estado o eliminan.
export function canEditTask(task: { created_by: string }, userId: string, role: 'admin' | 'member') {
  return canManageRecord(role, task.created_by, userId);
}

// Sin responsable, cualquier integrante puede empezarla o completarla, pero no retroceder su estado.
export function canAdvance(task: { assigned_membership_id: string | null; status: TaskStatus }, status: TaskStatus) {
  return !task.assigned_membership_id && taskStatuses.indexOf(status) > taskStatuses.indexOf(task.status);
}

// Se admite un minuto de margen por la diferencia de reloj entre el navegador y el servidor.
export function isPastDue(due: string | Date | null | undefined, now = Date.now()) {
  return !!due && new Date(due).getTime() < now - 60000;
}
