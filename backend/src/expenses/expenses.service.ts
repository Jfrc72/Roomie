import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PoolClient } from 'pg';
import { HomeAccessService } from '../access/home-access.service';
import { ActivitiesService } from '../activities/activities.service';
import { SessionUser } from '../auth/auth.entity';
import { DatabaseService } from '../database/database.service';
import { requireHomeId } from '../common/params';
import { canManageRecord, HomeRole } from '../common/permissions.rules';
import { ExpenseDto, PaymentDto } from './expenses.dto';
import { Expense } from './expenses.entity';
import { ExpensesRepository } from './expenses.repository';
import { ExpensesDigest, ExpensesOverview } from './expenses.responses';
import { buildShares, canPay, groupBalances, netBalance, summarize, toExpenseView } from './expenses.rules';

type Action = 'modificarlo' | 'eliminarlo' | 'restaurarlo';

@Injectable()
export class ExpensesService {
  constructor(
    private readonly repository: ExpensesRepository,
    private readonly db: DatabaseService,
    private readonly access: HomeAccessService,
    private readonly activities: ActivitiesService,
  ) {}

  /** Gastos del apartamento con el resumen del mes, los saldos de quien consulta y los pagos recientes. */
  async list(userId: string, homeIdParam?: string): Promise<ExpensesOverview> {
    const homeId = requireHomeId(homeIdParam);
    const role = await this.access.requireHome(userId, homeId);
    const [rows, ledger, month, payments] = await Promise.all([
      this.repository.list(homeId, userId),
      this.repository.ledger(homeId, userId),
      this.repository.monthSummary(homeId, userId),
      this.repository.recentPayments(homeId),
    ]);
    const balances = groupBalances(ledger);
    const debtorIds = new Set(balances.i_owe.map(balance => balance.user_id));
    return {
      expenses: rows.map(row => toExpenseView(row, role, userId, debtorIds)),
      balances,
      payments: payments.map(payment => ({ ...payment, amount: Number(payment.amount) })),
      summary: summarize(month, balances),
    };
  }

  /**
   * Resumen para el inicio: saldo neto de quien consulta y los últimos gastos.
   * No revisa el acceso: quien lo llama (DashboardService) ya comprobó la pertenencia al apartamento.
   */
  async summary(homeId: string, userId: string): Promise<ExpensesDigest> {
    const [ledger, recent] = await Promise.all([this.repository.ledger(homeId, userId), this.repository.recent(homeId, 3)]);
    return {
      balance: netBalance(groupBalances(ledger)),
      recent: recent.map(expense => ({ id: expense.id, title: expense.title, amount: Number(expense.amount) })),
    };
  }

  async create(user: SessionUser, homeIdParam: string | undefined, data: ExpenseDto) {
    const homeId = requireHomeId(homeIdParam);
    await this.access.requireHome(user.id, homeId);
    return this.db.transaction(async client => {
      await this.access.lockHome(user.id, homeId, client, false);
      const paidBy = data.paid_by_id ?? user.id;
      await this.requireActiveMembers(homeId, [user.id, paidBy, ...data.participant_ids], client);
      const id = await this.repository.insert(homeId, paidBy, user.id, data, client);
      await this.repository.insertShares(id, buildShares(data.total_amount, paidBy, data.participant_ids), client);
      await this.activities.add(homeId, user.id, `registró el gasto "${data.title}"`, client);
      return { id, message: 'Gasto registrado.' };
    });
  }

  /** Reemplaza los datos del gasto y vuelve a calcular sus cuotas; los abonos entre integrantes se conservan. */
  update(user: SessionUser, id: string, data: ExpenseDto) {
    return this.db.transaction(async client => {
      const expense = await this.lockRecord(user, id, false, 'modificarlo', client);
      const paidBy = data.paid_by_id ?? expense.paid_by;
      await this.requireActiveMembers(expense.home_id, [paidBy, ...data.participant_ids], client);
      await this.repository.update(id, paidBy, data, client);
      await this.repository.deleteShares(id, client);
      await this.repository.insertShares(id, buildShares(data.total_amount, paidBy, data.participant_ids), client);
      await this.activities.add(expense.home_id, user.id, `actualizó el gasto "${data.title}"`, client);
      return { message: 'Gasto actualizado.' };
    });
  }

  remove(user: SessionUser, id: string) {
    return this.db.transaction(async client => {
      const expense = await this.lockRecord(user, id, false, 'eliminarlo', client);
      await this.repository.setDeleted(id, true, client);
      await this.activities.add(expense.home_id, user.id, `eliminó el gasto "${expense.title}"`, client);
      return { message: 'Gasto eliminado.' };
    });
  }

  restore(user: SessionUser, id: string) {
    return this.db.transaction(async client => {
      const expense = await this.lockRecord(user, id, true, 'restaurarlo', client);
      await this.repository.setDeleted(id, false, client);
      await this.activities.add(expense.home_id, user.id, `restauró el gasto "${expense.title}"`, client);
      return { message: 'Gasto restaurado.' };
    });
  }

  /** Registra un abono de quien consulta a otro integrante, sin superar lo que le debe. */
  async pay(user: SessionUser, homeIdParam: string | undefined, data: PaymentDto) {
    const homeId = requireHomeId(homeIdParam);
    await this.access.requireHome(user.id, homeId);
    if (data.receiver_id === user.id) throw new BadRequestException('No puedes registrarte un pago a ti mismo.');
    return this.db.transaction(async client => {
      await this.access.lockHome(user.id, homeId, client, false);
      await this.requireActiveMembers(homeId, [user.id, data.receiver_id], client);
      const outstanding = await this.repository.outstanding(homeId, user.id, data.receiver_id, client);
      if (!canPay(outstanding, data.amount)) throw new BadRequestException('El pago supera el saldo pendiente con este integrante.');
      await this.repository.insertPayment(homeId, user.id, data.receiver_id, data.amount, client);
      await this.activities.add(homeId, user.id, 'registró un pago entre integrantes', client);
      return { message: 'Pago registrado.' };
    });
  }

  /**
   * Bloquea el gasto y luego su apartamento, siempre en ese orden, y comprueba permisos.
   * Bloquear el apartamento evita que un borrado o una edición cambie los saldos mientras se registra un pago.
   */
  private async lockRecord(user: SessionUser, id: string, deleted: boolean, action: Action, client: PoolClient): Promise<Expense> {
    const expense = await this.repository.lock(id, deleted, client);
    if (!expense) throw new NotFoundException(deleted ? 'Gasto eliminado no encontrado.' : 'Gasto no encontrado.');
    const role: HomeRole = await this.access.lockHome(user.id, expense.home_id, client, false);
    if (!canManageRecord(role, expense.created_by, user.id)) {
      throw new ForbiddenException(`Solo quien registró el gasto o un administrador puede ${action}.`);
    }
    return expense;
  }

  private async requireActiveMembers(homeId: string, userIds: string[], client: PoolClient) {
    const unique = [...new Set(userIds)];
    const active = await this.repository.activeMemberIds(homeId, unique, client);
    if (active.length !== unique.length) throw new BadRequestException('Todos los integrantes deben pertenecer al apartamento.');
  }
}
