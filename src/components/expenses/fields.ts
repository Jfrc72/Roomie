import { localToday } from "@/lib/dates";

export const categories = [
  "Servicios",
  "Arriendo",
  "Alimentación",
  "Mercado",
  "Varios",
];

export function expenseBody(data: FormData) {
  return {
    title: String(data.get("title") ?? ""),
    total_amount: Number(data.get("total_amount")),
    category: String(data.get("category") ?? "Varios"),
    expense_date: String(data.get("expense_date") ?? localToday()),
    paid_by_id: String(data.get("paid_by_id") ?? ""),
    participant_ids: data.getAll("participant_ids").map(String),
  };
}
