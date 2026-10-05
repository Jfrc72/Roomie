// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  mocks,
  dbRows,
  readRows,
  writes,
  request,
  userId,
  otherId,
  thirdId,
  homeId,
  recordId,
  memberId,
} from "./server-fixture";
import { expensesApi } from "@/server/expenses-api";
import { shoppingApi } from "@/server/shopping-api";
import { maintenanceApi } from "@/server/maintenance-api";

const expense = {
  title: "Mercado",
  category: "Alimentación",
  total_amount: 10,
  expense_date: "2026-10-01",
  participant_ids: [otherId, thirdId],
};
const item = {
  title: "Arroz",
  category: "Alimentación",
  quantity: 2,
  estimated_price: 3.5,
  assigned_membership_id: null,
};
const report = {
  title: "Fuga de agua",
  description: "Cocina",
  category: "Plomería",
  estimated_cost: null,
  priority: "ALTA",
  assigned_membership_id: null,
};
const expenseRow = {
  id: recordId,
  home_id: homeId,
  created_by: userId,
  paid_by: userId,
  title: "Mercado",
};
const itemRow = {
  ...item,
  id: recordId,
  home_id: homeId,
  added_by: otherId,
  status: "PENDIENTE",
};
const reportRow = {
  ...report,
  id: recordId,
  home_id: homeId,
  reported_by: otherId,
  status: "PENDIENTE",
};
const expenseCall = (method: string, body?: unknown, id = "") =>
  expensesApi(
    request(`expenses${id ? `/${id}` : `?homeId=${homeId}`}`, method, body),
    id ? ["expenses", id] : ["expenses"],
  );
const shoppingCall = (method: string, body?: unknown, id = "") =>
  shoppingApi(
    request(`shopping?homeId=${homeId}`, method, body),
    id ? ["shopping", id] : ["shopping"],
  );
const maintenanceCall = (method: string, body?: unknown, id = "") =>
  maintenanceApi(
    request(`maintenance?homeId=${homeId}`, method, body),
    id ? ["maintenance", id] : ["maintenance"],
  );

