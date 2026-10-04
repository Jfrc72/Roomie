import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { pool, transaction } from "../src/server/db";
const origin = process.env.APP_URL || "http://localhost:3000";
class BrowserSession {
  cookie = "";
  async call(path: string, method = "GET", body?: unknown) {
    const response = await fetch(`${origin}/api${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        Origin: origin,
        Cookie: this.cookie,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const cookie = response.headers.get("set-cookie");
    if (cookie) this.cookie = cookie.split(";")[0];
    return { status: response.status, json: await response.json() };
  }
}
interface Row {
  id: string;
  title: string;
  href: string;
  new_status: string;
  membership_id: string;
}
test("Tareas: permisos, estados, historial, avisos e Inicio", async (t) => {
  const suffix = randomUUID().slice(0, 8);
  const emails: string[] = [];
  const homeIds: string[] = [];
  const ids: string[] = [];
  const owner = new BrowserSession(),
    member = new BrowserSession(),
    outsider = new BrowserSession();
  const password = "PruebaRoomie2026!";
  const future = new Date(Date.now() + 2 * 86400000).toISOString();
  let homeId = "",
    ownerMembership = "",
    memberMembership = "",
    taskId = "",
    ownTaskId = "";
  const reminderUser = async (id: string) =>
    (
      await pool.query("SELECT user_id FROM reminders WHERE source_key=$1", [
        `task:${id}`,
      ])
    ).rows[0]?.user_id;
  try {
    for (const [client, label] of [
      [owner, "owner"],
      [member, "member"],
      [outsider, "outside"],
    ] as const) {
      const email = `test-${suffix}-tasks-${label}@roomie.test`;
      emails.push(email);
      const response = await client.call("/auth/register", "POST", {
        name: `Prueba ${label}`,
        email,
        password,
      });
      assert.equal(response.status, 200);
      ids.push((await client.call("/session")).json.data.user.id);
    }
    homeId = (
      await owner.call("/homes", "POST", {
        name: "Tareas de prueba",
        address: "",
        description: "",
      })
    ).json.data.id;
    homeIds.push(homeId);
    const invitation = await owner.call(
      `/homes/${homeId}/invitations`,
      "POST",
      {
        email: emails[1],
      },
    );
    assert.equal(
      (
        await member.call("/invitations", "POST", {
          token: new URL(invitation.json.data.url).searchParams.get("token"),
        })
      ).status,
      200,
    );
    const members = (await owner.call(`/homes/${homeId}`)).json.data.members;
    ownerMembership = members.find((m: Row) => m.id === ids[0]).membership_id;
    memberMembership = members.find((m: Row) => m.id === ids[1]).membership_id;
    await t.test(
      "crear valida datos, responsable y pertenencia al hogar",
      async () => {
        const base = {
          title: "Sacar la basura",
          description: "Lunes y jueves",
          assigned_membership_id: memberMembership,
          due_at: future,
          priority: "high",
        };
        const url = `/tasks?homeId=${homeId}`;
        assert.equal((await outsider.call(url)).status, 403);
        assert.equal((await outsider.call(url, "POST", base)).status, 403);
        for (const invalid of [
          { title: "" },
          { priority: "urgente" },
          { due_at: "mañana" },
          { due_at: new Date(Date.now() - 86400000).toISOString() },
          { assigned_membership_id: randomUUID() },
        ])
          assert.equal(
            (await owner.call(url, "POST", { ...base, ...invalid })).status,
            400,
          );
        const created = await owner.call(url, "POST", base);
        assert.equal(created.status, 200);
        taskId = created.json.data.id;
        const task = (await member.call(url)).json.data.find(
          (x: Row) => x.id === taskId,
        );
        assert.equal(task.status, "pending");
        assert.equal(task.assignee, "Prueba member");
        assert.equal(task.can_edit, false);
        const notices = (await member.call(`/notifications?homeId=${homeId}`))
          .json.data;
        assert(
          notices.some(
            (n: Row) =>
              n.title === "Nueva tarea asignada" &&
              n.href === `/tareas/${taskId}`,
          ),
        );
        assert.equal(await reminderUser(taskId), ids[1]);
      },
    );
    await t.test(
      "solo el creador o un administrador la modifican",
      async () => {
        const url = `/tasks?homeId=${homeId}`;
        ownTaskId = (
          await owner.call(url, "POST", {
            title: "Pagar el internet",
            description: "",
            assigned_membership_id: ownerMembership,
            due_at: null,
            priority: "medium",
          })
        ).json.data.id;
        // Ser responsable no permite cambiar el estado, editar ni eliminar la tarea.
        for (const [path, method, body] of [
          [`/tasks/${taskId}`, "PATCH", { status: "completed" }],
          [`/tasks/${taskId}`, "PATCH", { title: "Cambio del responsable" }],
          [`/tasks/${taskId}`, "DELETE", undefined],
          [`/tasks/${ownTaskId}`, "PATCH", { status: "completed" }],
          [`/tasks/${ownTaskId}`, "DELETE", undefined],
        ] as const)
          assert.equal((await member.call(path, method, body)).status, 403);
        assert.equal((await outsider.call(`/tasks/${ownTaskId}`)).status, 403);
        assert.equal(
          (await outsider.call(`/tasks/${taskId}`, "PATCH", { title: "Ajena" }))
            .status,
          403,
        );
        assert.equal((await member.call(`/tasks/${randomUUID()}`)).status, 404);
        const memberTaskId = (
          await member.call(url, "POST", {
            title: "Comprar jabón",
            description: "",
            assigned_membership_id: null,
            due_at: null,
            priority: "low",
          })
        ).json.data.id;
        assert.equal(
          (
            await member.call(`/tasks/${memberTaskId}`, "PATCH", {
              priority: "high",
            })
          ).status,
          200,
        );
        assert.equal(
          (
            await owner.call(`/tasks/${memberTaskId}`, "PATCH", {
              status: "completed",
            })
          ).status,
          200,
        );
        assert(
          (await member.call(`/notifications?homeId=${homeId}`)).json.data.some(
            (n: Row) => n.title === "Tarea completada",
          ),
        );
        // Sin responsable, cualquiera la empieza o completa, pero no la edita ni la reabre.
        const openTaskId = (
          await owner.call(url, "POST", {
            title: "Limpiar la nevera",
            description: "",
            assigned_membership_id: null,
            due_at: null,
            priority: "medium",
          })
        ).json.data.id;
        for (const [body, expected] of [
          [{ title: "Cambio sin permiso" }, 403],
          [{ status: "in_progress", priority: "high" }, 403],
          [{ status: "in_progress" }, 200],
          [{ status: "pending" }, 403],
          [{ status: "completed" }, 200],
          [{ status: "in_progress" }, 403],
        ] as const)
          assert.equal(
            (await member.call(`/tasks/${openTaskId}`, "PATCH", body)).status,
            expected,
          );
        assert.equal(
          (await member.call(`/tasks/${openTaskId}`, "DELETE")).status,
          403,
        );
        const open = (await member.call(`/tasks/${openTaskId}`)).json.data;
        assert.equal(open.assigned_membership_id, null);
        assert.equal(open.history[0].actor, "Prueba member");
        assert(
          (await owner.call(`/notifications?homeId=${homeId}`)).json.data.some(
            (n: Row) =>
              n.title === "Tarea completada" &&
              n.href === `/tareas/${openTaskId}`,
          ),
        );
        assert.equal(
          (
            await owner.call(`/tasks/${taskId}`, "PATCH", {
              status: "archived",
            })
          ).status,
          400,
        );
      },
    );
    await t.test("Inicio cuenta las tareas abiertas asignadas", async () => {
      const summary = (await member.call(`/homes/${homeId}/dashboard`)).json
        .data.summary;
      assert.equal(summary.pendingTasks, 1);
      assert.equal(summary.tasks[0].href, `/tareas/${taskId}`);
      assert.equal(
        (await owner.call(`/homes/${homeId}/dashboard`)).json.data.summary
          .pendingTasks,
        1,
      );
    });
    await t.test("los cambios de estado quedan en el historial", async () => {
      for (const status of ["in_progress", "completed"])
        assert.equal(
          (await owner.call(`/tasks/${taskId}`, "PATCH", { status })).status,
          200,
        );
      const detail = (await member.call(`/tasks/${taskId}`)).json.data;
      assert.equal(detail.status, "completed");
      assert(detail.completed_at);
      assert.deepEqual(
        detail.history.map((h: Row) => h.new_status),
        ["completed", "in_progress", "pending"],
      );
      assert.equal(detail.history[0].previous_status, "in_progress");
      assert.equal(detail.history[0].actor, "Prueba owner");
      assert.equal(await reminderUser(taskId), undefined);
      assert.equal(
        (await member.call(`/homes/${homeId}/dashboard`)).json.data.summary
          .pendingTasks,
        0,
      );
    });
    await t.test("reasignar solo a integrantes activos", async () => {
      assert.equal(
        (
          await owner.call(`/tasks/${ownTaskId}`, "PATCH", {
            assigned_membership_id: memberMembership,
            due_at: future,
          })
        ).status,
        200,
      );
      assert.equal(await reminderUser(ownTaskId), ids[1]);
      assert.equal(
        (
          await owner.call(
            `/homes/${homeId}/members/${memberMembership}`,
            "DELETE",
          )
        ).status,
        200,
      );
      assert.equal((await member.call(`/tasks?homeId=${homeId}`)).status, 403);
      assert.equal(
        (await owner.call(`/tasks/${ownTaskId}`)).json.data.assignee_active,
        false,
      );
      // Editar otros datos conserva al responsable anterior en el historial.
      assert.equal(
        (
          await owner.call(`/tasks/${ownTaskId}`, "PATCH", {
            title: "Pagar internet y luz",
            assigned_membership_id: memberMembership,
          })
        ).status,
        200,
      );
      assert.equal(
        (
          await owner.call(`/tasks/${ownTaskId}`, "PATCH", {
            assigned_membership_id: ownerMembership,
          })
        ).status,
        200,
      );
      assert.equal(await reminderUser(ownTaskId), ids[0]);
      assert.equal(
        (
          await owner.call(`/tasks/${ownTaskId}`, "PATCH", {
            assigned_membership_id: memberMembership,
          })
        ).status,
        400,
      );
    });
    await t.test(
      "eliminar borra la tarea, su historial y su recordatorio",
      async () => {
        assert.equal(
          (await owner.call(`/tasks/${ownTaskId}`, "DELETE")).status,
          200,
        );
        assert.equal((await owner.call(`/tasks/${ownTaskId}`)).status, 404);
        assert.equal(
          (
            await pool.query("SELECT id FROM task_history WHERE task_id=$1", [
              ownTaskId,
            ])
          ).rowCount,
          0,
        );
        assert.equal(await reminderUser(ownTaskId), undefined);
      },
    );
  } finally {
    await transaction(async (db) => {
      for (const home of homeIds) {
        await db.query("DELETE FROM tasks WHERE home_id=$1", [home]);
        await db.query(
          "DELETE FROM deliveries WHERE notification_id IN (SELECT id FROM notifications WHERE home_id=$1)",
          [home],
        );
        for (const table of [
          "notifications",
          "reminders",
          "activities",
          "invitations",
        ])
          await db.query(`DELETE FROM ${table} WHERE home_id=$1`, [home]);
        await db.query(
          "UPDATE sessions SET active_home_id=null WHERE active_home_id=$1",
          [home],
        );
        await db.query("DELETE FROM memberships WHERE home_id=$1", [home]);
        await db.query("DELETE FROM homes WHERE id=$1", [home]);
      }
      for (const email of emails) {
        await db.query("DELETE FROM users WHERE email=$1", [email]);
        await db.query("DELETE FROM login_attempts WHERE email=$1", [email]);
      }
    });
    await pool.end();
  }
});
