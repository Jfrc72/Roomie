import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { pool, transaction } from "../src/server/db";

const origin = process.env.APP_URL || "http://localhost:3000";
type Reply<T> = { data: T; error?: string };
type Member = { id: string; name: string; membership_id: string };
type ExpenseData = {
  expenses: {
    id: string;
    title: string;
    paid_by: string;
    total_amount: number;
    user_status: string | null;
    shares: { user_id: string; amount: number; status: string }[];
  }[];
  summary: { total_month: number; your_share: number; you_are_owed: number; you_owe: number };
  balances: { owes_me: { amount: number }[]; i_owe: { amount: number }[] };
};
type ShoppingItem = {
  id: string;
  title: string;
  quantity: number;
  estimated_price: number;
  status: string;
  bought_by: string | null;
  bought_by_name: string | null;
  assigned_to: string | null;
};
type MaintenanceData = {
  reports: { id: string; status: string; category: string; priority: string; assigned_to: string | null }[];
  counts: { pending: number; in_progress: number; resolved: number };
};

class BrowserSession {
  cookie = "";
  async call<T = unknown>(path: string, method = "GET", body?: unknown) {
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
    return {
      status: response.status,
      json: (await response.json()) as Reply<T>,
    };
  }
}

test("Gastos, compras y mantenimiento: nueve historias de usuario", async (t) => {
  const suffix = randomUUID().slice(0, 8);
  const clients = {
    owner: new BrowserSession(),
    member: new BrowserSession(),
    outsider: new BrowserSession(),
  };
  const emails: string[] = [];
  const userIds: string[] = [];
  let homeId = "";
  let ownerId = "";
  let memberId = "";
  let ownerMembership = "";
  let memberMembership = "";
  let expenseId = "";
  let itemId = "";
  let reportId = "";
  const password = "PruebaRoomie2026!";
  const date = new Date().toISOString().slice(0, 10);

  try {
    for (const [label, client] of Object.entries(clients)) {
      const email = `test-${suffix}-modules-${label}@roomie.test`;
      emails.push(email);
      const registered = await client.call<{ id: string }>("/auth/register", "POST", {
        name: `Prueba ${label}`,
        email,
        password,
      });
      assert.equal(registered.status, 200);
      const session = await client.call<{ user: { id: string } }>("/session");
      userIds.push(session.json.data.user.id);
    }
    ownerId = userIds[0];
    memberId = userIds[1];
    const createdHome = await clients.owner.call<{ id: string }>("/homes", "POST", {
      name: "Módulos de prueba",
      address: "",
      description: "",
    });
    assert.equal(createdHome.status, 200);
    homeId = createdHome.json.data.id;
    const invitation = await clients.owner.call<{ url: string }>(
      `/homes/${homeId}/invitations`,
      "POST",
      { email: emails[1] },
    );
    assert.equal(invitation.status, 200);
    const accepted = await clients.member.call(`/invitations`, "POST", {
      token: new URL(invitation.json.data.url).searchParams.get("token"),
    });
    assert.equal(accepted.status, 200);
    const home = await clients.owner.call<{ members: Member[] }>(`/homes/${homeId}`);
    ownerMembership = home.json.data.members.find((member) => member.id === ownerId)!.membership_id;
    memberMembership = home.json.data.members.find((member) => member.id === memberId)!.membership_id;

    await t.test("HU1.1.1 Registrar gasto con división exacta", async () => {
      const response = await clients.owner.call<{ id: string }>(`/expenses?homeId=${homeId}`, "POST", {
        title: "Mercado inicial",
        category: "Mercado",
        paid_by_id: ownerId,
        total_amount: 100.01,
        expense_date: date,
        participant_ids: [ownerId, memberId],
      });
      assert.equal(response.status, 200);
      expenseId = response.json.data.id;
    });
    await t.test("HU1.1.2 Crear las cuotas de todos los participantes", async () => {
      const list = await clients.owner.call<ExpenseData>(`/expenses?homeId=${homeId}`);
      const expense = list.json.data.expenses.find((row) => row.id === expenseId)!;
      assert.equal(expense.shares.length, 2);
      assert.equal(Math.round(expense.shares.reduce((total, share) => total + share.amount, 0) * 100), 10001);
      assert.equal(expense.shares.find((share) => share.user_id === ownerId)?.status, "PAGADO");
    });
    await t.test("HU1.1.3 Rechazar montos inválidos y participantes ajenos", async () => {
      const invalid = await clients.owner.call(`/expenses?homeId=${homeId}`, "POST", {
        title: "Monto cero",
        category: "Varios",
        total_amount: 0,
        expense_date: date,
        participant_ids: [ownerId],
      });
      const overPrecision = await clients.owner.call(`/expenses?homeId=${homeId}`, "POST", {
        title: "Fracciones de centavo",
        category: "Varios",
        total_amount: 1.005,
        expense_date: date,
        participant_ids: [ownerId],
      });
      const outsider = await clients.outsider.call(`/expenses?homeId=${homeId}`);
      assert.equal(invalid.status, 400);
      assert.equal(overPrecision.status, 400);
      assert.equal(outsider.status, 403);
      const alternatePayer = await clients.owner.call<{ id: string }>(`/expenses?homeId=${homeId}`, "POST", {
        title: "Pagado por otro integrante",
        category: "Varios",
        paid_by_id: memberId,
        total_amount: 10,
        expense_date: date,
        participant_ids: [ownerId, memberId],
      });
      const list = await clients.owner.call<ExpenseData>(`/expenses?homeId=${homeId}`);
      const expense = list.json.data.expenses.find((row) => row.id === alternatePayer.json.data.id);
      const deleted = await clients.owner.call(`/expenses/${alternatePayer.json.data.id}`, "DELETE");
      assert.equal(alternatePayer.status, 200);
      assert.equal(expense?.paid_by, memberId);
      assert.equal(deleted.status, 200);
    });

    await t.test("HU1.2.1 Resumen mensual y cuota personal", async () => {
      const result = await clients.member.call<ExpenseData>(`/expenses?homeId=${homeId}`);
      assert.equal(result.json.data.summary.total_month, 100.01);
      assert.equal(result.json.data.summary.your_share, 50);
    });
    await t.test("HU1.2.2 Balance individual entre roommates", async () => {
      const owner = await clients.owner.call<ExpenseData>(`/expenses?homeId=${homeId}`);
      const member = await clients.member.call<ExpenseData>(`/expenses?homeId=${homeId}`);
      assert.equal(owner.json.data.summary.you_are_owed, 50);
      assert.equal(member.json.data.summary.you_owe, 50);
    });
    await t.test("HU1.2.3 Registrar un abono y limitar pagos al saldo", async () => {
      const path = `/payments?homeId=${homeId}`;
      const payment = await clients.member.call(path, "POST", { receiver_id: ownerId, amount: 10 });
      const overpayment = await clients.member.call(path, "POST", { receiver_id: ownerId, amount: 41 });
      const settlement = await clients.member.call(path, "POST", { receiver_id: ownerId, amount: 40 });
      const balance = await clients.member.call<ExpenseData>(`/expenses?homeId=${homeId}`);
      const expense = balance.json.data.expenses.find((row) => row.id === expenseId)!;
      assert.equal(payment.status, 200);
      assert.equal(overpayment.status, 400);
      assert.equal(settlement.status, 200);
      assert.equal(balance.json.data.summary.you_owe, 0);
      assert.equal(expense.user_status, "PAGADO");
    });

    await t.test("HU1.3.1 Editar gasto y regenerar sus cuotas", async () => {
      const result = await clients.owner.call(`/expenses/${expenseId}`, "PATCH", {
        title: "Mercado actualizado",
        category: "Alimentación",
        paid_by_id: ownerId,
        total_amount: 120.55,
        expense_date: date,
        participant_ids: [ownerId, memberId],
      });
      const list = await clients.owner.call<ExpenseData>(`/expenses?homeId=${homeId}`);
      assert.equal(result.status, 200);
      assert.equal(list.json.data.expenses.find((row) => row.id === expenseId)?.total_amount, 120.55);
    });
    await t.test("HU1.3.2 Restringir edición a creador o administrador", async () => {
      const denied = await clients.member.call(`/expenses/${expenseId}`, "PATCH", {
        title: "Edición ajena",
        category: "Varios",
        paid_by_id: ownerId,
        total_amount: 120,
        expense_date: date,
        participant_ids: [ownerId, memberId],
      });
      assert.equal(denied.status, 403);
    });
    await t.test("HU1.3.3 Eliminar y deshacer un gasto", async () => {
      const deleted = await clients.owner.call(`/expenses/${expenseId}`, "DELETE");
      const hidden = await clients.owner.call<ExpenseData>(`/expenses?homeId=${homeId}`);
      const restored = await clients.owner.call(`/expenses/${expenseId}/restore`, "POST", {});
      const visible = await clients.owner.call<ExpenseData>(`/expenses?homeId=${homeId}`);
      assert.equal(deleted.status, 200);
      assert.equal(hidden.json.data.expenses.some((row) => row.id === expenseId), false);
      assert.equal(restored.status, 200);
      assert.equal(visible.json.data.expenses.some((row) => row.id === expenseId), true);
    });

    await t.test("HU2.1.1 Crear producto con cantidad, categoría y precio", async () => {
      const created = await clients.owner.call<{ id: string }>(`/shopping?homeId=${homeId}`, "POST", {
        title: "Jabón de loza",
        category: "Limpieza",
        quantity: 2,
        estimated_price: 8500,
        assigned_membership_id: memberMembership,
      });
      assert.equal(created.status, 200);
      itemId = created.json.data.id;
    });
    await t.test("HU2.1.2 Mostrar productos y autor", async () => {
      const list = await clients.owner.call<ShoppingItem[]>(`/shopping?homeId=${homeId}`);
      const item = list.json.data.find((row) => row.id === itemId)!;
      assert.equal(item.quantity, 2);
      assert.equal(item.estimated_price, 8500);
      assert.equal(item.status, "PENDIENTE");
      assert.equal(item.assigned_to, "Prueba member");
    });
    await t.test("HU2.1.3 Validar cantidad y acceso al hogar", async () => {
      const invalid = await clients.owner.call(`/shopping?homeId=${homeId}`, "POST", {
        title: "Cantidad inválida",
        category: "Varios",
        quantity: 0,
        estimated_price: 0,
      });
      const outsider = await clients.outsider.call(`/shopping?homeId=${homeId}`);
      assert.equal(invalid.status, 400);
      assert.equal(outsider.status, 403);
    });

    await t.test("HU2.2.1 Marcar producto como comprado", async () => {
      const result = await clients.member.call(`/shopping/${itemId}`, "PATCH", { status: "COMPRADO" });
      assert.equal(result.status, 200);
    });
    await t.test("HU2.2.2 Guardar comprador y estado en el historial", async () => {
      const list = await clients.owner.call<ShoppingItem[]>(`/shopping?homeId=${homeId}`);
      const item = list.json.data.find((row) => row.id === itemId)!;
      assert.equal(item.status, "COMPRADO");
      assert.equal(item.bought_by, memberId);
      assert.equal(item.bought_by_name, "Prueba member");
    });
    await t.test("HU2.2.3 Reactivar el producto pendiente", async () => {
      await clients.member.call(`/shopping/${itemId}`, "PATCH", { status: "PENDIENTE" });
      const list = await clients.owner.call<ShoppingItem[]>(`/shopping?homeId=${homeId}`);
      const item = list.json.data.find((row) => row.id === itemId)!;
      assert.equal(item.status, "PENDIENTE");
      assert.equal(item.bought_by, null);
    });

    await t.test("HU2.3.1 Editar producto, cantidad y precio", async () => {
      const result = await clients.owner.call(`/shopping/${itemId}`, "PATCH", {
        title: "Jabón actualizado",
        category: "Limpieza",
        quantity: 3,
        estimated_price: 9200,
      });
      assert.equal(result.status, 200);
    });
    await t.test("HU2.3.2 Rechazar modificaciones de otro creador", async () => {
      const result = await clients.member.call(`/shopping/${itemId}`, "PATCH", { quantity: 4 });
      assert.equal(result.status, 403);
    });
    await t.test("HU2.3.3 Eliminar y deshacer un producto", async () => {
      const deleted = await clients.owner.call(`/shopping/${itemId}`, "DELETE");
      const hidden = await clients.owner.call<ShoppingItem[]>(`/shopping?homeId=${homeId}`);
      const restored = await clients.owner.call(`/shopping/${itemId}/restore`, "POST", {});
      const visible = await clients.owner.call<ShoppingItem[]>(`/shopping?homeId=${homeId}`);
      assert.equal(deleted.status, 200);
      assert.equal(hidden.json.data.some((row) => row.id === itemId), false);
      assert.equal(restored.status, 200);
      assert.equal(visible.json.data.some((row) => row.id === itemId), true);
    });

    await t.test("HU3.1.1 Crear reporte con asignación y costo", async () => {
      const result = await clients.owner.call<{ id: string }>(`/maintenance?homeId=${homeId}`, "POST", {
        title: "Fuga en lavaplatos",
        description: "Gotea al cerrar la llave",
        category: "Plomería",
        estimated_cost: 45000,
        priority: "ALTA",
        assigned_membership_id: memberMembership,
      });
      assert.equal(result.status, 200);
      reportId = result.json.data.id;
    });
    await t.test("HU3.1.2 Conservar categoría, costo y responsable", async () => {
      const result = await clients.owner.call<MaintenanceData>(`/maintenance?homeId=${homeId}`);
      const report = result.json.data.reports.find((row) => row.id === reportId)!;
      assert.equal(report.category, "Plomería");
      assert.equal(report.assigned_to, "Prueba member");
      assert.equal(result.json.data.counts.pending, 1);
    });
    await t.test("HU3.1.3 Validar campos obligatorios y responsable", async () => {
      const missing = await clients.owner.call(`/maintenance?homeId=${homeId}`, "POST", {
        title: "",
        description: "",
        category: "Otros",
        estimated_cost: null,
        priority: "MEDIA",
        assigned_membership_id: null,
      });
      const foreign = await clients.owner.call(`/maintenance?homeId=${homeId}`, "POST", {
        title: "Responsable ajeno",
        description: "",
        category: "Otros",
        estimated_cost: null,
        priority: "MEDIA",
        assigned_membership_id: randomUUID(),
      });
      assert.equal(missing.status, 400);
      assert.equal(foreign.status, 400);
    });

    await t.test("HU3.2.1 Filtrar reportes por estado, prioridad y categoría", async () => {
      const filtered = await clients.owner.call<MaintenanceData>(
        `/maintenance?homeId=${homeId}&status=PENDIENTE&priority=ALTA&category=Plomer%C3%ADa`,
      );
      assert.equal(filtered.json.data.reports.length, 1);
      assert.equal(filtered.json.data.reports[0].id, reportId);
    });
    await t.test("HU3.2.2 Contar reportes por estado", async () => {
      const result = await clients.owner.call<MaintenanceData>(`/maintenance?homeId=${homeId}`);
      assert.deepEqual(result.json.data.counts, { pending: 1, in_progress: 0, resolved: 0 });
    });
    await t.test("HU3.2.3 Validar filtros y acceso de apartamento", async () => {
      const invalid = await clients.owner.call(`/maintenance?homeId=${homeId}&status=INVALIDO`);
      const outsider = await clients.outsider.call(`/maintenance?homeId=${homeId}`);
      assert.equal(invalid.status, 400);
      assert.equal(outsider.status, 403);
    });

    await t.test("HU3.3.1 Responsable actualiza estado y reasignación", async () => {
      const result = await clients.member.call(`/maintenance/${reportId}`, "PATCH", {
        status: "EN_PROGRESO",
        assigned_membership_id: ownerMembership,
      });
      assert.equal(result.status, 200);
    });
    await t.test("HU3.3.2 Actualizar estado y métricas de resolución", async () => {
      await clients.owner.call(`/maintenance/${reportId}`, "PATCH", { status: "RESUELTO" });
      const result = await clients.owner.call<MaintenanceData>(`/maintenance?homeId=${homeId}`);
      assert.equal(result.json.data.reports[0].status, "RESUELTO");
      assert.equal(result.json.data.counts.resolved, 1);
    });
    await t.test("HU3.3.3 Eliminar y restaurar reporte", async () => {
      const deleted = await clients.owner.call(`/maintenance/${reportId}`, "DELETE");
      const hidden = await clients.owner.call<MaintenanceData>(`/maintenance?homeId=${homeId}`);
      const restored = await clients.owner.call(`/maintenance/${reportId}/restore`, "POST", {});
      const visible = await clients.owner.call<MaintenanceData>(`/maintenance?homeId=${homeId}`);
      assert.equal(deleted.status, 200);
      assert.equal(hidden.json.data.reports.length, 0);
      assert.equal(restored.status, 200);
      assert.equal(visible.json.data.reports.length, 1);
    });
  } finally {
    await transaction(async (db) => {
      if (homeId) {
        await db.query("DELETE FROM maintenance_reports WHERE home_id=$1", [homeId]);
        await db.query("DELETE FROM shopping_items WHERE home_id=$1", [homeId]);
        await db.query(
          "DELETE FROM deliveries WHERE notification_id IN (SELECT id FROM notifications WHERE home_id=$1)",
          [homeId],
        );
        for (const table of ["notifications", "reminders", "activities", "invitations"])
          await db.query(`DELETE FROM ${table} WHERE home_id=$1`, [homeId]);
        await db.query("UPDATE sessions SET active_home_id=NULL WHERE active_home_id=$1", [homeId]);
        await db.query("DELETE FROM memberships WHERE home_id=$1", [homeId]);
        await db.query("DELETE FROM homes WHERE id=$1", [homeId]);
      }
      for (const email of emails) {
        await db.query("DELETE FROM users WHERE email=$1", [email]);
        await db.query("DELETE FROM login_attempts WHERE email=$1", [email]);
      }
    });
    await pool.end();
  }
});
