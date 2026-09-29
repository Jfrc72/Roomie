import { setTimeout as sleep } from "node:timers/promises";
import nodemailer from "nodemailer";
import webpush from "web-push";
import { pool, transaction } from "../src/server/db";
import { notify } from "../src/server/notifications";
const pushReady = Boolean(
  process.env.VAPID_PRIVATE_KEY &&
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
  process.env.VAPID_SUBJECT,
);
if (pushReady)
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
const mail = process.env.SMTP_HOST
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
        : undefined,
      connectionTimeout: 10000,
      socketTimeout: 10000,
    })
  : null;
export async function tick() {
  await transaction(async (db) => {
    const { rows } =
      await db.query(`SELECT r.* FROM reminders r JOIN notification_preferences p ON p.user_id=r.user_id
   WHERE r.processed_at IS NULL AND r.due_at-make_interval(hours=>p.reminder_hours)<=now() FOR UPDATE OF r SKIP LOCKED`);
    for (const row of rows) {
      await notify(db, {
        homeId: row.home_id,
        userId: row.user_id,
        title: row.title,
        message: row.message,
        href: row.href,
        sourceKey: `reminder:${row.id}:${new Date(row.due_at).toISOString()}`,
      });
      await db.query("UPDATE reminders SET processed_at=now() WHERE id=$1", [
        row.id,
      ]);
    }
  });
  await transaction(async (db) => {
    const { rows } =
      await db.query(`SELECT d.id,d.channel,d.attempts,n.title,n.message,n.href,n.home_id,n.user_id,u.email,p.email_enabled,p.push_enabled
    FROM deliveries d JOIN notifications n ON n.id=d.notification_id JOIN users u ON u.id=n.user_id
    JOIN notification_preferences p ON p.user_id=u.id WHERE d.sent_at IS NULL AND d.attempts<5 AND d.next_attempt_at<=now()
    ORDER BY d.next_attempt_at LIMIT 10 FOR UPDATE OF d SKIP LOCKED`);
    for (const row of rows) {
      const membership = await db.query(
        "SELECT id FROM memberships WHERE user_id=$1 AND home_id=$2 AND active",
        [row.user_id, row.home_id],
      );
      if (
        !membership.rowCount ||
        !(row.channel === "email" ? row.email_enabled : row.push_enabled)
      ) {
        await db.query("DELETE FROM deliveries WHERE id=$1", [row.id]);
        continue;
      }
      try {
        if (row.channel === "email") {
          if (!mail) throw Error("SMTP no configurado");
          await mail.sendMail({
            from: process.env.SMTP_FROM,
            to: row.email,
            subject: `Roomie: ${row.title}`,
            text: `${row.message}\n\n${process.env.APP_URL}${row.href}`,
          });
        } else {
          if (!pushReady) throw Error("VAPID no configurado");
          const subs = await db.query(
            "SELECT * FROM push_subscriptions WHERE user_id=$1",
            [row.user_id],
          );
          if (!subs.rowCount) throw Error("Sin dispositivos push registrados");
          for (const sub of subs.rows) {
            try {
              await webpush.sendNotification(
                {
                  endpoint: sub.endpoint,
                  keys: { p256dh: sub.p256dh, auth: sub.auth },
                },
                JSON.stringify({
                  title: row.title,
                  message: row.message,
                  href: row.href,
                }),
                { timeout: 10000 },
              );
            } catch (e) {
              if ([404, 410].includes((e as { statusCode: number }).statusCode))
                await db.query("DELETE FROM push_subscriptions WHERE id=$1", [
                  sub.id,
                ]);
              else throw e;
            }
          }
        }
        await db.query(
          "UPDATE deliveries SET sent_at=now(),last_error=null WHERE id=$1",
          [row.id],
        );
      } catch (e) {
        await db.query(
          "UPDATE deliveries SET attempts=attempts+1,last_error=$1,next_attempt_at=now()+interval '5 minutes' WHERE id=$2",
          [(e as Error).message.slice(0, 300), row.id],
        );
      }
    }
  });
}
let stopping = false;
const shutdown = new AbortController();
async function loop() {
  while (!stopping) {
    try {
      await tick();
    } catch (e) {
      console.error("Recordatorios:", (e as Error).message);
    }
    await sleep(15000, undefined, { signal: shutdown.signal }).catch(() => {});
  }
  await pool.end();
}
process.on("SIGTERM", () => {
  stopping = true;
  shutdown.abort();
});
process.on("SIGINT", () => {
  stopping = true;
  shutdown.abort();
});
if (!process.env.WORKER_TEST) loop();
