import { z } from "zod";
import { query, transaction } from "./db";
import { ApiError, hashToken, requireUser, token } from "./security";
import { activity, requireHome } from "./home-access";
import { email, homeSchema, idSchema } from "./validation";
import { getDashboardSummary } from "./dashboard";
import { notify } from "./notifications";

export async function homesApi(request: Request, path: string[]) {
  const user = await requireUser();
  const homeId = path[1];
  const action = path[2];
  if (!homeId && request.method === "POST") {
    const data = homeSchema.parse(await request.json());
    return transaction(async (db) => {
      const { rows } = await db.query(
        "INSERT INTO homes(name,address,description) VALUES($1,$2,$3) RETURNING *",
        [data.name, data.address, data.description],
      );
      const home = rows[0];
      await db.query(
        "INSERT INTO memberships(home_id,user_id,role) VALUES($1,$2,'admin')",
        [home.id, user.id],
      );
      await db.query(
        "UPDATE sessions SET active_home_id=$1 WHERE token_hash=$2",
        [home.id, user.sessionHash],
      );
      await activity(db, home.id, user.id, "creó el apartamento");
      return home;
    });
  }
  await requireHome(user.id, homeId);
  if (request.method === "POST" && action === "select") {
    await query("UPDATE sessions SET active_home_id=$1 WHERE token_hash=$2", [
      homeId,
      user.sessionHash,
    ]);
    return { message: "Apartamento seleccionado." };
  }
  if (request.method === "GET" && !action) {
    const [home] = await query("SELECT * FROM homes WHERE id=$1", [homeId]);
    const members = await query(
      `SELECT u.id,u.name,u.email,m.id AS membership_id,m.role FROM memberships m
      JOIN users u ON u.id=m.user_id WHERE m.home_id=$1 AND m.active ORDER BY m.joined_at`,
      [homeId],
    );
    return { ...home, members };
  }
  if (request.method === "GET" && action === "dashboard") {
    const activities = await query(
      `SELECT a.id,a.message,a.created_at,u.name AS actor FROM activities a
      LEFT JOIN users u ON u.id=a.actor_id WHERE home_id=$1 ORDER BY created_at DESC LIMIT 12`,
      [homeId],
    );
    return { summary: await getDashboardSummary(homeId, user.id), activities };
  }
  if (request.method === "GET" && action === "invitations") {
    await requireHome(user.id, homeId, true);
    return query(
      "SELECT id,email,status,expires_at FROM invitations WHERE home_id=$1 ORDER BY created_at DESC LIMIT 30",
      [homeId],
    );
  }
  // Bloquear la fila del hogar serializa las altas, bajas y cambios de rol.
  return transaction(async (db) => {
    await db.query("SELECT id FROM homes WHERE id=$1 FOR UPDATE", [homeId]);
    await requireHome(user.id, homeId, true, db);
    if (request.method === "PATCH" && !action) {
      const data = homeSchema.parse(await request.json());
      await db.query(
        "UPDATE homes SET name=$1,address=$2,description=$3 WHERE id=$4",
        [data.name, data.address, data.description, homeId],
      );
      await activity(
        db,
        homeId,
        user.id,
        "actualizó los datos del apartamento",
      );
      return { message: "Apartamento actualizado." };
    }
    if (request.method === "POST" && action === "invitations") {
      const data = z.object({ email }).parse(await request.json());
      const count = await db.query(
        "SELECT count(*)::int AS total FROM memberships WHERE home_id=$1 AND active",
        [homeId],
      );
      if (count.rows[0].total >= 8)
        throw new ApiError(409, "El apartamento ya tiene 8 integrantes.");
      const existing = await db.query(
        `SELECT m.id FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.home_id=$1 AND m.active AND u.email=$2`,
        [homeId, data.email],
      );
      if (existing.rowCount)
        throw new ApiError(409, "Esta persona ya pertenece al apartamento.");
      await db.query(
        "UPDATE invitations SET status='revoked' WHERE home_id=$1 AND email=$2 AND status='pending'",
        [homeId, data.email],
      );
      const value = token();
      await db.query(
        `INSERT INTO invitations(home_id,email,token_hash,created_by,expires_at) VALUES($1,$2,$3,$4,now()+interval '7 days')`,
        [homeId, data.email, hashToken(value), user.id],
      );
      await activity(db, homeId, user.id, "creó una invitación");
      return {
        url: `${process.env.APP_URL || "http://localhost:3000"}/invitaciones?token=${value}`,
        message:
          "Invitación creada. Comparte el enlace con la persona invitada.",
      };
    }
    if (request.method === "DELETE" && action === "invitations") {
      idSchema.parse(path[3]);
      const result = await db.query(
        "UPDATE invitations SET status='revoked' WHERE id=$1 AND home_id=$2 AND status='pending' RETURNING id",
        [path[3], homeId],
      );
      if (!result.rowCount)
        throw new ApiError(404, "Invitación no encontrada.");
      return { message: "Invitación cancelada." };
    }
    if (action === "members" && ["DELETE", "PATCH"].includes(request.method)) {
      idSchema.parse(path[3]);
      const { rows } = await db.query(
        "SELECT * FROM memberships WHERE id=$1 AND home_id=$2 AND active",
        [path[3], homeId],
      );
      const member = rows[0];
      if (!member) throw new ApiError(404, "Integrante no encontrado.");
      const newRole =
        request.method === "PATCH"
          ? z
              .object({ role: z.enum(["admin", "member"]) })
              .parse(await request.json()).role
          : null;
      if (member.role === "admin" && newRole !== "admin") {
        const admins = await db.query(
          "SELECT count(*)::int AS total FROM memberships WHERE home_id=$1 AND active AND role='admin'",
          [homeId],
        );
        if (admins.rows[0].total <= 1)
          throw new ApiError(
            409,
            "Debe quedar al menos un administrador. Asigna otro primero.",
          );
      }
      if (request.method === "DELETE") {
        // Baja lógica: el historial de gastos y tareas puede seguir referenciando al integrante.
        await db.query("UPDATE memberships SET active=false WHERE id=$1", [
          member.id,
        ]);
        await db.query(
          "UPDATE sessions SET active_home_id=null WHERE user_id=$1 AND active_home_id=$2",
          [member.user_id, homeId],
        );
        await activity(
          db,
          homeId,
          user.id,
          "retiró a un integrante del apartamento",
        );
      } else {
        await db.query("UPDATE memberships SET role=$1 WHERE id=$2", [
          newRole,
          member.id,
        ]);
        await activity(
          db,
          homeId,
          user.id,
          "actualizó el rol de un integrante",
        );
        await notify(db, {
          homeId,
          userId: member.user_id,
          title: "Tu rol cambió",
          message: `Tu nuevo rol es ${newRole === "admin" ? "administrador" : "integrante"}.`,
          href: "/apartamento",
        });
      }
      return { message: "Integrantes actualizados." };
    }
    throw new ApiError(404, "Operación no encontrada.");
  });
}

