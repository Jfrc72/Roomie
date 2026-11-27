import { forwardToNest, nestRoutes } from "@/server/nest-proxy";
import { ApiError, checkOrigin } from "@/server/security";
import { getLanguage, translate } from "@/lib/i18n";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Todas las rutas de la API están en NestJS: aquí solo se revisa el origen y se reenvía la solicitud.
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
    if (!nestRoutes.has(path[0])) throw new ApiError(404, "Ruta no encontrada.");
    return forwardToNest(request, path);
  } catch (error) {
    if (error instanceof ApiError) return failure(error.message, error.status);
    console.error("API:", error);
    return failure(
      "No pudimos completar la operación. Intenta nuevamente.",
      500,
    );
  }
}
export { handle as GET, handle as POST, handle as PATCH, handle as DELETE };
