import { TaskPriority, TaskStatus } from './tasks.rules';

export class Task {
  id: string;
  home_id: string;
  title: string;
  description: string;
  assigned_membership_id: string | null;
  due_at: Date | null;
  priority: TaskPriority;
  status: TaskStatus;
  created_by: string;
  created_at: Date;
  completed_at: Date | null;
}

// previous_status es null en el registro que crea la tarea.
export class TaskHistory {
  id: string;
  task_id: string;
  actor_id: string | null;
  previous_status: TaskStatus | null;
  new_status: TaskStatus;
  created_at: Date;
}

// La tarea como la muestra la API: con su responsable y quien la creó.
export interface TaskRow extends Task {
  assignee_user_id: string | null;
  assignee: string | null;
  assignee_active: boolean;
  creator: string;
}

export interface TaskHistoryRow {
  id: string;
  previous_status: TaskStatus | null;
  new_status: TaskStatus;
  created_at: Date;
  actor: string | null;
}
