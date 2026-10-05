import type { Task, TaskPriority, TaskStatus } from "@/types";
import { fromDateInput } from "./dates";
// Valores estables en inglés; estas etiquetas son las que ve el usuario.
export const statuses: TaskStatus[] = ["pending", "in_progress", "completed"];
export const statusLabels: Record<TaskStatus, string> = {
  pending: "Pendiente",
  in_progress: "En progreso",
  completed: "Completada",
};
export const priorities: TaskPriority[] = ["high", "medium", "low"];
export const priorityLabels: Record<TaskPriority, string> = {
  high: "Alta",
  medium: "Media",
  low: "Baja",
};
// El estado se cambia con botones: el tablero no depende de arrastrar.
export const statusMoves: Record<
  TaskStatus,
  { status: TaskStatus; label: string }[]
> = {
  pending: [
    { status: "in_progress", label: "Empezar" },
    { status: "completed", label: "Completar" },
  ],
  in_progress: [
    { status: "pending", label: "Volver a pendiente" },
    { status: "completed", label: "Completar" },
  ],
  completed: [{ status: "pending", label: "Reabrir" }],
};
// Sin responsable, cualquier integrante puede empezarla o completarla, pero no retroceder su estado.
export function canAdvance(
  task: Pick<Task, "assigned_membership_id" | "status">,
  status: TaskStatus,
) {
  return (
    !task.assigned_membership_id &&
    statuses.indexOf(status) > statuses.indexOf(task.status)
  );
}
export function isOverdue(task: Pick<Task, "due_at" | "status">) {
  return (
    task.status !== "completed" &&
    task.due_at !== null &&
    new Date(task.due_at) < new Date()
  );
}
export function taskPayload(form: FormData) {
  return {
    title: form.get("title"),
    description: form.get("description"),
    assigned_membership_id: form.get("assigned_membership_id") || null,
    priority: form.get("priority"),
    due_at: fromDateInput(form.get("due_at")),
  };
}
