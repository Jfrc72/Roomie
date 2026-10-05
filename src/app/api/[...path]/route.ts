import { ZodError } from "zod";
import { authApi } from "@/server/auth-api";
import { homesApi, acceptInvitation } from "@/server/homes-api";
import { notificationsApi } from "@/server/notifications-api";
import { tasksApi } from "@/server/tasks-api";
import { reservationsApi, resourcesApi } from "@/server/reservations-api";
import { pollsApi } from "@/server/polls-api";
import { rulesApi } from "@/server/rules-api";
import { expensesApi } from "@/server/expenses-api";
import { shoppingApi } from "@/server/shopping-api";
import { maintenanceApi } from "@/server/maintenance-api";
import { ApiError, checkOrigin, requireUser } from "@/server/security";
import { query } from "@/server/db";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handle(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  try {
    checkOrigin(request);
    const { path } = await context.params;
    let result;
    if (path[0] === "health" && request.method === "GET") {
      await query("SELECT 1");
      result = { status: "ok" };
    } else if (path[0] === "auth") result = await authApi(request, path);
    else if (path[0] === "homes") result = await homesApi(request, path);
    else if (path[0] === "notifications")
      result = await notificationsApi(request, path);
    else if (path[0] === "tasks") result = await tasksApi(request, path);
    else if (path[0] === "resources")
      result = await resourcesApi(request, path);
    else if (path[0] === "reservations")
      result = await reservationsApi(request, path);
    else if (path[0] === "polls") result = await pollsApi(request, path);
    else if (path[0] === "rules") result = await rulesApi(request, path);
    else if (path[0] === "expenses" || path[0] === "payments")
      result = await expensesApi(request, path);
    else if (path[0] === "shopping") result = await shoppingApi(request, path);
    else if (path[0] === "maintenance")
      result = await maintenanceApi(request, path);
    else if (path[0] === "invitations" && request.method === "POST")
      result = await acceptInvitation(request);
    else if (path[0] === "session" && request.method === "GET") {
      const user = await requireUser();
      const homes = await query(
        `SELECT h.*,m.role,(SELECT count(*)::int FROM memberships WHERE home_id=h.id AND active) AS member_count
        FROM homes h JOIN memberships m ON m.home_id=h.id WHERE m.user_id=$1 AND m.active ORDER BY h.created_at`,
        [user.id],
      );
      result = {
        user: { id: user.id, name: user.name, email: user.email },
        homes,
        activeHomeId: homes.some((h) => h.id === user.active_home_id)
          ? user.active_home_id
          : (homes[0]?.id ?? null),
      };
    } else throw new ApiError(404, "Ruta no encontrada.");
    return Response.json(
      { data: result },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof ApiError)
      return Response.json({ error: error.message }, { status: error.status });
    if (error instanceof ZodError)
      return Response.json({ error: error.issues[0].message }, { status: 400 });
    if (error instanceof SyntaxError)
      return Response.json(
        { error: "El formato de la solicitud no es válido." },
        { status: 400 },
      );
    if ((error as { code?: string }).code === "23505")
      return Response.json(
        { error: "Ya existe un registro con estos datos." },
        { status: 409 },
      );
    console.error("API:", error);
    return Response.json(
      { error: "No pudimos completar la operación. Intenta nuevamente." },
      { status: 500 },
    );
  }
}
export { handle as GET, handle as POST, handle as PATCH, handle as DELETE };
