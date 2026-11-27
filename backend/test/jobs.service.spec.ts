import { JobsService } from '../src/jobs/jobs.service';
import { JobsRepository } from '../src/jobs/jobs.repository';
import { NotificationDeliveryService } from '../src/jobs/notification-delivery.service';
import { NotificationsService } from '../src/notifications/notifications.service';
import { PollsService } from '../src/polls/polls.service';
import { DatabaseService } from '../src/database/database.service';
import { client, database, homeId, service, user } from './helpers';

describe('Procesamiento de recordatorios y entregas', () => {
  let jobs: JobsService;
  const row = { id: 'entrega', channel: 'email', user_id: user.id, home_id: homeId, email_enabled: true, push_enabled: true };
  const repo = { reminders: jest.fn(), processed: jest.fn(), deliveries: jest.fn(), authorized: jest.fn(), discard: jest.fn(), subscriptions: jest.fn(), removeSubscription: jest.fn(), sent: jest.fn(), retry: jest.fn() };
  const notifications = { notify: jest.fn() };
  const delivery = { email: jest.fn(), push: jest.fn() };
  const polls = { closeExpired: jest.fn() };
  beforeEach(async () => {
    jest.resetAllMocks(); repo.reminders.mockResolvedValue([]); repo.deliveries.mockResolvedValue([]); repo.authorized.mockResolvedValue(true); repo.subscriptions.mockResolvedValue([{ id: 'dispositivo' }]);
    jobs = await service(JobsService, [
      { provide: DatabaseService, useValue: database() }, { provide: JobsRepository, useValue: repo },
      { provide: NotificationsService, useValue: notifications }, { provide: NotificationDeliveryService, useValue: delivery },
      { provide: PollsService, useValue: polls },
    ]);
  });
  it('HU8.4 el worker cierra las votaciones vencidas en cada ciclo, de todos los apartamentos', async () => {
    await jobs.tick(); expect(polls.closeExpired).toHaveBeenCalledTimes(1); expect(polls.closeExpired).toHaveBeenCalledWith();
  });
  it('HU8.4 si falla el cierre de votaciones el error llega al worker para registrarlo', async () => {
    polls.closeExpired.mockRejectedValue(new Error('Sin base')); await expect(jobs.tick()).rejects.toThrow('Sin base');
  });
  it('HU7.3 no inventa avisos si no hay recordatorios pendientes', async () => {
    await jobs.tick(); expect(notifications.notify).not.toHaveBeenCalled(); expect(delivery.email).not.toHaveBeenCalled();
  });
  it('HU7.3 convierte el recordatorio en un aviso con clave única y lo marca procesado', async () => {
    repo.reminders.mockResolvedValue([{ id: 'recordatorio', home_id: homeId, user_id: user.id, title: 'Lavar platos', message: 'Tarea pendiente', href: '/tareas', due_at: new Date('2026-10-30T15:00:00Z') }]);
    await jobs.tick();
    expect(notifications.notify).toHaveBeenCalledWith(client, expect.objectContaining({ homeId, userId: user.id, sourceKey: 'reminder:recordatorio:2026-10-30T15:00:00.000Z' }));
    expect(repo.processed).toHaveBeenCalledWith('recordatorio', client);
  });
  it('HU7.3 no marca procesado el recordatorio si falla guardar el aviso', async () => {
    repo.reminders.mockResolvedValue([{ id: 'recordatorio', due_at: new Date() }]); notifications.notify.mockRejectedValue(new Error('Sin base'));
    await expect(jobs.tick()).rejects.toThrow('Sin base'); expect(repo.processed).not.toHaveBeenCalled();
  });
  it('HU7.3 descarta una entrega si la persona desactivó ese canal', async () => {
    repo.deliveries.mockResolvedValue([{ ...row, email_enabled: false }]);
    await jobs.tick(); expect(repo.discard).toHaveBeenCalledWith(row.id, client); expect(delivery.email).not.toHaveBeenCalled();
  });
  it('HU7.3 no envía mensajes a integrantes retirados o de hogares archivados', async () => {
    repo.deliveries.mockResolvedValue([row]); repo.authorized.mockResolvedValue(false);
    await jobs.tick(); expect(repo.discard).toHaveBeenCalled(); expect(delivery.email).not.toHaveBeenCalled();
  });
  it('HU7.3 marca enviada una entrega de correo exitosa', async () => {
    repo.deliveries.mockResolvedValue([row]);
    await jobs.tick(); expect(delivery.email).toHaveBeenCalledWith(row); expect(repo.sent).toHaveBeenCalledWith(row.id, client);
  });
  it('HU7.3 un fallo de correo se guarda para reintentar', async () => {
    repo.deliveries.mockResolvedValue([row]); delivery.email.mockRejectedValue(new Error('SMTP no disponible'));
    await jobs.tick(); expect(repo.retry).toHaveBeenCalledWith(row.id, 'SMTP no disponible', client); expect(repo.sent).not.toHaveBeenCalled();
  });
  it('HU7.3 una entrega push sin dispositivos no se informa como enviada', async () => {
    repo.deliveries.mockResolvedValue([{ ...row, channel: 'push' }]); repo.subscriptions.mockResolvedValue([]);
    await jobs.tick(); expect(repo.retry).toHaveBeenCalledWith(row.id, 'Sin dispositivos push registrados', client); expect(repo.sent).not.toHaveBeenCalled();
  });
  it('HU7.3 envía push a los dispositivos registrados', async () => {
    const push = { ...row, channel: 'push' }; repo.deliveries.mockResolvedValue([push]);
    await jobs.tick(); expect(delivery.push).toHaveBeenCalledWith(push, { id: 'dispositivo' }); expect(repo.sent).toHaveBeenCalled();
  });
  it.each([404, 410])('HU7.3 retira una suscripción vencida con respuesta %s', async statusCode => {
    repo.deliveries.mockResolvedValue([{ ...row, channel: 'push' }]); delivery.push.mockRejectedValue({ statusCode });
    await jobs.tick(); expect(repo.removeSubscription).toHaveBeenCalledWith('dispositivo', client);
  });
  it('HU7.3 un fallo temporal de push no elimina el dispositivo', async () => {
    repo.deliveries.mockResolvedValue([{ ...row, channel: 'push' }]); delivery.push.mockRejectedValue(new Error('Servicio no disponible'));
    await jobs.tick(); expect(repo.retry).toHaveBeenCalled(); expect(repo.removeSubscription).not.toHaveBeenCalled();
  });
});
