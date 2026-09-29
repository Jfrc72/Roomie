import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { query } from "./db";
import type { User } from "@/types";

const scrypt = promisify(scryptCallback);
export const COOKIE = "roomie_session";
export const hashToken = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export const token = () => randomBytes(32).toString("hex");
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${hash.toString("hex")}`;
}
export async function verifyPassword(password: string, stored: string) {
  const [salt, expected] = stored.split(":");
  const actual = (await scrypt(password, salt, 64)) as Buffer;
  return timingSafeEqual(actual, Buffer.from(expected, "hex"));
}
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
     WHERE s.token_hash=$1 AND s.expires_at>now()`,
    [hashToken(value)],
  );
  return rows[0] ? { ...rows[0], sessionHash: hashToken(value) } : null;
}
export async function requireUser() {
  const user = await currentUser();
  if (!user) throw new ApiError(401, "Inicia sesión para continuar.");
  return user;
}
export async function createSession(userId: string) {
  const value = token();
  await query(
    `INSERT INTO sessions(token_hash,user_id,expires_at,active_home_id)
    VALUES($1,$2,now()+interval '7 days',(SELECT home_id FROM memberships WHERE user_id=$2 AND active LIMIT 1))`,
    [hashToken(value), userId],
  );
  (await cookies()).set(COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.APP_URL?.startsWith("https://") ?? false,
    path: "/",
    maxAge: 604800,
  });
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
