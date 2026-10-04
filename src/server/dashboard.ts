import type { DashboardSummary } from "@/types";
import { getTasksSummary } from "./tasks-summary";
// Los adaptadores vacíos (finanzas, compras y reservas) se reemplazarán con consultas filtradas por homeId.
// El llamador debe verificar requireHome antes de llegar aquí.
export async function getDashboardSummary(
  homeId: string,
  userId: string,
): Promise<DashboardSummary> {
  return {
    balance: null,
    shoppingItems: null,
    nextReservation: null,
    expenses: [],
    ...(await getTasksSummary(homeId, userId)),
  };
}
