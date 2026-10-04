import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { pool, transaction } from "../src/server/db";
import { askAssistant } from "../src/lib/assistant";
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
interface Acceptance {
  user_id: string;
  accepted_at: string | null;
}
test("Acuerdos: versiones, aceptaciones y asistente simulado", async (t) => {
  const suffix = randomUUID().slice(0, 8);
  const emails: string[] = [];
  const homeIds: string[] = [];
  const ids: string[] = [];
  const owner = new BrowserSession(),
    member = new BrowserSession(),
    outsider = new BrowserSession();
  const password = "PruebaRoomie2026!";
  let homeId = "";
  const rules = async (client: BrowserSession) =>
    (await client.call(`/rules?homeId=${homeId}`)).json.data;
  const publish = (client: BrowserSession, content: string) =>
    client.call(`/rules?homeId=${homeId}`, "POST", { content, notes: "" });
  const accepted = (data: { acceptances: Acceptance[] }, userId: string) =>
    Boolean(data.acceptances.find((a) => a.user_id === userId)?.accepted_at);
  try {
    for (const [client, label] of [
      [owner, "owner"],
      [member, "member"],
      [outsider, "outside"],
    ] as const) {
      const email = `test-${suffix}-rules-${label}@roomie.test`;
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
        name: "Acuerdos de prueba",
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
    await t.test("solo los administradores publican versiones", async () => {
      assert.equal((await rules(member)).current, null);
      assert.equal(
        (await outsider.call(`/rules?homeId=${homeId}`)).status,
        403,
      );
      assert.equal(
        (await publish(member, "Acuerdo de un integrante")).status,
        403,
      );
      assert.equal((await publish(owner, "Corto")).status, 400);
      const created = await publish(owner, "Silencio desde las 10 p. m.");
      assert.equal(created.status, 200);
      assert.equal(created.json.data.version, 1);
      assert.equal(
        (await publish(owner, "Silencio desde las 10 p. m.")).status,
        409,
      );
      const data = await rules(member);
      assert.equal(data.current.version, 1);
      assert.equal(data.accepted_by_me, false);
      assert.equal(accepted(data, ids[0]), true);
      assert.equal(accepted(data, ids[1]), false);
      assert(
        (await member.call(`/notifications?homeId=${homeId}`)).json.data.some(
          (n: { title: string }) => n.title === "Nuevo reglamento",
        ),
      );
    });
    await t.test("aceptar la versión vigente una sola vez", async () => {
      const first = (await rules(member)).current.id;
      assert.equal(
        (await outsider.call(`/rules/${first}/accept`, "POST", {})).status,
        403,
      );
      const accept = await member.call(`/rules/${first}/accept`, "POST", {});
      assert.equal(accept.status, 200);
      assert.equal(accept.json.data.message, "Aceptaste el reglamento.");
      assert.equal(
        (await member.call(`/rules/${first}/accept`, "POST", {})).json.data
          .message,
        "Ya habías aceptado esta versión.",
      );
      assert.equal((await rules(member)).accepted_by_me, true);
      assert.equal(
        (
          await publish(
            owner,
            "Silencio desde las 10 p. m.\n\nVisitas avisadas.",
          )
        ).status,
        200,
      );
      const data = await rules(member);
      assert.equal(data.current.version, 2);
      assert.equal(data.history.length, 1);
      assert.equal(data.accepted_by_me, false);
      assert.equal(
        (await member.call(`/rules/${first}/accept`, "POST", {})).status,
        409,
      );
      assert.equal(
        (await member.call(`/rules/${data.current.id}/accept`, "POST", {}))
          .status,
        200,
      );
    });
    await t.test("publicaciones simultáneas no repiten versión", async () => {
      const details = (await owner.call(`/homes/${homeId}`)).json.data;
      const memberMembership = details.members.find(
        (m: { id: string }) => m.id === ids[1],
      ).membership_id;
      await owner.call(
        `/homes/${homeId}/members/${memberMembership}`,
        "PATCH",
        {
          role: "admin",
        },
      );
      const results = await Promise.all([
        publish(owner, "Versión simultánea del administrador original."),
        publish(member, "Versión simultánea del nuevo administrador."),
      ]);
      assert.deepEqual(
        results.map((r) => r.status),
        [200, 200],
      );
      assert.deepEqual(results.map((r) => r.json.data.version).sort(), [3, 4]);
    });
    await t.test(
      "el asistente simulado responde según la petición",
      async () => {
        const visits = await askAssistant("Reglas para las visitas", "");
        assert.match(visits.text, /visitas/);
        assert(visits.clauses.some((c) => c.includes("visita")));
        const review = await askAssistant(
          "Revisa mi borrador",
          "La basura se saca los lunes. Silencio después de las 10.",
        );
        assert.match(review.text, /^Revisé tu borrador/);
        assert(!review.text.includes("limpieza"));
      },
    );
  } finally {
    await transaction(async (db) => {
      for (const home of homeIds) {
        await db.query("DELETE FROM rule_versions WHERE home_id=$1", [home]);
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
