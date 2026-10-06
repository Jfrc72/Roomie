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
import { pollsApi } from "@/server/polls-api";
import { closeExpiredPolls } from "@/server/polls";

const form = {
  title: "¿Pintamos la sala?",
  description: "Elegir color",
  anonymous: false,
  closes_at: null,
  options: ["Verde", "Blanco"],
};
const poll = {
  id: recordId,
  home_id: homeId,
  title: form.title,
  rule: "simple",
  status: "open",
  closes_at: null,
  created_by: userId,
};
const create = (body: unknown) =>
  pollsApi(request(`polls?homeId=${homeId}`, "POST", body), ["polls"]);
const action = (name: string, body: unknown = {}) =>
  pollsApi(request("polls", "POST", body), ["polls", recordId, name]);
function listing(status: "open" | "closed", anonymous: boolean) {
  dbRows([]); // No hay votaciones vencidas por cerrar.
  readRows(
    [
      {
        ...poll,
        status,
        anonymous,
        eligible_count: 2,
        voters: 1,
        closed_at: status === "closed" ? "2026-10-01T12:00:00Z" : null,
      },
    ],
    [{ id: otherRecordId, poll_id: recordId, label: "Verde", votes: 1 }],
    [{ option_id: otherRecordId, name: "Miguel" }],
    [{ total: 3 }],
  );
  return pollsApi(request(`polls?homeId=${homeId}`), ["polls"]);
}
describe("HU8.1 · Abrir votaciones", () => {
  it("crea las opciones, usa mayoría simple por defecto y avisa a los otros integrantes", async () => {
    dbRows([{ id: recordId }], [], [{ user_id: otherId }]);
    await create(form);
    expect(writes("INSERT INTO polls")).toEqual([
      [homeId, form.title, form.description, "simple", false, null, userId],
    ]);
    expect(writes("INSERT INTO poll_options")).toEqual([
      [recordId, ["Verde", "Blanco"]],
    ]);
    expect(mocks.notify).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ userId: otherId, title: "Nueva votación" }),
    );
  });
  it("rechaza opciones repetidas aunque cambien mayúsculas o espacios", async () => {
    await expect(
      create({ ...form, options: ["Verde", " VERDE "] }),
    ).rejects.toThrow("repetirse");
    expect(mocks.dbQuery).not.toHaveBeenCalled();
  });
  it("rechaza un cierre en el pasado", async () => {
    await expect(
      create({ ...form, closes_at: "2000-01-01T00:00:00Z" }),
    ).rejects.toThrow("futuro");
    expect(mocks.dbQuery).not.toHaveBeenCalled();
  });
});
describe("HU8.3 · Votar", () => {
  it("guarda el voto del integrante activo para la opción elegida", async () => {
    dbRows([poll], [{ id: memberId }], [{ id: otherRecordId }]);
    await action("votes", { option_id: otherRecordId });
    expect(writes("INSERT INTO votes")).toEqual([
      [recordId, otherRecordId, memberId],
    ]);
  });
  it("rechaza votar por una opción que pertenece a otra votación", async () => {
    dbRows([poll], [{ id: memberId }], []);
    await expect(action("votes", { option_id: otherRecordId })).rejects.toThrow(
      "opción de esta votación",
    );
    expect(writes("INSERT INTO votes")).toEqual([]);
  });
  it("oculta recuentos y nombres mientras la votación está abierta", async () => {
    const result = await listing("open", false);
    expect(result).toEqual([
      expect.objectContaining({
        eligible: 3,
        options: [
          { id: otherRecordId, label: "Verde", votes: null, voters: null },
        ],
      }),
    ]);
  });
});
describe("HU8.4 · Cerrar votaciones", () => {
  it("rechaza el cierre por un integrante que no la creó", async () => {
    dbRows([{ ...poll, created_by: otherId }]);
    await expect(action("close")).rejects.toMatchObject({ status: 403 });
    expect(writes("UPDATE polls")).toEqual([]);
  });
  it("rechaza nuevos votos después del cierre", async () => {
    dbRows([{ ...poll, status: "closed" }]);
    await expect(
      action("votes", { option_id: otherRecordId }),
    ).rejects.toMatchObject({ status: 409 });
    expect(writes("INSERT INTO votes")).toEqual([]);
  });
  it("el cierre automático registra el resultado y avisa sin atribuirlo a una persona", async () => {
    dbRows(
      [poll],
      [],
      [{ user_id: userId }, { user_id: otherId }],
      [],
      [
        { label: "Verde", votes: 1 },
        { label: "Blanco", votes: 0 },
      ],
    );
    await closeExpiredPolls(homeId);
    expect(writes("UPDATE polls")).toEqual([[recordId, 2]]);
    expect(writes("INSERT INTO activities")[0][1]).toBeNull();
    expect(mocks.notify).toHaveBeenCalledTimes(2);
    expect(mocks.notify).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        userId: otherId,
        message: expect.stringContaining("Verde"),
      }),
    );
  });
});
describe("HU8.5 · Consultar decisiones", () => {
  it("muestra votos y nombres en una decisión pública cerrada", async () => {
    const result = await listing("closed", false);
    expect(result).toEqual([
      expect.objectContaining({
        can_close: false,
        options: [
          { id: otherRecordId, label: "Verde", votes: 1, voters: ["Miguel"] },
        ],
      }),
    ]);
  });
  it("conserva el anonimato al publicar el resultado", async () => {
    const result = await listing("closed", true);
    expect(result).toEqual([
      expect.objectContaining({
        options: [
          { id: otherRecordId, label: "Verde", votes: 1, voters: null },
        ],
      }),
    ]);
  });
  it("conserva el número de habilitados al cierre aunque después cambie el hogar", async () => {
    const result = await listing("closed", false);
    expect(result).toEqual([
      expect.objectContaining({
        eligible: 2,
        closed_at: "2026-10-01T12:00:00Z",
      }),
    ]);
  });
});
