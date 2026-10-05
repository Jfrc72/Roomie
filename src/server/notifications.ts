import { isInternalPath } from "@/lib/paths";
import type { PoolClient } from "pg";
export interface NotificationInput {
  homeId: string;
  userId: string;
  title: string;
  message: string;
  href: string;
  sourceKey?: string;
}
export async function notify(db: PoolClient, data: NotificationInput) {
  if (!isInternalPath(data.href))
    throw new Error("La notificación debe apuntar a una ruta interna.");
  const member = await db.query(
    "SELECT m.id FROM memberships m JOIN homes h ON h.id=m.home_id JOIN users u ON u.id=m.user_id WHERE m.home_id=$1 AND m.user_id=$2 AND m.active AND u.active AND h.archived_at IS NULL",
    [data.homeId, data.userId],
  );
  if (!member.rowCount) return;
  const { rows } = await db.query(
    `INSERT INTO notifications(home_id,user_id,title,message,href,source_key)
    VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(source_key) DO NOTHING RETURNING id`,
    [
      data.homeId,
      data.userId,
      data.title,
      data.message,
      data.href,
      data.sourceKey || null,
    ],
  );
  if (!rows[0]) return;
  const prefs = await db.query(
    "SELECT * FROM notification_preferences WHERE user_id=$1",
    [data.userId],
  );
  for (const channel of ["email", "push"]) {
    if (prefs.rows[0]?.[`${channel}_enabled`])
      await db.query(
        "INSERT INTO deliveries(notification_id,channel) VALUES($1,$2)",
        [rows[0].id, channel],
      );
  }
}
// Llamar dentro de la misma transacción que crea/actualiza la tarea, reserva o pago.
export async function scheduleReminder(
  db: PoolClient,
  data: NotificationInput & { sourceKey: string; dueAt: Date },
) {
  if (!isInternalPath(data.href))
    throw new Error("El recordatorio debe apuntar a una ruta interna.");
  await db.query(
    `INSERT INTO reminders(home_id,user_id,source_key,title,message,href,due_at) VALUES($1,$2,$3,$4,$5,$6,$7)
    ON CONFLICT(source_key) DO UPDATE SET user_id=excluded.user_id,title=excluded.title,message=excluded.message,href=excluded.href,due_at=excluded.due_at,processed_at=null`,
    [
      data.homeId,
      data.userId,
      data.sourceKey,
      data.title,
      data.message,
      data.href,
      data.dueAt,
    ],
  );
}
export async function cancelReminder(db: PoolClient, sourceKey: string) {
  await db.query("DELETE FROM reminders WHERE source_key=$1", [sourceKey]);
}
