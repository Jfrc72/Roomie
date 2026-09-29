import type { PoolClient } from "pg";
import { query } from "./db";
import { ApiError } from "./security";
import { idSchema } from "./validation";
export async function requireHome(
  userId: string,
  homeId: string,
  admin = false,
  db?: PoolClient,
) {
  idSchema.parse(homeId);
  const sql =
    "SELECT role FROM memberships WHERE home_id=$1 AND user_id=$2 AND active";
  const rows = db
    ? (await db.query(sql, [homeId, userId])).rows
    : await query(sql, [homeId, userId]);
  if (!rows[0]) throw new ApiError(403, "No tienes acceso a este apartamento.");
  if (admin && rows[0].role !== "admin")
    throw new ApiError(403, "Esta acción requiere el rol de administrador.");
  return rows[0].role as "admin" | "member";
}
export async function activity(
  db: PoolClient,
  homeId: string,
  userId: string,
  message: string,
) {
  await db.query(
    "INSERT INTO activities(home_id,actor_id,message) VALUES($1,$2,$3)",
    [homeId, userId, message],
  );
}
