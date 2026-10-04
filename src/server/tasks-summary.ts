import { query } from "./db";
import type { DashboardSummary } from "@/types";
// Inicio muestra `due` tal cual; se formatea en la zona horaria del proyecto.
const dateFormat = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Bogota",
});
// Tareas abiertas asignadas a la persona. El llamador debe verificar requireHome.
export async function getTasksSummary(
  homeId: string,
  userId: string,
): Promise<Pick<DashboardSummary, "pendingTasks" | "tasks">> {
  const mine = `FROM tasks t JOIN memberships m ON m.id=t.assigned_membership_id
    WHERE t.home_id=$1 AND m.user_id=$2 AND t.status<>'completed'`;
  const [[count], rows] = await Promise.all([
    query(`SELECT count(*)::int AS total ${mine}`, [homeId, userId]),
    query(
      `SELECT t.id,t.title,t.due_at ${mine} ORDER BY t.due_at ASC NULLS LAST, t.created_at LIMIT 5`,
      [homeId, userId],
    ),
  ]);
  return {
    pendingTasks: count.total,
    tasks: rows.map((t) => ({
      id: t.id,
      title: t.title,
      due: !t.due_at
        ? "Sin fecha límite"
        : `${t.due_at < new Date() ? "Venció" : "Vence"} ${dateFormat.format(t.due_at)}`,
      href: `/tareas/${t.id}`,
    })),
  };
}
