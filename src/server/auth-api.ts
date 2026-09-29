import { cookies } from "next/headers";
import { z } from "zod";
import { query, transaction } from "./db";
import {
  ApiError,
  COOKIE,
  createSession,
  hashPassword,
  requireUser,
  verifyPassword,
} from "./security";
import { email, name, password } from "./validation";

export async function authApi(request: Request, path: string[]) {
  const action = path[1];
  if (request.method === "POST" && action === "register") {
    const data = z
      .object({ name, email, password })
      .parse(await request.json());
    const hash = await hashPassword(data.password);
    const user = await transaction(async (db) => {
      const { rows } = await db.query(
        "INSERT INTO users(name,email,password_hash) VALUES($1,$2,$3) RETURNING id",
        [data.name, data.email, hash],
      );
      await db.query(
        "INSERT INTO notification_preferences(user_id) VALUES($1)",
        [rows[0].id],
      );
      return rows[0];
    });
    await createSession(user.id);
    return { message: "Cuenta creada correctamente." };
  }
  if (request.method === "POST" && action === "login") {
    const data = z
      .object({ email, password: z.string().min(1).max(128) })
      .parse(await request.json());
    const attempts = await query(
      `INSERT INTO login_attempts(email,attempts) VALUES($1,1)
      ON CONFLICT(email) DO UPDATE SET attempts=CASE WHEN login_attempts.window_start<now()-interval '15 minutes' THEN 1 ELSE login_attempts.attempts+1 END,
      window_start=CASE WHEN login_attempts.window_start<now()-interval '15 minutes' THEN now() ELSE login_attempts.window_start END RETURNING attempts`,
      [data.email],
    );
    if (attempts[0].attempts > 10)
      throw new ApiError(
        429,
        "Demasiados intentos. Espera 15 minutos y vuelve a intentarlo.",
      );
    const [user] = await query(
      "SELECT id,password_hash FROM users WHERE email=$1",
      [data.email],
    );
    if (!user || !(await verifyPassword(data.password, user.password_hash)))
      throw new ApiError(401, "Correo o contraseña incorrectos.");
    await query("DELETE FROM login_attempts WHERE email=$1", [data.email]);
    await createSession(user.id);
    return { message: "Sesión iniciada." };
  }
  const user = await requireUser();
  if (request.method === "POST" && action === "logout") {
    await query("DELETE FROM sessions WHERE token_hash=$1", [user.sessionHash]);
    (await cookies()).delete(COOKIE);
    return { message: "Sesión cerrada." };
  }
  if (request.method === "PATCH" && action === "profile") {
    const data = z.object({ name }).parse(await request.json());
    await query("UPDATE users SET name=$1 WHERE id=$2", [data.name, user.id]);
    return { message: "Perfil actualizado." };
  }
  if (request.method === "PATCH" && action === "password") {
    const data = z
      .object({ current: z.string().min(1).max(128), password })
      .parse(await request.json());
    const [row] = await query("SELECT password_hash FROM users WHERE id=$1", [
      user.id,
    ]);
    if (!(await verifyPassword(data.current, row.password_hash)))
      throw new ApiError(400, "La contraseña actual no coincide.");
    await transaction(async (db) => {
      await db.query("UPDATE users SET password_hash=$1 WHERE id=$2", [
        await hashPassword(data.password),
        user.id,
      ]);
      await db.query("DELETE FROM sessions WHERE user_id=$1", [user.id]);
    });
    await createSession(user.id);
    return {
      message: "Contraseña actualizada. Se cerraron las otras sesiones.",
    };
  }
  throw new ApiError(404, "Operación no encontrada.");
}
