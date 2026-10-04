import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { pool, transaction } from "../src/server/db";
import { closeExpiredPolls } from "../src/server/polls";
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
interface Option {
  id: string;
  label: string;
  votes: number | null;
  voters: string[] | null;
}
interface PollRow {
  id: string;
  title: string;
  message: string;
  status: string;
  options: Option[];
  voters: number;
  eligible: number;
  my_option_id: string | null;
  can_close: boolean;
}
test("Votaciones: permisos, anonimato, cierre y recuento", async (t) => {
  const suffix = randomUUID().slice(0, 8);
  const emails: string[] = [];
  const homeIds: string[] = [];
  const ids: string[] = [];
  const owner = new BrowserSession(),
    member = new BrowserSession(),
    leaver = new BrowserSession(),
    outsider = new BrowserSession();
  const password = "PruebaRoomie2026!";
  let homeId = "",
    pollId = "";
  const list = async (client: BrowserSession) =>
    (await client.call(`/polls?homeId=${homeId}`)).json.data as PollRow[];
  const find = async (client: BrowserSession, id: string) =>
    (await list(client)).find((p) => p.id === id)!;
  const create = (client: BrowserSession, body: object) =>
    client.call(`/polls?homeId=${homeId}`, "POST", {
      title: "¿De qué color pintamos la sala?",
      description: "",
      anonymous: false,
      closes_at: null,
      options: ["Azul", "Verde"],
      ...body,
    });
  const vote = (client: BrowserSession, id: string, option: Option) =>
    client.call(`/polls/${id}/votes`, "POST", { option_id: option.id });
  try {
    for (const [client, label] of [
      [owner, "owner"],
      [member, "member"],
      [leaver, "leaver"],
      [outsider, "outside"],
    ] as const) {
      const email = `test-${suffix}-polls-${label}@roomie.test`;
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
        name: "Votaciones de prueba",
        address: "",
        description: "",
      })
    ).json.data.id;
    homeIds.push(homeId);
    for (const [client, email] of [
      [member, emails[1]],
      [leaver, emails[2]],
    ] as const) {
      const invitation = await owner.call(
        `/homes/${homeId}/invitations`,
        "POST",
        { email },
      );
      assert.equal(
        (
          await client.call("/invitations", "POST", {
            token: new URL(invitation.json.data.url).searchParams.get("token"),
          })
        ).status,
        200,
      );
    }
    await t.test("cualquier integrante abre votaciones válidas", async () => {
      assert.equal(
        (await outsider.call(`/polls?homeId=${homeId}`)).status,
        403,
      );
      assert.equal((await create(outsider, {})).status, 403);
      for (const invalid of [
        { title: "" },
        { options: ["Solo una"] },
        { options: ["Azul", "azul "] },
        { options: Array.from({ length: 11 }, (_, i) => `Opción ${i}`) },
        { closes_at: new Date(Date.now() - 60000).toISOString() },
      ])
        assert.equal((await create(member, invalid)).status, 400);
      const created = await create(member, {
        options: ["Azul", "Verde", "Blanco"],
      });
      assert.equal(created.status, 200);
      pollId = created.json.data.id;
      assert(
        (await owner.call(`/notifications?homeId=${homeId}`)).json.data.some(
          (n: PollRow) => n.title === "Nueva votación",
        ),
      );
    });
    await t.test("votar, cambiar el voto y ocultar recuentos", async () => {
      const poll = await find(member, pollId);
      const [blue, green] = poll.options;
      assert.deepEqual(
        poll.options.map((o) => o.label),
        ["Azul", "Verde", "Blanco"],
      );
      assert.equal((await vote(owner, pollId, blue)).status, 200);
      assert.equal((await vote(member, pollId, green)).status, 200);
      assert.equal((await vote(member, pollId, blue)).status, 200);
      assert.equal((await vote(leaver, pollId, green)).status, 200);
      assert.equal((await vote(outsider, pollId, blue)).status, 403);
      assert.equal(
        (
          await member.call(`/polls/${pollId}/votes`, "POST", {
            option_id: randomUUID(),
          })
        ).status,
        400,
      );
      const open = await find(member, pollId);
      assert.equal(open.voters, 3);
      assert.equal(open.eligible, 3);
      assert.equal(open.my_option_id, blue.id);
      assert.equal(open.can_close, true);
      assert(open.options.every((o) => o.votes === null && o.voters === null));
      assert.equal((await find(leaver, pollId)).can_close, false);
      assert.equal(
        (await leaver.call(`/polls/${pollId}/close`, "POST", {})).status,
        403,
      );
    });
    await t.test("al cerrar solo cuentan los integrantes activos", async () => {
      const details = (await owner.call(`/homes/${homeId}`)).json.data;
      const leaverMembership = details.members.find(
        (m: { id: string }) => m.id === ids[2],
      ).membership_id;
      assert.equal(
        (
          await owner.call(
            `/homes/${homeId}/members/${leaverMembership}`,
            "DELETE",
          )
        ).status,
        200,
      );
      assert.equal(
        (await member.call(`/polls/${pollId}/close`, "POST", {})).status,
        200,
      );
      assert.equal(
        (await member.call(`/polls/${pollId}/close`, "POST", {})).status,
        409,
      );
      const closed = await find(owner, pollId);
      assert.equal(closed.status, "closed");
      assert.equal(closed.voters, 2);
      assert.equal(closed.eligible, 2);
      assert.deepEqual(
        closed.options.map((o) => [o.label, o.votes, o.voters]),
        [
          ["Azul", 2, ["Prueba member", "Prueba owner"]],
          ["Verde", 0, []],
          ["Blanco", 0, []],
        ],
      );
      assert.equal((await vote(owner, pollId, closed.options[1])).status, 409);
      assert(
        (await owner.call(`/notifications?homeId=${homeId}`)).json.data.some(
          (n: PollRow) =>
            n.title === "Votación cerrada" && n.message.includes('ganó "Azul"'),
        ),
      );
    });
    await t.test("las anónimas nunca exponen quién votó qué", async () => {
      const id = (await create(owner, { title: "¿Mascota?", anonymous: true }))
        .json.data.id;
      const [yes, no] = (await find(owner, id)).options;
      assert.equal((await vote(owner, id, yes)).status, 200);
      assert.equal((await vote(member, id, no)).status, 200);
      assert.equal(
        (await owner.call(`/polls/${id}/close`, "POST", {})).status,
        200,
      );
      const closed = await find(member, id);
      assert.deepEqual(
        closed.options.map((o) => [o.votes, o.voters]),
        [
          [1, null],
          [1, null],
        ],
      );
      assert.deepEqual(Object.keys(closed.options[0]).sort(), [
        "id",
        "label",
        "voters",
        "votes",
      ]);
      assert(
        (await member.call(`/notifications?homeId=${homeId}`)).json.data.some(
          (n: PollRow) => n.message.includes("empate entre 2 opciones"),
        ),
      );
    });
    await t.test("se cierran solas al llegar la fecha", async () => {
      const id = (
        await create(member, {
          title: "¿Cena el viernes?",
          closes_at: new Date(Date.now() + 3600000).toISOString(),
        })
      ).json.data.id;
      const [first] = (await find(member, id)).options;
      assert.equal((await vote(member, id, first)).status, 200);
      await pool.query(
        "UPDATE polls SET closes_at=now()-interval '1 second' WHERE id=$1",
        [id],
      );
      assert.equal((await vote(owner, id, first)).status, 409);
      await closeExpiredPolls(homeId);
      const closed = await find(owner, id);
      assert.equal(closed.status, "closed");
      assert.equal(closed.options[0].votes, 1);
      const activity = await pool.query(
        "SELECT actor_id FROM activities WHERE home_id=$1 AND message=$2",
        [homeId, 'cerró la votación "¿Cena el viernes?"'],
      );
      assert.equal(activity.rows[0].actor_id, null);
    });
  } finally {
    await transaction(async (db) => {
      for (const home of homeIds) {
        await db.query("DELETE FROM polls WHERE home_id=$1", [home]);
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
