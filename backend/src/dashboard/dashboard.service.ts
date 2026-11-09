import { Injectable } from '@nestjs/common';
import { HomeAccessService } from '../access/home-access.service';
import { ActivitiesService } from '../activities/activities.service';
import { formatHomeDate } from '../common/format';
import { DashboardRepository } from './dashboard.repository';

@Injectable()
export class DashboardService {
  constructor(private readonly repository: DashboardRepository, private readonly access: HomeAccessService, private readonly activities: ActivitiesService) {}
  async get(userId: string, homeId: string) {
    await this.access.requireHome(userId, homeId);
    const [tasks, pendingTasks, reservation, balance, shoppingItems, urgentMaintenance, expenses, activities] = await Promise.all([
      this.repository.tasks(homeId, userId), this.repository.taskCount(homeId, userId), this.repository.reservation(homeId),
      this.repository.balance(homeId, userId), this.repository.shopping(homeId), this.repository.maintenance(homeId),
      this.repository.expenses(homeId), this.activities.list(homeId),
    ]);
    return { summary: {
      balance, pendingTasks, shoppingItems, urgentMaintenance,
      nextReservation: reservation ? `${reservation.name} · ${formatHomeDate(reservation.starts_at)}` : null,
      tasks: tasks.map(task => ({ id: task.id, title: task.title, due: !task.due_at ? 'Sin fecha límite' : `${task.due_at < new Date() ? 'Venció' : 'Vence'} ${formatHomeDate(task.due_at)}`, href: `/tareas/${task.id}` })),
      expenses: expenses.map(expense => ({ ...expense, amount: Number(expense.amount), href: '/gastos' })),
    }, activities };
  }
}
