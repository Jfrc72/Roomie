import { z } from "zod";
import { query, transaction } from "./db";
import { ApiError, requireUser } from "./security";
import { activity, requireHome } from "./home-access";
import { cancelReminder, notify, scheduleReminder } from "./notifications";
import { idSchema, name } from "./validation";
import type { Reservation } from "@/types";

const resourceSchema = z.object({
  name,
  description: z
    .string()
    .trim()
    .max(300, "La descripción admite hasta 300 caracteres."),
});
const reservationSchema = z.object({
  resource_id: idSchema,
  starts_at: z.iso.datetime({
    offset: true,
    error: "Escribe una fecha de inicio válida.",
  }),
  ends_at: z.iso.datetime({
    offset: true,
    error: "Escribe una fecha de fin válida.",
  }),
});
const rangeSchema = z.object({
  from: z.iso.datetime({
    offset: true,
    error: "Escribe un rango de fechas válido.",
  }),
  to: z.iso.datetime({
    offset: true,
    error: "Escribe un rango de fechas válido.",
  }),
});
const maxDays = 7;
const reservationColumns = `SELECT r.id,r.resource_id,s.name AS resource,m.user_id,u.name AS member,
  m.active AS member_active,r.starts_at,r.ends_at
  FROM reservations r JOIN resources s ON s.id=r.resource_id
  JOIN memberships m ON m.id=r.membership_id JOIN users u ON u.id=m.user_id`;

function homeIdFrom(request: Request) {
  const homeId = new URL(request.url).searchParams.get("homeId");
  if (!homeId) throw new ApiError(400, "Selecciona un apartamento.");
  return homeId;
}

export async function resourcesApi(request: Request, path: string[]) {
  const user = await requireUser();
  const resourceId = path[1];
  if (!resourceId) {
    const homeId = homeIdFrom(request);
    if (request.method === "GET") {
      await requireHome(user.id, homeId);
      return query(
        "SELECT id,name,description FROM resources WHERE home_id=$1 AND active ORDER BY lower(name)",
        [homeId],
      );
    }
    if (request.method === "POST") {
      await requireHome(user.id, homeId, true);
      const data = resourceSchema.parse(await request.json());
      return transaction(async (db) => {
        const { rows } = await db.query(
          "INSERT INTO resources(home_id,name,description) VALUES($1,$2,$3) RETURNING id,name,description",
          [homeId, data.name, data.description],
        );
        await activity(db, homeId, user.id, `agregó el recurso "${data.name}"`);
        return rows[0];
      });
    }
    throw new ApiError(405, "Método no permitido.");
  }
  idSchema.parse(resourceId);
  const data =
    request.method === "PATCH"
      ? resourceSchema.parse(await request.json())
      : null;
  // Bloquear el recurso serializa su retiro con las reservas que se están creando.
  return transaction(async (db) => {
    const { rows } = await db.query(
      "SELECT * FROM resources WHERE id=$1 AND active FOR UPDATE",
      [resourceId],
    );
    const resource = rows[0];
    if (!resource) throw new ApiError(404, "Recurso no encontrado.");
    await requireHome(user.id, resource.home_id, true, db);
    if (data) {
      await db.query(
        "UPDATE resources SET name=$1,description=$2 WHERE id=$3",
        [data.name, data.description, resource.id],
      );
      await activity(
        db,
        resource.home_id,
        user.id,
        `actualizó el recurso "${data.name}"`,
      );
      return { message: "Recurso actualizado." };
    }
    if (request.method === "DELETE") {
      const pending = await db.query(
        "SELECT count(*)::int AS total FROM reservations WHERE resource_id=$1 AND status='active' AND ends_at>now()",
        [resource.id],
      );
      const total = pending.rows[0].total;
      if (total)
        throw new ApiError(
          409,
          `Este recurso tiene ${total === 1 ? "una reserva próxima" : `${total} reservas próximas`}. Cancélalas antes de retirarlo.`,
        );
      // Baja lógica: las reservas pasadas conservan su recurso.
      await db.query("UPDATE resources SET active=false WHERE id=$1", [
        resource.id,
      ]);
      await activity(
        db,
        resource.home_id,
        user.id,
        `retiró el recurso "${resource.name}"`,
      );
      return { message: "Recurso retirado." };
    }
    throw new ApiError(405, "Método no permitido.");
  });
}

