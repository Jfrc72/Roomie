import type { PoolClient } from "pg";
import { transaction } from "./db";
import { notify } from "./notifications";
import { pollWinners, resultText } from "@/lib/polls";
// Sin dependencias de la sesión: también lo usa el worker para el cierre automático.
// El llamador debe tener bloqueada la fila de la votación (FOR UPDATE).
export async function closePoll(
  db: PoolClient,
  poll: { id: string; home_id: string; title: string },
  actorId: string | null,
) {
  // Cuentan los votos de quienes siguen activos al cerrar; los de integrantes retirados se descartan.
  await db.query(
    "DELETE FROM votes v USING memberships m WHERE v.poll_id=$1 AND m.id=v.membership_id AND NOT m.active",
    [poll.id],
  );
  const members = await db.query(
    "SELECT user_id FROM memberships WHERE home_id=$1 AND active",
    [poll.home_id],
  );
  await db.query(
    "UPDATE polls SET status='closed',closed_at=now(),eligible_count=$2 WHERE id=$1",
    [poll.id, members.rowCount],
  );
  const { rows: options } = await db.query(
    `SELECT o.label,count(v.membership_id)::int AS votes FROM poll_options o
    LEFT JOIN votes v ON v.option_id=o.id WHERE o.poll_id=$1 GROUP BY o.id ORDER BY o.position`,
    [poll.id],
  );
  // Sin actor (cierre automático), Inicio muestra la actividad a nombre de Roomie.
  await db.query(
    "INSERT INTO activities(home_id,actor_id,message) VALUES($1,$2,$3)",
    [poll.home_id, actorId, `cerró la votación "${poll.title}"`],
  );
  const message = `"${poll.title}": ${resultText(pollWinners(options))}`;
  for (const { user_id } of members.rows)
    if (user_id !== actorId)
      await notify(db, {
        homeId: poll.home_id,
        userId: user_id,
        title: "Votación cerrada",
        message,
        href: "/votaciones",
        sourceKey: `poll:${poll.id}:closed:${user_id}`,
      });
}
// Cierra las votaciones cuya fecha ya pasó. Lo llaman el worker y la API antes de leer.
export async function closeExpiredPolls(homeId?: string) {
  await transaction(async (db) => {
    const { rows } = await db.query(
      `SELECT id,home_id,title FROM polls WHERE status='open' AND closes_at<=now()
      ${homeId ? "AND home_id=$1" : ""} FOR UPDATE SKIP LOCKED`,
      homeId ? [homeId] : [],
    );
    for (const poll of rows) await closePoll(db, poll, null);
  });
}
