import { fromCents, hasCentPrecision, splitCents, toCents } from '../src/common/money.rules';
import { canManageRecord } from '../src/common/permissions.rules';
import { hasChanges, requireHomeId } from '../src/common/params';

describe('Dinero en centavos', () => {
  it.each([0, 1, 100.01, 3500.5, 9999999999.99, 1e21, 5e-1])('acepta %s: tiene como máximo dos decimales', value => {
    expect(hasCentPrecision(value)).toBe(true);
  });
  it.each([1.005, 0.001, 10.123, 1e-7, 1.5e-7, 2.345e-1])('rechaza %s: tiene fracciones de centavo', value => {
    expect(hasCentPrecision(value)).toBe(false);
  });
  it('convierte importes de número y de texto de PostgreSQL a centavos exactos', () => {
    expect(toCents(0.29)).toBe(29);
    expect(toCents(1.15)).toBe(115);
    expect(toCents('10.25')).toBe(1025);
    expect(toCents('0.00')).toBe(0);
    expect(toCents('-40.00')).toBe(-4000);
  });
  it('convierte centavos a texto con dos decimales', () => {
    expect(fromCents(1)).toBe('0.01');
    expect(fromCents(334)).toBe('3.34');
    expect(fromCents(1000000)).toBe('10000.00');
  });
  it('reparte un total sin perder ni inventar centavos', () => {
    expect(splitCents(1000, 3)).toEqual([334, 333, 333]);
    expect(splitCents(1, 4)).toEqual([1, 0, 0, 0]);
    expect(splitCents(1200, 4)).toEqual([300, 300, 300, 300]);
    expect(splitCents(10001, 2)).toEqual([5001, 5000]);
  });
  it.each([[1, 1], [2, 3], [9999, 7], [1000000, 8], [7, 8]])('las cuotas de %s centavos entre %s personas suman el total', (total, parts) => {
    const shares = splitCents(total, parts);
    expect(shares).toHaveLength(parts);
    expect(shares.reduce((sum, share) => sum + share, 0)).toBe(total);
    expect(Math.max(...shares) - Math.min(...shares)).toBeLessThanOrEqual(1);
  });
  it('rechaza repartos imposibles', () => {
    expect(() => splitCents(100, 0)).toThrow(RangeError);
    expect(() => splitCents(1.5, 2)).toThrow(RangeError);
    expect(() => splitCents(-1, 2)).toThrow(RangeError);
    expect(() => splitCents(100, 1.5)).toThrow(RangeError);
  });
});

describe('Permisos comunes de los registros', () => {
  it('un administrador gestiona cualquier registro', () => expect(canManageRecord('admin', 'otra', 'yo')).toBe(true));
  it('quien creó el registro lo gestiona', () => expect(canManageRecord('member', 'yo', 'yo')).toBe(true));
  it('otro integrante no gestiona un registro ajeno', () => expect(canManageRecord('member', 'otra', 'yo')).toBe(false));
});

describe('Parámetros de las rutas', () => {
  it('exige indicar el apartamento', () => {
    expect(() => requireHomeId(undefined)).toThrow('Selecciona un apartamento.');
    expect(() => requireHomeId('')).toThrow('Selecciona un apartamento.');
    expect(requireHomeId('abc')).toBe('abc');
  });
  it('distingue un cuerpo con cambios de uno vacío, aunque las clases declaren sus campos como undefined', () => {
    expect(hasChanges({ title: undefined, quantity: undefined })).toBe(false);
    expect(hasChanges({})).toBe(false);
    expect(hasChanges({ title: undefined, quantity: 0 })).toBe(true);
    expect(hasChanges({ assigned_membership_id: null })).toBe(true);
  });
});
