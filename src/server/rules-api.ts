import { z } from "zod";
import { query, transaction } from "./db";
import { ApiError, requireUser } from "./security";
import { activity, requireHome } from "./home-access";
import { notify } from "./notifications";
import { idSchema } from "./validation";
import type { RuleAcceptance, RuleVersion } from "@/types";

const ruleSchema = z.object({
  content: z
    .string()
    .trim()
    .min(10, "El reglamento debe tener al menos 10 caracteres.")
    .max(10000, "El reglamento admite hasta 10000 caracteres."),
  notes: z.string().trim().max(200, "El resumen admite hasta 200 caracteres."),
});

export async function rulesApi(request: Request, path: string[]) {
  const user = await requireUser();
  const versionId = path[1];
  if (!versionId) {
    const homeId = new URL(request.url).searchParams.get("homeId");
    if (!homeId) throw new ApiError(400, "Selecciona un apartamento.");
    if (request.method === "GET") {
      await requireHome(user.id, homeId);
      return listRules(homeId, user.id);
    }
    if (request.method === "POST") {
      await requireHome(user.id, homeId, true);
      const data = ruleSchema.parse(await request.json());
      return transaction(async (db) => {
        // Bloquear el hogar numera las versiones sin repetir aunque publiquen dos administradores a la vez.
        await db.query("SELECT id FROM homes WHERE id=$1 FOR UPDATE", [homeId]);
        await requireHome(user.id, homeId, true, db);
        const { rows } = await db.query(
          "SELECT version,content FROM rule_versions WHERE home_id=$1 ORDER BY version DESC LIMIT 1",
          [homeId],
        );
        if (rows[0]?.content === data.content)
          throw new ApiError(
            409,
            "El texto es igual al de la versión vigente.",
          );
        const version = (rows[0]?.version ?? 0) + 1;
        const created = await db.query(
          "INSERT INTO rule_versions(home_id,version,content,notes,created_by) VALUES($1,$2,$3,$4,$5) RETURNING id",
          [homeId, version, data.content, data.notes, user.id],
        );
        const id = created.rows[0].id;
        // Quien publica la versión la acepta al publicarla.
        await db.query(
          `INSERT INTO rule_acceptances(rule_version_id,membership_id)
          SELECT $1,id FROM memberships WHERE home_id=$2 AND user_id=$3 AND active`,
          [id, homeId, user.id],
        );
        await activity(
          db,
          homeId,
          user.id,
          `publicó la versión ${version} del reglamento`,
        );
        const members = await db.query(
          "SELECT user_id FROM memberships WHERE home_id=$1 AND active AND user_id<>$2",
          [homeId, user.id],
        );
        for (const { user_id } of members.rows)
          await notify(db, {
            homeId,
            userId: user_id,
            title: "Nuevo reglamento",
            message: `${user.name} publicó la versión ${version}. Léela y acéptala.`,
            href: "/reglamento",
            sourceKey: `rules:${id}:${user_id}`,
          });
        return { id, version, message: "Versión publicada." };
      });
    }
    throw new ApiError(405, "Método no permitido.");
  }
  idSchema.parse(versionId);
  if (request.method !== "POST" || path[2] !== "accept")
    throw new ApiError(404, "Operación no encontrada.");
  return transaction(async (db) => {
    const { rows } = await db.query(
      "SELECT id,home_id,version FROM rule_versions WHERE id=$1",
      [versionId],
    );
    const rule = rows[0];
    if (!rule) throw new ApiError(404, "Versión no encontrada.");
    await requireHome(user.id, rule.home_id, false, db);
    const latest = await db.query(
      "SELECT id FROM rule_versions WHERE home_id=$1 ORDER BY version DESC LIMIT 1",
      [rule.home_id],
    );
    if (latest.rows[0].id !== rule.id)
      throw new ApiError(
        409,
        "Hay una versión más reciente del reglamento; acepta esa.",
      );
    const accepted = await db.query(
      `INSERT INTO rule_acceptances(rule_version_id,membership_id)
      SELECT $1,id FROM memberships WHERE home_id=$2 AND user_id=$3 AND active
      ON CONFLICT DO NOTHING RETURNING accepted_at`,
      [rule.id, rule.home_id, user.id],
    );
    if (!accepted.rowCount)
      return { message: "Ya habías aceptado esta versión." };
    await activity(
      db,
      rule.home_id,
      user.id,
      `aceptó la versión ${rule.version} del reglamento`,
    );
    return { message: "Aceptaste el reglamento." };
  });
}

// La versión vigente es la más reciente; las aceptaciones listan a los integrantes activos.
async function listRules(homeId: string, userId: string) {
  const [current, ...history] = await query<RuleVersion>(
    `SELECT r.id,r.version,r.content,r.notes,r.created_at,u.name AS author FROM rule_versions r
    JOIN users u ON u.id=r.created_by WHERE r.home_id=$1 ORDER BY r.version DESC`,
    [homeId],
  );
  if (!current)
    return { current: null, accepted_by_me: false, acceptances: [], history };
  const acceptances = await query<RuleAcceptance>(
    `SELECT m.id AS membership_id,u.name,a.accepted_at,m.user_id FROM memberships m
    JOIN users u ON u.id=m.user_id
    LEFT JOIN rule_acceptances a ON a.membership_id=m.id AND a.rule_version_id=$2
    WHERE m.home_id=$1 AND m.active ORDER BY a.accepted_at IS NULL, u.name`,
    [homeId, current.id],
  );
  return {
    current,
    accepted_by_me: acceptances.some(
      (a) => a.user_id === userId && a.accepted_at,
    ),
    acceptances,
    history,
  };
}
