import { z } from "zod";
import { query, transaction } from "./db";
import { ApiError, requireUser } from "./security";
import { activity, requireHome } from "./home-access";
import { notify } from "./notifications";
import { idSchema } from "./validation";
import type { RuleAcceptance, RuleReport, RuleVersion } from "@/types";

const reportSchema = z.object({
  clause: z
    .string()
    .trim()
    .min(1, "Elige el acuerdo incumplido.")
    .max(300, "El acuerdo admite hasta 300 caracteres."),
  description: z
    .string()
    .trim()
    .max(500, "La descripción admite hasta 500 caracteres."),
  reported_membership_id: idSchema.nullable(),
});
// Compara textos sin importar saltos de línea ni espacios repetidos.
const compact = (text: string) => text.replace(/\s+/g, " ").trim();
const excerpt = (text: string) =>
  text.length > 120 ? `${text.slice(0, 119)}…` : text;
type CurrentUser = Awaited<ReturnType<typeof requireUser>>;

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
  if (path[1] === "reports") return reportsApi(request, path, user);
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

// Cualquier integrante reporta un incumplimiento del reglamento vigente; avisa a los
// administradores y a la persona señalada. Solo un administrador lo marca como resuelto.
async function reportsApi(request: Request, path: string[], user: CurrentUser) {
  const reportId = path[2];
  if (!reportId) {
    if (request.method !== "POST")
      throw new ApiError(405, "Método no permitido.");
    const homeId = new URL(request.url).searchParams.get("homeId");
    if (!homeId) throw new ApiError(400, "Selecciona un apartamento.");
    await requireHome(user.id, homeId);
    const data = reportSchema.parse(await request.json());
    return transaction(async (db) => {
      const { rows } = await db.query(
        "SELECT id,content FROM rule_versions WHERE home_id=$1 ORDER BY version DESC LIMIT 1",
        [homeId],
      );
      const current = rows[0];
      if (!current)
        throw new ApiError(409, "Aún no hay un reglamento publicado.");
      // Se guarda el texto del acuerdo: sigue legible aunque se publique otra versión.
      const clause = compact(data.clause);
      if (!compact(current.content).includes(clause))
        throw new ApiError(400, "Elige un acuerdo del reglamento vigente.");
      let reported: { user_id: string; name: string } | null = null;
      if (data.reported_membership_id) {
        const found = await db.query(
          `SELECT m.user_id,u.name FROM memberships m JOIN users u ON u.id=m.user_id
          WHERE m.id=$1 AND m.home_id=$2 AND m.active FOR SHARE OF m`,
          [data.reported_membership_id, homeId],
        );
        if (!found.rows[0])
          throw new ApiError(
            400,
            "La persona señalada debe ser un integrante activo.",
          );
        if (found.rows[0].user_id === user.id)
          throw new ApiError(400, "No puedes reportarte a ti mismo.");
        reported = found.rows[0];
      }
      const created = await db.query(
        `INSERT INTO rule_reports(home_id,rule_version_id,clause,description,reported_by,reported_membership_id)
        VALUES($1,$2,$3,$4,$5,$6) RETURNING id`,
        [
          homeId,
          current.id,
          clause,
          data.description,
          user.id,
          data.reported_membership_id,
        ],
      );
      const id = created.rows[0].id;
      await activity(
        db,
        homeId,
        user.id,
        "reportó un incumplimiento del reglamento",
      );
      const admins = await db.query(
        "SELECT user_id FROM memberships WHERE home_id=$1 AND active AND role='admin'",
        [homeId],
      );
      const recipients = new Set<string>(admins.rows.map((r) => r.user_id));
      if (reported) recipients.add(reported.user_id);
      recipients.delete(user.id);
      for (const recipient of recipients)
        await notify(db, {
          homeId,
          userId: recipient,
          title: "Incumplimiento reportado",
          message:
            recipient === reported?.user_id
              ? `${user.name} reportó que no cumpliste: "${excerpt(clause)}"`
              : `${user.name} reportó un incumplimiento${reported ? ` de ${reported.name}` : ""}: "${excerpt(clause)}"`,
          href: "/reglamento",
          sourceKey: `rule-report:${id}:${recipient}`,
        });
      return { id, message: "Reporte enviado." };
    });
  }
  idSchema.parse(reportId);
  if (request.method !== "POST" || path[3] !== "resolve")
    throw new ApiError(404, "Operación no encontrada.");
  return transaction(async (db) => {
    const { rows } = await db.query(
      "SELECT id,home_id,clause,reported_by,resolved_at FROM rule_reports WHERE id=$1 FOR UPDATE",
      [reportId],
    );
    const report = rows[0];
    if (!report) throw new ApiError(404, "Reporte no encontrado.");
    await requireHome(user.id, report.home_id, true, db);
    if (report.resolved_at)
      throw new ApiError(409, "Este reporte ya está resuelto.");
    await db.query(
      "UPDATE rule_reports SET resolved_at=now(),resolved_by=$2 WHERE id=$1",
      [report.id, user.id],
    );
    await activity(
      db,
      report.home_id,
      user.id,
      "marcó como resuelto un incumplimiento del reglamento",
    );
    if (report.reported_by !== user.id)
      await notify(db, {
        homeId: report.home_id,
        userId: report.reported_by,
        title: "Incumplimiento resuelto",
        message: `${user.name} marcó como resuelto tu reporte: "${excerpt(report.clause)}"`,
        href: "/reglamento",
        sourceKey: `rule-report:${report.id}:resolved`,
      });
    return { message: "Reporte resuelto." };
  });
}

// La versión vigente es la más reciente; las aceptaciones listan a los integrantes activos.
async function listRules(homeId: string, userId: string) {
  const [versions, reports] = await Promise.all([
    query<RuleVersion>(
      `SELECT r.id,r.version,r.content,r.notes,r.created_at,u.name AS author FROM rule_versions r
      JOIN users u ON u.id=r.created_by WHERE r.home_id=$1 ORDER BY r.version DESC`,
      [homeId],
    ),
    // Pendientes primero; luego los más recientes.
    query<RuleReport>(
      `SELECT r.id,r.clause,r.description,r.created_at,r.resolved_at,u.name AS reporter,t.name AS reported
      FROM rule_reports r JOIN users u ON u.id=r.reported_by
      LEFT JOIN memberships m ON m.id=r.reported_membership_id LEFT JOIN users t ON t.id=m.user_id
      WHERE r.home_id=$1 ORDER BY r.resolved_at IS NOT NULL, r.created_at DESC LIMIT 30`,
      [homeId],
    ),
  ]);
  const [current, ...history] = versions;
  if (!current)
    return {
      current: null,
      accepted_by_me: false,
      acceptances: [],
      history,
      reports,
    };
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
    reports,
  };
}
