import type { DashboardSummary } from "@/types";
import { getTasksSummary } from "./tasks-summary";
import { getNextReservation } from "./reservations-summary";
import { query } from "./db";

export async function getDashboardSummary(
  homeId: string,
  userId: string,
): Promise<DashboardSummary> {
  const [tasks, nextReservation, finance, shopping, maintenance, expenses] =
    await Promise.all([
      getTasksSummary(homeId, userId),
      getNextReservation(homeId),
      query(
        `WITH ledger AS (
           SELECT es.user_id AS debtor,e.paid_by AS creditor,sum(es.amount) AS amount
           FROM expense_shares es JOIN expenses e ON e.id=es.expense_id
           WHERE e.home_id=$1 AND e.deleted_at IS NULL AND es.status='PENDIENTE' AND es.user_id<>e.paid_by
           GROUP BY es.user_id,e.paid_by
           UNION ALL
           SELECT payer_id,receiver_id,-sum(amount) FROM direct_payments WHERE home_id=$1
           GROUP BY payer_id,receiver_id
         )
         SELECT COALESCE(sum(CASE WHEN debtor=$2 THEN -amount ELSE amount END),0) AS balance
         FROM ledger WHERE debtor=$2 OR creditor=$2`,
        [homeId, userId],
      ),
      query(
        "SELECT count(*)::int AS total FROM shopping_items WHERE home_id=$1 AND status='PENDIENTE' AND deleted_at IS NULL",
        [homeId],
      ),
      query(
        "SELECT count(*)::int AS total FROM maintenance_reports WHERE home_id=$1 AND priority IN ('ALTA','URGENTE') AND status<>'RESUELTO' AND deleted_at IS NULL",
        [homeId],
      ),
      query<{ id: string; title: string; amount: string | number }>(
        `SELECT id,title,total_amount AS amount FROM expenses
         WHERE home_id=$1 AND deleted_at IS NULL ORDER BY expense_date DESC,created_at DESC LIMIT 3`,
        [homeId],
      ),
    ]);
  return {
    balance: Number(finance[0].balance),
    shoppingItems: Number(shopping[0].total),
    urgentMaintenance: Number(maintenance[0].total),
    nextReservation,
    expenses: expenses.map((expense) => ({
      id: expense.id,
      title: expense.title,
      amount: Number(expense.amount),
      href: "/gastos",
    })),
    ...tasks,
  };
}
