import type { PoolClient } from "pg";
import { ApiError } from "./security";

export function hasCentPrecision(value: number) {
  const [coefficient, exponentText] = String(value).toLowerCase().split("e");
  const decimalPlaces = (coefficient.split(".")[1]?.length ?? 0) - Number(exponentText ?? 0);
  return Math.max(0, decimalPlaces) <= 2;
}

export function homeIdFrom(request: Request) {
  const homeId = new URL(request.url).searchParams.get("homeId");
  if (!homeId) throw new ApiError(400, "Selecciona un apartamento.");
  return homeId;
}

export async function lockHome(db: PoolClient, homeId: string) {
  const { rows } = await db.query("SELECT id FROM homes WHERE id=$1 FOR UPDATE", [
    homeId,
  ]);
  if (!rows[0]) throw new ApiError(404, "Apartamento no encontrado.");
}

export async function activeUserIds(
  db: PoolClient,
  homeId: string,
  userIds: string[],
) {
  const uniqueIds = [...new Set(userIds)];
  if (!uniqueIds.length) throw new ApiError(400, "Selecciona al menos un integrante.");
  const { rows } = await db.query(
    "SELECT user_id FROM memberships WHERE home_id=$1 AND user_id=ANY($2::uuid[]) AND active FOR SHARE",
    [homeId, uniqueIds],
  );
  if (rows.length !== uniqueIds.length)
    throw new ApiError(400, "Todos los integrantes deben pertenecer al apartamento.");
  return uniqueIds;
}

export function money(value: string | number | null) {
  return value === null ? null : Number(value);
}
