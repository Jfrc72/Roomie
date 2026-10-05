// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import type { PoolClient } from "pg";
import { canRemoveAdmin, invitationProblem } from "@/server/rules";
import { isInternalPath } from "@/lib/paths";
import {
  notify,
  scheduleReminder,
  cancelReminder,
} from "@/server/notifications";
import { translate, getLanguage } from "@/lib/i18n";

const now = new Date("2026-10-01T12:00:00Z");
const valid = {
  status: "pending",
  expiresAt: new Date("2026-10-02"),
  email: "juan@example.com",
  userEmail: "juan@example.com",
  count: 7,
  existing: false,
};

describe("HU1.3 / HU1.4 · Reglas del último administrador", () => {
  it("impide retirar al único administrador", () =>
    expect(canRemoveAdmin("admin", null, 1)).toBe(false));
  it("impide degradar al único administrador", () =>
    expect(canRemoveAdmin("admin", "member", 1)).toBe(false));
  it("permite la baja cuando queda otro administrador", () =>
    expect(canRemoveAdmin("admin", null, 2)).toBe(true));
});
describe("HU1.2 · Reglas de aceptación", () => {
  it("acepta el correo correcto mientras exista espacio", () =>
    expect(invitationProblem(valid, now)).toBeNull());
  it("rechaza una invitación vencida justo en su límite", () =>
    expect(invitationProblem({ ...valid, expiresAt: now }, now)).toBe(
      "expired",
    ));
  it("rechaza un correo diferente", () =>
    expect(
      invitationProblem({ ...valid, userEmail: "otra@example.com" }, now),
    ).toBe("email"));
  it("rechaza reutilizar un enlace aceptado", () =>
    expect(invitationProblem({ ...valid, status: "accepted" }, now)).toBe(
      "expired",
    ));
  it("rechaza superar ocho integrantes", () =>
    expect(invitationProblem({ ...valid, count: 8 }, now)).toBe("capacity"));
  it("rechaza un integrante que ya pertenece al hogar", () =>
    expect(invitationProblem({ ...valid, existing: true }, now)).toBe(
      "member",
    ));
});

const notice = {
  homeId: "h1",
  userId: "u1",
  title: "Aviso",
  message: "Un pendiente",
  href: "/tareas",
  sourceKey: "task:1:u1",
};
function fakeDatabase(responses: unknown[]) {
  const query = vi.fn();
  responses.forEach((value) => query.mockResolvedValueOnce(value));
  return { query, db: { query } as unknown as PoolClient };
}
describe("HU7.3 · Servicio común de avisos y recordatorios", () => {
  it("no crea avisos para una persona sin acceso al hogar", async () => {
    const { db, query } = fakeDatabase([{ rows: [], rowCount: 0 }]);
    await notify(db, notice);
    expect(query).toHaveBeenCalledTimes(1);
  });
  it("no programa envíos si el evento ya generó su aviso", async () => {
    const { db, query } = fakeDatabase([
      { rows: [{ id: "m1" }], rowCount: 1 },
      { rows: [], rowCount: 0 },
    ]);
    await notify(db, notice);
    expect(query).toHaveBeenCalledTimes(2);
  });
  it("solo programa el canal que el destinatario activó", async () => {
    const { db, query } = fakeDatabase([
      { rowCount: 1 },
      { rows: [{ id: "n1" }] },
      { rows: [{ email_enabled: true, push_enabled: false }] },
      {},
    ]);
    await notify(db, notice);
    expect(query).toHaveBeenCalledTimes(4);
    expect(query.mock.calls[3][1]).toEqual(["n1", "email"]);
  });
  it("rechaza destinos externos antes de guardar un recordatorio", async () => {
    const { db, query } = fakeDatabase([]);
    await expect(
      scheduleReminder(db, {
        ...notice,
        href: "https://example.com",
        dueAt: now,
      }),
    ).rejects.toThrow("ruta interna");
    expect(query).not.toHaveBeenCalled();
  });
  it("cancela únicamente la clave del pendiente completado", async () => {
    const { db, query } = fakeDatabase([{}]);
    await cancelReminder(db, "task:1:u1");
    expect(query).toHaveBeenCalledWith(
      "DELETE FROM reminders WHERE source_key=$1",
      ["task:1:u1"],
    );
  });
});

describe("Idiomas y rutas seguras", () => {
  it("usa español cuando recibe un idioma no disponible", () =>
    expect(getLanguage("fr")).toBe("es"));
  it("traduce el saludo conservando el nombre", () =>
    expect(translate("¡Hola, {name}!", "en", { name: "Juan" })).toBe(
      "Hello, Juan!",
    ));
  it("mantiene el texto que escribió una persona", () =>
    expect(translate("Nuestra casa de Bogotá", "en")).toBe(
      "Nuestra casa de Bogotá",
    ));
  it.each([
    "//example.com",
    "https://example.com",
    "/\\example.com",
    "javascript:alert(1)",
  ])("rechaza la ruta %s", (path) => expect(isInternalPath(path)).toBe(false));
});
