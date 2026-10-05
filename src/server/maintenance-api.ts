import { z } from "zod";
import { query, transaction } from "./db";
import { ApiError, requireUser } from "./security";
import { activity, requireHome } from "./home-access";
import { idSchema } from "./validation";
import { hasCentPrecision, homeIdFrom, lockHome } from "./shared-modules";

const maintenanceStatus = z.enum(["PENDIENTE", "EN_PROGRESO", "RESUELTO"]);
const maintenancePriority = z.enum(["BAJA", "MEDIA", "ALTA", "URGENTE"]);
const reportSchema = z.object({
  title: z.string().trim().min(3).max(255),
  description: z.string().trim().max(2000),
  category: z.string().trim().min(1).max(50),
  estimated_cost: z.number().finite().min(0).max(9999999999.99)
    .refine(hasCentPrecision, "El costo admite máximo dos decimales.")
    .nullable(),
  priority: maintenancePriority,
  assigned_membership_id: idSchema.nullable(),
});
const reportPatchSchema = reportSchema.partial().extend({
  status: maintenanceStatus.optional(),
});

export async function maintenanceApi(request: Request, path: string[]) {
  const user = await requireUser();
  const reportId = path[1];
  if (!reportId) {
    const homeId = homeIdFrom(request);
    const role = await requireHome(user.id, homeId);
    if (request.method === "GET") {
      const params = new URL(request.url).searchParams;
      const status = params.get("status");
      const priority = params.get("priority");
      const category = params.get("category");
      if (status && !maintenanceStatus.safeParse(status).success)
        throw new ApiError(400, "Filtro de estado no válido.");
      if (priority && !maintenancePriority.safeParse(priority).success)
        throw new ApiError(400, "Filtro de prioridad no válido.");
      const [reports, counts] = await Promise.all([
        query(
          `SELECT r.id,r.title,r.description,r.category,r.estimated_cost,r.priority,r.status,
            r.reported_by,u.name AS reported_by_name,r.assigned_membership_id,assignee.name AS assigned_to,
            r.created_at,r.updated_at
           FROM maintenance_reports r JOIN users u ON u.id=r.reported_by
           LEFT JOIN memberships m ON m.id=r.assigned_membership_id
           LEFT JOIN users assignee ON assignee.id=m.user_id
           WHERE r.home_id=$1 AND r.deleted_at IS NULL AND ($2::text IS NULL OR r.status=$2)
             AND ($3::text IS NULL OR r.priority=$3) AND ($4::text IS NULL OR r.category=$4)
           ORDER BY CASE r.priority WHEN 'URGENTE' THEN 0 WHEN 'ALTA' THEN 1 WHEN 'MEDIA' THEN 2 ELSE 3 END,
             r.created_at DESC`,
          [homeId, status, priority, category],
        ),
        query(
          `SELECT count(*) FILTER (WHERE status='PENDIENTE')::int AS pending,
            count(*) FILTER (WHERE status='EN_PROGRESO')::int AS in_progress,
            count(*) FILTER (WHERE status='RESUELTO')::int AS resolved
           FROM maintenance_reports WHERE home_id=$1 AND deleted_at IS NULL`,
          [homeId],
        ),
      ]);
      return {
        reports: reports.map((report) => ({
          ...report,
          estimated_cost: report.estimated_cost === null ? null : Number(report.estimated_cost),
          can_edit: role === "admin" || report.reported_by === user.id,
        })),
        counts: counts[0],
      };
    }
    if (request.method === "POST") {
      const data = reportSchema.parse(await request.json());
      return transaction(async (db) => {
        await lockHome(db, homeId);
        if (data.assigned_membership_id) {
          const member = await db.query(
            "SELECT id FROM memberships WHERE id=$1 AND home_id=$2 AND active FOR SHARE",
            [data.assigned_membership_id, homeId],
          );
          if (!member.rowCount)
            throw new ApiError(400, "El responsable debe pertenecer al apartamento.");
        }
        const { rows } = await db.query(
          `INSERT INTO maintenance_reports(home_id,title,description,category,estimated_cost,priority,reported_by,assigned_membership_id)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
          [homeId, data.title, data.description, data.category, data.estimated_cost?.toFixed(2) ?? null,
            data.priority, user.id, data.assigned_membership_id],
        );
        await activity(db, homeId, user.id, `reportó "${data.title}" para mantenimiento`);
        return { id: rows[0].id, message: "Reporte creado." };
      });
    }
    throw new ApiError(405, "Método no permitido.");
  }

  idSchema.parse(reportId);
  if (request.method === "POST" && path[2] === "restore") {
    return transaction(async (db) => {
      const { rows } = await db.query("SELECT * FROM maintenance_reports WHERE id=$1 FOR UPDATE", [reportId]);
      const report = rows[0];
      if (!report || !report.deleted_at) throw new ApiError(404, "Reporte eliminado no encontrado.");
      const role = await requireHome(user.id, report.home_id, false, db);
      if (role !== "admin" && report.reported_by !== user.id)
        throw new ApiError(403, "Solo quien reportó o un administrador puede restaurar el reporte.");
      await db.query("UPDATE maintenance_reports SET deleted_at=NULL,updated_at=now() WHERE id=$1", [reportId]);
      await activity(db, report.home_id, user.id, `restauró el reporte "${report.title}"`);
      return { message: "Reporte restaurado." };
    });
  }
  if (request.method === "PATCH") {
    const data = reportPatchSchema.parse(await request.json());
    if (!Object.keys(data).length) throw new ApiError(400, "Indica qué deseas actualizar.");
    return transaction(async (db) => {
      const { rows } = await db.query("SELECT * FROM maintenance_reports WHERE id=$1 AND deleted_at IS NULL FOR UPDATE", [reportId]);
      const report = rows[0];
      if (!report) throw new ApiError(404, "Reporte no encontrado.");
      await lockHome(db, report.home_id);
      const role = await requireHome(user.id, report.home_id, false, db);
      const assignedUser = report.assigned_membership_id
        ? await db.query(
            "SELECT user_id FROM memberships WHERE id=$1 AND home_id=$2",
            [report.assigned_membership_id, report.home_id],
          )
        : { rows: [] };
      const mayManage = role === "admin" || report.reported_by === user.id ||
        assignedUser.rows[0]?.user_id === user.id;
      if (!mayManage)
        throw new ApiError(403, "Solo quien reportó, el responsable o un administrador puede actualizar el reporte.");
      if (data.assigned_membership_id) {
        const member = await db.query(
          "SELECT id FROM memberships WHERE id=$1 AND home_id=$2 AND active FOR SHARE",
          [data.assigned_membership_id, report.home_id],
        );
        if (!member.rowCount)
          throw new ApiError(400, "El responsable debe pertenecer al apartamento.");
      }
      await db.query(
        `UPDATE maintenance_reports SET title=$1,description=$2,category=$3,estimated_cost=$4,
          priority=$5,status=$6,assigned_membership_id=$7,updated_at=now() WHERE id=$8`,
        [
          data.title ?? report.title,
          data.description ?? report.description,
          data.category ?? report.category,
          data.estimated_cost === undefined ? report.estimated_cost : data.estimated_cost?.toFixed(2) ?? null,
          data.priority ?? report.priority,
          data.status ?? report.status,
          data.assigned_membership_id === undefined ? report.assigned_membership_id : data.assigned_membership_id,
          reportId,
        ],
      );
      await activity(db, report.home_id, user.id, `actualizó el reporte "${data.title ?? report.title}"`);
      return { message: "Reporte actualizado." };
    });
  }
  if (request.method === "DELETE") {
    return transaction(async (db) => {
      const { rows } = await db.query("SELECT * FROM maintenance_reports WHERE id=$1 AND deleted_at IS NULL FOR UPDATE", [reportId]);
      const report = rows[0];
      if (!report) throw new ApiError(404, "Reporte no encontrado.");
      const role = await requireHome(user.id, report.home_id, false, db);
      if (role !== "admin" && report.reported_by !== user.id)
        throw new ApiError(403, "Solo quien reportó o un administrador puede eliminar el reporte.");
      await lockHome(db, report.home_id);
      await db.query("UPDATE maintenance_reports SET deleted_at=now(),updated_at=now() WHERE id=$1", [reportId]);
      await activity(db, report.home_id, user.id, `eliminó el reporte "${report.title}"`);
      return { message: "Reporte eliminado." };
    });
  }
  throw new ApiError(405, "Método no permitido.");
}
