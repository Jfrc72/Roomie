import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { ExpenseDto, PaymentDto } from '../src/expenses/expenses.dto';
import { isDateOnly } from '../src/common/validators';

const id = '00000000-0000-4000-8000-000000000001';
const validation = (type: new () => object, value: object) => validateSync(plainToInstance(type, value), { whitelist: true, forbidNonWhitelisted: true });
const expense = (over: object = {}) => ({ title: 'Mercado', category: 'Mercado', total_amount: 100.01, expense_date: '2026-11-25', participant_ids: [id], ...over });
const invalid = (over: object) => validation(ExpenseDto, expense(over)).length > 0;

describe('Validación de gastos y pagos', () => {
  it('acepta un gasto completo y también uno sin pagador, que se asumirá quien lo registra', () => {
    expect(validation(ExpenseDto, expense({ paid_by_id: id }))).toHaveLength(0);
    expect(validation(ExpenseDto, expense())).toHaveLength(0);
  });
  it('quita los espacios del concepto y de la categoría', () => {
    const dto = plainToInstance(ExpenseDto, expense({ title: '  Mercado  ', category: ' Varios ' }));
    expect(dto).toMatchObject({ title: 'Mercado', category: 'Varios' });
  });
  it.each([0, -5, 1.005, 0.001, 1e-7, 10000000000, '100', null, true])('rechaza el monto %s', total_amount => {
    expect(invalid({ total_amount })).toBe(true);
  });
  it.each([0.01, 1, 100.01, 9999999999.99])('acepta el monto %s', total_amount => {
    expect(invalid({ total_amount })).toBe(false);
  });
  it.each(['2026-02-30', '2026-13-01', '2026-2-3', '2026-02-10T10:00:00Z', '10/02/2026', '', 20261125, null])('rechaza la fecha %s', expense_date => {
    expect(invalid({ expense_date })).toBe(true);
  });
  it('acepta fechas bisiestas reales y rechaza el 29 de febrero de un año común', () => {
    expect(invalid({ expense_date: '2028-02-29' })).toBe(false);
    expect(invalid({ expense_date: '2026-02-29' })).toBe(true);
    expect(isDateOnly('2026-12-31')).toBe(true);
    expect(isDateOnly(undefined)).toBe(false);
  });
  it.each([[[]], ['x'], [Array(9).fill(id)], [['no-es-uuid']], [[id, 5]], [null]])('rechaza los participantes %j', participant_ids => {
    expect(invalid({ participant_ids })).toBe(true);
  });
  it('admite entre uno y ocho participantes', () => {
    expect(invalid({ participant_ids: [id] })).toBe(false);
    expect(invalid({ participant_ids: Array(8).fill(id) })).toBe(false);
  });
  it.each([[{ title: '' }], [{ title: 'x' }], [{ title: 'a'.repeat(256) }], [{ title: 5 }], [{ category: '' }], [{ category: 'a'.repeat(51) }], [{ paid_by_id: 'no-es-uuid' }], [{ paid_by_id: null }]])('rechaza %j', over => {
    expect(invalid(over)).toBe(true);
  });
  it('rechaza campos que no existen, como un rol o el creador del gasto', () => {
    expect(invalid({ created_by: id })).toBe(true);
    expect(invalid({ role: 'admin' })).toBe(true);
  });
  it('un abono necesita receptor y un monto positivo con dos decimales como máximo', () => {
    expect(validation(PaymentDto, { receiver_id: id, amount: 25000.5 })).toHaveLength(0);
    for (const amount of [0, -1, 0.001, '10', null]) expect(validation(PaymentDto, { receiver_id: id, amount }).length).toBeGreaterThan(0);
    expect(validation(PaymentDto, { receiver_id: 'x', amount: 5 }).length).toBeGreaterThan(0);
    expect(validation(PaymentDto, { amount: 5 }).length).toBeGreaterThan(0);
    expect(validation(PaymentDto, { receiver_id: id, amount: 5, payer_id: id }).length).toBeGreaterThan(0);
  });
});
