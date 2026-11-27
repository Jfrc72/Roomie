import { Injectable } from '@nestjs/common';
import { HomeAccessService } from '../access/home-access.service';
import { ActivitiesService } from '../activities/activities.service';
import { formatHomeDate } from '../common/format';
import { ExpensesService } from '../expenses/expenses.service';
import { MaintenanceService } from '../maintenance/maintenance.service';
import { ShoppingService } from '../shopping/shopping.service';
import { DashboardRepository } from './dashboard.repository';

@Injectable()
export class DashboardService {
  constructor(
    private readonly repository: DashboardRepository, private readonly access: HomeAccessService, private readonly activities: ActivitiesService,
    private readonly expenses: ExpensesService, private readonly shopping: ShoppingService, private readonly maintenance: MaintenanceService,
  ) {}
  async get(userId: string, homeId: string) {
    await this.access.requireHome(userId, homeId);
    // Gastos, compras y mantenimiento aportan su propio resumen: así no se repiten sus consultas aquí.
    const [tasks, pendingTasks, reservation, money, shopping, maintenance, activities] = await Promise.all([
      this.repository.tasks(homeId, userId), this.repository.taskCount(homeId, userId), this.repository.reservation(homeId),
      this.expenses.summary(homeId, userId), this.shopping.summary(homeId), this.maintenance.summary(homeId), this.activities.list(homeId),
    ]);
    return { summary: {
      balance: money.balance, pendingTasks, shoppingItems: shopping.pending, urgentMaintenance: maintenance.urgent,
      nextReservation: reservation ? `${reservation.name} · ${formatHomeDate(reservation.starts_at)}` : null,
      tasks: tasks.map(task => ({ id: task.id, title: task.title, due: !task.due_at ? 'Sin fecha límite' : `${task.due_at < new Date() ? 'Venció' : 'Vence'} ${formatHomeDate(task.due_at)}`, href: `/tareas/${task.id}` })),
      expenses: money.recent.map(expense => ({ ...expense, href: '/gastos' })),
    }, activities };
  }
}
