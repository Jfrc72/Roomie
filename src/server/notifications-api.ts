import { z } from "zod";
import { query } from "./db";
import { ApiError, requireUser } from "./security";
import { requireHome } from "./home-access";
import { idSchema } from "./validation";
export async function notificationsApi(request: Request, path: string[]) {
  const user = await requireUser();
  if (path[1] === "preferences") {
    if (request.method === "GET") {
      const [prefs] = await query(
        "SELECT email_enabled,push_enabled,reminder_hours FROM notification_preferences WHERE user_id=$1",
        [user.id],
      );
      return {
        ...prefs,
        emailAvailable: Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM),
        pushAvailable: Boolean(
          process.env.VAPID_PRIVATE_KEY &&
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
          process.env.VAPID_SUBJECT,
        ),
      };
    }
    if (request.method === "PATCH") {
      const data = z
        .object({
          email_enabled: z.boolean(),
          push_enabled: z.boolean(),
          reminder_hours: z.number().int().min(0).max(168),
        })
        .parse(await request.json());
      if (
        data.email_enabled &&
        !(process.env.SMTP_HOST && process.env.SMTP_FROM)
      )
        throw new ApiError(
          400,
          "El correo aún no está configurado en el servidor.",
        );
      if (
        data.push_enabled &&
        !(
          process.env.VAPID_PRIVATE_KEY &&
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
          process.env.VAPID_SUBJECT
        )
      )
        throw new ApiError(
          400,
          "Las notificaciones push aún no están configuradas.",
        );
      await query(
        `INSERT INTO notification_preferences(user_id,email_enabled,push_enabled,reminder_hours) VALUES($1,$2,$3,$4)
       ON CONFLICT(user_id) DO UPDATE SET email_enabled=$2,push_enabled=$3,reminder_hours=$4`,
        [user.id, data.email_enabled, data.push_enabled, data.reminder_hours],
      );
      return { message: "Preferencias guardadas." };
    }
  }
  if (path[1] === "subscriptions" && request.method === "POST") {
    const data = z
      .object({
        endpoint: z.string().url().max(2000),
        keys: z.object({
          p256dh: z.string().max(300),
          auth: z.string().max(100),
        }),
      })
      .parse(await request.json());
    const host = new URL(data.endpoint).hostname;
    if (
      new URL(data.endpoint).protocol !== "https:" ||
      ![
        "fcm.googleapis.com",
        "updates.push.services.mozilla.com",
        "web.push.apple.com",
      ].some((h) => host === h || host.endsWith(`.${h}`))
    )
      throw new ApiError(400, "Proveedor push no admitido.");
    await query(
      `INSERT INTO push_subscriptions(user_id,endpoint,p256dh,auth) VALUES($1,$2,$3,$4)
      ON CONFLICT(endpoint) DO UPDATE SET user_id=$1,p256dh=$3,auth=$4`,
      [user.id, data.endpoint, data.keys.p256dh, data.keys.auth],
    );
    return { message: "Dispositivo registrado." };
  }
  if (request.method === "GET") {
    const homeId = new URL(request.url).searchParams.get("homeId");
    if (!homeId) return [];
    await requireHome(user.id, homeId);
    return query(
      "SELECT id,title,message,href,read_at,created_at FROM notifications WHERE user_id=$1 AND home_id=$2 AND dismissed_at IS NULL ORDER BY created_at DESC LIMIT 100",
      [user.id, homeId],
    );
  }
  if (["PATCH", "DELETE"].includes(request.method)) {
    idSchema.parse(path[1]);
    const [notice] = await query(
      "SELECT home_id FROM notifications WHERE id=$1 AND user_id=$2 AND dismissed_at IS NULL",
      [path[1], user.id],
    );
    if (!notice) throw new ApiError(404, "Notificación no encontrada.");
    await requireHome(user.id, notice.home_id);
    if (request.method === "DELETE") {
      await query(
        "UPDATE notifications SET dismissed_at=now() WHERE id=$1 AND user_id=$2",
        [path[1], user.id],
      );
      await query("DELETE FROM deliveries WHERE notification_id=$1", [path[1]]);
      return { message: "Notificación eliminada." };
    }
    const data = z.object({ read: z.boolean() }).parse(await request.json());
    await query(
      "UPDATE notifications SET read_at=CASE WHEN $1 THEN now() ELSE null END WHERE id=$2 AND user_id=$3",
      [data.read, path[1], user.id],
    );
    return { message: "Notificación actualizada." };
  }
  throw new ApiError(404, "Operación no encontrada.");
}
