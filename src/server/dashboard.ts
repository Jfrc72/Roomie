import type { DashboardSummary } from "@/types";
import { getTasksSummary } from "./tasks-summary";
import { getNextReservation } from "./reservations-summary";
// Los adaptadores vacíos (finanzas y compras) se reemplazarán con consultas filtradas por homeId.
// El llamador debe verificar requireHome antes de llegar aquí.
export async function getDashboardSummary(
  homeId: string,
  userId: string,
): Promise<DashboardSummary> {
  const [tasks, nextReservation] = await Promise.all([
    getTasksSummary(homeId, userId),
    getNextReservation(homeId),
  ]);
  return {
    balance: null,
    shoppingItems: null,
    nextReservation,
    expenses: [],
    ...tasks,
  };
}
