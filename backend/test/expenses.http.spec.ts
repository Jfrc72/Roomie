import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ExpensesController } from '../src/expenses/expenses.controller';
import { PaymentsController } from '../src/expenses/payments.controller';
import { ExpensesService } from '../src/expenses/expenses.service';
import { homeId, user } from './helpers';
import { startApi, TestApi } from './http-app';

const other = '00000000-0000-4000-8000-000000000002';
const expenseId = '00000000-0000-4000-8000-000000000030';
const body = (over: object = {}) => ({ title: '  Mercado  ', category: 'Mercado', total_amount: 100.01, expense_date: '2026-11-25', participant_ids: [other], ...over });

describe('Rutas HTTP de gastos y pagos', () => {
  const expenses = { list: jest.fn(), create: jest.fn(), update: jest.fn(), remove: jest.fn(), restore: jest.fn(), pay: jest.fn() };
  const providers = [{ provide: ExpensesService, useValue: expenses }];
  let api: TestApi;
  beforeEach(() => { jest.resetAllMocks(); });
  beforeAll(async () => { api = await startApi([ExpensesController, PaymentsController], providers); });
  afterAll(() => api.close());

  it('GET /expenses entrega el resumen dentro de {data} y pasa el apartamento al servicio', async () => {
    expenses.list.mockResolvedValue({ expenses: [], summary: { total_month: 0 } });
    const reply = await api.call(`/expenses?homeId=${homeId}`);
    expect(reply).toEqual({ status: 200, body: { data: { expenses: [], summary: { total_month: 0 } } } });
    expect(expenses.list).toHaveBeenCalledWith(user.id, homeId);
  });
  it('POST /expenses responde 200 con el id y entrega al servicio los datos ya limpios', async () => {
    expenses.create.mockResolvedValue({ id: expenseId, message: 'Gasto registrado.' });
    const reply = await api.call(`/expenses?homeId=${homeId}`, 'POST', body());
    expect(reply).toEqual({ status: 200, body: { data: { id: expenseId, message: 'Gasto registrado.' } } });
    expect(expenses.create).toHaveBeenCalledWith(user, homeId, expect.objectContaining({ title: 'Mercado', total_amount: 100.01, participant_ids: [other] }));
  });
  it.each([
    ['un monto de cero', { total_amount: 0 }],
    ['fracciones de centavo', { total_amount: 1.005 }],
    ['una fecha inexistente', { expense_date: '2026-02-30' }],
    ['una lista de participantes vacía', { participant_ids: [] }],
    ['un campo que no existe', { created_by: other }],
  ])('POST /expenses rechaza %s con 400 y no llega al servicio', async (_name, over) => {
    const reply = await api.call(`/expenses?homeId=${homeId}`, 'POST', body(over));
    expect(reply).toEqual({ status: 400, body: { error: 'Revisa los campos: los datos no son válidos.' } });
    expect(expenses.create).not.toHaveBeenCalled();
  });
  it('PATCH /expenses/:id valida el identificador y el cuerpo', async () => {
    expenses.update.mockResolvedValue({ message: 'Gasto actualizado.' });
    expect((await api.call(`/expenses/${expenseId}`, 'PATCH', body())).body).toEqual({ data: { message: 'Gasto actualizado.' } });
    expect(await api.call('/expenses/no-es-un-uuid', 'PATCH', body())).toEqual({ status: 400, body: { error: 'Identificador inválido.' } });
    expect((await api.call(`/expenses/${expenseId}`, 'PATCH', body({ total_amount: -3 }))).status).toBe(400);
    expect(expenses.update).toHaveBeenCalledTimes(1);
  });
  it('DELETE y restore responden 200 y usan el usuario de la sesión', async () => {
    expenses.remove.mockResolvedValue({ message: 'Gasto eliminado.' });
    expenses.restore.mockResolvedValue({ message: 'Gasto restaurado.' });
    expect((await api.call(`/expenses/${expenseId}`, 'DELETE')).status).toBe(200);
    expect((await api.call(`/expenses/${expenseId}/restore`, 'POST', {})).body).toEqual({ data: { message: 'Gasto restaurado.' } });
    expect(expenses.remove).toHaveBeenCalledWith(user, expenseId);
    expect(expenses.restore).toHaveBeenCalledWith(user, expenseId);
    expect((await api.call('/expenses/no-es-un-uuid/restore', 'POST', {})).status).toBe(400);
  });
  it('los errores del servicio llegan como {error} con su código HTTP', async () => {
    expenses.remove.mockRejectedValue(new ForbiddenException('Solo quien registró el gasto o un administrador puede eliminarlo.'));
    expenses.restore.mockRejectedValue(new NotFoundException('Gasto eliminado no encontrado.'));
    expenses.list.mockRejectedValue(new Error('fallo interno con datos sensibles'));
    const log = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(await api.call(`/expenses/${expenseId}`, 'DELETE')).toEqual({ status: 403, body: { error: 'Solo quien registró el gasto o un administrador puede eliminarlo.' } });
    expect(await api.call(`/expenses/${expenseId}/restore`, 'POST', {})).toEqual({ status: 404, body: { error: 'Gasto eliminado no encontrado.' } });
    const failure = await api.call(`/expenses?homeId=${homeId}`);
    // Un error inesperado nunca filtra su mensaje al cliente: solo se registra en el servidor.
    expect(failure).toEqual({ status: 500, body: { error: 'No pudimos completar la operación. Intenta nuevamente.' } });
    expect(log).toHaveBeenCalledTimes(1);
    log.mockRestore();
  });
  it('POST /payments registra un abono y valida el cuerpo', async () => {
    expenses.pay.mockResolvedValue({ message: 'Pago registrado.' });
    expect(await api.call(`/payments?homeId=${homeId}`, 'POST', { receiver_id: other, amount: 10 })).toEqual({ status: 200, body: { data: { message: 'Pago registrado.' } } });
    expect(expenses.pay).toHaveBeenCalledWith(user, homeId, expect.objectContaining({ receiver_id: other, amount: 10 }));
    expect((await api.call(`/payments?homeId=${homeId}`, 'POST', { receiver_id: other, amount: 0 })).status).toBe(400);
    expect((await api.call(`/payments?homeId=${homeId}`, 'POST', { receiver_id: 'x', amount: 5 })).status).toBe(400);
    expect(expenses.pay).toHaveBeenCalledTimes(1);
  });
  it('un método no declarado no existe en la ruta', async () => {
    expect((await api.call('/expenses', 'PUT', body())).status).toBe(404);
  });
});

describe('Seguridad de las rutas de gastos', () => {
  const expenses = { list: jest.fn(), create: jest.fn(), pay: jest.fn() };
  it('sin sesión ninguna ruta llega al servicio y todas responden 401', async () => {
    const anonymous = await startApi([ExpensesController, PaymentsController], [{ provide: ExpensesService, useValue: expenses }], null);
    try {
      expect(await anonymous.call(`/expenses?homeId=${homeId}`)).toEqual({ status: 401, body: { error: 'Inicia sesión para continuar.' } });
      expect((await anonymous.call(`/expenses?homeId=${homeId}`, 'POST', body())).status).toBe(401);
      expect((await anonymous.call(`/payments?homeId=${homeId}`, 'POST', { receiver_id: other, amount: 1 })).status).toBe(401);
      expect(expenses.list).not.toHaveBeenCalled();
      expect(expenses.create).not.toHaveBeenCalled();
      expect(expenses.pay).not.toHaveBeenCalled();
    } finally {
      await anonymous.close();
    }
  });
});
