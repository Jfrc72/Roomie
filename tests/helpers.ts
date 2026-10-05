// Utilidades compartidas por las pruebas de integración: sesiones con cookie, hogares de prueba
// y limpieza de todo lo creado. Requieren `npm run dev` abierto.
import { randomUUID } from "node:crypto";
import { pool, transaction } from "../src/server/db";

export const origin = process.env.APP_URL || "http://localhost:3000";
export const password = "PruebaRoomie2026!";

// Simula un navegador: guarda la cookie de sesión y envía el Origin que exige la API.
export class BrowserSession {
  cookie = "";
  id = "";
  email = "";
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

// Registra una persona por etiqueta; el correo lleva un sufijo único para no chocar entre archivos.
export async function register(prefix: string, labels: string[]) {
  const suffix = randomUUID().slice(0, 8);
  const people: Record<string, BrowserSession> = {};
  for (const label of labels) {
    const person = new BrowserSession();
    person.email = `test-${suffix}-${prefix}-${label}@roomie.test`;
    const response = await person.call("/auth/register", "POST", {
      name: `Prueba ${label}`,
      email: person.email,
      password,
    });
    if (response.status !== 200) throw Error(`No se pudo registrar ${label}`);
    person.id = (await person.call("/session")).json.data.user.id;
    people[label] = person;
  }
  return people;
}

// Crea un hogar administrado por `owner` e invita y acepta a las demás personas.
export async function createHome(
  owner: BrowserSession,
  name: string,
  invitees: BrowserSession[] = [],
) {
  const homeId = (
    await owner.call("/homes", "POST", { name, address: "", description: "" })
  ).json.data.id as string;
  for (const person of invitees) {
    const invitation = await owner.call(
      `/homes/${homeId}/invitations`,
      "POST",
      {
        email: person.email,
      },
    );
    const token = new URL(invitation.json.data.url).searchParams.get("token");
    const accepted = await person.call("/invitations", "POST", { token });
    if (accepted.status !== 200)
      throw Error("No se pudo aceptar la invitación");
  }
  return homeId;
}

// Id de membresía de cada persona en el hogar (lo usan responsables y retiros).
export async function memberships(owner: BrowserSession, homeId: string) {
  const members = (await owner.call(`/homes/${homeId}`)).json.data.members as {
    id: string;
    membership_id: string;
  }[];
  return (person: BrowserSession) =>
    members.find((m) => m.id === person.id)!.membership_id;
}

export const notices = async (person: BrowserSession, homeId: string) =>
  (await person.call(`/notifications?homeId=${homeId}`)).json.data as {
    title: string;
    message: string;
    href: string;
  }[];

export const reminderUser = async (sourceKey: string) =>
  (
    await pool.query("SELECT user_id FROM reminders WHERE source_key=$1", [
      sourceKey,
    ])
  ).rows[0]?.user_id as string | undefined;

// Borra los hogares y las personas creadas, empezando por las tablas de los módulos.
export async function cleanup(people: BrowserSession[], homeIds: string[]) {
  await transaction(async (db) => {
    for (const home of homeIds) {
      await db.query(
        "DELETE FROM deliveries WHERE notification_id IN (SELECT id FROM notifications WHERE home_id=$1)",
        [home],
      );
      for (const table of [
        "rule_reports",
        "rule_versions",
        "polls",
        "reservations",
        "resources",
        "tasks",
        "expenses",
        "direct_payments",
        "shopping_items",
        "maintenance_reports",
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
    for (const person of people) {
      await db.query("DELETE FROM users WHERE email=$1", [person.email]);
      await db.query("DELETE FROM login_attempts WHERE email=$1", [
        person.email,
      ]);
    }
  });
  await pool.end();
}
