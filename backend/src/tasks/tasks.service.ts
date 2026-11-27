import { randomUUID } from 'node:crypto';
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';
import { HomeAccessService } from '../access/home-access.service';
import { ActivitiesService } from '../activities/activities.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SessionUser } from '../auth/auth.entity';
import { CreateTaskDto, UpdateTaskDto } from './tasks.dto';
import { TaskRow } from './tasks.entity';
import { TasksRepository } from './tasks.repository';
import { canAdvance, canEditTask, isPastDue, TaskStatus } from './tasks.rules';

const statusVerbs: Record<TaskStatus, string> = { pending: 'marcó como pendiente', in_progress: 'empezó', completed: 'completó' };
const time = (value: string | Date | null) => value ? new Date(value).getTime() : null;
type ReminderTask = Pick<TaskRow, 'id' | 'home_id' | 'title' | 'status' | 'due_at' | 'assignee_user_id'>;

function requireFutureDue(due: string | Date | null) {
  if (isPastDue(due)) throw new BadRequestException('La fecha límite no puede estar en el pasado.');
}

@Injectable()
export class TasksService {
  constructor(
    private readonly repository: TasksRepository,
    private readonly db: DatabaseService,
    private readonly access: HomeAccessService,
    private readonly activities: ActivitiesService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(userId: string, homeId: string) {
    const role = await this.access.requireHome(userId, homeId);
    const tasks = await this.repository.list(homeId);
    return tasks.map(task => ({ ...task, can_edit: canEditTask(task, userId, role) }));
  }

  async detail(userId: string, taskId: string) {
    const task = await this.repository.find(taskId);
    if (!task) throw new NotFoundException('Tarea no encontrada.');
    const role = await this.access.requireHome(userId, task.home_id);
    return { ...task, can_edit: canEditTask(task, userId, role), history: await this.repository.history(taskId) };
  }

  async create(user: SessionUser, homeId: string, data: CreateTaskDto) {
    await this.access.requireHome(user.id, homeId);
    requireFutureDue(data.due_at);
    return this.db.transaction(async client => {
      const assignee = await this.assignee(homeId, data.assigned_membership_id, client);
      const task = await this.repository.create(homeId, data, user.id, client);
      await this.repository.addHistory(task.id, user.id, null, 'pending', client);
      await this.activities.add(homeId, user.id, `creó la tarea "${task.title}"`, client);
      if (assignee && assignee !== user.id) await this.notifications.notify(client, {
        homeId, userId: assignee, title: 'Nueva tarea asignada', message: `${user.name} te asignó "${task.title}".`,
        href: `/tareas/${task.id}`, sourceKey: `task:${task.id}:created:${assignee}`,
      });
      await this.syncReminder({ ...task, assignee_user_id: assignee }, false, client);
      return { id: task.id, message: 'Tarea creada.' };
    });
  }

  update(user: SessionUser, taskId: string, data: UpdateTaskDto) {
    // Solo cuentan los campos enviados; un campo ausente conserva su valor.
    const changes = Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined)) as UpdateTaskDto;
    return this.db.transaction(async client => {
      const { task, role } = await this.lock(user.id, taskId, client);
      const onlyAdvances = Object.keys(changes).length === 1 && changes.status !== undefined && canAdvance(task, changes.status);
      if (!canEditTask(task, user.id, role) && !onlyAdvances) throw new ForbiddenException('Solo quien creó la tarea o un administrador pueden modificarla.');
      const next: TaskRow = { ...task, ...changes } as TaskRow;
      // Un responsable que ya no pertenece puede conservarse, pero no asignarse de nuevo.
      const reassigned = next.assigned_membership_id !== task.assigned_membership_id;
      if (reassigned) next.assignee_user_id = await this.assignee(task.home_id, next.assigned_membership_id, client);
      const dueChanged = time(next.due_at) !== time(task.due_at);
      if (dueChanged) requireFutureDue(next.due_at);
      await this.repository.update(next, client);
      if (reassigned || dueChanged || (['title', 'description', 'priority'] as const).some(key => next[key] !== task[key])) {
        await this.activities.add(task.home_id, user.id, `actualizó la tarea "${next.title}"`, client);
      }
      if (next.status !== task.status) {
        const historyId = await this.repository.addHistory(task.id, user.id, task.status, next.status, client);
        await this.activities.add(task.home_id, user.id, `${statusVerbs[next.status]} la tarea "${next.title}"`, client);
        if (next.status === 'completed' && task.created_by !== user.id) await this.notifications.notify(client, {
          homeId: task.home_id, userId: task.created_by, title: 'Tarea completada', message: `${user.name} completó "${next.title}".`,
          href: `/tareas/${task.id}`, sourceKey: `task:${task.id}:completed:${historyId}:${task.created_by}`,
        });
      }
      if (reassigned && next.assignee_user_id && next.assignee_user_id !== user.id) await this.notifications.notify(client, {
        homeId: task.home_id, userId: next.assignee_user_id, title: 'Nueva tarea asignada', message: `${user.name} te asignó "${next.title}".`,
        href: `/tareas/${task.id}`, sourceKey: `task:${task.id}:assigned:${randomUUID()}:${next.assignee_user_id}`,
      });
      await this.syncReminder(next, reassigned, client);
      return { message: 'Tarea actualizada.' };
    });
  }

  remove(userId: string, taskId: string) {
    return this.db.transaction(async client => {
      const { task, role } = await this.lock(userId, taskId, client);
      if (!canEditTask(task, userId, role)) throw new ForbiddenException('Solo quien creó la tarea o un administrador pueden eliminarla.');
      await this.notifications.cancelReminder(client, `task:${task.id}`);
      await this.repository.remove(task.id, client);
      await this.activities.add(task.home_id, userId, `eliminó la tarea "${task.title}"`, client);
      return { message: 'Tarea eliminada.' };
    });
  }

  // Resumen de Inicio. Quien lo llama ya comprobó el acceso al hogar.
  async assignedSummary(homeId: string, userId: string) {
    const [tasks, total] = await Promise.all([this.repository.openAssigned(homeId, userId), this.repository.countOpenAssigned(homeId, userId)]);
    return { tasks, total };
  }

  private async lock(userId: string, taskId: string, client: PoolClient) {
    const task = await this.repository.lock(taskId, client);
    if (!task) throw new NotFoundException('Tarea no encontrada.');
    return { task, role: await this.access.requireHome(userId, task.home_id, false, client) };
  }

  private async assignee(homeId: string, membershipId: string | null, client: PoolClient) {
    if (!membershipId) return null;
    const userId = await this.repository.activeMember(homeId, membershipId, client);
    if (!userId) throw new BadRequestException('El responsable debe ser un integrante activo del apartamento.');
    return userId;
  }

  // Un recordatorio por tarea. Al cambiar de responsable se crea de nuevo para que también le llegue.
  private async syncReminder(task: ReminderTask, reassigned: boolean, client: PoolClient) {
    const sourceKey = `task:${task.id}`;
    const pending = task.status !== 'completed' && task.due_at && task.assignee_user_id;
    if (reassigned || !pending) await this.notifications.cancelReminder(client, sourceKey);
    if (pending) await this.notifications.scheduleReminder(client, {
      homeId: task.home_id, userId: task.assignee_user_id!, sourceKey, title: 'Recordatorio de tarea',
      message: `Recuerda completar "${task.title}" antes de su fecha límite.`, href: `/tareas/${task.id}`, dueAt: new Date(task.due_at!),
    });
  }
}
