import { z } from "zod";
import { query, transaction } from "./db";
import { ApiError, requireUser } from "./security";
import { activity, requireHome } from "./home-access";
import { notify } from "./notifications";
import { closeExpiredPolls, closePoll } from "./polls";
import { idSchema } from "./validation";

const pollSchema = z.object({
  title: z
    .string()
    .trim()
    .min(2, "La pregunta debe tener al menos 2 caracteres.")
    .max(120, "La pregunta admite hasta 120 caracteres."),
  description: z
    .string()
    .trim()
    .max(500, "Los detalles admiten hasta 500 caracteres."),
  anonymous: z.boolean(),
  closes_at: z.iso
    .datetime({ offset: true, error: "Escribe una fecha de cierre válida." })
    .nullable(),
  options: z
    .array(
      z
        .string()
        .trim()
        .min(1, "Las opciones no pueden estar vacías.")
        .max(80, "Cada opción admite hasta 80 caracteres."),
    )
    .min(2, "Agrega al menos 2 opciones.")
    .max(10, "Una votación admite hasta 10 opciones.")
    .refine(
      (options) =>
        new Set(options.map((o) => o.toLowerCase())).size === options.length,
      "Las opciones no pueden repetirse.",
    ),
});

export async function pollsApi(request: Request, path: string[]) {
  const user = await requireUser();
  const pollId = path[1];
  if (!pollId) {
    const homeId = new URL(request.url).searchParams.get("homeId");
    if (!homeId) throw new ApiError(400, "Selecciona un apartamento.");
    const role = await requireHome(user.id, homeId);
    if (request.method === "GET") {
      await closeExpiredPolls(homeId);
      return listPolls(homeId, user.id, role);
    }
    if (request.method === "POST") {
      const data = pollSchema.parse(await request.json());
      if (data.closes_at && new Date(data.closes_at).getTime() <= Date.now())
        throw new ApiError(400, "La fecha de cierre debe estar en el futuro.");
      return transaction(async (db) => {
        const { rows } = await db.query(
          "INSERT INTO polls(home_id,title,description,anonymous,closes_at,created_by) VALUES($1,$2,$3,$4,$5,$6) RETURNING id",
          [
            homeId,
            data.title,
            data.description,
            data.anonymous,
            data.closes_at,
            user.id,
          ],
        );
        const id = rows[0].id;
        await db.query(
          `INSERT INTO poll_options(poll_id,label,position)
          SELECT $1,label,ord FROM unnest($2::text[]) WITH ORDINALITY AS o(label,ord)`,
          [id, data.options],
        );
        await activity(
          db,
          homeId,
          user.id,
          `abrió la votación "${data.title}"`,
        );
        const members = await db.query(
          "SELECT user_id FROM memberships WHERE home_id=$1 AND active AND user_id<>$2",
          [homeId, user.id],
        );
        for (const { user_id } of members.rows)
          await notify(db, {
            homeId,
            userId: user_id,
            title: "Nueva votación",
            message: `${user.name} abrió "${data.title}".`,
            href: "/votaciones",
            sourceKey: `poll:${id}:created:${user_id}`,
          });
        return { id, message: "Votación abierta." };
      });
    }
    throw new ApiError(405, "Método no permitido.");
  }
  idSchema.parse(pollId);
  const action = path[2];
  if (request.method !== "POST" || !["votes", "close"].includes(action))
    throw new ApiError(404, "Operación no encontrada.");
  const data =
    action === "votes"
      ? z.object({ option_id: idSchema }).parse(await request.json())
      : null;
  return transaction(async (db) => {
    // Votar comparte la fila y cerrar la bloquea: ningún voto entra después del recuento.
    const { rows } = await db.query(
      `SELECT id,home_id,title,status,closes_at,created_by FROM polls WHERE id=$1 ${data ? "FOR SHARE" : "FOR UPDATE"}`,
      [pollId],
    );
    const poll = rows[0];
    if (!poll) throw new ApiError(404, "Votación no encontrada.");
    const role = await requireHome(user.id, poll.home_id, false, db);
    if (
      poll.status !== "open" ||
      (data && poll.closes_at && new Date(poll.closes_at) <= new Date())
    )
      throw new ApiError(409, "Esta votación ya está cerrada.");
    if (data) {
      const membership = await db.query(
        "SELECT id FROM memberships WHERE home_id=$1 AND user_id=$2 AND active FOR SHARE",
        [poll.home_id, user.id],
      );
      if (!membership.rowCount)
        throw new ApiError(403, "No tienes acceso a este apartamento.");
      const option = await db.query(
        "SELECT id FROM poll_options WHERE id=$1 AND poll_id=$2",
        [data.option_id, poll.id],
      );
      if (!option.rowCount)
        throw new ApiError(400, "Elige una opción de esta votación.");
      // Mientras siga abierta, se puede cambiar el voto.
      await db.query(
        `INSERT INTO votes(poll_id,option_id,membership_id) VALUES($1,$2,$3)
        ON CONFLICT(poll_id,membership_id) DO UPDATE SET option_id=excluded.option_id,voted_at=now()`,
        [poll.id, data.option_id, membership.rows[0].id],
      );
      return { message: "Voto guardado." };
    }
    if (role !== "admin" && poll.created_by !== user.id)
      throw new ApiError(
        403,
        "Solo quien creó la votación o un administrador pueden cerrarla.",
      );
    await closePoll(db, poll, user.id);
    return { message: "Votación cerrada." };
  });
}