export async function reservationsApi(request: Request, path: string[]) {
  const user = await requireUser();
  const reservationId = path[1];
  if (!reservationId) {
    const homeId = homeIdFrom(request);
    const role = await requireHome(user.id, homeId);
    if (request.method === "GET") {
      // Sin rango: activas que aún no terminan. Con from/to (calendario): activas que se
      // cruzan con ese intervalo, incluidas las ya pasadas.
      const params = new URL(request.url).searchParams;
      let period = "r.ends_at>now()";
      const values = [homeId];
      if (params.has("from") || params.has("to")) {
        const range = rangeSchema.parse({
          from: params.get("from"),
          to: params.get("to"),
        });
        const days =
          (new Date(range.to).getTime() - new Date(range.from).getTime()) /
          86400000;
        if (days <= 0 || days > 31)
          throw new ApiError(400, "El rango debe durar entre 1 y 31 días.");
        period = "r.ends_at>$2 AND r.starts_at<$3";
        values.push(range.from, range.to);
      }
      const rows = await query<Omit<Reservation, "can_cancel">>(
        `${reservationColumns} WHERE r.home_id=$1 AND r.status='active' AND ${period} ORDER BY r.starts_at`,
        values,
      );
      return rows.map((r) => ({
        ...r,
        can_cancel: role === "admin" || r.user_id === user.id,
      }));
    }
    if (request.method === "POST") {
      const data = reservationSchema.parse(await request.json());
      const start = new Date(data.starts_at);
      const end = new Date(data.ends_at);
      if (start.getTime() < Date.now() - 60000)
        throw new ApiError(400, "La reserva debe empezar en el futuro.");
      if (end <= start)
        throw new ApiError(
          400,
          "La hora de fin debe ser posterior a la de inicio.",
        );
      if (end.getTime() - start.getTime() > maxDays * 86400000)
        throw new ApiError(
          400,
          `Una reserva puede durar como máximo ${maxDays} días.`,
        );
      return transaction(async (db) => {
        // FOR UPDATE procesa de una en una las reservas del mismo recurso: sin él, dos inserciones
        // simultáneas que se cruzan se esperan entre sí en la restricción EXCLUDE y PostgreSQL
        // aborta una por deadlock (500). También impide retirar el recurso mientras se confirma.
        const resource = await db.query(
          "SELECT name FROM resources WHERE id=$1 AND home_id=$2 AND active FOR UPDATE",
          [data.resource_id, homeId],
        );
        if (!resource.rows[0])
          throw new ApiError(
            400,
            "Elige un recurso disponible del apartamento.",
          );
        const membership = await db.query(
          "SELECT id FROM memberships WHERE home_id=$1 AND user_id=$2 AND active FOR SHARE",
          [homeId, user.id],
        );
        if (!membership.rows[0])
          throw new ApiError(403, "No tienes acceso a este apartamento.");
        const resourceName: string = resource.rows[0].name;
        let id: string;
        try {
          const { rows } = await db.query(
            "INSERT INTO reservations(home_id,resource_id,membership_id,starts_at,ends_at) VALUES($1,$2,$3,$4,$5) RETURNING id",
            [homeId, data.resource_id, membership.rows[0].id, start, end],
          );
          id = rows[0].id;
        } catch (error) {
          // 23P01: la restricción EXCLUDE encontró un cruce con otra reserva activa.
          if ((error as { code?: string }).code === "23P01")
            throw new ApiError(
              409,
              `${resourceName} ya está reservado en ese horario. Elige otro.`,
            );
          throw error;
        }
        await activity(db, homeId, user.id, `reservó "${resourceName}"`);
        await scheduleReminder(db, {
          homeId,
          userId: user.id,
          sourceKey: `reservation:${id}`,
          title: "Recordatorio de reserva",
          message: `Recuerda tu reserva de "${resourceName}".`,
          href: "/reservas",
          dueAt: start,
        });
        return { id, message: "Reserva creada." };
      });
    }
    throw new ApiError(405, "Método no permitido.");
  }
  idSchema.parse(reservationId);
  // Cancelar es una baja lógica: el horario queda libre y el registro se conserva.
  if (request.method !== "DELETE")
    throw new ApiError(405, "Método no permitido.");
  return transaction(async (db) => {
    const { rows } = await db.query(
      `SELECT r.home_id,r.status,r.ends_at,m.user_id,s.name AS resource FROM reservations r
      JOIN memberships m ON m.id=r.membership_id JOIN resources s ON s.id=r.resource_id
      WHERE r.id=$1 FOR UPDATE OF r`,
      [reservationId],
    );
    const reservation = rows[0];
    if (!reservation) throw new ApiError(404, "Reserva no encontrada.");
    const role = await requireHome(user.id, reservation.home_id, false, db);
    if (role !== "admin" && reservation.user_id !== user.id)
      throw new ApiError(
        403,
        "Solo quien hizo la reserva o un administrador pueden cancelarla.",
      );
    if (reservation.status !== "active")
      throw new ApiError(409, "Esta reserva ya fue cancelada.");
    if (new Date(reservation.ends_at) <= new Date())
      throw new ApiError(409, "Esta reserva ya terminó.");
    await db.query(
      "UPDATE reservations SET status='cancelled',cancelled_at=now() WHERE id=$1",
      [reservationId],
    );
    await cancelReminder(db, `reservation:${reservationId}`);
    await activity(
      db,
      reservation.home_id,
      user.id,
      `canceló una reserva de "${reservation.resource}"`,
    );
    if (reservation.user_id !== user.id)
      await notify(db, {
        homeId: reservation.home_id,
        userId: reservation.user_id,
        title: "Reserva cancelada",
        message: `${user.name} canceló tu reserva de "${reservation.resource}".`,
        href: "/reservas",
        sourceKey: `reservation:${reservationId}:cancelled:${reservation.user_id}`,
      });
    return { message: "Reserva cancelada." };
  });
}
