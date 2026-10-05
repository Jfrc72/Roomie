// Pruebas de integración de Reservas (F5), organizadas por historia de usuario. Ver docs/HISTORIAS.md.
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  cleanup,
  createHome,
  notices,
  register,
  reminderUser,
  type BrowserSession,
} from "./helpers";

interface Reservation {
  id: string;
  user_id: string;
  resource: string;
  can_cancel: boolean;
}
// Mañana a las 15:00 UTC más `hours`: siempre en el futuro.
const base = new Date(Date.now() + 86400000);
base.setUTCHours(15, 0, 0, 0);
const at = (hours: number) =>
  new Date(base.getTime() + hours * 3600000).toISOString();
test("Reservas: historias HU5.1 a HU5.4", async (t) => {
  const people = await register("reservations", ["owner", "member", "outside"]);
  const { owner, member, outside } = people;
  const homeId = await createHome(owner, "Reservas de prueba", [member]);
  const resources = `/resources?homeId=${homeId}`;
  const reservations = `/reservations?homeId=${homeId}`;
  let washer = "";
  let mine = "";
  const reserve = (
    person: BrowserSession,
    from: number,
    to: number,
    resource = washer,
  ) =>
    person.call(reservations, "POST", {
      resource_id: resource,
      starts_at: at(from),
      ends_at: at(to),
    });
  const list = async (person: BrowserSession, query = "") =>
    (await person.call(`${reservations}${query}`)).json.data as Reservation[];
  try {
    await t.test(
      "HU5.1.1 Solo los administradores agregan recursos",
      async () => {
        const data = { name: "Lavadora", description: "En el patio" };
        assert.equal((await member.call(resources, "POST", data)).status, 403);
        assert.equal((await outside.call(resources)).status, 403);
        const created = await owner.call(resources, "POST", data);
        assert.equal(created.status, 200);
        washer = created.json.data.id;
        assert.deepEqual(
          (await member.call(resources)).json.data.map(
            (r: { id: string }) => r.id,
          ),
          [washer],
        );
      },
    );
    await t.test(
      "HU5.1.2 El nombre es obligatorio y único entre los recursos activos",
      async () => {
        assert.equal(
          (await owner.call(resources, "POST", { name: "", description: "" }))
            .status,
          400,
        );
        assert.equal(
          (
            await owner.call(resources, "POST", {
              name: "lavadora",
              description: "",
            })
          ).status,
          409,
        );
      },
    );
    await t.test(
      "HU5.1.3 Editar y retirar recursos; no se retira uno con reservas próximas",
      async () => {
        const room = (
          await owner.call(resources, "POST", { name: "Sala", description: "" })
        ).json.data.id;
        const edit = { name: "Sala de estudio", description: "Segundo piso" };
        assert.equal(
          (await member.call(`/resources/${room}`, "PATCH", edit)).status,
          403,
        );
        assert.equal(
          (await owner.call(`/resources/${room}`, "PATCH", edit)).status,
          200,
        );
        const booked = (await reserve(member, 10, 11, room)).json.data.id;
        assert.equal(
          (await member.call(`/resources/${room}`, "DELETE")).status,
          403,
        );
        assert.equal(
          (await owner.call(`/resources/${room}`, "DELETE")).status,
          409,
        );
        await owner.call(`/reservations/${booked}`, "DELETE");
        assert.equal(
          (await owner.call(`/resources/${room}`, "DELETE")).status,
          200,
        );
        assert(
          !(await owner.call(resources)).json.data.some(
            (r: { id: string }) => r.id === room,
          ),
        );
        assert.equal((await reserve(member, 12, 13, room)).status, 400);
      },
    );
    await t.test(
      "HU5.2.1 Reservar crea la reserva, su recordatorio y la próxima reserva de Inicio",
      async () => {
        const created = await reserve(member, 0, 1);
        assert.equal(created.status, 200);
        mine = created.json.data.id;
        assert.equal(await reminderUser(`reservation:${mine}`), member.id);
        const summary = (await member.call(`/homes/${homeId}/dashboard`)).json
          .data.summary;
        assert.match(summary.nextReservation, /^Lavadora · /);
      },
    );
    await t.test(
      "HU5.2.2 Rechazar fechas inválidas, recursos ajenos y personas de fuera",
      async () => {
        const valid = {
          resource_id: washer,
          starts_at: at(20),
          ends_at: at(21),
        };
        for (const invalid of [
          { ends_at: at(19) },
          { ends_at: at(20) },
          { starts_at: new Date(Date.now() - 3600000).toISOString() },
          { ends_at: at(20 + 24 * 8) },
          { starts_at: "mañana" },
          { resource_id: randomUUID() },
        ])
          assert.equal(
            (await member.call(reservations, "POST", { ...valid, ...invalid }))
              .status,
            400,
          );
        assert.equal(
          (await outside.call(reservations, "POST", valid)).status,
          403,
        );
      },
    );
    await t.test(
      "HU5.2.3 Impedir cruces, también simultáneos, y permitir reservas consecutivas",
      async () => {
        assert.equal((await reserve(owner, 0.5, 1.5)).status, 409);
        assert.equal((await reserve(owner, -1, 3)).status, 409);
        assert.equal((await reserve(owner, 1, 2)).status, 200);
        const results = await Promise.all([
          reserve(member, 4, 5),
          reserve(owner, 4.5, 5.5),
        ]);
        assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
      },
    );
    await t.test(
      "HU5.3.1 El calendario trae las reservas que se cruzan con la semana pedida",
      async () => {
        const range = (from: number, to: number) =>
          `&from=${encodeURIComponent(at(from))}&to=${encodeURIComponent(at(to))}`;
        assert.equal((await list(member, range(-24, 24))).length, 3);
        assert.equal((await list(member, range(48, 72))).length, 0);
        // Una reserva que empieza antes del rango también aparece.
        assert.equal((await list(member, range(0.5, 24))).length, 3);
        assert.equal((await list(member)).length, 3);
      },
    );
    await t.test(
      "HU5.3.2 Rechazar rangos invertidos, de más de 31 días o con fechas inválidas",
      async () => {
        for (const query of [
          `&from=${encodeURIComponent(at(24))}&to=${encodeURIComponent(at(-24))}`,
          `&from=${encodeURIComponent(at(0))}&to=${encodeURIComponent(at(40 * 24))}`,
          `&from=ayer&to=${encodeURIComponent(at(0))}`,
        ])
          assert.equal(
            (await member.call(`${reservations}${query}`)).status,
            400,
          );
      },
    );
    await t.test(
      "HU5.4.1 Cancelan quien reservó o un administrador; otro integrante no",
      async () => {
        const owners = (await list(member)).find(
          (r) => r.user_id === owner.id,
        )!;
        assert.equal(owners.can_cancel, false);
        assert.equal(
          (await member.call(`/reservations/${owners.id}`, "DELETE")).status,
          403,
        );
        assert.equal(
          (await outside.call(`/reservations/${mine}`, "DELETE")).status,
          403,
        );
        assert((await list(owner)).every((r) => r.can_cancel));
      },
    );
    await t.test(
      "HU5.4.2 Cancelar libera el horario y su recordatorio; no se cancela dos veces",
      async () => {
        assert.equal(
          (await member.call(`/reservations/${mine}`, "DELETE")).status,
          200,
        );
        assert.equal(
          (await member.call(`/reservations/${mine}`, "DELETE")).status,
          409,
        );
        assert.equal(await reminderUser(`reservation:${mine}`), undefined);
        assert.equal((await reserve(owner, 0, 1)).status, 200);
      },
    );
    await t.test(
      "HU5.4.3 Si un administrador cancela una reserva ajena, avisa a su dueño",
      async () => {
        const theirs = (await reserve(member, 6, 7)).json.data.id;
        assert.equal(
          (await owner.call(`/reservations/${theirs}`, "DELETE")).status,
          200,
        );
        assert(
          (await notices(member, homeId)).some(
            (n) => n.title === "Reserva cancelada" && n.href === "/reservas",
          ),
        );
      },
    );
  } finally {
    await cleanup(Object.values(people), [homeId]);
  }
});
