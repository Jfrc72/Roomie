import { Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';
import { ExpenseDto } from './expenses.dto';
import { Expense, ExpenseRow, LedgerRow, MonthSummaryRow, PaymentRow, RecentExpenseRow } from './expenses.entity';
import { ShareDraft } from './expenses.rules';

@Injectable()
export class ExpensesRepository {
  constructor(private readonly db: DatabaseService) {}

  // ── Lecturas ────────────────────────────────────────────────────────────────────────────

  /** Gastos vigentes con sus cuotas. `expense_date::text` evita que la zona horaria cambie el día. */
  list(homeId: string, userId: string) {
    return this.db.query<ExpenseRow>(
      `SELECT e.id,e.title,e.category,e.total_amount,e.expense_date::text AS expense_date,e.paid_by,
        payer.name AS paid_by_name,e.created_by,
        (SELECT es.status FROM expense_shares es WHERE es.expense_id=e.id AND es.user_id=$2) AS user_status,
        COALESCE((SELECT json_agg(json_build_object('id',es.id,'user_id',es.user_id,'member',u.name,
          'amount',es.amount,'status',es.status,'paid_at',es.paid_at) ORDER BY u.name)
          FROM expense_shares es JOIN users u ON u.id=es.user_id WHERE es.expense_id=e.id),'[]'::json) AS shares
       FROM expenses e JOIN users payer ON payer.id=e.paid_by
       WHERE e.home_id=$1 AND e.deleted_at IS NULL
       ORDER BY e.expense_date DESC,e.created_at DESC LIMIT 100`,
      [homeId, userId],
    );
  }

  /**
   * Deuda neta entre quien consulta y cada integrante: cuotas pendientes menos abonos.
   * Un resultado de cero (deuda saldada) no se devuelve.
   */
  ledger(homeId: string, userId: string) {
    return this.db.query<LedgerRow>(
      `WITH ledger AS (
         SELECT es.user_id AS debtor,e.paid_by AS creditor,sum(es.amount) AS amount
         FROM expense_shares es JOIN expenses e ON e.id=es.expense_id
         WHERE e.home_id=$1 AND e.deleted_at IS NULL AND es.status='PENDIENTE' AND es.user_id<>e.paid_by
         GROUP BY es.user_id,e.paid_by
         UNION ALL
         SELECT payer_id,receiver_id,-sum(amount) FROM direct_payments WHERE home_id=$1
         GROUP BY payer_id,receiver_id
       )
       SELECT CASE WHEN sum(CASE WHEN l.debtor=$2 THEN l.amount ELSE -l.amount END)>0 THEN 'i_owe' ELSE 'owes_me' END AS direction,
         CASE WHEN l.debtor=$2 THEN l.creditor ELSE l.debtor END AS user_id,
         u.name AS member,abs(sum(CASE WHEN l.debtor=$2 THEN l.amount ELSE -l.amount END)) AS gross
       FROM ledger l JOIN users u ON u.id=CASE WHEN l.debtor=$2 THEN l.creditor ELSE l.debtor END
       WHERE l.debtor=$2 OR l.creditor=$2
       GROUP BY CASE WHEN l.debtor=$2 THEN l.creditor ELSE l.debtor END,u.name
       HAVING abs(sum(CASE WHEN l.debtor=$2 THEN l.amount ELSE -l.amount END))>0.005
       ORDER BY u.name`,
      [homeId, userId],
    );
  }

  async monthSummary(homeId: string, userId: string) {
    const [row] = await this.db.query<MonthSummaryRow>(
      `SELECT COALESCE(sum(e.total_amount) FILTER (WHERE date_trunc('month',e.expense_date)=date_trunc('month',CURRENT_DATE)),0) AS total_month,
        COALESCE(sum(es.amount) FILTER (WHERE date_trunc('month',e.expense_date)=date_trunc('month',CURRENT_DATE)),0) AS your_share
       FROM expenses e LEFT JOIN expense_shares es ON es.expense_id=e.id AND es.user_id=$2
       WHERE e.home_id=$1 AND e.deleted_at IS NULL`,
      [homeId, userId],
    );
    return row;
  }

  recentPayments(homeId: string) {
    return this.db.query<PaymentRow>(
      `SELECT p.id,p.payer_id,pu.name AS payer,p.receiver_id,ru.name AS receiver,p.amount,p.created_at
       FROM direct_payments p JOIN users pu ON pu.id=p.payer_id JOIN users ru ON ru.id=p.receiver_id
       WHERE p.home_id=$1 ORDER BY p.created_at DESC LIMIT 10`,
      [homeId],
    );
  }

  /** Últimos gastos del apartamento, para el resumen del inicio. */
  recent(homeId: string, limit: number) {
    return this.db.query<RecentExpenseRow>(
      'SELECT id,title,total_amount AS amount FROM expenses WHERE home_id=$1 AND deleted_at IS NULL ORDER BY expense_date DESC,created_at DESC LIMIT $2',
      [homeId, limit],
    );
  }

  // ── Escrituras (siempre dentro de una transacción) ──────────────────────────────────────

  /** Bloquea la fila para que ediciones, borrados y pagos simultáneos se ejecuten de uno en uno. */
  async lock(id: string, deleted: boolean, client: PoolClient) {
    const [row] = await this.db.query<Expense>(
      `SELECT * FROM expenses WHERE id=$1 AND deleted_at IS ${deleted ? 'NOT NULL' : 'NULL'} FOR UPDATE`, [id], client,
    );
    return row ? Object.assign(new Expense(), row) : null;
  }

  /** Devuelve los integrantes activos de la lista, para comprobar que todos pertenecen al apartamento. */
  async activeMemberIds(homeId: string, userIds: string[], client: PoolClient) {
    const rows = await this.db.query<{ user_id: string }>(
      'SELECT user_id FROM memberships WHERE home_id=$1 AND user_id=ANY($2::uuid[]) AND active FOR SHARE', [homeId, userIds], client,
    );
    return rows.map(row => row.user_id);
  }

  async insert(homeId: string, paidBy: string, createdBy: string, data: ExpenseDto, client: PoolClient) {
    const [row] = await this.db.query<{ id: string }>(
      `INSERT INTO expenses(home_id,paid_by,created_by,title,total_amount,category,expense_date)
       VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [homeId, paidBy, createdBy, data.title, data.total_amount.toFixed(2), data.category, data.expense_date], client,
    );
    return row.id;
  }

  /** Inserta todas las cuotas con una sola sentencia: o quedan todas o ninguna. */
  async insertShares(expenseId: string, shares: ShareDraft[], client: PoolClient) {
    await this.db.query(
      `INSERT INTO expense_shares(expense_id,user_id,amount,status,paid_at)
       SELECT $1,s.user_id,s.amount,s.status,CASE WHEN s.status='PAGADO' THEN now() END
       FROM unnest($2::uuid[],$3::numeric[],$4::text[]) AS s(user_id,amount,status)`,
      [expenseId, shares.map(share => share.userId), shares.map(share => share.amount), shares.map(share => share.status)], client,
    );
  }

  async update(id: string, paidBy: string, data: ExpenseDto, client: PoolClient) {
    await this.db.query(
      'UPDATE expenses SET paid_by=$1,title=$2,total_amount=$3,category=$4,expense_date=$5 WHERE id=$6',
      [paidBy, data.title, data.total_amount.toFixed(2), data.category, data.expense_date, id], client,
    );
  }

  async deleteShares(expenseId: string, client: PoolClient) {
    await this.db.query('DELETE FROM expense_shares WHERE expense_id=$1', [expenseId], client);
  }

  /** Borrado lógico: el gasto se oculta pero se conserva para poder deshacerlo. */
  async setDeleted(id: string, deleted: boolean, client: PoolClient) {
    await this.db.query('UPDATE expenses SET deleted_at=CASE WHEN $2 THEN now() END WHERE id=$1', [id, deleted], client);
  }

  /** Cuánto le debe `payerId` a `receiverId` (cuotas pendientes menos abonos); puede ser cero o negativo. */
  async outstanding(homeId: string, payerId: string, receiverId: string, client: PoolClient) {
    const [row] = await this.db.query<{ outstanding: string }>(
      `SELECT COALESCE(
         (SELECT sum(CASE WHEN es.user_id=$2 THEN es.amount ELSE -es.amount END)
          FROM expense_shares es JOIN expenses e ON e.id=es.expense_id
          WHERE e.home_id=$1 AND e.deleted_at IS NULL AND es.status='PENDIENTE'
            AND ((es.user_id=$2 AND e.paid_by=$3) OR (es.user_id=$3 AND e.paid_by=$2))),0)
         - COALESCE((SELECT sum(CASE WHEN payer_id=$2 THEN amount ELSE -amount END)
          FROM direct_payments WHERE home_id=$1
            AND ((payer_id=$2 AND receiver_id=$3) OR (payer_id=$3 AND receiver_id=$2))),0)
         AS outstanding`,
      [homeId, payerId, receiverId], client,
    );
    return row.outstanding;
  }

  async insertPayment(homeId: string, payerId: string, receiverId: string, amount: number, client: PoolClient) {
    await this.db.query(
      'INSERT INTO direct_payments(home_id,payer_id,receiver_id,amount) VALUES($1,$2,$3,$4)',
      [homeId, payerId, receiverId, amount.toFixed(2)], client,
    );
  }
}