describe("HU2.1 · Registrar y dividir gastos", () => {
  it("reparte los centavos sin perder dinero y deja pagada la cuota del pagador", async () => {
    dbRows(
      [{ id: homeId }],
      [userId, otherId, thirdId].map((user_id) => ({ user_id })),
      [{ id: recordId }],
    );
    await expenseCall("POST", expense);
    const shares = writes("INSERT INTO expense_shares");
    expect(shares).toEqual([
      [recordId, userId, "3.34", "PAGADO"],
      [recordId, otherId, "3.33", "PENDIENTE"],
      [recordId, thirdId, "3.33", "PENDIENTE"],
    ]);
    expect(
      shares.reduce((sum, row) => sum + Math.round(Number(row[2]) * 100), 0),
    ).toBe(1000);
  });
  it("rechaza fracciones menores a un centavo antes de guardar", async () => {
    await expect(
      expenseCall("POST", { ...expense, total_amount: 1.001 }),
    ).rejects.toThrow("dos decimales");
    expect(mocks.dbQuery).not.toHaveBeenCalled();
  });
  it("rechaza participantes que no están activos en el hogar", async () => {
    dbRows([{ id: homeId }], [{ user_id: userId }]);
    await expect(expenseCall("POST", expense)).rejects.toThrow(
      "pertenecer al apartamento",
    );
    expect(writes("INSERT INTO expenses")).toEqual([]);
  });
});
describe("HU2.2 · Resumen y pagos", () => {
  it("separa lo que debo de lo que me deben y convierte los importes del resumen", async () => {
    readRows(
      [],
      [
        {
          direction: "i_owe",
          user_id: otherId,
          member: "Miguel",
          gross: "12.50",
        },
        {
          direction: "owes_me",
          user_id: thirdId,
          member: "Tomás",
          gross: "3.25",
        },
      ],
      [{ total_month: "100.50", your_share: "30.25" }],
      [],
    );
    const result = await expenseCall("GET");
    expect(result).toMatchObject({
      summary: {
        total_month: 100.5,
        your_share: 30.25,
        you_owe: 12.5,
        you_are_owed: 3.25,
      },
      balances: {
        i_owe: [{ user_id: otherId, amount: 12.5 }],
        owes_me: [{ user_id: thirdId, amount: 3.25 }],
      },
    });
  });
  it("rechaza un abono mayor al saldo pendiente", async () => {
    dbRows(
      [{ id: homeId }],
      [{ user_id: userId }, { user_id: otherId }],
      [{ outstanding: "10.00" }],
    );
    await expect(
      expensesApi(
        request(`payments?homeId=${homeId}`, "POST", {
          receiver_id: otherId,
          amount: 10.01,
        }),
        ["payments"],
      ),
    ).rejects.toThrow("supera el saldo");
    expect(writes("INSERT INTO direct_payments")).toEqual([]);
  });
  it("acepta saldar exactamente la deuda y guarda el valor con centavos", async () => {
    dbRows(
      [{ id: homeId }],
      [{ user_id: userId }, { user_id: otherId }],
      [{ outstanding: "10.25" }],
    );
    await expensesApi(
      request(`payments?homeId=${homeId}`, "POST", {
        receiver_id: otherId,
        amount: 10.25,
      }),
      ["payments"],
    );
    expect(writes("INSERT INTO direct_payments")).toEqual([
      [homeId, userId, otherId, "10.25"],
    ]);
  });
});
describe("HU2.3 · Corregir y eliminar gastos", () => {
  it("recalcula las cuotas al editar el monto y los participantes", async () => {
    dbRows(
      [expenseRow],
      [{ id: homeId }],
      [{ user_id: userId }, { user_id: otherId }],
    );
    await expenseCall(
      "PATCH",
      { ...expense, total_amount: 5.01, participant_ids: [otherId] },
      recordId,
    );
    expect(writes("DELETE FROM expense_shares")).toEqual([[recordId]]);
    expect(writes("INSERT INTO expense_shares")).toEqual([
      [recordId, userId, "2.51", "PAGADO"],
      [recordId, otherId, "2.50", "PENDIENTE"],
    ]);
  });
  it("impide que un integrante borre un gasto ajeno", async () => {
    dbRows([{ ...expenseRow, created_by: otherId }]);
    await expect(
      expenseCall("DELETE", undefined, recordId),
    ).rejects.toMatchObject({ status: 403 });
    expect(writes("UPDATE expenses")).toEqual([]);
  });
  it("restaura un gasto eliminado por su autor sin recrear sus cuotas", async () => {
    dbRows([{ ...expenseRow, deleted_at: "2026-10-01" }]);
    await expensesApi(request(`expenses/${recordId}/restore`, "POST", {}), [
      "expenses",
      recordId,
      "restore",
    ]);
    expect(writes("UPDATE expenses SET deleted_at=NULL")).toEqual([[recordId]]);
    expect(writes("INSERT INTO expense_shares")).toEqual([]);
  });
});
describe("HU4.1 · Agregar productos", () => {
  it("guarda cantidad, precio y comprador válidos", async () => {
    dbRows([{ id: homeId }], [{ id: memberId }], [{ id: recordId }]);
    await shoppingCall("POST", { ...item, assigned_membership_id: memberId });
    expect(writes("INSERT INTO shopping_items")).toEqual([
      [homeId, "Arroz", "Alimentación", 2, "3.50", userId, memberId],
    ]);
  });
  it("rechaza una cantidad cero sin escribir", async () => {
    await expect(
      shoppingCall("POST", { ...item, quantity: 0 }),
    ).rejects.toThrow();
    expect(mocks.dbQuery).not.toHaveBeenCalled();
  });
  it("rechaza asignar a un comprador ajeno al hogar", async () => {
    dbRows([{ id: homeId }], []);
    await expect(
      shoppingCall("POST", { ...item, assigned_membership_id: memberId }),
    ).rejects.toThrow("comprador asignado");
    expect(writes("INSERT INTO shopping_items")).toEqual([]);
  });
});
describe("HU4.2 · Marcar compras", () => {
  it("permite marcar comprado un producto ajeno e identifica al comprador", async () => {
    dbRows([itemRow], [{ id: homeId }]);
    await shoppingCall("PATCH", { status: "COMPRADO" }, recordId);
    expect(writes("UPDATE shopping_items")[0].slice(4, 6)).toEqual([
      "COMPRADO",
      userId,
    ]);
    expect(mocks.activity).toHaveBeenCalledWith(
      expect.anything(),
      homeId,
      userId,
      'marcó como comprado "Arroz"',
    );
  });
  it("permite reactivar un producto comprado", async () => {
    dbRows([{ ...itemRow, status: "COMPRADO" }], [{ id: homeId }]);
    await shoppingCall("PATCH", { status: "PENDIENTE" }, recordId);
    expect(writes("UPDATE shopping_items")[0][4]).toBe("PENDIENTE");
    expect(mocks.activity).toHaveBeenCalledWith(
      expect.anything(),
      homeId,
      userId,
      'reactivó "Arroz"',
    );
  });
  it("rechaza un estado desconocido sin modificar el producto", async () => {
    await expect(
      shoppingCall("PATCH", { status: "PERDIDO" }, recordId),
    ).rejects.toThrow();
    expect(mocks.dbQuery).not.toHaveBeenCalled();
  });
});
describe("HU4.3 · Editar y eliminar productos", () => {
  it("el autor corrige cantidad y precio conservando el resto", async () => {
    dbRows([{ ...itemRow, added_by: userId }], [{ id: homeId }]);
    await shoppingCall(
      "PATCH",
      { quantity: 3, estimated_price: 4.25 },
      recordId,
    );
    expect(writes("UPDATE shopping_items")[0]).toEqual([
      "Arroz",
      "Alimentación",
      3,
      "4.25",
      "PENDIENTE",
      userId,
      null,
      recordId,
    ]);
  });
  it("impide que otro integrante elimine el producto", async () => {
    dbRows([itemRow], [{ id: homeId }]);
    await expect(
      shoppingCall("DELETE", undefined, recordId),
    ).rejects.toMatchObject({ status: 403 });
    expect(writes("UPDATE shopping_items")).toEqual([]);
  });
  it("un administrador restaura un producto eliminado por otro integrante", async () => {
    mocks.requireHome.mockResolvedValue("admin");
    dbRows([{ ...itemRow, deleted_at: "2026-10-01" }]);
    await shoppingApi(request("shopping", "POST", {}), [
      "shopping",
      recordId,
      "restore",
    ]);
    expect(writes("UPDATE shopping_items SET deleted_at=NULL")).toEqual([
      [recordId],
    ]);
  });
});
describe("HU6.1 · Crear mantenimiento", () => {
  it("guarda categoría, prioridad, costo y responsable", async () => {
    dbRows([{ id: homeId }], [{ id: memberId }], [{ id: recordId }]);
    await maintenanceCall("POST", {
      ...report,
      estimated_cost: 25.5,
      assigned_membership_id: memberId,
    });
    expect(writes("INSERT INTO maintenance_reports")).toEqual([
      [
        homeId,
        "Fuga de agua",
        "Cocina",
        "Plomería",
        "25.50",
        "ALTA",
        userId,
        memberId,
      ],
    ]);
  });
  it("rechaza un título vacío sin guardar el reporte", async () => {
    await expect(
      maintenanceCall("POST", { ...report, title: "  " }),
    ).rejects.toThrow();
    expect(mocks.dbQuery).not.toHaveBeenCalled();
  });
  it("rechaza un responsable que no pertenece al hogar", async () => {
    dbRows([{ id: homeId }], []);
    await expect(
      maintenanceCall("POST", { ...report, assigned_membership_id: memberId }),
    ).rejects.toThrow("responsable debe pertenecer");
    expect(writes("INSERT INTO maintenance_reports")).toEqual([]);
  });
});
describe("HU6.2 · Filtrar reportes", () => {
  it("combina los tres filtros y conserva los contadores del hogar", async () => {
    readRows(
      [{ ...reportRow, estimated_cost: "15.25" }],
      [{ pending: 2, in_progress: 1, resolved: 4 }],
    );
    const result = await maintenanceApi(
      request(
        `maintenance?homeId=${homeId}&status=PENDIENTE&priority=ALTA&category=Plomería`,
      ),
      ["maintenance"],
    );
    expect(mocks.query.mock.calls[0][1]).toEqual([
      homeId,
      "PENDIENTE",
      "ALTA",
      "Plomería",
    ]);
    expect(result).toMatchObject({
      reports: [{ estimated_cost: 15.25, can_edit: false }],
      counts: { pending: 2, in_progress: 1, resolved: 4 },
    });
  });
  it("rechaza un filtro de estado inválido antes de consultar", async () => {
    await expect(
      maintenanceApi(request(`maintenance?homeId=${homeId}&status=OTRO`), [
        "maintenance",
      ]),
    ).rejects.toThrow("Filtro de estado");
    expect(mocks.query).not.toHaveBeenCalled();
  });
  it("rechaza un filtro de prioridad inválido antes de consultar", async () => {
    await expect(
      maintenanceApi(request(`maintenance?homeId=${homeId}&priority=OTRA`), [
        "maintenance",
      ]),
    ).rejects.toThrow("Filtro de prioridad");
    expect(mocks.query).not.toHaveBeenCalled();
  });
});
describe("HU6.3 · Gestionar mantenimiento", () => {
  it("el responsable puede resolver un reporte que no creó", async () => {
    dbRows(
      [{ ...reportRow, assigned_membership_id: memberId }],
      [{ id: homeId }],
      [{ user_id: userId }],
    );
    await maintenanceCall("PATCH", { status: "RESUELTO" }, recordId);
    expect(writes("UPDATE maintenance_reports")[0][5]).toBe("RESUELTO");
  });
  it("un integrante ajeno al reporte no puede cambiarlo", async () => {
    dbRows([reportRow], [{ id: homeId }]);
    await expect(
      maintenanceCall("PATCH", { status: "RESUELTO" }, recordId),
    ).rejects.toMatchObject({ status: 403 });
    expect(writes("UPDATE maintenance_reports")).toEqual([]);
  });
  it("el autor puede deshacer la eliminación conservando el reporte", async () => {
    dbRows([{ ...reportRow, reported_by: userId, deleted_at: "2026-10-01" }]);
    await maintenanceApi(request("maintenance", "POST", {}), [
      "maintenance",
      recordId,
      "restore",
    ]);
    expect(writes("UPDATE maintenance_reports SET deleted_at=NULL")).toEqual([
      [recordId],
    ]);
  });
});
