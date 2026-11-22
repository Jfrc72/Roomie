import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class DashboardRepository {
  constructor(private readonly db: DatabaseService) {}
  async balance(homeId: string, userId: string) {
    const [row] = await this.db.query<{ balance: string }>(`WITH ledger AS (
      SELECT es.user_id AS debtor,e.paid_by AS creditor,sum(es.amount) AS amount
      FROM expense_shares es JOIN expenses e ON e.id=es.expense_id
      WHERE e.home_id=$1 AND e.deleted_at IS NULL AND es.status='PENDIENTE' AND es.user_id<>e.paid_by
      GROUP BY es.user_id,e.paid_by
      UNION ALL SELECT payer_id,receiver_id,-sum(amount) FROM direct_payments WHERE home_id=$1 GROUP BY payer_id,receiver_id
      ) SELECT COALESCE(sum(CASE WHEN debtor=$2 THEN -amount ELSE amount END),0) AS balance FROM ledger WHERE debtor=$2 OR creditor=$2`, [homeId, userId]);
    return Number(row.balance);
  }
  async shopping(homeId: string) {
    const [row] = await this.db.query<{ total: number }>("SELECT count(*)::int AS total FROM shopping_items WHERE home_id=$1 AND status='PENDIENTE' AND deleted_at IS NULL", [homeId]);
    return row.total;
  }
  async maintenance(homeId: string) {
    const [row] = await this.db.query<{ total: number }>("SELECT count(*)::int AS total FROM maintenance_reports WHERE home_id=$1 AND priority IN ('ALTA','URGENTE') AND status<>'RESUELTO' AND deleted_at IS NULL", [homeId]);
    return row.total;
  }
  expenses(homeId: string) {
    return this.db.query<{ id: string; title: string; amount: string }>('SELECT id,title,total_amount AS amount FROM expenses WHERE home_id=$1 AND deleted_at IS NULL ORDER BY expense_date DESC,created_at DESC LIMIT 3', [homeId]);
  }
}
