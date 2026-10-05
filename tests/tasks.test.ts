// Pruebas de integración de Tareas (F3), organizadas por historia de usuario. Ver docs/HISTORIAS.md.
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { pool } from "../src/server/db";
import {
  cleanup,
  createHome,
  memberships,
  notices,
  register,
  reminderUser,
  type BrowserSession,
} from "./helpers";

interface Task {
  id: string;
  status: string;
  assignee: string;
  assignee_active: boolean;
  completed_at: string | null;
  can_edit: boolean;
  history: {
    previous_status: string | null;
    new_status: string;
    actor: string;
  }[];
}
test("Tareas: historias HU3.1 a HU3.6", async (t) => {
  const people = await register("tasks", [
    "owner",
    "member",
    "leaver",
    "outside",
  ]);
  const { owner, member, leaver, outside } = people;
  const homeId = await createHome(owner, "Tareas de prueba", [member, leaver]);
  const membership = await memberships(owner, homeId);
  const url = `/tasks?homeId=${homeId}`;
  const future = new Date(Date.now() + 2 * 86400000).toISOString();
  const create = (person: BrowserSession, body: object) =>
    person.call(url, "POST", {
      title: "Tarea de prueba",
      description: "",
      assigned_membership_id: null,
      due_at: null,
      priority: "medium",
      ...body,
    });
  const detail = async (person: BrowserSession, id: string) =>
    (await person.call(`/tasks/${id}`)).json.data as Task;
  const patch = (person: BrowserSession, id: string, body: object) =>
    person.call(`/tasks/${id}`, "PATCH", body);
  let a = "";
  try {
    await t.test(
      "HU3.1.1 Crear una tarea válida la deja pendiente y con su creación en el historial",
      async () => {
        const created = await create(owner, {
          title: "Sacar la basura",
          assigned_membership_id: membership(member),
          due_at: future,
          priority: "high",
        });
        assert.equal(created.status, 200);
        a = created.json.data.id;
        const task = await detail(member, a);
        assert.equal(task.status, "pending");
        assert.equal(task.history.length, 1);
        assert.equal(task.history[0].previous_status, null);
        assert.equal(task.history[0].actor, "Prueba owner");
      },
    );
    await t.test(
      "HU3.1.2 Rechazar título vacío, prioridad inválida o fecha inválida o pasada",
      async () => {
        for (const invalid of [
          { title: "" },
          { priority: "urgente" },
          { due_at: "mañana" },
          { due_at: new Date(Date.now() - 86400000).toISOString() },
        ])
          assert.equal((await create(owner, invalid)).status, 400);
      },
    );
    await t.test(
      "HU3.1.3 Solo los integrantes del hogar ven y crean tareas",
      async () => {
        assert.equal((await outside.call(url)).status, 403);
        assert.equal((await create(outside, {})).status, 403);
        assert.equal((await outside.call(`/tasks/${a}`)).status, 403);
      },
    );
    await t.test(
      "HU3.2.1 Asignar una tarea avisa al responsable con un enlace a ella",
      async () => {
        assert(
          (await notices(member, homeId)).some(
            (n) =>
              n.title === "Nueva tarea asignada" && n.href === `/tareas/${a}`,
          ),
        );
      },
    );
    await t.test(
      "HU3.2.2 Solo se asignan integrantes activos del hogar",
      async () => {
        assert.equal(
          (await create(owner, { assigned_membership_id: randomUUID() }))
            .status,
          400,
        );
        assert.equal(
          (await patch(owner, a, { assigned_membership_id: randomUUID() }))
            .status,
          400,
        );
      },
    );
    await t.test(
      "HU3.2.3 Un responsable retirado se conserva al editar, pero no se vuelve a asignar",
      async () => {
        const b = (
          await create(owner, {
            title: "Pagar el internet",
            assigned_membership_id: membership(leaver),
            due_at: future,
          })
        ).json.data.id;
        assert.equal(await reminderUser(`task:${b}`), leaver.id);
        await owner.call(
          `/homes/${homeId}/members/${membership(leaver)}`,
          "DELETE",
        );
        assert.equal((await detail(owner, b)).assignee_active, false);
        assert.equal(
          (
            await patch(owner, b, {
              title: "Pagar internet y luz",
              assigned_membership_id: membership(leaver),
            })
          ).status,
          200,
        );
        assert.equal(
          (await patch(owner, b, { assigned_membership_id: membership(owner) }))
            .status,
          200,
        );
        // El recordatorio pasa al nuevo responsable.
        assert.equal(await reminderUser(`task:${b}`), owner.id);
        assert.equal(
          (
            await patch(owner, b, {
              assigned_membership_id: membership(leaver),
            })
          ).status,
          400,
        );
      },
    );
    await t.test(
      "HU3.3.1 Una fecha límite programa el recordatorio del responsable",
      async () => {
        assert.equal(await reminderUser(`task:${a}`), member.id);
        const reminder = await pool.query(
          "SELECT due_at,href FROM reminders WHERE source_key=$1",
          [`task:${a}`],
        );
        assert.equal(new Date(reminder.rows[0].due_at).toISOString(), future);
        assert.equal(reminder.rows[0].href, `/tareas/${a}`);
      },
    );
    await t.test(
      "HU3.3.2 Completar una tarea cancela su recordatorio",
      async () => {
        const c = (
          await create(owner, {
            assigned_membership_id: membership(member),
            due_at: future,
          })
        ).json.data.id;
        assert.equal(await reminderUser(`task:${c}`), member.id);
        assert.equal(
          (await patch(owner, c, { status: "completed" })).status,
          200,
        );
        assert.equal(await reminderUser(`task:${c}`), undefined);
      },
    );
    await t.test(
      "HU3.4.1 Solo el creador o un administrador cambian el estado; el responsable no",
      async () => {
        assert.equal(
          (await patch(member, a, { status: "completed" })).status,
          403,
        );
        assert.equal((await patch(member, a, { title: "Cambio" })).status, 403);
        assert.equal(
          (await patch(owner, a, { status: "in_progress" })).status,
          200,
        );
      },
    );
    await t.test(
      "HU3.4.2 Sin responsable, cualquiera la empieza o completa, pero no la edita ni la reabre",
      async () => {
        const d = (await create(owner, { title: "Limpiar la nevera" })).json
          .data.id;
        for (const [body, expected] of [
          [{ title: "Cambio sin permiso" }, 403],
          [{ status: "in_progress", priority: "high" }, 403],
          [{ status: "in_progress" }, 200],
          [{ status: "pending" }, 403],
          [{ status: "completed" }, 200],
          [{ status: "in_progress" }, 403],
        ] as const)
          assert.equal((await patch(member, d, body)).status, expected);
        assert.equal((await member.call(`/tasks/${d}`, "DELETE")).status, 403);
        const task = await detail(member, d);
        assert.equal(task.history[0].actor, "Prueba member");
        // El creador recibe el aviso de que otra persona la completó.
        assert(
          (await notices(owner, homeId)).some(
            (n) => n.title === "Tarea completada" && n.href === `/tareas/${d}`,
          ),
        );
        // Completada hace más de 30 días: sale del tablero, pero sigue en su página.
        await pool.query(
          "UPDATE tasks SET completed_at=now()-interval '31 days' WHERE id=$1",
          [d],
        );
        assert(
          !(await member.call(url)).json.data.some((x: Task) => x.id === d),
        );
        assert.equal((await member.call(`/tasks/${d}`)).status, 200);
      },
    );
    await t.test(
      "HU3.5.1 Cada cambio de estado queda en el historial con su autor y estado previo",
      async () => {
        assert.equal(
          (await patch(owner, a, { status: "completed" })).status,
          200,
        );
        const task = await detail(member, a);
        assert.deepEqual(
          task.history.map((h) => [h.previous_status, h.new_status]),
          [
            ["in_progress", "completed"],
            ["pending", "in_progress"],
            [null, "pending"],
          ],
        );
        assert(task.history.every((h) => h.actor === "Prueba owner"));
      },
    );
    await t.test(
      "HU3.5.2 La fecha de cumplimiento se guarda al completar y se borra al reabrir",
      async () => {
        assert((await detail(owner, a)).completed_at);
        assert.equal(
          (await patch(owner, a, { status: "pending" })).status,
          200,
        );
        assert.equal((await detail(owner, a)).completed_at, null);
        assert.equal((await detail(owner, a)).history.length, 4);
      },
    );
    await t.test(
      "HU3.5.3 Inicio cuenta las tareas abiertas asignadas a cada persona",
      async () => {
        const pending = async (person: BrowserSession) =>
          (await person.call(`/homes/${homeId}/dashboard`)).json.data.summary;
        const mine = await pending(member);
        assert.equal(mine.pendingTasks, 1);
        assert.equal(mine.tasks[0].href, `/tareas/${a}`);
        assert.equal((await pending(owner)).pendingTasks, 1);
      },
    );
    await t.test(
      "HU3.6.1 Editar actualiza los datos y queda en la actividad del hogar",
      async () => {
        assert.equal(
          (
            await patch(owner, a, {
              title: "Sacar la basura y reciclar",
              priority: "low",
            })
          ).status,
          200,
        );
        const task = (await detail(member, a)) as Task & {
          title: string;
          priority: string;
        };
        assert.equal(task.title, "Sacar la basura y reciclar");
        assert.equal(task.priority, "low");
        const activity = await pool.query(
          "SELECT id FROM activities WHERE home_id=$1 AND message=$2",
          [homeId, 'actualizó la tarea "Sacar la basura y reciclar"'],
        );
        assert.equal(activity.rowCount, 1);
      },
    );
    await t.test(
      "HU3.6.2 Eliminar: solo creador o administrador; borra historial y recordatorio",
      async () => {
        assert.equal((await member.call(`/tasks/${a}`, "DELETE")).status, 403);
        assert.equal((await owner.call(`/tasks/${a}`, "DELETE")).status, 200);
        assert.equal((await owner.call(`/tasks/${a}`)).status, 404);
        const history = await pool.query(
          "SELECT id FROM task_history WHERE task_id=$1",
          [a],
        );
        assert.equal(history.rowCount, 0);
        assert.equal(await reminderUser(`task:${a}`), undefined);
      },
    );
    await t.test(
      "HU3.6.3 El tablero indica a cada persona qué tareas puede editar",
      async () => {
        const own = (await create(member, { title: "Comprar jabón" })).json.data
          .id;
        const list = (await member.call(url)).json.data as (Task & {
          created_by: string;
        })[];
        assert.equal(list.find((x) => x.id === own)?.can_edit, true);
        assert(
          list
            .filter((x) => x.created_by === owner.id)
            .every((x) => !x.can_edit),
        );
        assert(
          (await owner.call(url)).json.data.every((x: Task) => x.can_edit),
        );
      },
    );
  } finally {
    await cleanup(Object.values(people), [homeId]);
  }
});
