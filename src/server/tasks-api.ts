import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { z } from "zod";
import { query, transaction } from "./db";
import { ApiError, requireUser } from "./security";
import { activity, requireHome } from "./home-access";
import { cancelReminder, notify, scheduleReminder } from "./notifications";
import { idSchema } from "./validation";
import { canAdvance } from "@/lib/tasks";
import type { Task, TaskStatus } from "@/types";

const taskSchema = z.object({
  title: z
    .string()
    .trim()
    .min(2, "El título debe tener al menos 2 caracteres.")
    .max(120, "El título admite hasta 120 caracteres."),
  description: z
    .string()
    .trim()
    .max(500, "La descripción admite hasta 500 caracteres."),
  assigned_membership_id: idSchema.nullable(),
  due_at: z.iso
    .datetime({ offset: true, error: "Escribe una fecha límite válida." })
    .nullable(),
  priority: z.enum(["low", "medium", "high"], "Elige una prioridad válida."),
});
const status = z.enum(
  ["pending", "in_progress", "completed"],
  "Elige un estado válido.",
);
const statusVerbs: Record<TaskStatus, string> = {
  pending: "marcó como pendiente",
  in_progress: "empezó",
  completed: "completó",
};
type TaskRow = Omit<Task, "can_edit">;
const taskColumns = `SELECT t.id,t.home_id,t.title,t.description,t.assigned_membership_id,t.due_at,t.priority,
  t.status,t.created_by,t.created_at,t.completed_at,m.user_id AS assignee_user_id,u.name AS assignee,
  COALESCE(m.active,false) AS assignee_active,c.name AS creator
  FROM tasks t LEFT JOIN memberships m ON m.id=t.assigned_membership_id
  LEFT JOIN users u ON u.id=m.user_id JOIN users c ON c.id=t.created_by`;

// Solo quien creó la tarea o un administrador la editan, cambian de estado o eliminan.
// Excepción en PATCH: canAdvance permite empezar o completar una tarea sin responsable.
const canEdit = (
  task: Pick<Task, "created_by">,
  userId: string,
  role: "admin" | "member",
) => role === "admin" || task.created_by === userId;
const time = (value: string | Date | null) =>
  value ? new Date(value).getTime() : null;
function assertFutureDue(due: string | null) {
  if (due && new Date(due).getTime() < Date.now() - 60000)
    throw new ApiError(400, "La fecha límite no puede estar en el pasado.");
}
// FOR SHARE impide que retiren a la persona antes de confirmar la asignación.
async function assigneeUserId(
  db: PoolClient,
  homeId: string,
  membershipId: string | null,
) {
  if (!membershipId) return null;
  const { rows } = await db.query(
    "SELECT user_id FROM memberships WHERE id=$1 AND home_id=$2 AND active FOR SHARE",
    [membershipId, homeId],
  );
  if (!rows[0])
    throw new ApiError(
      400,
      "El responsable debe ser un integrante activo del apartamento.",
    );
  return rows[0].user_id as string;
}
async function lockTask(db: PoolClient, userId: string, taskId: string) {
  const { rows } = await db.query(
    `${taskColumns} WHERE t.id=$1 FOR UPDATE OF t`,
    [taskId],
  );
  if (!rows[0]) throw new ApiError(404, "Tarea no encontrada.");
  return {
    task: rows[0],
    role: await requireHome(userId, rows[0].home_id, false, db),
  };
}
// Un recordatorio por tarea. Al cambiar de responsable se crea de nuevo para que también le llegue.
async function syncReminder(
  db: PoolClient,
  task: {
    id: string;
    home_id: string;
    title: string;
    status: TaskStatus;
    due_at: string | Date | null;
    assignee_user_id: string | null;
  },
  reassigned: boolean,
) {
  const sourceKey = `task:${task.id}`;
  if (
    reassigned ||
    task.status === "completed" ||
    !task.due_at ||
    !task.assignee_user_id
  )
    await cancelReminder(db, sourceKey);
  if (task.status !== "completed" && task.due_at && task.assignee_user_id)
    await scheduleReminder(db, {
      homeId: task.home_id,
      userId: task.assignee_user_id,
      sourceKey,
      title: "Recordatorio de tarea",
      message: `Recuerda completar "${task.title}" antes de su fecha límite.`,
      href: `/tareas/${task.id}`,
      dueAt: new Date(task.due_at),
    });
}

