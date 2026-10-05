// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  mocks,
  dbRows,
  writes,
  request,
  userId,
  otherId,
  homeId,
  recordId,
  memberId,
  otherRecordId,
} from "./server-fixture";
import { reservationsApi, resourcesApi } from "@/server/reservations-api";
import { ApiError } from "@/server/security";

const form = {
  resource_id: recordId,
  starts_at: "2099-01-01T12:00:00Z",
  ends_at: "2099-01-01T13:00:00Z",
};
const reserve = (body: unknown) =>
  reservationsApi(request(`reservations?homeId=${homeId}`, "POST", body), [
    "reservations",
  ]);
const cancel = () =>
  reservationsApi(request("reservations", "DELETE"), [
    "reservations",
    recordId,
  ]);
const reservation = {
  home_id: homeId,
  status: "active",
  ends_at: form.ends_at,
  user_id: userId,
  resource: "Lavadora",
};

describe("HU5.1 · Administrar recursos", () => {
  it("rechaza crear un recurso cuando falla el permiso de administrador", async () => {
    mocks.requireHome.mockRejectedValue(
      new ApiError(403, "Se requiere administrador"),
    );
    await expect(
      resourcesApi(
        request(`resources?homeId=${homeId}`, "POST", {
          name: "Lavadora",
          description: "",
        }),
        ["resources"],
      ),
    ).rejects.toMatchObject({ status: 403 });
    expect(mocks.requireHome).toHaveBeenCalledWith(userId, homeId, true);
    expect(mocks.dbQuery).not.toHaveBeenCalled();
  });
  it("actualiza los datos del recurso del hogar comprobado", async () => {
    dbRows([{ id: recordId, home_id: homeId }]);
    await resourcesApi(
      request("resources", "PATCH", { name: "Sala", description: "Piso uno" }),
      ["resources", recordId],
    );
    expect(mocks.requireHome).toHaveBeenCalledWith(
      userId,
      homeId,
      true,
      expect.anything(),
    );
    expect(writes("UPDATE resources")).toEqual([
      ["Sala", "Piso uno", recordId],
    ]);
  });
  it("no retira un recurso con reservas próximas", async () => {
    dbRows([{ id: recordId, home_id: homeId }], [{ total: 1 }]);
    await expect(
      resourcesApi(request("resources", "DELETE"), ["resources", recordId]),
    ).rejects.toMatchObject({ status: 409 });
    expect(writes("UPDATE resources")).toEqual([]);
  });
});
describe("HU5.2 · Reservas válidas y sin cruces", () => {
  it("una reserva válida programa el recordatorio de quien la creó", async () => {
    dbRows([{ name: "Lavadora" }], [{ id: memberId }], [{ id: otherRecordId }]);
    expect(await reserve(form)).toMatchObject({ id: otherRecordId });
    expect(writes("INSERT INTO reservations")).toEqual([
      [
        homeId,
        recordId,
        memberId,
        new Date(form.starts_at),
        new Date(form.ends_at),
      ],
    ]);
    expect(mocks.scheduleReminder).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        userId,
        sourceKey: `reservation:${otherRecordId}`,
        dueAt: new Date(form.starts_at),
      }),
    );
  });
  it("rechaza un intervalo invertido antes de guardar", async () => {
    await expect(reserve({ ...form, ends_at: form.starts_at })).rejects.toThrow(
      "posterior",
    );
    expect(mocks.dbQuery).not.toHaveBeenCalled();
  });
  it("rechaza reservas de más de siete días", async () => {
    await expect(
      reserve({ ...form, ends_at: "2099-01-08T12:01:00Z" }),
    ).rejects.toThrow("máximo 7");
    expect(mocks.dbQuery).not.toHaveBeenCalled();
  });
  it("traduce un conflicto de horario de PostgreSQL en un error que puede corregirse", async () => {
    dbRows([{ name: "Lavadora" }], [{ id: memberId }]);
    mocks.dbQuery.mockRejectedValueOnce(
      Object.assign(new Error("exclusion"), { code: "23P01" }),
    );
    await expect(reserve(form)).rejects.toMatchObject({
      status: 409,
      message: "Lavadora ya está reservado en ese horario. Elige otro.",
    });
    expect(mocks.scheduleReminder).not.toHaveBeenCalled();
  });
});
describe("HU5.4 · Cancelar reservas", () => {
  it("rechaza a una persona que no es autora ni administradora", async () => {
    dbRows([{ ...reservation, user_id: otherId }]);
    await expect(cancel()).rejects.toMatchObject({ status: 403 });
    expect(writes("UPDATE reservations")).toEqual([]);
  });
  it("la cancelación del administrador avisa al dueño y cancela su recordatorio", async () => {
    mocks.requireHome.mockResolvedValue("admin");
    dbRows([{ ...reservation, user_id: otherId }]);
    await cancel();
    expect(writes("UPDATE reservations")).toEqual([[recordId]]);
    expect(mocks.cancelReminder).toHaveBeenCalledWith(
      expect.anything(),
      `reservation:${recordId}`,
    );
    expect(mocks.notify).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ userId: otherId, title: "Reserva cancelada" }),
    );
  });
  it("no vuelve a cancelar una reserva ya cancelada", async () => {
    dbRows([{ ...reservation, status: "cancelled" }]);
    await expect(cancel()).rejects.toMatchObject({ status: 409 });
    expect(writes("UPDATE reservations")).toEqual([]);
    expect(mocks.notify).not.toHaveBeenCalled();
  });
});
