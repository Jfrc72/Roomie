import { ZodError } from "zod";
import { forwardToNest, nestRoutes } from "@/server/nest-proxy";
import { pollsApi } from "@/server/polls-api";
import { expensesApi } from "@/server/expenses-api";
import { shoppingApi } from "@/server/shopping-api";
import { maintenanceApi } from "@/server/maintenance-api";
import { ApiError, checkOrigin } from "@/server/security";
import { getLanguage, translate } from "@/lib/i18n";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handle(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  const cookie = request.headers
    .get("cookie")
    ?.split(";")
    .map((v) => v.trim())
    .find((v) => v.startsWith("roomie_language="))
    ?.split("=")[1];
  const language = getLanguage(cookie);
  const failure = (message: string, status: number) =>
    Response.json({ error: translate(message, language) }, { status });
  try {
    checkOrigin(request);
    const { path } = await context.params;
    let result;
    if (nestRoutes.has(path[0])) return forwardToNest(request, path);
    if (path[0] === "polls") result = await pollsApi(request, path);
    else if (path[0] === "expenses" || path[0] === "payments")
      result = await expensesApi(request, path);
    else if (path[0] === "shopping") result = await shoppingApi(request, path);
    else if (path[0] === "maintenance")
      result = await maintenanceApi(request, path);
    else throw new ApiError(404, "Ruta no encontrada.");
    return Response.json(
      { data: result },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof ApiError) return failure(error.message, error.status);
    if (error instanceof ZodError)
      return failure("Revisa los campos: los datos no son válidos.", 400);
    if (error instanceof SyntaxError)
      return failure("El formato de la solicitud no es válido.", 400);
    if ((error as { code?: string }).code === "23505")
      return failure("Ya existe un registro con estos datos.", 409);
    console.error("API:", error);
    return failure(
      "No pudimos completar la operación. Intenta nuevamente.",
      500,
    );
  }
}
export { handle as GET, handle as POST, handle as PATCH, handle as DELETE };
