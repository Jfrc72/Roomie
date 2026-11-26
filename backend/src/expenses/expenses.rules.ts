import { fromCents, splitCents, toCents } from '../common/money.rules';
import { canManageRecord, HomeRole } from '../common/permissions.rules';
import { ExpenseRow, LedgerRow, MonthSummaryRow, ShareStatus } from './expenses.entity';
import { BalancesView, BalanceView, ExpensesSummaryView, ExpenseView } from './expenses.responses';

export interface ShareDraft {
  userId: string;
  amount: string;
  status: ShareStatus;
}

/**
 * Divide un gasto en cuotas exactas a centavos. El pagador siempre participa y va primero,
 * así que asume los centavos sobrantes; su cuota nace pagada y las demás pendientes.
 */
export function buildShares(totalAmount: number, paidBy: string, participantIds: string[]): ShareDraft[] {
  const participants = [...new Set([paidBy, ...participantIds])];
  const amounts = splitCents(toCents(totalAmount), participants.length);
  return participants.map((userId, index) => ({
    userId,
    amount: fromCents(amounts[index]),
    status: userId === paidBy ? 'PAGADO' : 'PENDIENTE',
  }));
}

/** Separa el libro de cuentas entre lo que le deben a quien consulta y lo que debe. */
export function groupBalances(rows: LedgerRow[]): BalancesView {
  const balances: BalancesView = { owes_me: [], i_owe: [] };
  for (const row of rows) {
    (row.direction === 'i_owe' ? balances.i_owe : balances.owes_me).push({ user_id: row.user_id, member: row.member, amount: Number(row.gross) });
  }
  return balances;
}

const sumCents = (rows: BalanceView[]) => rows.reduce((total, row) => total + toCents(row.amount), 0);

/** Saldo neto de quien consulta: positivo si le deben más de lo que debe. */
export const netBalance = (balances: BalancesView): number => (sumCents(balances.owes_me) - sumCents(balances.i_owe)) / 100;

export function summarize(month: MonthSummaryRow, balances: BalancesView): ExpensesSummaryView {
  return {
    total_month: Number(month.total_month),
    your_share: Number(month.your_share),
    you_are_owed: sumCents(balances.owes_me) / 100,
    you_owe: sumCents(balances.i_owe) / 100,
  };
}

/**
 * Estado de la cuota de quien consulta. Una cuota pendiente se muestra como pagada cuando
 * esa persona ya no le debe nada a quien pagó (por ejemplo, porque saldó con abonos).
 */
export function viewerStatus(shareStatus: ShareStatus | null, paidBy: string, debtorIds: ReadonlySet<string>): ShareStatus | null {
  if (shareStatus === null) return null;
  return shareStatus === 'PAGADO' || !debtorIds.has(paidBy) ? 'PAGADO' : 'PENDIENTE';
}

/** Convierte una fila de la base al gasto que ve la interfaz: números en vez de texto y permiso de edición. */
export function toExpenseView(row: ExpenseRow, role: HomeRole, userId: string, debtorIds: ReadonlySet<string>): ExpenseView {
  return {
    ...row,
    total_amount: Number(row.total_amount),
    user_status: viewerStatus(row.user_status, row.paid_by, debtorIds),
    can_edit: canManageRecord(role, row.created_by, userId),
    shares: row.shares.map(share => ({ ...share, amount: Number(share.amount) })),
  };
}

/** Un abono es válido si hay deuda y no la supera; se compara en centavos para evitar errores de redondeo. */
export function canPay(outstanding: string | number, amount: number): boolean {
  const owed = toCents(outstanding);
  return owed > 0 && toCents(amount) <= owed;
}
