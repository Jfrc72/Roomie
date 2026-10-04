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
}
// Mañana a las 15:00 UTC más `hours`: siempre en el futuro.
const base = new Date(Date.now() + 86400000);
base.setUTCHours(15, 0, 0, 0);
const at = (hours: number) =>
  new Date(base.getTime() + hours * 3600000).toISOString();
test("Reservas: recursos, cruces, cancelación, avisos e Inicio", async (t) => {
  const suffix = randomUUID().slice(0, 8);
  const emails: string[] = [];
  const homeIds: string[] = [];
  const ids: string[] = [];
  const owner = new BrowserSession(),
    member = new BrowserSession(),
    outsider = new BrowserSession();
  const password = "PruebaRoomie2026!";
  let homeId = "",
    washer = "",
    memberReservation = "";
  const reserve = (client: BrowserSession, from: number, to: number) =>
    client.call(`/reservations?homeId=${homeId}`, "POST", {
      resource_id: washer,
      starts_at: at(from),
      ends_at: at(to),
    });
  const reminderUser = async (id: string) =>
    (
      await pool.query("SELECT user_id FROM reminders WHERE source_key=$1", [
        `reservation:${id}`,
      ])
    ).rows[0]?.user_id;
  try {
    for (const [client, label] of [
      [owner, "owner"],
      [member, "member"],
      [outsider, "outside"],
    ] as const) {
      const email = `test-${suffix}-reservations-${label}@roomie.test`;
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
        name: "Reservas de prueba",
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
    await t.test("solo los administradores gestionan recursos", async () => {
      const url = `/resources?homeId=${homeId}`;
      const data = { name: "Lavadora", description: "En el patio" };
      assert.equal((await member.call(url, "POST", data)).status, 403);
      assert.equal((await outsider.call(url)).status, 403);
      assert.equal(
        (await owner.call(url, "POST", { ...data, name: "" })).status,
        400,
      );
      const created = await owner.call(url, "POST", data);
      assert.equal(created.status, 200);
      washer = created.json.data.id;
      assert.equal(
        (await owner.call(url, "POST", { ...data, name: "lavadora" })).status,
        409,
      );
      assert.equal(
        (
          await member.call(`/resources/${washer}`, "PATCH", {
            name: "Mía",
            description: "",
          })
        ).status,
        403,
      );
      assert.equal(
        (await member.call(`/resources/${washer}`, "DELETE")).status,
        403,
      );
      assert.deepEqual(
        (await member.call(url)).json.data.map((r: Row) => r.id),
        [washer],
      );
    });
    await t.test("validar fechas, recurso y pertenencia", async () => {
      const url = `/reservations?homeId=${homeId}`;
      const valid = { resource_id: washer, starts_at: at(0), ends_at: at(1) };
      assert.equal((await outsider.call(url)).status, 403);
      assert.equal((await outsider.call(url, "POST", valid)).status, 403);
      for (const invalid of [
        { ends_at: at(-1) },
        { ends_at: at(0) },
        { starts_at: new Date(Date.now() - 3600000).toISOString() },
        { ends_at: at(24 * 8) },
        { starts_at: "mañana" },
        { resource_id: randomUUID() },
      ])
        assert.equal(
          (await member.call(url, "POST", { ...valid, ...invalid })).status,
          400,
        );
    });
    await t.test("impedir cruces, también simultáneos", async () => {
      const created = await reserve(member, 0, 1);
      assert.equal(created.status, 200);
      memberReservation = created.json.data.id;
      assert.equal((await reserve(owner, 0.5, 1.5)).status, 409);
      assert.equal((await reserve(owner, -1, 3)).status, 409);
      // Las reservas consecutivas no se cruzan.
      assert.equal((await reserve(owner, 1, 2)).status, 200);
      const results = await Promise.all([
        reserve(member, 4, 5),
        reserve(owner, 4.5, 5.5),
      ]);
      assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
      assert.equal(await reminderUser(memberReservation), ids[1]);
      const list = (await member.call(`/reservations?homeId=${homeId}`)).json
        .data;
      assert.equal(list.length, 3);
      const mine = list.find((r: Row) => r.id === memberReservation);
      assert.equal(mine.resource, "Lavadora");
      assert.equal(mine.can_cancel, true);
      assert.equal(
        list.filter((r: { can_cancel: boolean }) => r.can_cancel).length,
        list.filter((r: { user_id: string }) => r.user_id === ids[1]).length,
      );
      const summary = (await member.call(`/homes/${homeId}/dashboard`)).json
        .data.summary;
      assert.match(summary.nextReservation, /^Lavadora · /);
    });
    await t.test("cancelar libera el horario y avisa", async () => {
      const ownerReservation = (
        await member.call(`/reservations?homeId=${homeId}`)
      ).json.data.find((r: { user_id: string }) => r.user_id === ids[0]).id;
      assert.equal(
        (await member.call(`/reservations/${ownerReservation}`, "DELETE"))
          .status,
        403,
      );
      assert.equal(
        (await outsider.call(`/reservations/${memberReservation}`, "DELETE"))
          .status,
        403,
      );
      assert.equal(
        (await owner.call(`/reservations/${memberReservation}`, "DELETE"))
          .status,
        200,
      );
      assert.equal(
        (await owner.call(`/reservations/${memberReservation}`, "DELETE"))
          .status,
        409,
      );
      assert.equal(await reminderUser(memberReservation), undefined);
      assert(
        (await member.call(`/notifications?homeId=${homeId}`)).json.data.some(
          (n: Row) => n.title === "Reserva cancelada" && n.href === "/reservas",
        ),
      );
      assert.equal((await reserve(owner, 0, 1)).status, 200);
    });
    await t.test("retirar un recurso exige que no tenga reservas", async () => {
      assert.equal(
        (await owner.call(`/resources/${washer}`, "DELETE")).status,
        409,
      );
      for (const r of (await owner.call(`/reservations?homeId=${homeId}`)).json
        .data)
        assert.equal(
          (await owner.call(`/reservations/${r.id}`, "DELETE")).status,
          200,
        );
      assert.equal(
        (await owner.call(`/resources/${washer}`, "DELETE")).status,
        200,
      );
      assert.deepEqual(
        (await owner.call(`/resources?homeId=${homeId}`)).json.data,
        [],
      );
      assert.equal((await reserve(member, 8, 9)).status, 400);
      assert.equal(
        (await member.call(`/homes/${homeId}/dashboard`)).json.data.summary
          .nextReservation,
        null,
      );
    });
  } finally {
    await transaction(async (db) => {
      for (const home of homeIds) {
        await db.query("DELETE FROM reservations WHERE home_id=$1", [home]);
        await db.query("DELETE FROM resources WHERE home_id=$1", [home]);
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