// Mientras está abierta no se envían recuentos; en las anónimas nunca se envía quién votó qué.
async function listPolls(
  homeId: string,
  userId: string,
  role: "admin" | "member",
) {
  const polls = await query(
    `SELECT p.id,p.title,p.description,p.anonymous,p.closes_at,p.status,p.created_by,c.name AS creator,
    p.created_at,p.closed_at,p.eligible_count,
    (SELECT v.option_id FROM votes v JOIN memberships m ON m.id=v.membership_id
      WHERE v.poll_id=p.id AND m.user_id=$2) AS my_option_id,
    (SELECT count(*)::int FROM votes v JOIN memberships m ON m.id=v.membership_id
      WHERE v.poll_id=p.id AND (m.active OR p.status='closed')) AS voters
    FROM polls p JOIN users c ON c.id=p.created_by WHERE p.home_id=$1
    ORDER BY p.status='closed', COALESCE(p.closed_at,p.created_at) DESC`,
    [homeId, userId],
  );
  const ids = polls.map((p) => p.id);
  const [options, names, [active]] = await Promise.all([
    query(
      `SELECT o.id,o.poll_id,o.label,count(v.membership_id)::int AS votes FROM poll_options o
      LEFT JOIN votes v ON v.option_id=o.id WHERE o.poll_id=ANY($1) GROUP BY o.id ORDER BY o.position`,
      [ids],
    ),
    query(
      `SELECT v.option_id,u.name FROM votes v JOIN polls p ON p.id=v.poll_id
      JOIN memberships m ON m.id=v.membership_id JOIN users u ON u.id=m.user_id
      WHERE v.poll_id=ANY($1) AND p.status='closed' AND NOT p.anonymous ORDER BY u.name`,
      [ids],
    ),
    query(
      "SELECT count(*)::int AS total FROM memberships WHERE home_id=$1 AND active",
      [homeId],
    ),
  ]);
  return polls.map(({ created_by, eligible_count, ...poll }) => {
    const closed = poll.status === "closed";
    return {
      ...poll,
      eligible: closed ? eligible_count : active.total,
      can_close: !closed && (role === "admin" || created_by === userId),
      options: options
        .filter((o) => o.poll_id === poll.id)
        .map((o) => ({
          id: o.id,
          label: o.label,
          votes: closed ? o.votes : null,
          voters:
            closed && !poll.anonymous
              ? names.filter((n) => n.option_id === o.id).map((n) => n.name)
              : null,
        })),
    };
  });
}
