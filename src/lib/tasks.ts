import type { Task, TaskPriority, TaskStatus } from "@/types";
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
export function formatDate(value: string) {
  return new Date(value).toLocaleString("es-CO", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
// datetime-local trabaja con la hora local sin zona; la API recibe ISO con zona.
export function toDateInput(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
export function taskPayload(form: FormData) {
  const due = String(form.get("due_at") || "");
  return {
    title: form.get("title"),
    description: form.get("description"),
    assigned_membership_id: form.get("assigned_membership_id") || null,
    priority: form.get("priority"),
    due_at: due ? new Date(due).toISOString() : null,
  };
}