export async function acceptInvitation(request: Request) {
  const user = await requireUser();
  const data = z
    .object({ token: z.string().regex(/^[a-f0-9]{64}$/) })
    .parse(await request.json());
  return transaction(async (db) => {
    const result = await db.query(
      "SELECT * FROM invitations WHERE token_hash=$1",
      [hashToken(data.token)],
    );
    const invite = result.rows[0];
    if (!invite) throw new ApiError(404, "Invitación no encontrada.");
    await db.query("SELECT id FROM homes WHERE id=$1 FOR UPDATE", [
      invite.home_id,
    ]);
    const fresh = await db.query(
      "SELECT status,expires_at FROM invitations WHERE id=$1 FOR UPDATE",
      [invite.id],
    );
    if (
      fresh.rows[0].status !== "pending" ||
      new Date(fresh.rows[0].expires_at) < new Date()
    )
      throw new ApiError(409, "Esta invitación venció o ya fue utilizada.");
    if (invite.email !== user.email)
      throw new ApiError(
        403,
        "Inicia sesión con el correo al que fue enviada la invitación.",
      );
    const existing = await db.query(
      "SELECT active FROM memberships WHERE home_id=$1 AND user_id=$2",
      [invite.home_id, user.id],
    );
    if (existing.rows[0]?.active)
      throw new ApiError(409, "Ya perteneces a este apartamento.");
    const count = await db.query(
      "SELECT count(*)::int AS total FROM memberships WHERE home_id=$1 AND active",
      [invite.home_id],
    );
    if (count.rows[0].total >= 8)
      throw new ApiError(
        409,
        "El apartamento llegó al límite de 8 integrantes.",
      );
    await db.query(
      `INSERT INTO memberships(home_id,user_id,role) VALUES($1,$2,'member') ON CONFLICT(home_id,user_id) DO UPDATE SET active=true,role='member'`,
      [invite.home_id, user.id],
    );
    await db.query("UPDATE invitations SET status='accepted' WHERE id=$1", [
      invite.id,
    ]);
    await db.query(
      "UPDATE sessions SET active_home_id=$1 WHERE token_hash=$2",
      [invite.home_id, user.sessionHash],
    );
    await activity(db, invite.home_id, user.id, "se unió al apartamento");
    await notify(db, {
      homeId: invite.home_id,
      userId: invite.created_by,
      title: "Un nuevo roommate",
      message: `${user.name} aceptó la invitación.`,
      href: "/apartamento",
    });
    return { message: "Ya eres parte del apartamento." };
  });
}
