import { DashboardService } from '../src/dashboard/dashboard.service';
import { DashboardRepository } from '../src/dashboard/dashboard.repository';
import { HomeAccessService } from '../src/access/home-access.service';
import { ActivitiesService } from '../src/activities/activities.service';
import { homeId, service, user } from './helpers';

describe('Resumen del inicio', () => {
  let dashboard: DashboardService;
  const repo = { tasks: jest.fn(), taskCount: jest.fn(), reservation: jest.fn(), balance: jest.fn(), shopping: jest.fn(), maintenance: jest.fn(), expenses: jest.fn() };
  const access = { requireHome: jest.fn() };
  const activities = { list: jest.fn() };
  beforeEach(async () => {
    jest.resetAllMocks(); repo.tasks.mockResolvedValue([]); repo.taskCount.mockResolvedValue(0); repo.reservation.mockResolvedValue(null);
    repo.balance.mockResolvedValue(0); repo.shopping.mockResolvedValue(0); repo.maintenance.mockResolvedValue(0); repo.expenses.mockResolvedValue([]); activities.list.mockResolvedValue([]);
    dashboard = await service(DashboardService, [{ provide: DashboardRepository, useValue: repo }, { provide: HomeAccessService, useValue: access }, { provide: ActivitiesService, useValue: activities }]);
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
    repo.tasks.mockResolvedValue([{ id: '1', title: 'Sin fecha', due_at: null }, { id: '2', title: 'Anterior', due_at: new Date('2000-01-01') }, { id: '3', title: 'Próxima', due_at: new Date('2099-01-01') }]);
    const tasks = (await dashboard.get(user.id, homeId)).summary.tasks;
    expect(tasks[0].due).toBe('Sin fecha límite'); expect(tasks[1].due).toMatch(/^Venció /); expect(tasks[2].due).toMatch(/^Vence /);
    expect(tasks[2].href).toBe('/tareas/3');
  });
  it('incluye la próxima reserva usando la zona horaria de Bogotá', async () => {
    repo.reservation.mockResolvedValue({ name: 'Sala', starts_at: new Date('2099-01-01T02:00:00Z') });
    expect((await dashboard.get(user.id, homeId)).summary.nextReservation).toContain('Sala · 31');
  });
  it('propaga un error real en vez de mostrar contadores falsos', async () => {
    repo.shopping.mockRejectedValue(new Error('Sin conexión'));
    await expect(dashboard.get(user.id, homeId)).rejects.toThrow('Sin conexión');
  });
});
