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
} from "./server-fixture";
import { tasksApi } from "@/server/tasks-api";

const due = "2099-10-01T12:00:00Z";
const form = {
  title: "Limpiar cocina",
  description: "Lavar el piso",
  priority: "high",
  due_at: due,
  assigned_membership_id: null,
};
const task = {
  ...form,
  id: recordId,
  home_id: homeId,
  status: "pending",
  created_by: userId,
  assignee_user_id: null,
};
const create = (body: unknown) =>
  tasksApi(request(`tasks?homeId=${homeId}`, "POST", body), ["tasks"]);
const patch = (body: unknown) =>
  tasksApi(request(`tasks/${recordId}`, "PATCH", body), ["tasks", recordId]);

describe("HU3.1 · Crear tareas", () => {
  it("guarda los datos y registra el estado inicial en el historial", async () => {
    dbRows([task]);
    expect(await create(form)).toMatchObject({ id: recordId });
    expect(writes("INSERT INTO tasks")).toEqual([
      [homeId, form.title, form.description, null, due, "high", userId],
    ]);
    expect(writes("INSERT INTO task_history")).toEqual([[recordId, userId]]);
  });
  it("rechaza títulos vacíos antes de guardar", async () => {
    await expect(create({ ...form, title: " " })).rejects.toThrow("al menos 2");
    expect(mocks.dbQuery).not.toHaveBeenCalled();
  });
  it("rechaza fechas límite en el pasado", async () => {
    await expect(
      create({ ...form, due_at: "2000-01-01T00:00:00Z" }),
    ).rejects.toThrow("pasado");
    expect(mocks.dbQuery).not.toHaveBeenCalled();
  });
});
describe("HU3.2 · Asignar tareas", () => {
  it("avisa al responsable con un enlace a su tarea", async () => {
    dbRows([{ user_id: otherId }], [task]);
    await create({ ...form, assigned_membership_id: memberId });
    expect(mocks.notify).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        userId: otherId,
        href: `/tareas/${recordId}`,
        title: "Nueva tarea asignada",
      }),
    );
    expect(mocks.dbQuery.mock.calls[0][1]).toEqual([memberId, homeId]);
  });
  it("rechaza responsables retirados o de otro hogar", async () => {
    dbRows([]);
    await expect(
      create({ ...form, assigned_membership_id: memberId }),
    ).rejects.toThrow("integrante activo");
    expect(writes("INSERT INTO tasks")).toEqual([]);
    expect(mocks.notify).not.toHaveBeenCalled();
  });
  it("al reasignar avisa a la nueva persona y traslada el recordatorio", async () => {
    dbRows([task], [{ user_id: otherId }]);
    await patch({ assigned_membership_id: memberId });
    expect(mocks.cancelReminder).toHaveBeenCalledWith(
      expect.anything(),
      `task:${recordId}`,
    );
    expect(mocks.scheduleReminder).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ userId: otherId, dueAt: new Date(due) }),
    );
    expect(mocks.notify).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        userId: otherId,
        title: "Nueva tarea asignada",
      }),
    );
  });
});
describe("HU3.3 · Recordatorios de tareas", () => {
  it("programa un recordatorio cuando hay fecha y responsable", async () => {
    dbRows([{ user_id: otherId }], [task]);
    await create({ ...form, assigned_membership_id: memberId });
    expect(mocks.scheduleReminder).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        sourceKey: `task:${recordId}`,
        userId: otherId,
        dueAt: new Date(due),
      }),
    );
    expect(mocks.cancelReminder).not.toHaveBeenCalled();
  });
  it("completar la tarea cancela el recordatorio sin programar otro", async () => {
    dbRows(
      [
        {
          ...task,
          assigned_membership_id: memberId,
          assignee_user_id: otherId,
        },
      ],
      [],
      [{ id: "history-1" }],
    );
    await patch({ status: "completed" });
    expect(mocks.cancelReminder).toHaveBeenCalledWith(
      expect.anything(),
      `task:${recordId}`,
    );
    expect(mocks.scheduleReminder).not.toHaveBeenCalled();
  });
});
it("HU3.4 · Un responsable que no es autor ni administrador no puede reabrir la tarea", async () => {
  dbRows([
    {
      ...task,
      status: "completed",
      created_by: otherId,
      assigned_membership_id: memberId,
      assignee_user_id: userId,
    },
  ]);
  await expect(patch({ status: "pending" })).rejects.toMatchObject({
    status: 403,
  });
  expect(writes("UPDATE tasks")).toEqual([]);
});
describe("HU3.5 · Historial de tareas", () => {
  it("devuelve el historial con el autor y la transición registrada", async () => {
    const history = [
      {
        actor: "Miguel",
        previous_status: "pending",
        new_status: "completed",
        created_at: "2026-10-01T12:00:00Z",
      },
    ];
    readRows([task], history);
    expect(
      await tasksApi(request(`tasks/${recordId}`), ["tasks", recordId]),
    ).toMatchObject({ id: recordId, history });
    expect(mocks.requireHome).toHaveBeenCalledWith(userId, homeId);
  });
  it("completar registra quién actuó y avisa al creador si fue otra persona", async () => {
    mocks.requireHome.mockResolvedValue("admin");
    dbRows([{ ...task, created_by: otherId }], [], [{ id: "history-2" }]);
    await patch({ status: "completed" });
    expect(writes("INSERT INTO task_history")).toEqual([
      [recordId, userId, "pending", "completed"],
    ]);
    expect(mocks.notify).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        userId: otherId,
        title: "Tarea completada",
        sourceKey: `task:${recordId}:completed:history-2:${otherId}`,
      }),
    );
  });
  it("guardar el mismo estado no inventa una transición ni un aviso de finalización", async () => {
    dbRows([task]);
    await patch({ status: "pending" });
    expect(writes("INSERT INTO task_history")).toEqual([]);
    expect(mocks.notify).not.toHaveBeenCalled();
  });
});
describe("HU3.6 · Editar y eliminar tareas", () => {
  it("el autor puede corregir el título y se registra la actividad", async () => {
    dbRows([task]);
    await patch({ title: "Limpiar baño" });
    expect(writes("UPDATE tasks")[0][0]).toBe("Limpiar baño");
    expect(mocks.activity).toHaveBeenCalledWith(
      expect.anything(),
      homeId,
      userId,
      'actualizó la tarea "Limpiar baño"',
    );
  });
  it("impide eliminar tareas de otra persona sin permiso", async () => {
    dbRows([{ ...task, created_by: otherId }]);
    await expect(
      tasksApi(request("tasks", "DELETE"), ["tasks", recordId]),
    ).rejects.toMatchObject({ status: 403 });
    expect(writes("DELETE FROM tasks")).toEqual([]);
    expect(mocks.cancelReminder).not.toHaveBeenCalled();
  });
  it("elimina la tarea autorizada y cancela su recordatorio", async () => {
    dbRows([task]);
    await tasksApi(request("tasks", "DELETE"), ["tasks", recordId]);
    expect(writes("DELETE FROM tasks")).toEqual([[recordId]]);
    expect(mocks.cancelReminder).toHaveBeenCalledWith(
      expect.anything(),
      `task:${recordId}`,
    );
  });
});
