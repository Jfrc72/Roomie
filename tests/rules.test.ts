// Pruebas de integración de Acuerdos (F9), organizadas por historia de usuario. Ver docs/HISTORIAS.md.
// La HU9.5 (asistente con IA simulada) se prueba en tests/unit/acuerdos.test.ts.
import test from "node:test";
import assert from "node:assert/strict";
import {
  cleanup,
  createHome,
  memberships,
  notices,
  register,
  type BrowserSession,
} from "./helpers";

interface Version {
  id: string;
  version: number;
  notes: string;
  author: string;
}
interface Rules {
  current: Version | null;
  accepted_by_me: boolean;
  acceptances: { user_id: string; accepted_at: string | null }[];
  history: Version[];
  reports: {
    reporter: string;
    reported: string | null;
    resolved_at: string | null;
  }[];
}
test("Acuerdos: historias HU9.1 a HU9.4", async (t) => {
  const people = await register("rules", [
    "owner",
    "member",
    "beto",
    "outside",
  ]);
  const { owner, member, beto, outside } = people;
  const homeId = await createHome(owner, "Acuerdos de prueba", [member, beto]);
  const homeIds = [homeId];
  const membership = await memberships(owner, homeId);
  const url = `/rules?homeId=${homeId}`;
  const reports = `/rules/reports?homeId=${homeId}`;
  const rules = async (person: BrowserSession) =>
    (await person.call(url)).json.data as Rules;
  const publish = (person: BrowserSession, content: string, notes = "") =>
    person.call(url, "POST", { content, notes });
  const accept = (person: BrowserSession, id: string) =>
    person.call(`/rules/${id}/accept`, "POST", {});
  const accepted = (data: Rules, person: BrowserSession) =>
    Boolean(data.acceptances.find((a) => a.user_id === person.id)?.accepted_at);
  const content =
    "Silencio desde las 10 p. m.\n\nCada persona lava su loza\nel mismo día.";
  const clause = "Cada persona lava su loza el mismo día.";
  let first = "";
  try {
    await t.test(
      "HU9.1.1 Solo los administradores publican versiones del reglamento",
      async () => {
        assert.equal((await rules(member)).current, null);
        assert.equal(
          (await publish(member, "Acuerdo de un integrante")).status,
          403,
        );
        const created = await publish(owner, "Silencio desde las 10 p. m.");
        assert.equal(created.status, 200);
        assert.equal(created.json.data.version, 1);
        first = created.json.data.id;
      },
    );
    await t.test(
      "HU9.1.2 El texto debe tener al menos 10 caracteres y ser distinto del vigente",
      async () => {
        assert.equal((await publish(owner, "Corto")).status, 400);
        assert.equal(
          (await publish(owner, "Silencio desde las 10 p. m.")).status,
          409,
        );
      },
    );
    await t.test(
      "HU9.1.3 Las versiones se numeran sin repetirse, también si se publican a la vez",
      async () => {
        await owner.call(
          `/homes/${homeId}/members/${membership(member)}`,
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
        assert.deepEqual(
          results.map((r) => r.json.data.version).sort(),
          [2, 3],
        );
      },
    );
    await t.test(
      "HU9.2.1 Cada integrante acepta la versión vigente una sola vez",
      async () => {
        const current = (await rules(beto)).current!;
        const response = await accept(beto, current.id);
        assert.equal(response.json.data.message, "Aceptaste el reglamento.");
        assert.equal(
          (await accept(beto, current.id)).json.data.message,
          "Ya habías aceptado esta versión.",
        );
        assert.equal((await rules(beto)).accepted_by_me, true);
      },
    );
    await t.test(
      "HU9.2.2 Una versión nueva exige aceptar de nuevo y las antiguas no se aceptan",
      async () => {
        const previous = (await rules(beto)).current!;
        assert.equal(
          (await publish(owner, content, "Agrega la loza")).status,
          200,
        );
        const data = await rules(beto);
        assert.equal(data.accepted_by_me, false);
        assert.equal((await accept(beto, previous.id)).status, 409);
        assert.equal((await accept(beto, first)).status, 409);
        assert.equal((await accept(beto, data.current!.id)).status, 200);
      },
    );
    await t.test(
      "HU9.2.3 Todos ven quién aceptó; quien publica acepta y los demás reciben aviso",
      async () => {
        const data = await rules(member);
        assert.equal(accepted(data, owner), true);
        assert.equal(accepted(data, beto), true);
        assert.equal(accepted(data, member), false);
        assert(
          (await notices(beto, homeId)).some(
            (n) => n.title === "Nuevo reglamento",
          ),
        );
      },
    );
    await t.test(
      "HU9.3.1 El historial guarda las versiones anteriores con autor y cambios",
      async () => {
        const data = await rules(beto);
        assert.equal(data.current!.notes, "Agrega la loza");
        assert.equal(data.current!.author, "Prueba owner");
        assert.equal(data.history.length, 3);
        assert(data.history.every((v) => v.author.startsWith("Prueba ")));
      },
    );
    await t.test(
      "HU9.3.2 La versión vigente es siempre la más reciente",
      async () => {
        const data = await rules(beto);
        assert.equal(data.current!.version, 4);
        assert.deepEqual(
          data.history.map((v) => v.version),
          [3, 2, 1],
        );
      },
    );
    await t.test(
      "HU9.3.3 Las personas de fuera no ven ni aceptan el reglamento",
      async () => {
        assert.equal((await outside.call(url)).status, 403);
        assert.equal(
          (await accept(outside, (await rules(beto)).current!.id)).status,
          403,
        );
      },
    );
    await t.test(
      "HU9.4.1 Reportar un incumplimiento avisa a los administradores y a la persona señalada",
      async () => {
        const response = await beto.call(reports, "POST", {
          clause,
          description: "La loza quedó sucia toda la noche",
          reported_membership_id: membership(member),
        });
        assert.equal(response.status, 200);
        const message = (person: BrowserSession) =>
          notices(person, homeId).then(
            (list) =>
              list.find((n) => n.title === "Incumplimiento reportado")?.message,
          );
        assert.equal(
          await message(owner),
          `Prueba beto reportó un incumplimiento de Prueba member: "${clause}"`,
        );
        assert.equal(
          await message(member),
          `Prueba beto reportó que no cumpliste: "${clause}"`,
        );
      },
    );
    await t.test(
      "HU9.4.2 Rechazar acuerdos inexistentes, autorreportes y hogares sin reglamento",
      async () => {
        const report = (body: object, path = reports) =>
          beto.call(path, "POST", {
            clause,
            description: "",
            reported_membership_id: null,
            ...body,
          });
        assert.equal(
          (await report({ clause: "Nadie paga el arriendo" })).status,
          400,
        );
        assert.equal(
          (await report({ reported_membership_id: membership(beto) })).status,
          400,
        );
        const empty = await createHome(beto, "Sin reglamento");
        homeIds.push(empty);
        assert.equal(
          (await report({}, `/rules/reports?homeId=${empty}`)).status,
          409,
        );
      },
    );
    await t.test(
      "HU9.4.3 Solo un administrador resuelve el reporte y se avisa a quien lo hizo",
      async () => {
        const [pending] = (await beto.call(url)).json.data.reports as {
          id: string;
        }[];
        const resolve = (person: BrowserSession) =>
          person.call(`/rules/reports/${pending.id}/resolve`, "POST", {});
        assert.equal((await resolve(beto)).status, 403);
        assert.equal((await resolve(owner)).status, 200);
        assert.equal((await resolve(owner)).status, 409);
        const [resolved] = (await rules(beto)).reports;
        assert(resolved.resolved_at);
        assert.equal(resolved.reporter, "Prueba beto");
        assert.equal(resolved.reported, "Prueba member");
        assert(
          (await notices(beto, homeId)).some(
            (n) => n.title === "Incumplimiento resuelto",
          ),
        );
      },
    );
  } finally {
    await cleanup(Object.values(people), homeIds);
  }
});
