import { ReservationsService } from '../src/reservations/reservations.service';
import { ReservationsRepository } from '../src/reservations/reservations.repository';
import { ResourcesRepository } from '../src/reservations/resources.repository';
import { DatabaseService } from '../src/database/database.service';
import { HomeAccessService } from '../src/access/home-access.service';
import { ActivitiesService } from '../src/activities/activities.service';
import { NotificationsService } from '../src/notifications/notifications.service';
import { client, database, homeId, memberId, service, user } from './helpers';

const resourceId = '00000000-0000-4000-8000-000000000040';
const reservationId = '00000000-0000-4000-8000-000000000050';
const otherId = '00000000-0000-4000-8000-000000000002';
const form = { resource_id: resourceId, starts_at: '2099-01-01T12:00:00.000Z', ends_at: '2099-01-01T13:00:00.000Z' };
const booked = { home_id: homeId, status: 'active', ends_at: new Date(form.ends_at), user_id: user.id, resource: 'Lavadora' };

describe('Reservas', () => {
  let reservations: ReservationsService;
  const repo = { list: jest.fn(), membership: jest.fn(), create: jest.fn(), lock: jest.fn(), cancel: jest.fn(), next: jest.fn() };
  const resources = { lockForReservation: jest.fn() };
  const access = { requireHome: jest.fn() };
  const activities = { add: jest.fn() };
  const notifications = { notify: jest.fn(), scheduleReminder: jest.fn(), cancelReminder: jest.fn() };
  beforeEach(async () => {
    jest.resetAllMocks();
    access.requireHome.mockResolvedValue('member');
    resources.lockForReservation.mockResolvedValue({ name: 'Lavadora' });
    repo.membership.mockResolvedValue(memberId);
    repo.create.mockResolvedValue(reservationId);
    repo.lock.mockResolvedValue(booked);
    reservations = await service(ReservationsService, [
      { provide: ReservationsRepository, useValue: repo }, { provide: ResourcesRepository, useValue: resources },
      { provide: DatabaseService, useValue: database() }, { provide: HomeAccessService, useValue: access },
      { provide: ActivitiesService, useValue: activities }, { provide: NotificationsService, useValue: notifications },
    ]);
  });

  describe('HU5.2 reservar sin cruces', () => {
    it('HU5.2 una reserva válida queda a nombre de quien la crea y programa su recordatorio', async () => {
      expect(await reservations.create(user.id, homeId, form)).toEqual({ id: reservationId, message: 'Reserva creada.' });
      expect(repo.create).toHaveBeenCalledWith({ homeId, resourceId, membershipId: memberId, start: new Date(form.starts_at), end: new Date(form.ends_at) }, client);
      expect(notifications.scheduleReminder).toHaveBeenCalledWith(client, expect.objectContaining({ userId: user.id, sourceKey: `reservation:${reservationId}`, dueAt: new Date(form.starts_at) }));
    });
    it('HU5.2 rechaza horarios invertidos o de más de siete días antes de abrir la transacción', async () => {
      await expect(reservations.create(user.id, homeId, { ...form, ends_at: form.starts_at })).rejects.toThrow('posterior');
      await expect(reservations.create(user.id, homeId, { ...form, ends_at: '2099-01-08T12:01:00.000Z' })).rejects.toThrow('máximo 7');
      expect(resources.lockForReservation).not.toHaveBeenCalled();
    });
    it('HU5.2 un cruce detectado por PostgreSQL responde 409 sin recordatorio', async () => {
      repo.create.mockRejectedValue(Object.assign(new Error('exclusion'), { code: '23P01' }));
      await expect(reservations.create(user.id, homeId, form)).rejects.toMatchObject({ status: 409, message: 'Lavadora ya está reservado en ese horario. Elige otro.' });
      expect(notifications.scheduleReminder).not.toHaveBeenCalled();
    });
    it('HU5.2 rechaza recursos retirados o de otro hogar', async () => {
      resources.lockForReservation.mockResolvedValue(null);
      await expect(reservations.create(user.id, homeId, form)).rejects.toMatchObject({ status: 400 });
      expect(resources.lockForReservation).toHaveBeenCalledWith(resourceId, homeId, client);
      expect(repo.create).not.toHaveBeenCalled();
    });
    it('HU5.2 otros errores de la base de datos no se ocultan como cruces', async () => {
      repo.create.mockRejectedValue(new Error('Sin conexión'));
      await expect(reservations.create(user.id, homeId, form)).rejects.toThrow('Sin conexión');
    });
    it('HU5.2 Inicio muestra la próxima reserva del hogar', async () => {
      repo.next.mockResolvedValue({ name: 'Lavadora', starts_at: new Date(form.starts_at) });
      expect(await reservations.next(homeId)).toEqual({ name: 'Lavadora', starts_at: new Date(form.starts_at) });
    });
  });

  describe('HU5.3 calendario', () => {
    it('HU5.3 con un rango trae las reservas que se cruzan con él e indica cuáles se pueden cancelar', async () => {
      repo.list.mockResolvedValue([{ id: 'a', user_id: user.id }, { id: 'b', user_id: otherId }]);
      const list = await reservations.list(user.id, homeId, '2099-01-01T05:00:00.000Z', '2099-01-08T05:00:00.000Z');
      expect(repo.list).toHaveBeenCalledWith(homeId, { from: '2099-01-01T05:00:00.000Z', to: '2099-01-08T05:00:00.000Z' });
      expect(list.map(r => r.can_cancel)).toEqual([true, false]);
    });
    it('HU5.3 rechaza rangos invertidos o de más de 31 días', async () => {
      await expect(reservations.list(user.id, homeId, '2099-01-08T05:00:00.000Z', '2099-01-01T05:00:00.000Z')).rejects.toMatchObject({ status: 400 });
      await expect(reservations.list(user.id, homeId, '2099-01-01T05:00:00.000Z', '2099-03-01T05:00:00.000Z')).rejects.toThrow('31 días');
      expect(repo.list).not.toHaveBeenCalled();
    });
    it('HU5.3 rechaza fechas inválidas o un rango incompleto', async () => {
      await expect(reservations.list(user.id, homeId, 'ayer', '2099-01-01T05:00:00.000Z')).rejects.toMatchObject({ status: 400 });
      await expect(reservations.list(user.id, homeId, '2099-01-01T05:00:00.000Z')).rejects.toMatchObject({ status: 400 });
      expect(repo.list).not.toHaveBeenCalled();
    });
    it('HU5.3 un administrador puede cancelar todas las reservas de la lista', async () => {
      access.requireHome.mockResolvedValue('admin');
      repo.list.mockResolvedValue([{ id: 'b', user_id: otherId }]);
      expect((await reservations.list(user.id, homeId))[0].can_cancel).toBe(true);
      expect(repo.list).toHaveBeenCalledWith(homeId, undefined);
    });
  });

  describe('HU5.4 cancelar', () => {
    it('HU5.4 rechaza a una persona que no reservó ni es administradora', async () => {
      repo.lock.mockResolvedValue({ ...booked, user_id: otherId });
      await expect(reservations.cancel(user, reservationId)).rejects.toMatchObject({ status: 403 });
      expect(repo.cancel).not.toHaveBeenCalled();
    });
    it('HU5.4 la cancelación de un administrador libera el horario, cancela el recordatorio y avisa al dueño', async () => {
      access.requireHome.mockResolvedValue('admin');
      repo.lock.mockResolvedValue({ ...booked, user_id: otherId });
      expect(await reservations.cancel(user, reservationId)).toEqual({ message: 'Reserva cancelada.' });
      expect(repo.cancel).toHaveBeenCalledWith(reservationId, client);
      expect(notifications.cancelReminder).toHaveBeenCalledWith(client, `reservation:${reservationId}`);
      expect(notifications.notify).toHaveBeenCalledWith(client, expect.objectContaining({ userId: otherId, title: 'Reserva cancelada', href: '/reservas' }));
    });
    it('HU5.4 no vuelve a cancelar una reserva cancelada ni una que ya terminó', async () => {
      repo.lock.mockResolvedValue({ ...booked, status: 'cancelled' });
      await expect(reservations.cancel(user, reservationId)).rejects.toMatchObject({ status: 409 });
      repo.lock.mockResolvedValue({ ...booked, ends_at: new Date('2000-01-01T00:00:00Z') });
      await expect(reservations.cancel(user, reservationId)).rejects.toMatchObject({ status: 409 });
      expect(repo.cancel).not.toHaveBeenCalled();
      expect(notifications.notify).not.toHaveBeenCalled();
    });
    it('HU5.4 quien cancela su propia reserva no recibe un aviso de sí mismo', async () => {
      await reservations.cancel(user, reservationId);
      expect(repo.cancel).toHaveBeenCalled();
      expect(notifications.notify).not.toHaveBeenCalled();
    });
    it('HU5.4 una reserva inexistente responde 404', async () => {
      repo.lock.mockResolvedValue(null);
      await expect(reservations.cancel(user, reservationId)).rejects.toMatchObject({ status: 404 });
    });
  });
});
