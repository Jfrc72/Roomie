import { LedgerRow } from '../src/expenses/expenses.entity';
import { buildShares, canPay, groupBalances, netBalance, summarize, toExpenseView, viewerStatus } from '../src/expenses/expenses.rules';

const owner = '00000000-0000-4000-8000-000000000001';
const second = '00000000-0000-4000-8000-000000000002';
const third = '00000000-0000-4000-8000-000000000003';

describe('Reparto de un gasto', () => {
  it('el pagador va primero, asume el centavo sobrante y su cuota nace pagada', () => {
    expect(buildShares(10, owner, [second, third])).toEqual([
      { userId: owner, amount: '3.34', status: 'PAGADO' },
      { userId: second, amount: '3.33', status: 'PENDIENTE' },
      { userId: third, amount: '3.33', status: 'PENDIENTE' },
    ]);
  });
  it('el pagador participa aunque no esté en la lista y no se repite si sí está', () => {
    expect(buildShares(20, owner, [second]).map(share => share.userId)).toEqual([owner, second]);
    expect(buildShares(20, owner, [owner, second, second]).map(share => share.userId)).toEqual([owner, second]);
  });
  it('un gasto de una sola persona es una única cuota pagada por el total', () => {
    expect(buildShares(45.5, owner, [owner])).toEqual([{ userId: owner, amount: '45.50', status: 'PAGADO' }]);
  });
  it.each([[100.01, 2], [0.01, 3], [1234567.89, 8], [99.99, 7]])('las cuotas de %s entre %s personas suman el total exacto', (total, people) => {
    const ids = Array.from({ length: people - 1 }, (_, index) => `00000000-0000-4000-8000-0000000001${String(index).padStart(2, '0')}`);
    const shares = buildShares(total, owner, ids);
    expect(shares.reduce((sum, share) => sum + Math.round(Number(share.amount) * 100), 0)).toBe(Math.round(total * 100));
  });
});

describe('Saldos entre integrantes', () => {
  const ledger: LedgerRow[] = [
    { direction: 'i_owe', user_id: second, member: 'Tomás', gross: '12.50' },
    { direction: 'owes_me', user_id: third, member: 'Juan', gross: '3.25' },
    { direction: 'owes_me', user_id: '4', member: 'Ana', gross: '0.10' },
  ];
  it('separa lo que debo de lo que me deben y convierte los importes a número', () => {
    expect(groupBalances(ledger)).toEqual({
      i_owe: [{ user_id: second, member: 'Tomás', amount: 12.5 }],
      owes_me: [{ user_id: third, member: 'Juan', amount: 3.25 }, { user_id: '4', member: 'Ana', amount: 0.1 }],
    });
  });
  it('un libro vacío no tiene saldos', () => {
    expect(groupBalances([])).toEqual({ owes_me: [], i_owe: [] });
    expect(netBalance(groupBalances([]))).toBe(0);
  });
  it('el saldo neto se calcula en centavos sin errores de coma flotante', () => {
    // 0,1 + 0,2 en coma flotante da 0,30000000000000004; en centavos da exactamente 0,30.
    const balances = groupBalances([
      { direction: 'owes_me', user_id: second, member: 'A', gross: '0.10' },
      { direction: 'owes_me', user_id: third, member: 'B', gross: '0.20' },
    ]);
    expect(netBalance(balances)).toBe(0.3);
    expect(summarize({ total_month: '0', your_share: '0' }, balances).you_are_owed).toBe(0.3);
  });
  it('el saldo neto resta lo que debo de lo que me deben', () => {
    expect(netBalance(groupBalances(ledger))).toBe(-9.15);
  });
  it('el resumen convierte los importes del mes y de los saldos', () => {
    expect(summarize({ total_month: '100.50', your_share: '30.25' }, groupBalances(ledger))).toEqual({
      total_month: 100.5, your_share: 30.25, you_are_owed: 3.35, you_owe: 12.5,
    });
  });
});

describe('Estado de la cuota de quien consulta', () => {
  it('una persona que no participa no tiene estado', () => expect(viewerStatus(null, owner, new Set())).toBeNull());
  it('una cuota pagada sigue pagada', () => expect(viewerStatus('PAGADO', owner, new Set([owner]))).toBe('PAGADO'));
  it('una cuota pendiente sigue pendiente mientras se le deba algo a quien pagó', () => {
    expect(viewerStatus('PENDIENTE', owner, new Set([owner]))).toBe('PENDIENTE');
  });
  it('una cuota pendiente se muestra pagada cuando la deuda con quien pagó ya quedó saldada', () => {
    expect(viewerStatus('PENDIENTE', owner, new Set([third]))).toBe('PAGADO');
  });
});

describe('Vista del gasto', () => {
  const row = {
    id: 'g1', title: 'Mercado', category: 'Mercado', total_amount: '100.01', expense_date: '2026-11-25', paid_by: owner,
    paid_by_name: 'Miguel', created_by: owner, user_status: 'PENDIENTE' as const,
    shares: [{ id: 's1', user_id: owner, member: 'Miguel', amount: '50.01', status: 'PAGADO' as const, paid_at: null }],
  };
  it('convierte los importes en números y conserva la fecha como texto', () => {
    const view = toExpenseView(row, 'member', owner, new Set([owner]));
    expect(view.total_amount).toBe(100.01);
    expect(view.shares[0].amount).toBe(50.01);
    expect(view.expense_date).toBe('2026-11-25');
    expect(view.user_status).toBe('PENDIENTE');
  });
  it('solo quien lo creó o un administrador puede editarlo', () => {
    expect(toExpenseView(row, 'member', owner, new Set()).can_edit).toBe(true);
    expect(toExpenseView(row, 'member', second, new Set()).can_edit).toBe(false);
    expect(toExpenseView(row, 'admin', second, new Set()).can_edit).toBe(true);
  });
});

describe('Validez de un abono', () => {
  it('acepta abonar menos que la deuda y saldarla exactamente', () => {
    expect(canPay('40.00', 10)).toBe(true);
    expect(canPay('10.25', 10.25)).toBe(true);
    expect(canPay(10.25, 0.01)).toBe(true);
  });
  it('rechaza superar la deuda por un solo centavo', () => {
    expect(canPay('10.00', 10.01)).toBe(false);
    expect(canPay('40.00', 40.01)).toBe(false);
  });
  it('rechaza abonar si no se debe nada o si la deuda es a favor', () => {
    expect(canPay('0', 1)).toBe(false);
    expect(canPay('0.00', 0.01)).toBe(false);
    expect(canPay('-5.00', 1)).toBe(false);
  });
});
