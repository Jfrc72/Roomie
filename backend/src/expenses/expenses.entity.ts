export type ShareStatus = 'PENDIENTE' | 'PAGADO';

// Clases que representan las filas de las tablas (db/024_shared_modules.sql).
// PostgreSQL devuelve los `numeric` como texto para no perder precisión.
export class Expense {
  id: string;
  home_id: string;
  paid_by: string;
  created_by: string;
  title: string;
  total_amount: string;
  category: string;
  expense_date: Date;
  created_at: Date;
  deleted_at: Date | null;
}

export class ExpenseShare {
  id: string;
  expense_id: string;
  user_id: string;
  amount: string;
  status: ShareStatus;
  paid_at: Date | null;
}

export class DirectPayment {
  id: string;
  home_id: string;
  payer_id: string;
  receiver_id: string;
  amount: string;
  created_at: Date;
}

// Resultados de las consultas de lectura (incluyen datos de otras tablas).
export interface ShareRow {
  id: string;
  user_id: string;
  member: string;
  amount: number | string;
  status: ShareStatus;
  paid_at: string | null;
}

export interface ExpenseRow {
  id: string;
  title: string;
  category: string;
  total_amount: string;
  expense_date: string;
  paid_by: string;
  paid_by_name: string;
  created_by: string;
  user_status: ShareStatus | null;
  shares: ShareRow[];
}

/** Deuda neta con otra persona, vista desde quien consulta. `gross` es siempre positivo. */
export interface LedgerRow {
  direction: 'i_owe' | 'owes_me';
  user_id: string;
  member: string;
  gross: string;
}

export interface MonthSummaryRow {
  total_month: string;
  your_share: string;
}

export interface PaymentRow {
  id: string;
  payer_id: string;
  payer: string;
  receiver_id: string;
  receiver: string;
  amount: string;
  created_at: Date;
}

export interface RecentExpenseRow {
  id: string;
  title: string;
  amount: string;
}
