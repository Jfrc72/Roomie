// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  mocks,
  dbRows,
  readRows,
  writes,
  request,
  userId,
  otherId,
  homeId,
  recordId,
  memberId,
  otherRecordId,
} from "./server-fixture";
import { rulesApi } from "@/server/rules-api";

const content = "Limpiar los espacios comunes al terminar.";
const version = {
  id: recordId,
  home_id: homeId,
  version: 3,
  content,
  author: "Juan",
  notes: "Turnos",
};
const publish = (text = content) =>
  rulesApi(
    request(`rules?homeId=${homeId}`, "POST", {
      content: text,
      notes: "Turnos",
    }),
    ["rules"],
  );
const accept = () =>
  rulesApi(request("rules", "POST", {}), ["rules", recordId, "accept"]);
const report = (body: unknown) =>
  rulesApi(request(`rules/reports?homeId=${homeId}`, "POST", body), [
    "rules",
    "reports",
  ]);

describe("HU9.1 · Publicar reglamento", () => {
  it("numera la nueva versión y registra la aceptación de su autor", async () => {
    dbRows(
      [],
      [{ version: 2, content: "Reglamento anterior" }],
      [{ id: recordId }],
      [],
      [{ user_id: otherId }],
    );
    expect(await publish()).toMatchObject({ id: recordId, version: 3 });
    expect(mocks.requireHome).toHaveBeenCalledWith(userId, homeId, true);
    expect(writes("INSERT INTO rule_versions")).toEqual([
      [homeId, 3, content, "Turnos", userId],
    ]);
    expect(writes("INSERT INTO rule_acceptances")).toEqual([
      [recordId, homeId, userId],
    ]);
    expect(mocks.notify).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ userId: otherId, title: "Nuevo reglamento" }),
    );
  });
  it("rechaza un reglamento demasiado corto", async () => {
    await expect(publish("Corto")).rejects.toThrow();
    expect(mocks.dbQuery).not.toHaveBeenCalled();
  });
  it("no crea otra versión si el texto no cambió", async () => {
    dbRows([], [version]);
    await expect(publish()).rejects.toMatchObject({ status: 409 });
    expect(writes("INSERT INTO rule_versions")).toEqual([]);
  });
});
describe("HU9.2 · Aceptar reglamento", () => {
  it("acepta la versión vigente y registra la actividad", async () => {
    dbRows([version], [{ id: recordId }], [{ accepted_at: "2026-10-01" }]);
    expect(await accept()).toEqual({ message: "Aceptaste el reglamento." });
    expect(writes("INSERT INTO rule_acceptances")).toEqual([
      [recordId, homeId, userId],
    ]);
    expect(mocks.activity).toHaveBeenCalledOnce();
  });
  it("rechaza aceptar una versión antigua", async () => {
    dbRows([version], [{ id: otherRecordId }]);
    await expect(accept()).rejects.toMatchObject({ status: 409 });
    expect(writes("INSERT INTO rule_acceptances")).toEqual([]);
  });
  it("repetir la aceptación no duplica la actividad", async () => {
    dbRows([version], [{ id: recordId }], []);
    expect(await accept()).toEqual({
      message: "Ya habías aceptado esta versión.",
    });
    expect(mocks.activity).not.toHaveBeenCalled();
  });
});
describe("HU9.3 · Historial del reglamento", () => {
  it("separa la versión vigente del historial conservando autor y notas", async () => {
    const previous = {
      ...version,
      id: otherRecordId,
      version: 2,
      author: "Miguel",
      notes: "Primera revisión",
    };
    readRows([version, previous], [], [{ user_id: userId, accepted_at: null }]);
    expect(
      await rulesApi(request(`rules?homeId=${homeId}`), ["rules"]),
    ).toMatchObject({
      current: version,
      history: [previous],
      accepted_by_me: false,
    });
  });
  it("un hogar sin versiones muestra un estado vacío, sin aceptación previa", async () => {
    readRows([], []);
    expect(
      await rulesApi(request(`rules?homeId=${homeId}`), ["rules"]),
    ).toEqual({
      current: null,
      accepted_by_me: false,
      acceptances: [],
      history: [],
      reports: [],
    });
    expect(mocks.query).toHaveBeenCalledTimes(2);
  });
  it("no entrega el historial si la persona no pertenece al hogar", async () => {
    mocks.requireHome.mockRejectedValue(new Error("Sin acceso"));
    await expect(
      rulesApi(request(`rules?homeId=${homeId}`), ["rules"]),
    ).rejects.toThrow("Sin acceso");
    expect(mocks.query).not.toHaveBeenCalled();
  });
});
describe("HU9.4 · Incumplimientos", () => {
  it("rechaza reportar un acuerdo que no está en la versión vigente", async () => {
    dbRows([version]);
    await expect(
      report({
        clause: "Prohibido cocinar",
        description: "",
        reported_membership_id: null,
      }),
    ).rejects.toThrow("reglamento vigente");
    expect(writes("INSERT INTO rule_reports")).toEqual([]);
  });
  it("impide reportarse a uno mismo", async () => {
    dbRows([version], [{ user_id: userId, name: "Juan" }]);
    await expect(
      report({
        clause: content,
        description: "",
        reported_membership_id: memberId,
      }),
    ).rejects.toThrow("ti mismo");
    expect(writes("INSERT INTO rule_reports")).toEqual([]);
  });
  it("resolver exige administrador y avisa a quien reportó", async () => {
    dbRows([
      {
        id: recordId,
        home_id: homeId,
        clause: content,
        reported_by: otherId,
        resolved_at: null,
      },
    ]);
    await rulesApi(request("rules", "POST", {}), [
      "rules",
      "reports",
      recordId,
      "resolve",
    ]);
    expect(mocks.requireHome).toHaveBeenCalledWith(
      userId,
      homeId,
      true,
      expect.anything(),
    );
    expect(writes("UPDATE rule_reports")).toEqual([[recordId, userId]]);
    expect(mocks.notify).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        userId: otherId,
        title: "Incumplimiento resuelto",
      }),
    );
  });
});
