import { ForbiddenException } from '@nestjs/common';
import { HomeAccessService } from '../src/access/home-access.service';
import { ActivitiesService } from '../src/activities/activities.service';
import { DatabaseService } from '../src/database/database.service';
import { ExpensesRepository } from '../src/expenses/expenses.repository';
import { ExpensesService } from '../src/expenses/expenses.service';
import { client, database, homeId, service, user } from './helpers';

const other = '00000000-0000-4000-8000-000000000002';
const third = '00000000-0000-4000-8000-000000000003';
const expenseId = '00000000-0000-4000-8000-000000000030';
const dto = (over: object = {}) => ({
  title: 'Mercado', category: 'Alimentación', total_amount: 10, expense_date: '2026-11-25', participant_ids: [other, third], ...over,
});
const stored = (over: object = {}) => ({ id: expenseId, home_id: homeId, paid_by: user.id, created_by: user.id, title: 'Mercado', ...over });

describe('Gastos y pagos', () => {
  let expenses: ExpensesService;
  const repo = {
    list: jest.fn(), ledger: jest.fn(), monthSummary: jest.fn(), recentPayments: jest.fn(), recent: jest.fn(), lock: jest.fn(),
    activeMemberIds: jest.fn(), insert: jest.fn(), insertShares: jest.fn(), update: jest.fn(), deleteShares: jest.fn(),
    setDeleted: jest.fn(), outstanding: jest.fn(), insertPayment: jest.fn(),
  };
  const access = { requireHome: jest.fn(), lockHome: jest.fn() };
  const activities = { add: jest.fn() };
  let db: ReturnType<typeof database>;

  beforeEach(async () => {
    jest.resetAllMocks();
    access.requireHome.mockResolvedValue('member');
    access.lockHome.mockResolvedValue('member');
    repo.insert.mockResolvedValue(expenseId);
    repo.activeMemberIds.mockImplementation(async (_home: string, ids: string[]) => ids);
    repo.ledger.mockResolvedValue([]);
    repo.list.mockResolvedValue([]);
    repo.recentPayments.mockResolvedValue([]);
    repo.recent.mockResolvedValue([]);
    repo.monthSummary.mockResolvedValue({ total_month: '0', your_share: '0' });
    db = database();
    expenses = await service(ExpensesService, [
      { provide: ExpensesRepository, useValue: repo }, { provide: DatabaseService, useValue: db },
      { provide: HomeAccessService, useValue: access }, { provide: ActivitiesService, useValue: activities },
    ]);
  });

  describe('HU2.1 registrar y dividir gastos', () => {
    it('HU2.1 reparte los centavos sin perder dinero y deja pagada la cuota del pagador', async () => {
      await expenses.create(user, homeId, dto() as never);
      const shares = repo.insertShares.mock.calls[0][1];
      expect(shares).toEqual([
        { userId: user.id, amount: '3.34', status: 'PAGADO' },
        { userId: other, amount: '3.33', status: 'PENDIENTE' },
        { userId: third, amount: '3.33', status: 'PENDIENTE' },
      ]);
      expect(shares.reduce((sum: number, share: { amount: string }) => sum + Math.round(Number(share.amount) * 100), 0)).toBe(1000);
    });
    it('HU2.1 devuelve el id del gasto y registra la actividad con su título', async () => {
      await expect(expenses.create(user, homeId, dto() as never)).resolves.toEqual({ id: expenseId, message: 'Gasto registrado.' });
      expect(activities.add).toHaveBeenCalledWith(homeId, user.id, 'registró el gasto "Mercado"', client);
      expect(repo.insertShares.mock.calls[0][0]).toBe(expenseId);
    });
    it('HU2.1 si paga otra persona, esa persona asume el centavo sobrante y queda como pagadora', async () => {
      await expenses.create(user, homeId, dto({ paid_by_id: other, total_amount: 10, participant_ids: [user.id, third] }) as never);
      expect(repo.insert).toHaveBeenCalledWith(homeId, other, user.id, expect.objectContaining({ total_amount: 10 }), client);
      expect(repo.insertShares.mock.calls[0][1][0]).toEqual({ userId: other, amount: '3.34', status: 'PAGADO' });
      expect(repo.activeMemberIds).toHaveBeenCalledWith(homeId, [user.id, other, third], client);
    });
    it('HU2.1 rechaza participantes que no están activos en el hogar y no guarda nada', async () => {
      repo.activeMemberIds.mockResolvedValue([user.id, other]);
      await expect(expenses.create(user, homeId, dto() as never)).rejects.toMatchObject({ status: 400, message: 'Todos los integrantes deben pertenecer al apartamento.' });
      expect(repo.insert).not.toHaveBeenCalled();
      expect(repo.insertShares).not.toHaveBeenCalled();
      expect(activities.add).not.toHaveBeenCalled();
    });
    it('HU2.1 una persona de fuera no registra gastos ni toca el apartamento', async () => {
      access.requireHome.mockRejectedValue(new ForbiddenException('No tienes acceso a este apartamento.'));
      await expect(expenses.create(user, homeId, dto() as never)).rejects.toMatchObject({ status: 403 });
      expect(db.transaction).not.toHaveBeenCalled();
    });
    it('HU2.1 exige indicar el apartamento antes de consultar la base', async () => {
      await expect(expenses.create(user, undefined, dto() as never)).rejects.toMatchObject({ status: 400, message: 'Selecciona un apartamento.' });
      expect(access.requireHome).not.toHaveBeenCalled();
    });
    it('HU2.1 bloquea el apartamento sin exigir ser administrador', async () => {
      await expenses.create(user, homeId, dto() as never);
      expect(access.lockHome).toHaveBeenCalledWith(user.id, homeId, client, false);
    });
  });

  describe('HU2.2 resumen, saldos y abonos', () => {
    const ledger = [
      { direction: 'i_owe', user_id: other, member: 'Miguel', gross: '12.50' },
      { direction: 'owes_me', user_id: third, member: 'Tomás', gross: '3.25' },
    ];
    it('HU2.2 separa lo que debo de lo que me deben y convierte los importes del resumen', async () => {
      repo.ledger.mockResolvedValue(ledger);
      repo.monthSummary.mockResolvedValue({ total_month: '100.50', your_share: '30.25' });
      const result = await expenses.list(user.id, homeId);
      expect(result.summary).toEqual({ total_month: 100.5, your_share: 30.25, you_owe: 12.5, you_are_owed: 3.25 });
      expect(result.balances.i_owe).toEqual([{ user_id: other, member: 'Miguel', amount: 12.5 }]);
      expect(result.balances.owes_me).toEqual([{ user_id: third, member: 'Tomás', amount: 3.25 }]);
    });
    it('HU2.2 una cuota pendiente se muestra pagada cuando ya no debo nada a quien pagó', async () => {
      repo.list.mockResolvedValue([{ id: expenseId, paid_by: other, created_by: other, user_status: 'PENDIENTE', total_amount: '10.00', shares: [] }]);
      expect((await expenses.list(user.id, homeId)).expenses[0].user_status).toBe('PAGADO');
      repo.ledger.mockResolvedValue([{ direction: 'i_owe', user_id: other, member: 'Miguel', gross: '5.00' }]);
      expect((await expenses.list(user.id, homeId)).expenses[0].user_status).toBe('PENDIENTE');
    });
    it('HU2.2 indica qué gastos puede editar quien consulta y convierte los pagos recientes', async () => {
      repo.list.mockResolvedValue([
        { id: 'propio', paid_by: user.id, created_by: user.id, user_status: null, total_amount: '1.00', shares: [] },
        { id: 'ajeno', paid_by: other, created_by: other, user_status: null, total_amount: '2.00', shares: [] },
      ]);
      repo.recentPayments.mockResolvedValue([{ id: 'p1', amount: '10.00' }]);
      const result = await expenses.list(user.id, homeId);
      expect(result.expenses.map(expense => expense.can_edit)).toEqual([true, false]);
      expect(result.payments).toEqual([{ id: 'p1', amount: 10 }]);
    });
    it('HU2.2 una persona de fuera no ve los gastos y no se consulta nada', async () => {
      access.requireHome.mockRejectedValue(new ForbiddenException('No tienes acceso a este apartamento.'));
      await expect(expenses.list(user.id, homeId)).rejects.toMatchObject({ status: 403 });
      expect(repo.list).not.toHaveBeenCalled();
      expect(repo.ledger).not.toHaveBeenCalled();
    });
    it('HU2.2 acepta saldar exactamente la deuda y guarda el valor con centavos', async () => {
      repo.outstanding.mockResolvedValue('10.25');
      await expect(expenses.pay(user, homeId, { receiver_id: other, amount: 10.25 })).resolves.toEqual({ message: 'Pago registrado.' });
      expect(repo.insertPayment).toHaveBeenCalledWith(homeId, user.id, other, 10.25, client);
      expect(activities.add).toHaveBeenCalledWith(homeId, user.id, 'registró un pago entre integrantes', client);
    });
    it('HU2.2 rechaza un abono mayor al saldo pendiente por un solo centavo', async () => {
      repo.outstanding.mockResolvedValue('10.00');
      await expect(expenses.pay(user, homeId, { receiver_id: other, amount: 10.01 })).rejects.toMatchObject({ status: 400, message: 'El pago supera el saldo pendiente con este integrante.' });
      expect(repo.insertPayment).not.toHaveBeenCalled();
    });
    it('HU2.2 rechaza abonar cuando no se debe nada', async () => {
      repo.outstanding.mockResolvedValue('0.00');
      await expect(expenses.pay(user, homeId, { receiver_id: other, amount: 1 })).rejects.toMatchObject({ status: 400 });
      expect(repo.insertPayment).not.toHaveBeenCalled();
    });
    it('HU2.2 no permite registrarse un pago a uno mismo ni abre la transacción', async () => {
      await expect(expenses.pay(user, homeId, { receiver_id: user.id, amount: 1 })).rejects.toMatchObject({ status: 400, message: 'No puedes registrarte un pago a ti mismo.' });
      expect(db.transaction).not.toHaveBeenCalled();
    });
    it('HU2.2 rechaza pagar a quien no es integrante activo', async () => {
      repo.activeMemberIds.mockResolvedValue([user.id]);
      await expect(expenses.pay(user, homeId, { receiver_id: other, amount: 1 })).rejects.toMatchObject({ status: 400 });
      expect(repo.outstanding).not.toHaveBeenCalled();
    });
    it('HU2.2 el resumen del inicio da el saldo neto y los últimos gastos como números', async () => {
      repo.ledger.mockResolvedValue(ledger);
      repo.recent.mockResolvedValue([{ id: 'g1', title: 'Mercado compartido', amount: '15000.50' }]);
      await expect(expenses.summary(homeId, user.id)).resolves.toEqual({
        balance: -9.25, recent: [{ id: 'g1', title: 'Mercado compartido', amount: 15000.5 }],
      });
      expect(repo.recent).toHaveBeenCalledWith(homeId, 3);
    });
  });

  describe('HU2.3 editar, eliminar y restaurar gastos', () => {
    it('HU2.3 recalcula las cuotas al editar el monto y los participantes', async () => {
      repo.lock.mockResolvedValue(stored());
      await expenses.update(user, expenseId, dto({ total_amount: 5.01, participant_ids: [other] }) as never);
      expect(repo.deleteShares).toHaveBeenCalledWith(expenseId, client);
      expect(repo.insertShares).toHaveBeenCalledWith(expenseId, [
        { userId: user.id, amount: '2.51', status: 'PAGADO' },
        { userId: other, amount: '2.50', status: 'PENDIENTE' },
      ], client);
      expect(activities.add).toHaveBeenCalledWith(homeId, user.id, 'actualizó el gasto "Mercado"', client);
    });
    it('HU2.3 conserva al pagador actual si no se indica otro y bloquea el apartamento del gasto', async () => {
      repo.lock.mockResolvedValue(stored({ paid_by: other }));
      await expenses.update(user, expenseId, dto() as never);
      expect(repo.update).toHaveBeenCalledWith(expenseId, other, expect.anything(), client);
      expect(access.lockHome).toHaveBeenCalledWith(user.id, homeId, client, false);
    });
    it('HU2.3 impide que un integrante edite el gasto de otra persona', async () => {
      repo.lock.mockResolvedValue(stored({ created_by: other }));
      await expect(expenses.update(user, expenseId, dto() as never)).rejects.toMatchObject({ status: 403, message: 'Solo quien registró el gasto o un administrador puede modificarlo.' });
      expect(repo.update).not.toHaveBeenCalled();
      expect(repo.deleteShares).not.toHaveBeenCalled();
    });
    it('HU2.3 impide que un integrante elimine un gasto ajeno', async () => {
      repo.lock.mockResolvedValue(stored({ created_by: other }));
      await expect(expenses.remove(user, expenseId)).rejects.toMatchObject({ status: 403, message: 'Solo quien registró el gasto o un administrador puede eliminarlo.' });
      expect(repo.setDeleted).not.toHaveBeenCalled();
    });
    it('HU2.3 un administrador elimina el gasto de otra persona de forma lógica', async () => {
      access.lockHome.mockResolvedValue('admin');
      repo.lock.mockResolvedValue(stored({ created_by: other }));
      await expect(expenses.remove(user, expenseId)).resolves.toEqual({ message: 'Gasto eliminado.' });
      expect(repo.setDeleted).toHaveBeenCalledWith(expenseId, true, client);
      expect(activities.add).toHaveBeenCalledWith(homeId, user.id, 'eliminó el gasto "Mercado"', client);
    });
    it('HU2.3 restaura un gasto eliminado sin recrear sus cuotas', async () => {
      repo.lock.mockResolvedValue(stored());
      await expect(expenses.restore(user, expenseId)).resolves.toEqual({ message: 'Gasto restaurado.' });
      expect(repo.lock).toHaveBeenCalledWith(expenseId, true, client);
      expect(repo.setDeleted).toHaveBeenCalledWith(expenseId, false, client);
      expect(repo.insertShares).not.toHaveBeenCalled();
      expect(activities.add).toHaveBeenCalledWith(homeId, user.id, 'restauró el gasto "Mercado"', client);
    });
    it('HU2.3 solo quien lo registró o un administrador restaura un gasto eliminado', async () => {
      repo.lock.mockResolvedValue(stored({ created_by: other }));
      await expect(expenses.restore(user, expenseId)).rejects.toMatchObject({ status: 403, message: 'Solo quien registró el gasto o un administrador puede restaurarlo.' });
      expect(repo.setDeleted).not.toHaveBeenCalled();
    });
    it('HU2.3 un gasto que no existe o no está eliminado da 404 con el mensaje de cada caso', async () => {
      repo.lock.mockResolvedValue(null);
      await expect(expenses.update(user, expenseId, dto() as never)).rejects.toMatchObject({ status: 404, message: 'Gasto no encontrado.' });
      await expect(expenses.remove(user, expenseId)).rejects.toMatchObject({ status: 404, message: 'Gasto no encontrado.' });
      await expect(expenses.restore(user, expenseId)).rejects.toMatchObject({ status: 404, message: 'Gasto eliminado no encontrado.' });
      expect(access.lockHome).not.toHaveBeenCalled();
    });
    it('HU2.3 quien ya no pertenece al apartamento del gasto no puede editarlo', async () => {
      repo.lock.mockResolvedValue(stored());
      access.lockHome.mockRejectedValue(new ForbiddenException('No tienes acceso a este apartamento.'));
      await expect(expenses.update(user, expenseId, dto() as never)).rejects.toMatchObject({ status: 403 });
      expect(repo.update).not.toHaveBeenCalled();
    });
    it('HU2.3 al editar rechaza participantes ajenos y deja el gasto intacto', async () => {
      repo.lock.mockResolvedValue(stored());
      repo.activeMemberIds.mockResolvedValue([user.id]);
      await expect(expenses.update(user, expenseId, dto() as never)).rejects.toMatchObject({ status: 400 });
      expect(repo.update).not.toHaveBeenCalled();
      expect(repo.deleteShares).not.toHaveBeenCalled();
    });
  });
});
