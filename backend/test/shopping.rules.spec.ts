import { ShoppingItem } from '../src/shopping/shopping.entity';
import { applyChanges, editsDetails, toItemView } from '../src/shopping/shopping.rules';

const owner = '00000000-0000-4000-8000-000000000001';
const buyer = '00000000-0000-4000-8000-000000000002';
const membership = '00000000-0000-4000-8000-000000000030';
const item = (over: Partial<ShoppingItem> = {}) => Object.assign(new ShoppingItem(), {
  id: 'i1', home_id: 'h1', title: 'Arroz', category: 'Alimentos', quantity: 2, estimated_price: '3.50', status: 'PENDIENTE',
  added_by: owner, assigned_membership_id: null, bought_by: null, ...over,
});

describe('Reglas de la lista de compras', () => {
  describe('quién puede cambiar qué', () => {
    it('cambiar solo el estado lo puede hacer cualquier integrante', () => expect(editsDetails({ status: 'COMPRADO' })).toBe(false));
    it.each([{ title: 'x' }, { category: 'Hogar' }, { quantity: 1 }, { estimated_price: 0 }, { assigned_membership_id: null }])('editar %j exige ser autor o administrador', patch => {
      expect(editsDetails(patch as never)).toBe(true);
    });
    it('un cuerpo con campos undefined no cuenta como edición', () => expect(editsDetails({ title: undefined, status: 'COMPRADO' })).toBe(false));
  });

  describe('quién compró', () => {
    it('al marcar comprado se registra a quien lo marca', () => {
      expect(applyChanges(item(), { status: 'COMPRADO' }, buyer)).toMatchObject({ status: 'COMPRADO', bought_by: buyer });
    });
    it('si ya tenía comprador se conserva aunque otra persona vuelva a marcarlo', () => {
      expect(applyChanges(item({ status: 'COMPRADO', bought_by: owner }), { status: 'COMPRADO' }, buyer).bought_by).toBe(owner);
    });
    it('editar un producto comprado sin tocar el estado no cambia al comprador', () => {
      expect(applyChanges(item({ status: 'COMPRADO', bought_by: owner }), { quantity: 5 }, buyer)).toMatchObject({ status: 'COMPRADO', bought_by: owner, quantity: 5 });
    });
    it('editar un producto pendiente no inventa un comprador', () => {
      expect(applyChanges(item(), { quantity: 5 }, buyer).bought_by).toBeNull();
    });
    it('reactivar borra al comprador', () => {
      expect(applyChanges(item({ status: 'COMPRADO', bought_by: owner }), { status: 'PENDIENTE' }, buyer)).toMatchObject({ status: 'PENDIENTE', bought_by: null });
    });
  });

  describe('valores finales tras los cambios', () => {
    it('conserva lo que no se envía y da formato de centavos al precio', () => {
      expect(applyChanges(item(), { estimated_price: 4.5 }, owner)).toEqual({
        title: 'Arroz', category: 'Alimentos', quantity: 2, estimated_price: '4.50', status: 'PENDIENTE', bought_by: null, assigned_membership_id: null,
      });
    });
    it('un precio de cero es un valor y no "sin cambio"', () => {
      expect(applyChanges(item(), { estimated_price: 0 }, owner).estimated_price).toBe('0.00');
    });
    it('distingue entre no tocar la asignación y quitarla', () => {
      const assigned = item({ assigned_membership_id: membership });
      expect(applyChanges(assigned, { quantity: 1 }, owner).assigned_membership_id).toBe(membership);
      expect(applyChanges(assigned, { assigned_membership_id: null }, owner).assigned_membership_id).toBeNull();
      expect(applyChanges(item(), { assigned_membership_id: membership }, owner).assigned_membership_id).toBe(membership);
    });
  });

  describe('vista del producto', () => {
    const row = { id: 'i1', title: 'Arroz', category: 'Alimentos', quantity: 2, estimated_price: '8500.00', status: 'PENDIENTE' as const, added_by: owner, added_by_name: 'Miguel', bought_by: null, bought_by_name: null, assigned_membership_id: null, assigned_to: null, created_at: new Date('2026-11-25') };
    it('convierte el precio a número y conserva los nombres', () => {
      expect(toItemView(row, 'member', owner)).toMatchObject({ estimated_price: 8500, quantity: 2, added_by_name: 'Miguel' });
    });
    it('solo el autor o un administrador puede editar', () => {
      expect(toItemView(row, 'member', owner).can_edit).toBe(true);
      expect(toItemView(row, 'member', buyer).can_edit).toBe(false);
      expect(toItemView(row, 'admin', buyer).can_edit).toBe(true);
    });
  });
});
