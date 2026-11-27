import { MaintenanceReport } from '../src/maintenance/maintenance.entity';
import { applyChanges, canUpdateReport, invalidFilter, normalizeFilters, toReportView } from '../src/maintenance/maintenance.rules';

const reporter = '00000000-0000-4000-8000-000000000001';
const assignee = '00000000-0000-4000-8000-000000000002';
const stranger = '00000000-0000-4000-8000-000000000003';
const report = (over: Partial<MaintenanceReport> = {}) => Object.assign(new MaintenanceReport(), {
  id: 'r1', home_id: 'h1', title: 'Fuga', description: 'Cocina', category: 'Plomería', estimated_cost: '25.50', priority: 'ALTA', status: 'PENDIENTE',
  reported_by: reporter, assigned_membership_id: 'm1', ...over,
});

describe('Reglas de mantenimiento', () => {
  describe('filtros', () => {
    it('acepta los estados y prioridades permitidos y los filtros vacíos', () => {
      expect(invalidFilter({})).toBeNull();
      expect(invalidFilter({ status: 'EN_PROGRESO', priority: 'URGENTE', category: 'cualquiera' })).toBeNull();
      expect(invalidFilter({ status: '', priority: '' })).toBeNull();
    });
    it.each([['pendiente'], ['OTRO'], ['RESUELTO '], ['__proto__']])('rechaza el estado %j', status => expect(invalidFilter({ status })).toBe('estado'));
    it.each([['alta'], ['CRITICA']])('rechaza la prioridad %j', priority => expect(invalidFilter({ priority })).toBe('prioridad'));
    it('si el estado y la prioridad fallan se avisa primero del estado', () => expect(invalidFilter({ status: 'x', priority: 'y' })).toBe('estado'));
    it('un filtro vacío se convierte en null para no filtrar', () => {
      expect(normalizeFilters({ status: '', priority: undefined, category: '' })).toEqual({ status: null, priority: null, category: null });
      expect(normalizeFilters({ status: 'PENDIENTE', priority: 'ALTA', category: 'Plomería' })).toEqual({ status: 'PENDIENTE', priority: 'ALTA', category: 'Plomería' });
    });
  });

  describe('permisos de actualización', () => {
    it('pueden actualizar quien reportó, el responsable y un administrador', () => {
      expect(canUpdateReport('member', reporter, null, reporter)).toBe(true);
      expect(canUpdateReport('member', reporter, assignee, assignee)).toBe(true);
      expect(canUpdateReport('admin', reporter, null, stranger)).toBe(true);
    });
    it('otro integrante no puede, ni siquiera si el reporte no tiene responsable', () => {
      expect(canUpdateReport('member', reporter, assignee, stranger)).toBe(false);
      expect(canUpdateReport('member', reporter, null, stranger)).toBe(false);
    });
  });

  describe('valores finales tras los cambios', () => {
    it('sin cambios conserva todo', () => {
      expect(applyChanges(report(), {})).toEqual({
        title: 'Fuga', description: 'Cocina', category: 'Plomería', estimated_cost: '25.50', priority: 'ALTA', status: 'PENDIENTE', assigned_membership_id: 'm1',
      });
    });
    it('aplica solo lo enviado y da formato de centavos al costo', () => {
      expect(applyChanges(report(), { status: 'RESUELTO', estimated_cost: 12000.5 })).toMatchObject({ status: 'RESUELTO', estimated_cost: '12000.50', title: 'Fuga' });
    });
    it('null borra el costo y el responsable, pero no se confunde con "sin cambio"', () => {
      expect(applyChanges(report(), { estimated_cost: null, assigned_membership_id: null })).toMatchObject({ estimated_cost: null, assigned_membership_id: null });
      expect(applyChanges(report({ estimated_cost: null }), { title: 'Nuevo' }).estimated_cost).toBeNull();
    });
    it('un costo de cero es un valor y una descripción vacía también', () => {
      expect(applyChanges(report(), { estimated_cost: 0 }).estimated_cost).toBe('0.00');
      expect(applyChanges(report(), { description: '' }).description).toBe('');
    });
  });

  describe('vista del reporte', () => {
    const row = {
      id: 'r1', title: 'Fuga', description: '', category: 'Plomería', estimated_cost: '45000.00', priority: 'ALTA' as const, status: 'PENDIENTE' as const,
      reported_by: reporter, reported_by_name: 'Miguel', assigned_membership_id: 'm1', assigned_to: 'Tomás', assigned_user_id: assignee,
      created_at: new Date('2026-11-25'), updated_at: new Date('2026-11-25'),
    };
    it('convierte el costo a número, deja null si no hay y no expone el id de la cuenta del responsable', () => {
      const view = toReportView(row, 'member', reporter);
      expect(view.estimated_cost).toBe(45000);
      expect(toReportView({ ...row, estimated_cost: null }, 'member', reporter).estimated_cost).toBeNull();
      expect('assigned_user_id' in view).toBe(false);
    });
    it('puede editar quien reportó o un administrador; puede gestionar además el responsable', () => {
      expect(toReportView(row, 'member', reporter)).toMatchObject({ can_edit: true, can_manage: true });
      expect(toReportView(row, 'member', assignee)).toMatchObject({ can_edit: false, can_manage: true });
      expect(toReportView(row, 'member', stranger)).toMatchObject({ can_edit: false, can_manage: false });
      expect(toReportView(row, 'admin', stranger)).toMatchObject({ can_edit: true, can_manage: true });
    });
  });
});
