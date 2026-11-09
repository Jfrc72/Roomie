import { cookies } from "next/headers";
import { query } from "./db";
import type { User } from "@/types";
import { COOKIE, hashToken } from "../../backend/src/auth/passwords";
export { COOKIE, hashPassword, hashToken, token } from "../../backend/src/auth/passwords";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function currentUser(): Promise<
  (User & { sessionHash: string; active_home_id: string | null }) | null
> {
  const value = (await cookies()).get(COOKIE)?.value;
  if (!value) return null;
  const rows = await query<User & { active_home_id: string | null }>(
    `SELECT u.id,u.name,u.email,s.active_home_id FROM users u JOIN sessions s ON s.user_id=u.id
     WHERE s.token_hash=$1 AND s.expires_at>now() AND u.active`,
    [hashToken(value)],
  );
  return rows[0] ? { ...rows[0], sessionHash: hashToken(value) } : null;
}
export async function requireUser() {
  const user = await currentUser();
  if (!user) throw new ApiError(401, "Inicia sesión para continuar.");
  return user;
}
export function checkOrigin(request: Request) {
  if (["GET", "HEAD"].includes(request.method)) return;
  const origin = request.headers.get("origin");
  const expected = new URL(process.env.APP_URL || "http://localhost:3000")
    .origin;
  if (origin !== expected)
    throw new ApiError(403, "Origen de la solicitud no permitido.");
  if (
    request.method !== "DELETE" &&
    !request.headers.get("content-type")?.includes("application/json")
  )
    throw new ApiError(415, "Envía los datos como JSON.");
}
