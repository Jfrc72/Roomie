import { TasksService } from '../src/tasks/tasks.service';
import { TasksRepository } from '../src/tasks/tasks.repository';
import { DatabaseService } from '../src/database/database.service';
import { HomeAccessService } from '../src/access/home-access.service';
import { ActivitiesService } from '../src/activities/activities.service';
import { NotificationsService } from '../src/notifications/notifications.service';
import { CreateTaskDto } from '../src/tasks/tasks.dto';
import { client, database, homeId, memberId, service, user } from './helpers';

const taskId = '00000000-0000-4000-8000-000000000030';
const otherId = '00000000-0000-4000-8000-000000000002';
const due = '2099-10-01T12:00:00.000Z';
const form: CreateTaskDto = { title: 'Limpiar cocina', description: 'Lavar el piso', assigned_membership_id: null, due_at: due, priority: 'high' };
const task = {
  id: taskId, home_id: homeId, title: 'Limpiar cocina', description: 'Lavar el piso', assigned_membership_id: null, due_at: new Date(due),
  priority: 'high', status: 'pending', created_by: user.id, created_at: new Date(), completed_at: null,
  assignee_user_id: null, assignee: null, assignee_active: false, creator: 'Juan',
};

describe('Tareas', () => {
  let tasks: TasksService;
  const repo = {
    list: jest.fn(), find: jest.fn(), lock: jest.fn(), history: jest.fn(), activeMember: jest.fn(), create: jest.fn(),
    addHistory: jest.fn(), update: jest.fn(), remove: jest.fn(), openAssigned: jest.fn(), countOpenAssigned: jest.fn(),
  };
  const access = { requireHome: jest.fn() };
  const activities = { add: jest.fn() };
  const notifications = { notify: jest.fn(), scheduleReminder: jest.fn(), cancelReminder: jest.fn() };
  const assigned = { ...task, assigned_membership_id: memberId, assignee_user_id: otherId };
  beforeEach(async () => {
    jest.resetAllMocks();
    access.requireHome.mockResolvedValue('member');
    repo.create.mockResolvedValue({ id: taskId, home_id: homeId, title: form.title, status: 'pending', due_at: new Date(due) });
    repo.addHistory.mockResolvedValue('historial-1');
    repo.lock.mockResolvedValue(task);
    tasks = await service(TasksService, [
      { provide: TasksRepository, useValue: repo }, { provide: DatabaseService, useValue: database() }, { provide: HomeAccessService, useValue: access },
      { provide: ActivitiesService, useValue: activities }, { provide: NotificationsService, useValue: notifications },
    ]);
  });

  describe('HU3.1 crear tareas', () => {
    it('HU3.1 crea la tarea pendiente y registra su creación en el historial y la actividad', async () => {
      expect(await tasks.create(user, homeId, form)).toEqual({ id: taskId, message: 'Tarea creada.' });
      expect(repo.create).toHaveBeenCalledWith(homeId, form, user.id, client);
      expect(repo.addHistory).toHaveBeenCalledWith(taskId, user.id, null, 'pending', client);
      expect(activities.add).toHaveBeenCalledWith(homeId, user.id, 'creó la tarea "Limpiar cocina"', client);
    });
    it('HU3.1 rechaza una fecha límite pasada antes de abrir la transacción', async () => {
      await expect(tasks.create(user, homeId, { ...form, due_at: '2000-01-01T00:00:00.000Z' })).rejects.toMatchObject({ status: 400 });
      expect(repo.create).not.toHaveBeenCalled();
    });
    it('HU3.1 una persona de otro hogar no crea ni consulta tareas', async () => {
      access.requireHome.mockRejectedValue(new Error('Sin acceso'));
      await expect(tasks.create(user, homeId, form)).rejects.toThrow('Sin acceso');
      await expect(tasks.list(user.id, homeId)).rejects.toThrow('Sin acceso');
      expect(repo.create).not.toHaveBeenCalled();
      expect(repo.list).not.toHaveBeenCalled();
    });
  });

  describe('HU3.2 asignar responsable', () => {
    it('HU3.2 avisa al responsable con un enlace a la tarea', async () => {
      repo.activeMember.mockResolvedValue(otherId);
      await tasks.create(user, homeId, { ...form, assigned_membership_id: memberId });
      expect(repo.activeMember).toHaveBeenCalledWith(homeId, memberId, client);
      expect(notifications.notify).toHaveBeenCalledWith(client, expect.objectContaining({ userId: otherId, title: 'Nueva tarea asignada', href: `/tareas/${taskId}` }));
    });
    it('HU3.2 rechaza responsables retirados o de otro hogar sin guardar ni avisar', async () => {
      repo.activeMember.mockResolvedValue(null);
      await expect(tasks.create(user, homeId, { ...form, assigned_membership_id: memberId })).rejects.toMatchObject({ status: 400 });
      expect(repo.create).not.toHaveBeenCalled();
      expect(notifications.notify).not.toHaveBeenCalled();
    });
    it('HU3.2 al reasignar avisa a la nueva persona y traslada el recordatorio', async () => {
      repo.activeMember.mockResolvedValue(otherId);
      await tasks.update(user, taskId, { assigned_membership_id: memberId });
      expect(notifications.cancelReminder).toHaveBeenCalledWith(client, `task:${taskId}`);
      expect(notifications.scheduleReminder).toHaveBeenCalledWith(client, expect.objectContaining({ userId: otherId, dueAt: new Date(due) }));
      expect(notifications.notify).toHaveBeenCalledWith(client, expect.objectContaining({ userId: otherId, title: 'Nueva tarea asignada' }));
    });
    it('HU3.2 conserva a un responsable retirado si no se cambia la asignación', async () => {
      repo.lock.mockResolvedValue({ ...assigned, assignee_active: false });
      await tasks.update(user, taskId, { title: 'Limpiar baño' });
      expect(repo.activeMember).not.toHaveBeenCalled();
      expect(repo.update).toHaveBeenCalledWith(expect.objectContaining({ assigned_membership_id: memberId, title: 'Limpiar baño' }), client);
    });
  });

  describe('HU3.3 recordatorios', () => {
    it('HU3.3 programa un recordatorio cuando hay fecha y responsable', async () => {
      repo.activeMember.mockResolvedValue(otherId);
      await tasks.create(user, homeId, { ...form, assigned_membership_id: memberId });
      expect(notifications.scheduleReminder).toHaveBeenCalledWith(client, expect.objectContaining({ sourceKey: `task:${taskId}`, userId: otherId, dueAt: new Date(due), href: `/tareas/${taskId}` }));
      expect(notifications.cancelReminder).not.toHaveBeenCalled();
    });
    it('HU3.3 completar la tarea cancela el recordatorio sin programar otro', async () => {
      repo.lock.mockResolvedValue(assigned);
      await tasks.update(user, taskId, { status: 'completed' });
      expect(notifications.cancelReminder).toHaveBeenCalledWith(client, `task:${taskId}`);
      expect(notifications.scheduleReminder).not.toHaveBeenCalled();
    });
    it('HU3.3 sin responsable no programa recordatorio', async () => {
      await tasks.create(user, homeId, form);
      expect(notifications.scheduleReminder).not.toHaveBeenCalled();
    });
    it('HU3.3 mover la fecha a una pasada se rechaza sin guardar', async () => {
      await expect(tasks.update(user, taskId, { due_at: '2000-01-01T00:00:00.000Z' })).rejects.toMatchObject({ status: 400 });
      expect(repo.update).not.toHaveBeenCalled();
    });
  });

  describe('HU3.4 cambiar estado', () => {
    it('HU3.4 un responsable que no es autor ni administrador no puede reabrir la tarea', async () => {
      repo.lock.mockResolvedValue({ ...assigned, status: 'completed', created_by: otherId, assignee_user_id: user.id });
      await expect(tasks.update(user, taskId, { status: 'pending' })).rejects.toMatchObject({ status: 403 });
      expect(repo.update).not.toHaveBeenCalled();
    });
    it('HU3.4 sin responsable cualquier integrante puede empezarla', async () => {
      repo.lock.mockResolvedValue({ ...task, created_by: otherId });
      expect(await tasks.update(user, taskId, { status: 'in_progress', title: undefined })).toEqual({ message: 'Tarea actualizada.' });
      expect(repo.addHistory).toHaveBeenCalledWith(taskId, user.id, 'pending', 'in_progress', client);
    });
    it('HU3.4 sin permiso no se puede avanzar el estado y editar a la vez', async () => {
      repo.lock.mockResolvedValue({ ...task, created_by: otherId });
      await expect(tasks.update(user, taskId, { status: 'in_progress', priority: 'low' })).rejects.toMatchObject({ status: 403 });
      expect(repo.update).not.toHaveBeenCalled();
    });
  });

  describe('HU3.5 historial', () => {
    it('HU3.5 devuelve la tarea con su historial después de revisar el acceso', async () => {
      const history = [{ id: 'h', actor: 'Miguel', previous_status: 'pending', new_status: 'completed', created_at: new Date() }];
      repo.find.mockResolvedValue(task);
      repo.history.mockResolvedValue(history);
      expect(await tasks.detail(user.id, taskId)).toMatchObject({ id: taskId, can_edit: true, history });
      expect(access.requireHome).toHaveBeenCalledWith(user.id, homeId);
    });
    it('HU3.5 completar registra quién actuó y avisa al creador si fue otra persona', async () => {
      access.requireHome.mockResolvedValue('admin');
      repo.lock.mockResolvedValue({ ...task, created_by: otherId });
      repo.addHistory.mockResolvedValue('historial-2');
      await tasks.update(user, taskId, { status: 'completed' });
      expect(repo.addHistory).toHaveBeenCalledWith(taskId, user.id, 'pending', 'completed', client);
      expect(activities.add).toHaveBeenCalledWith(homeId, user.id, 'completó la tarea "Limpiar cocina"', client);
      expect(notifications.notify).toHaveBeenCalledWith(client, expect.objectContaining({
        userId: otherId, title: 'Tarea completada', sourceKey: `task:${taskId}:completed:historial-2:${otherId}`,
      }));
    });
    it('HU3.5 guardar el mismo estado no inventa una transición ni un aviso', async () => {
      await tasks.update(user, taskId, { status: 'pending' });
      expect(repo.addHistory).not.toHaveBeenCalled();
      expect(notifications.notify).not.toHaveBeenCalled();
    });
    it('HU3.5 una tarea inexistente responde 404 sin revisar el hogar', async () => {
      repo.find.mockResolvedValue(null);
      await expect(tasks.detail(user.id, taskId)).rejects.toMatchObject({ status: 404 });
      expect(access.requireHome).not.toHaveBeenCalled();
    });
    it('HU3.5 el resumen de Inicio cuenta las tareas abiertas asignadas a la persona', async () => {
      repo.openAssigned.mockResolvedValue([{ id: taskId, title: 'Limpiar cocina', due_at: null }]);
      repo.countOpenAssigned.mockResolvedValue(6);
      expect(await tasks.assignedSummary(homeId, user.id)).toEqual({ total: 6, tasks: [{ id: taskId, title: 'Limpiar cocina', due_at: null }] });
    });
  });

  describe('HU3.6 editar, eliminar y filtrar', () => {
    it('HU3.6 el autor corrige el título y queda en la actividad', async () => {
      await tasks.update(user, taskId, { title: 'Limpiar baño' });
      expect(repo.update).toHaveBeenCalledWith(expect.objectContaining({ title: 'Limpiar baño', status: 'pending' }), client);
      expect(activities.add).toHaveBeenCalledWith(homeId, user.id, 'actualizó la tarea "Limpiar baño"', client);
    });
    it('HU3.6 impide eliminar tareas de otra persona sin ser administrador', async () => {
      repo.lock.mockResolvedValue({ ...task, created_by: otherId });
      await expect(tasks.remove(user.id, taskId)).rejects.toMatchObject({ status: 403 });
      expect(repo.remove).not.toHaveBeenCalled();
      expect(notifications.cancelReminder).not.toHaveBeenCalled();
    });
    it('HU3.6 elimina la tarea autorizada y cancela su recordatorio', async () => {
      expect(await tasks.remove(user.id, taskId)).toEqual({ message: 'Tarea eliminada.' });
      expect(repo.remove).toHaveBeenCalledWith(taskId, client);
      expect(notifications.cancelReminder).toHaveBeenCalledWith(client, `task:${taskId}`);
    });
    it('HU3.6 el tablero indica qué tareas puede editar cada persona', async () => {
      repo.list.mockResolvedValue([task, { ...task, id: 'ajena', created_by: otherId }]);
      expect((await tasks.list(user.id, homeId)).map(t => t.can_edit)).toEqual([true, false]);
      access.requireHome.mockResolvedValue('admin');
      expect((await tasks.list(user.id, homeId)).every(t => t.can_edit)).toBe(true);
    });
    it('HU3.6 eliminar una tarea inexistente responde 404', async () => {
      repo.lock.mockResolvedValue(null);
      await expect(tasks.remove(user.id, taskId)).rejects.toMatchObject({ status: 404 });
    });
  });
});
