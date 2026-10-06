// @vitest-environment node
import { describe, expect, it } from "vitest";
import { mocks, readRows, request } from "./server-fixture";
import { authApi } from "@/server/auth-api";
import { COOKIE } from "@/server/security";

describe("HU10.2 · Invalidar sesión", () => {
  it("borra la sesión actual en el servidor y elimina la cookie", async () => {
    readRows([]);
    expect(
      await authApi(request("auth/logout", "POST", {}), ["auth", "logout"]),
    ).toEqual({ message: "Sesión cerrada." });
    expect(mocks.query).toHaveBeenCalledWith(
      "DELETE FROM sessions WHERE token_hash=$1",
      ["session-hash"],
    );
    expect(mocks.deleteCookie).toHaveBeenCalledWith(COOKIE);
  });
  it("si el servidor falla no informa un cierre exitoso ni borra solo la cookie", async () => {
    mocks.query.mockRejectedValueOnce(new Error("Base no disponible"));
    await expect(
      authApi(request("auth/logout", "POST", {}), ["auth", "logout"]),
    ).rejects.toThrow("Base no disponible");
    expect(mocks.deleteCookie).not.toHaveBeenCalled();
  });
});
