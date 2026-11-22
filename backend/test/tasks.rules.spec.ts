import { canAdvance, canEditTask, isPastDue } from '../src/tasks/tasks.rules';

describe('Reglas de tareas', () => {
  it('HU3.4 sin responsable se puede avanzar, pero no retroceder ni repetir el estado', () => {
    const free = { assigned_membership_id: null, status: 'pending' as const };
    expect(canAdvance(free, 'in_progress')).toBe(true);
    expect(canAdvance(free, 'completed')).toBe(true);
    expect(canAdvance({ ...free, status: 'completed' }, 'pending')).toBe(false);
    expect(canAdvance(free, 'pending')).toBe(false);
  });
  it('HU3.4 con responsable solo cambian el estado el autor o un administrador', () => {
    expect(canAdvance({ assigned_membership_id: 'membresia', status: 'pending' }, 'completed')).toBe(false);
    expect(canEditTask({ created_by: 'autor' }, 'autor', 'member')).toBe(true);
    expect(canEditTask({ created_by: 'autor' }, 'otra', 'member')).toBe(false);
    expect(canEditTask({ created_by: 'autor' }, 'otra', 'admin')).toBe(true);
  });
  it('HU3.3 una fecha límite pasada se rechaza con un minuto de margen', () => {
    const now = new Date('2026-11-22T12:00:00Z').getTime();
    expect(isPastDue(null, now)).toBe(false);
    expect(isPastDue('2026-11-22T11:59:30Z', now)).toBe(false);
    expect(isPastDue(new Date('2026-11-22T11:58:00Z'), now)).toBe(true);
  });
});