export async function tasksApi(request: Request, path: string[]) {
  const user = await requireUser();
  const taskId = path[1];
  if (!taskId) {
    const homeId = new URL(request.url).searchParams.get("homeId");
    if (!homeId) throw new ApiError(400, "Selecciona un apartamento.");
    const role = await requireHome(user.id, homeId);
    if (request.method === "GET") {
      // Abiertas y completadas en los últimos 30 días; las anteriores siguen disponibles por id.
      const tasks = await query<TaskRow>(
        `${taskColumns} WHERE t.home_id=$1 AND (t.status<>'completed' OR t.completed_at>now()-interval '30 days')
        ORDER BY t.due_at ASC NULLS LAST, t.created_at DESC`,
        [homeId],
      );
      return tasks.map((t) => ({ ...t, can_edit: canEdit(t, user.id, role) }));
    }
    if (request.method === "POST") {
      const data = taskSchema.parse(await request.json());
      assertFutureDue(data.due_at);
      return transaction(async (db) => {
        const assignee = await assigneeUserId(
          db,
          homeId,
          data.assigned_membership_id,
        );
        const { rows } = await db.query(
          `INSERT INTO tasks(home_id,title,description,assigned_membership_id,due_at,priority,created_by)
          VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id,home_id,title,status,due_at`,
          [
            homeId,
            data.title,
            data.description,
            data.assigned_membership_id,
            data.due_at,
            data.priority,
            user.id,
          ],
        );
        const task = { ...rows[0], assignee_user_id: assignee };
        await db.query(
          "INSERT INTO task_history(task_id,actor_id,new_status) VALUES($1,$2,'pending')",
          [task.id, user.id],
        );
        await activity(db, homeId, user.id, `creó la tarea "${task.title}"`);
        if (assignee && assignee !== user.id)
          await notify(db, {
            homeId,
            userId: assignee,
            title: "Nueva tarea asignada",
            message: `${user.name} te asignó "${task.title}".`,
            href: `/tareas/${task.id}`,
            sourceKey: `task:${task.id}:created:${assignee}`,
          });
        await syncReminder(db, task, false);
        return { id: task.id, message: "Tarea creada." };
      });
    }
    throw new ApiError(405, "Método no permitido.");
  }
  idSchema.parse(taskId);
  if (request.method === "GET") {
    const [task] = await query<TaskRow>(`${taskColumns} WHERE t.id=$1`, [
      taskId,
    ]);
    if (!task) throw new ApiError(404, "Tarea no encontrada.");
    const role = await requireHome(user.id, task.home_id);
    const history = await query(
      `SELECT h.id,h.previous_status,h.new_status,h.created_at,u.name AS actor FROM task_history h
      LEFT JOIN users u ON u.id=h.actor_id WHERE h.task_id=$1 ORDER BY h.created_at DESC`,
      [taskId],
    );
    return { ...task, can_edit: canEdit(task, user.id, role), history };
  }
  if (request.method === "PATCH") {
    const data = taskSchema
      .extend({ status })
      .partial()
      .parse(await request.json());
    return transaction(async (db) => {
      const { task, role } = await lockTask(db, user.id, taskId);
      const onlyAdvances =
        Object.keys(data).length === 1 &&
        data.status !== undefined &&
        canAdvance(task, data.status);
      if (!canEdit(task, user.id, role) && !onlyAdvances)
        throw new ApiError(
          403,
          "Solo quien creó la tarea o un administrador pueden modificarla.",
        );
      const next = { ...task, ...data };
      // Un responsable que ya no pertenece puede conservarse, pero no asignarse de nuevo.
      const reassigned =
        next.assigned_membership_id !== task.assigned_membership_id;
      if (reassigned)
        next.assignee_user_id = await assigneeUserId(
          db,
          task.home_id,
          next.assigned_membership_id,
        );
      const dueChanged = time(next.due_at) !== time(task.due_at);
      if (dueChanged) assertFutureDue(next.due_at);
      await db.query(
        `UPDATE tasks SET title=$1,description=$2,assigned_membership_id=$3,due_at=$4,priority=$5,status=$6,
        completed_at=CASE WHEN $6='completed' THEN COALESCE(completed_at,now()) END WHERE id=$7`,
        [
          next.title,
          next.description,
          next.assigned_membership_id,
          next.due_at,
          next.priority,
          next.status,
          task.id,
        ],
      );
      if (
        reassigned ||
        dueChanged ||
        ["title", "description", "priority"].some((k) => next[k] !== task[k])
      )
        await activity(
          db,
          task.home_id,
          user.id,
          `actualizó la tarea "${next.title}"`,
        );
      if (next.status !== task.status) {
        const { rows } = await db.query(
          "INSERT INTO task_history(task_id,actor_id,previous_status,new_status) VALUES($1,$2,$3,$4) RETURNING id",
          [task.id, user.id, task.status, next.status],
        );
        await activity(
          db,
          task.home_id,
          user.id,
          `${statusVerbs[next.status as TaskStatus]} la tarea "${next.title}"`,
        );
        if (next.status === "completed" && task.created_by !== user.id)
          await notify(db, {
            homeId: task.home_id,
            userId: task.created_by,
            title: "Tarea completada",
            message: `${user.name} completó "${next.title}".`,
            href: `/tareas/${task.id}`,
            sourceKey: `task:${task.id}:completed:${rows[0].id}:${task.created_by}`,
          });
      }
      if (
        reassigned &&
        next.assignee_user_id &&
        next.assignee_user_id !== user.id
      )
        await notify(db, {
          homeId: task.home_id,
          userId: next.assignee_user_id,
          title: "Nueva tarea asignada",
          message: `${user.name} te asignó "${next.title}".`,
          href: `/tareas/${task.id}`,
          sourceKey: `task:${task.id}:assigned:${randomUUID()}:${next.assignee_user_id}`,
        });
      await syncReminder(db, next, reassigned);
      return { message: "Tarea actualizada." };
    });
  }
  if (request.method === "DELETE") {
    return transaction(async (db) => {
      const { task, role } = await lockTask(db, user.id, taskId);
      if (!canEdit(task, user.id, role))
        throw new ApiError(
          403,
          "Solo quien creó la tarea o un administrador pueden eliminarla.",
        );
      await cancelReminder(db, `task:${task.id}`);
      // El historial se elimina en cascada; la actividad del hogar conserva el registro.
      await db.query("DELETE FROM tasks WHERE id=$1", [task.id]);
      await activity(
        db,
        task.home_id,
        user.id,
        `eliminó la tarea "${task.title}"`,
      );
      return { message: "Tarea eliminada." };
    });
  }
  throw new ApiError(405, "Método no permitido.");
}
