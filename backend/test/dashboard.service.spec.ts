import { DashboardService } from '../src/dashboard/dashboard.service';
import { DashboardRepository } from '../src/dashboard/dashboard.repository';
import { HomeAccessService } from '../src/access/home-access.service';
import { ActivitiesService } from '../src/activities/activities.service';
import { TasksService } from '../src/tasks/tasks.service';
import { ReservationsService } from '../src/reservations/reservations.service';
import { homeId, service, user } from './helpers';

describe('Resumen del inicio', () => {
  let dashboard: DashboardService;
  const repo = { balance: jest.fn(), shopping: jest.fn(), maintenance: jest.fn(), expenses: jest.fn() };
  const access = { requireHome: jest.fn() };
  const activities = { list: jest.fn() };
  const tasks = { assignedSummary: jest.fn() };
  const reservations = { next: jest.fn() };
  beforeEach(async () => {
    jest.resetAllMocks(); tasks.assignedSummary.mockResolvedValue({ tasks: [], total: 0 }); reservations.next.mockResolvedValue(null);
    repo.balance.mockResolvedValue(0); repo.shopping.mockResolvedValue(0); repo.maintenance.mockResolvedValue(0); repo.expenses.mockResolvedValue([]); activities.list.mockResolvedValue([]);
    dashboard = await service(DashboardService, [{ provide: DashboardRepository, useValue: repo }, { provide: HomeAccessService, useValue: access }, { provide: ActivitiesService, useValue: activities },
      { provide: TasksService, useValue: tasks }, { provide: ReservationsService, useValue: reservations }]);
  });
  it('un apartamento nuevo tiene contadores vacíos sin datos inventados', async () => {
    expect(await dashboard.get(user.id, homeId)).toEqual({ summary: { balance: 0, pendingTasks: 0, shoppingItems: 0, urgentMaintenance: 0, nextReservation: null, tasks: [], expenses: [] }, activities: [] });
  });
  it('solo consulta el resumen después de revisar acceso', async () => {
    access.requireHome.mockRejectedValue(new Error('Sin acceso'));
    await expect(dashboard.get(user.id, homeId)).rejects.toThrow('Sin acceso');
    expect(repo.balance).not.toHaveBeenCalled();
  });
  it('convierte los montos de PostgreSQL a números y conserva los títulos del usuario', async () => {
    repo.expenses.mockResolvedValue([{ id: 'gasto', title: 'Mercado compartido', amount: '15000.50' }]);
    expect((await dashboard.get(user.id, homeId)).summary.expenses).toEqual([{ id: 'gasto', title: 'Mercado compartido', amount: 15000.5, href: '/gastos' }]);
  });
  it('distingue tareas sin fecha, vencidas y próximas', async () => {
    tasks.assignedSummary.mockResolvedValue({ total: 3, tasks: [{ id: '1', title: 'Sin fecha', due_at: null }, { id: '2', title: 'Anterior', due_at: new Date('2000-01-01') }, { id: '3', title: 'Próxima', due_at: new Date('2099-01-01') }] });
    const shown = (await dashboard.get(user.id, homeId)).summary.tasks;
    expect(shown[0].due).toBe('Sin fecha límite'); expect(shown[1].due).toMatch(/^Venció /); expect(shown[2].due).toMatch(/^Vence /);
    expect(shown[2].href).toBe('/tareas/3');
  });
  it('HU3.5 usa el resumen del módulo de tareas para contar las tareas abiertas de la persona', async () => {
    tasks.assignedSummary.mockResolvedValue({ total: 7, tasks: [] });
    expect((await dashboard.get(user.id, homeId)).summary.pendingTasks).toBe(7);
    expect(tasks.assignedSummary).toHaveBeenCalledWith(homeId, user.id);
    expect(reservations.next).toHaveBeenCalledWith(homeId);
  });
  it('incluye la próxima reserva usando la zona horaria de Bogotá', async () => {
    reservations.next.mockResolvedValue({ name: 'Sala', starts_at: new Date('2099-01-01T02:00:00Z') });
    expect((await dashboard.get(user.id, homeId)).summary.nextReservation).toContain('Sala · 31');
  });
  it('propaga un error real en vez de mostrar contadores falsos', async () => {
    repo.shopping.mockRejectedValue(new Error('Sin conexión'));
    await expect(dashboard.get(user.id, homeId)).rejects.toThrow('Sin conexión');
  });
});
