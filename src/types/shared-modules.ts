export type ExpenseStatus = "PENDIENTE" | "PAGADO";
export type ShoppingStatus = "PENDIENTE" | "COMPRADO";
export type MaintenanceStatus = "PENDIENTE" | "EN_PROGRESO" | "RESUELTO";
export type MaintenancePriority = "BAJA" | "MEDIA" | "ALTA" | "URGENTE";

export interface ExpenseShare {
  id: string;
  user_id: string;
  member: string;
  amount: number;
  status: ExpenseStatus;
  paid_at: string | null;
}
export interface Expense {
  id: string;
  title: string;
  category: string;
  total_amount: number;
  expense_date: string;
  paid_by: string;
  paid_by_name: string;
  created_by: string;
  user_status: ExpenseStatus | null;
  shares: ExpenseShare[];
  can_edit: boolean;
}
export interface ExpenseBalance {
  user_id: string;
  member: string;
  amount: number;
}
export interface DirectPayment {
  id: string;
  payer_id: string;
  payer: string;
  receiver_id: string;
  receiver: string;
  amount: number;
  created_at: string;
}
export interface ExpensesData {
  expenses: Expense[];
  balances: { owes_me: ExpenseBalance[]; i_owe: ExpenseBalance[] };
  payments: DirectPayment[];
  summary: {
    total_month: number;
    your_share: number;
    you_are_owed: number;
    you_owe: number;
  };
}
export interface ShoppingItem {
  id: string;
  title: string;
  category: string;
  quantity: number;
  estimated_price: number;
  status: ShoppingStatus;
  added_by: string;
  added_by_name: string;
  bought_by: string | null;
  bought_by_name: string | null;
  assigned_membership_id: string | null;
  assigned_to: string | null;
  can_edit: boolean;
  created_at: string;
}
export interface MaintenanceReport {
  id: string;
  title: string;
  description: string;
  category: string;
  estimated_cost: number | null;
  priority: MaintenancePriority;
  status: MaintenanceStatus;
  reported_by: string;
  reported_by_name: string;
  assigned_membership_id: string | null;
  assigned_to: string | null;
  can_edit: boolean;
  created_at: string;
  updated_at: string;
}
export interface MaintenanceData {
  reports: MaintenanceReport[];
  counts: { pending: number; in_progress: number; resolved: number };
}
