// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { forwardToNest } from "@/server/nest-proxy";

afterEach(() => vi.restoreAllMocks());
const logout = () => new Request("http://localhost:3000/api/auth/logout", {
  method: "POST", headers: { Cookie: "roomie_session=sesion-de-prueba", Origin: "http://localhost:3000", "Content-Type": "application/json" }, body: "{}",
});

describe("HU10.2 · Invalidar sesión", () => {
  it("envía la sesión a Nest y devuelve la cookie que la borra después del cierre", async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ data: { message: "Sesión cerrada." } }), {
      headers: { "set-cookie": "roomie_session=; Path=/; Max-Age=0", "content-type": "application/json" },
    }));
    const response = await forwardToNest(logout(), ["auth", "logout"]);
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    expect((fetch.mock.calls[0][1]?.headers as Headers).get("cookie")).toBe("roomie_session=sesion-de-prueba");
    expect((await response.json()).data.message).toBe("Sesión cerrada.");
  });
  it("si Nest falla no informa éxito ni borra la cookie del navegador", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Servidor no disponible"));
    const response = await forwardToNest(logout(), ["auth", "logout"]);
    expect(response.status).toBe(503);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect((await response.json()).error).toBeTruthy();
  });
  it("mantiene el error de sesión vencida y no inventa una cookie nueva", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ error: "Inicia sesión para continuar." }, { status: 401 }));
    const response = await forwardToNest(logout(), ["auth", "logout"]);
    expect(response.status).toBe(401);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect((await response.json()).error).toBe("Inicia sesión para continuar.");
  });
});
