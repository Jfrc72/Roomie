import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { pool, transaction } from "../src/server/db";
import { scheduleReminder, notify } from "../src/server/notifications";
const origin = process.env.APP_URL || "http://localhost:3000";
class BrowserSession {
  cookie = "";
  async call(
    path: string,
    method = "GET",
    body?: unknown,
    customOrigin = origin,
  ) {
    const response = await fetch(`${origin}/api${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        Origin: customOrigin,
        Cookie: this.cookie,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const cookie = response.headers.get("set-cookie");
    if (cookie) this.cookie = cookie.split(";")[0];
    return { status: response.status, json: await response.json(), cookie };
  }
}
test("Base completa: acceso, hogares, invitaciones, permisos y avisos", async (t) => {
  const suffix = randomUUID().slice(0, 8);
  const emails: string[] = [];
  const homeIds: string[] = [];
  const ids: string[] = [];
  const owner = new BrowserSession(),
    member = new BrowserSession(),
    outsider = new BrowserSession();
  const password = "PruebaRoomie2026!";
  let homeId = "",
    membershipId = "";
  try {
    await t.test(
      "sin sesión no se leen datos; origen ajeno rechazado",
      async () => {
        assert.equal((await owner.call("/session")).status, 401);
        assert.equal(
          (
            await owner.call(
              "/auth/login",
              "POST",
              { email: "a@b.com", password },
              "https://otro.example",
            )
          ).status,
          403,
        );
      },
    );
    for (const [client, label] of [
      [owner, "owner"],
      [member, "member"],
      [outsider, "outside"],
    ] as const) {
      const email = `test-${suffix}-${label}@roomie.test`;
      emails.push(email);
      const response = await client.call("/auth/register", "POST", {
        name: `Prueba ${label}`,
        email,
        password,
      });
      assert.equal(response.status, 200);
      assert.match(response.cookie!, /HttpOnly/i);
      const session = await client.call("/session");
      ids.push(session.json.data.user.id);
      assert(!JSON.stringify(session.json).includes("password_hash"));
    }
    await t.test("crear hogar, persistencia y acceso aislado", async () => {
      const response = await owner.call("/homes", "POST", {
        name: "Hogar de prueba",
        address: "Bogotá",
        description: "Integración",
      });
      assert.equal(response.status, 200);
      homeId = response.json.data.id;
      homeIds.push(homeId);
      assert.equal(
        (await owner.call("/session")).json.data.activeHomeId,
        homeId,
      );
      assert.equal((await outsider.call(`/homes/${homeId}`)).status, 403);
      assert.equal(
        (await outsider.call(`/homes/${homeId}/select`, "POST", {})).status,
        403,
      );
      const afterLogin = new BrowserSession();
      assert.equal(
        (
          await afterLogin.call("/auth/login", "POST", {
            email: emails[0],
            password,
          })
        ).status,
        200,
      );
      assert.equal(
        (await afterLogin.call(`/homes/${homeId}`)).json.data.name,
        "Hogar de prueba",
      );
      assert.equal(
        (
          await owner.call("/homes", "POST", {
            name: "",
            address: "",
            description: "",
          })
        ).status,
        400,
      );
    });
    await t.test(
      "invitación por correo, uso único y permisos de integrante",
      async () => {
        const invitation = await owner.call(
          `/homes/${homeId}/invitations`,
          "POST",
          { email: emails[1] },
        );
        assert.equal(invitation.status, 200);
        const token = new URL(invitation.json.data.url).searchParams.get(
          "token",
        );
        assert.equal(
          (await outsider.call("/invitations", "POST", { token })).status,
          403,
        );
        assert.equal(
          (await member.call("/invitations", "POST", { token })).status,
          200,
        );
        assert.equal(
          (await member.call("/invitations", "POST", { token })).status,
          409,
        );
        assert.equal(
          (
            await member.call(`/homes/${homeId}`, "PATCH", {
              name: "No permitido",
              address: "",
              description: "",
            })
          ).status,
          403,
        );
        assert.equal(
          (
            await member.call(`/homes/${homeId}/invitations`, "POST", {
              email: "otra@roomie.test",
            })
          ).status,
          403,
        );
        const details = (await owner.call(`/homes/${homeId}`)).json.data;
        membershipId = details.members.find(
          (m: { id: string }) => m.id === ids[1],
        ).membership_id;
      },
    );
    await t.test(
      "el último administrador no puede retirarse ni degradarse",
      async () => {
        const details = (await owner.call(`/homes/${homeId}`)).json.data;
        const mine = details.members.find(
          (m: { id: string }) => m.id === ids[0],
        ).membership_id;
        assert.equal(
          (await owner.call(`/homes/${homeId}/members/${mine}`, "DELETE"))
            .status,
          409,
        );
        assert.equal(
          (
            await owner.call(`/homes/${homeId}/members/${mine}`, "PATCH", {
              role: "member",
            })
          ).status,
          409,
        );
      },
    );
    await t.test("roles y notificaciones sincronizadas", async () => {
      assert.equal(
        (
          await owner.call(
            `/homes/${homeId}/members/${membershipId}`,
            "PATCH",
            { role: "admin" },
          )
        ).status,
        200,
      );
      assert.equal(
        (
          await member.call(`/homes/${homeId}`, "PATCH", {
            name: "Nombre compartido",
            address: "Bogotá",
            description: "Editado por otro admin",
          })
        ).status,
        200,
      );
      const list = (await member.call(`/notifications?homeId=${homeId}`)).json
        .data;
      assert(list.some((n: { title: string }) => n.title === "Tu rol cambió"));
      assert.equal(
        (
          await member.call(`/notifications/${list[0].id}`, "PATCH", {
            read: true,
          })
        ).status,
        200,
      );
      assert(
        (await member.call(`/notifications?homeId=${homeId}`)).json.data[0]
          .read_at,
      );
      assert.equal(
        (
          await outsider.call(`/notifications/${list[0].id}`, "PATCH", {
            read: true,
          })
        ).status,
        404,
      );
    });
    await t.test(
      "recordatorios vencidos generan un aviso, sin duplicarlo",
      async () => {
        process.env.WORKER_TEST = "1";
        const { tick } = await import("../scripts/worker");
        await transaction(async (db) => {
          await scheduleReminder(db, {
            homeId,
            userId: ids[1],
            sourceKey: `test:${suffix}`,
            title: "Recordatorio de prueba",
            message: "Tarea de prueba",
            href: "/tareas",
            dueAt: new Date(Date.now() - 60000),
          });
        });
        await tick();
        await tick();
        const rows = await pool.query(
          "SELECT id FROM notifications WHERE user_id=$1 AND title=$2",
          [ids[1], "Recordatorio de prueba"],
        );
        assert.equal(rows.rowCount, 1);
        await transaction(async (db) => {
          await notify(db, {
            homeId,
            userId: ids[2],
            title: "No autorizado",
            message: "No debe llegar",
            href: "/",
          });
        });
        assert.equal(
          (
            await pool.query(
              "SELECT id FROM notifications WHERE user_id=$1 AND title='No autorizado'",
              [ids[2]],
            )
          ).rowCount,
          0,
        );
      },
    );
    await t.test(
      "revocación de invitación y baja inmediata de acceso",
      async () => {
        const invite = await owner.call(
          `/homes/${homeId}/invitations`,
          "POST",
          { email: emails[2] },
        );
        const token = new URL(invite.json.data.url).searchParams.get("token");
        const list = (await owner.call(`/homes/${homeId}/invitations`)).json
          .data;
        const id = list.find(
          (i: { email: string }) => i.email === emails[2],
        ).id;
        assert.equal(
          (await owner.call(`/homes/${homeId}/invitations/${id}`, "DELETE"))
            .status,
          200,
        );
        assert.equal(
          (await outsider.call("/invitations", "POST", { token })).status,
          409,
        );
        assert.equal(
          (
            await owner.call(
              `/homes/${homeId}/members/${membershipId}`,
              "DELETE",
            )
          ).status,
          200,
        );
        assert.equal((await member.call(`/homes/${homeId}`)).status, 403);
        assert.equal(
          (await member.call(`/notifications?homeId=${homeId}`)).status,
          403,
        );
      },
    );
    await t.test(
      "invitaciones simultáneas no superan ocho integrantes",
      async () => {
        const home = (
          await owner.call("/homes", "POST", {
            name: "Capacidad de prueba",
            address: "",
            description: "",
          })
        ).json.data.id;
        homeIds.push(home);
        for (let i = 0; i < 6; i++) {
          const email = `test-${suffix}-capacity-${i}@roomie.test`;
          emails.push(email);
          const row = await pool.query(
            "INSERT INTO users(name,email,password_hash) SELECT $1,$2,password_hash FROM users WHERE id=$3 RETURNING id",
            ["Capacidad", email, ids[0]],
          );
          await pool.query(
            "INSERT INTO memberships(home_id,user_id,role) VALUES($1,$2,'member')",
            [home, row.rows[0].id],
          );
        }
        const first = await owner.call(`/homes/${home}/invitations`, "POST", {
          email: emails[1],
        });
        const second = await owner.call(`/homes/${home}/invitations`, "POST", {
          email: emails[2],
        });
        const results = await Promise.all([
          member.call("/invitations", "POST", {
            token: new URL(first.json.data.url).searchParams.get("token"),
          }),
          outsider.call("/invitations", "POST", {
            token: new URL(second.json.data.url).searchParams.get("token"),
          }),
        ]);
        assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
        assert.equal(
          (await owner.call(`/homes/${home}`)).json.data.members.length,
          8,
        );
      },
    );
    await t.test("cambiar contraseña revoca las otras sesiones", async () => {
      const other = new BrowserSession();
      await other.call("/auth/login", "POST", { email: emails[0], password });
      const result = await owner.call("/auth/password", "PATCH", {
        current: password,
        password: "OtraPrueba2026!",
      });
      assert.equal(result.status, 200);
      assert.equal((await other.call("/session")).status, 401);
      assert.equal((await owner.call("/session")).status, 200);
      assert.equal(
        (
          await other.call("/auth/login", "POST", {
            email: emails[0],
            password,
          })
        ).status,
        401,
      );
    });
    await t.test("cierre de sesión invalida la cookie anterior", async () => {
      const old = owner.cookie;
      await owner.call("/auth/logout", "POST", {});
      owner.cookie = old;
      assert.equal((await owner.call("/session")).status, 401);
    });
  } finally {
    await transaction(async (db) => {
      for (const home of homeIds) {
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
