import type { DashboardSummary } from "@/types";
// Miguel y Tomás reemplazarán los adaptadores vacíos con consultas filtradas por homeId.
// El llamador debe verificar requireHome antes de llegar aquí.
export async function getDashboardSummary(
  homeId: string,
  userId: string,
): Promise<DashboardSummary> {
  void homeId;
  void userId;
  return {
    balance: null,
    pendingTasks: null,
    shoppingItems: null,
    nextReservation: null,
    tasks: [],
    expenses: [],
  };
}
