// Pruebas de integración de Votaciones (F8), organizadas por historia de usuario. Ver docs/HISTORIAS.md.
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { pool } from "../src/server/db";
import { closeExpiredPolls } from "../src/server/polls";
import {
  cleanup,
  createHome,
  memberships,
  notices,
  register,
  type BrowserSession,
} from "./helpers";

interface Option {
  id: string;
  label: string;
  votes: number | null;
  voters: string[] | null;
}
interface Poll {
  id: string;
  rule: string;
  status: string;
  closed_at: string | null;
  options: Option[];
  my_option_id: string | null;
  voters: number;
  eligible: number;
  can_close: boolean;
}
test("Votaciones: historias HU8.1 a HU8.5", async (t) => {
  const people = await register("polls", [
    "owner",
    "member",
    "leaver",
    "outside",
  ]);
  const { owner, member, leaver, outside } = people;
  const homeId = await createHome(owner, "Votaciones de prueba", [
    member,
    leaver,
  ]);
  const membership = await memberships(owner, homeId);
  const url = `/polls?homeId=${homeId}`;
  const create = (person: BrowserSession, body: object) =>
    person.call(url, "POST", {
      title: "¿De qué color pintamos la sala?",
      description: "",
      anonymous: false,
      closes_at: null,
      options: ["Azul", "Verde", "Blanco"],
      ...body,
    });
  const list = async (person: BrowserSession) =>
    (await person.call(url)).json.data as Poll[];
  const find = async (person: BrowserSession, id: string) =>
    (await list(person)).find((p) => p.id === id)!;
  const vote = (person: BrowserSession, id: string, option: Option) =>
    person.call(`/polls/${id}/votes`, "POST", { option_id: option.id });
  const close = (person: BrowserSession, id: string) =>
    person.call(`/polls/${id}/close`, "POST", {});
  let main = "";
  try {
    await t.test(
      "HU8.1.1 Cualquier integrante abre una votación y se avisa a los demás",
      async () => {
        const created = await create(member, {});
        assert.equal(created.status, 200);
        main = created.json.data.id;
        assert.deepEqual(
          (await find(owner, main)).options.map((o) => o.label),
          ["Azul", "Verde", "Blanco"],
        );
        assert(
          (await notices(owner, homeId)).some(
            (n) => n.title === "Nueva votación",
          ),
        );
      },
    );
    await t.test(
      "HU8.1.2 Validar de 2 a 10 opciones distintas y un cierre en el futuro",
      async () => {
        for (const invalid of [
          { title: "" },
          { options: ["Solo una"] },
          { options: ["Azul", "azul "] },
          { options: Array.from({ length: 11 }, (_, i) => `Opción ${i}`) },
          { closes_at: new Date(Date.now() - 60000).toISOString() },
        ])
          assert.equal((await create(member, invalid)).status, 400);
      },
    );
    await t.test(
      "HU8.1.3 Las personas de fuera no ven ni abren votaciones",
      async () => {
        assert.equal((await outside.call(url)).status, 403);
        assert.equal((await create(outside, {})).status, 403);
      },
    );
    await t.test(
      "HU8.2.4 La regla se guarda (mayoría simple por defecto) y el resultado la aplica",
      async () => {
        assert.equal((await find(owner, main)).rule, "simple");
        assert.equal((await create(owner, { rule: "mayoria" })).status, 400);
        // Vota cada integrante (owner, member, leaver), cierra y devuelve el aviso del resultado.
        const decide = async (title: string, votes: number[]) => {
          const id = (
            await create(owner, {
              title,
              rule: "unanimous",
              options: ["Sí", "No"],
            })
          ).json.data.id;
          const poll = await find(owner, id);
          assert.equal(poll.rule, "unanimous");
          for (const [i, person] of [owner, member, leaver].entries())
            await vote(person, id, poll.options[votes[i]]);
          await close(owner, id);
          return (await notices(member, homeId)).find((n) =>
            n.message.startsWith(`"${title}"`),
          )?.message;
        };
        assert.equal(
          await decide("¿Pintamos de blanco?", [0, 0, 0]),
          '"¿Pintamos de blanco?": ganó "Sí" por unanimidad.',
        );
        assert.equal(
          await decide("¿Compramos un sofá?", [0, 1, 0]),
          '"¿Compramos un sofá?": no hubo unanimidad.',
        );
      },
    );
    await t.test(
      "HU8.3.1 Votar y cambiar el voto mientras la votación está abierta",
      async () => {
        const [blue, green] = (await find(member, main)).options;
        assert.equal((await vote(owner, main, blue)).status, 200);
        assert.equal((await vote(member, main, green)).status, 200);
        assert.equal((await vote(member, main, blue)).status, 200);
        assert.equal((await vote(leaver, main, green)).status, 200);
        assert.equal((await vote(outside, main, blue)).status, 403);
        assert.equal(
          (
            await member.call(`/polls/${main}/votes`, "POST", {
              option_id: randomUUID(),
            })
          ).status,
          400,
        );
      },
    );
    await t.test(
      "HU8.3.2 Mientras está abierta se ve la participación, no los recuentos",
      async () => {
        const open = await find(member, main);
        assert.equal(open.voters, 3);
        assert.equal(open.eligible, 3);
        assert.equal(open.my_option_id, open.options[0].id);
        assert(
          open.options.every((o) => o.votes === null && o.voters === null),
        );
        assert.equal(open.can_close, true);
        assert.equal((await find(leaver, main)).can_close, false);
      },
    );
    await t.test(
      "HU8.3.3 En las votaciones anónimas nunca se expone quién votó qué",
      async () => {
        const id = (
          await create(owner, {
            title: "¿Mascota?",
            anonymous: true,
            options: ["Sí", "No"],
          })
        ).json.data.id;
        const [yes, no] = (await find(owner, id)).options;
        await vote(owner, id, yes);
        await vote(member, id, no);
        await close(owner, id);
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
      },
    );
    await t.test(
      "HU8.4.1 Solo quien la creó o un administrador la cierran; luego no se vota",
      async () => {
        const id = (await create(member, { title: "¿Cena el viernes?" })).json
          .data.id;
        assert.equal((await close(leaver, id)).status, 403);
        assert.equal((await close(outside, id)).status, 403);
        assert.equal((await close(owner, id)).status, 200);
        assert.equal((await close(owner, id)).status, 409);
        assert.equal(
          (await vote(member, id, (await find(member, id)).options[0])).status,
          409,
        );
      },
    );
    await t.test(
      "HU8.4.2 Al cerrar solo cuentan los integrantes activos; el resto es abstención",
      async () => {
        await owner.call(
          `/homes/${homeId}/members/${membership(leaver)}`,
          "DELETE",
        );
        assert.equal((await close(member, main)).status, 200);
        const closed = await find(owner, main);
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
      },
    );
    await t.test(
      "HU8.4.3 Una votación se cierra sola al llegar su fecha",
      async () => {
        const id = (
          await create(member, {
            title: "¿Pizza?",
            closes_at: new Date(Date.now() + 3600000).toISOString(),
          })
        ).json.data.id;
        await vote(member, id, (await find(member, id)).options[0]);
        await pool.query(
          "UPDATE polls SET closes_at=now()-interval '1 second' WHERE id=$1",
          [id],
        );
        assert.equal(
          (await vote(owner, id, (await find(owner, id)).options[0])).status,
          409,
        );
        await closeExpiredPolls(homeId);
        assert.equal((await find(owner, id)).status, "closed");
        const activity = await pool.query(
          "SELECT actor_id FROM activities WHERE home_id=$1 AND message=$2",
          [homeId, 'cerró la votación "¿Pizza?"'],
        );
        assert.equal(activity.rows[0].actor_id, null);
      },
    );
    await t.test(
      "HU8.5.1 Las votaciones cerradas quedan como historial con su resultado",
      async () => {
        const closed = (await list(member)).filter(
          (p) => p.status === "closed",
        );
        assert(closed.length >= 5);
        assert(
          closed.every(
            (p) =>
              p.closed_at &&
              p.options.every((o) => typeof o.votes === "number"),
          ),
        );
      },
    );
    await t.test(
      "HU8.5.2 Primero las abiertas y luego las cerradas, de la más reciente a la más antigua",
      async () => {
        const open = (await create(owner, { title: "¿Película del sábado?" }))
          .json.data.id;
        const all = await list(member);
        assert.equal(all[0].id, open);
        const closedAt = all
          .filter((p) => p.status === "closed")
          .map((p) => Date.parse(p.closed_at!));
        assert.deepEqual(
          closedAt,
          [...closedAt].sort((x, y) => y - x),
        );
      },
    );
    await t.test(
      "HU8.5.3 Al cerrar se avisa el resultado a los integrantes",
      async () => {
        assert(
          (await notices(owner, homeId)).some(
            (n) =>
              n.title === "Votación cerrada" &&
              n.message === '"¿De qué color pintamos la sala?": ganó "Azul".',
          ),
        );
      },
    );
  } finally {
    await cleanup(Object.values(people), [homeId]);
  }
});
