import { HomesService } from '../src/homes/homes.service';
import { HomesRepository } from '../src/homes/homes.repository';
import { DatabaseService } from '../src/database/database.service';
import { HomeAccessService } from '../src/access/home-access.service';
import { ActivitiesService } from '../src/activities/activities.service';
import { NotificationsService } from '../src/notifications/notifications.service';
import { client, database, homeId, service, user } from './helpers';

describe('Apartamentos', () => {
  let homes: HomesService;
  const data = { name: 'Apartamento 301', address: '', description: '' };
  const repo = { create: jest.fn(), select: jest.fn(), find: jest.fn(), members: jest.fn(), update: jest.fn(), archive: jest.fn() };
  const access = { requireHome: jest.fn(), lockHome: jest.fn() };
  const activities = { add: jest.fn() };
  const notifications = { cancelHome: jest.fn() };
  beforeEach(async () => {
    jest.resetAllMocks(); repo.create.mockResolvedValue({ id: homeId, ...data }); repo.find.mockResolvedValue({ id: homeId, ...data }); repo.members.mockResolvedValue([]);
    homes = await service(HomesService, [
      { provide: HomesRepository, useValue: repo }, { provide: DatabaseService, useValue: database() },
      { provide: HomeAccessService, useValue: access }, { provide: ActivitiesService, useValue: activities }, { provide: NotificationsService, useValue: notifications },
    ]);
  });
  it('HU1.1 crea el hogar y selecciona ese hogar en la misma sesión', async () => {
    expect((await homes.create(user, data)).id).toBe(homeId);
    expect(repo.create).toHaveBeenCalledWith(data, user.id, client);
    expect(repo.select).toHaveBeenCalledWith(homeId, user.sessionHash, client);
    expect(activities.add).toHaveBeenCalledWith(homeId, user.id, 'creó el apartamento', client);
  });
  it('HU1.1 devuelve integrantes solo después de revisar acceso', async () => {
    expect((await homes.details(user.id, homeId)).members).toEqual([]);
    expect(access.requireHome).toHaveBeenCalledWith(user.id, homeId);
  });
  it('HU1.1 no consulta datos del hogar si el acceso es rechazado', async () => {
    access.requireHome.mockRejectedValue(new Error('Sin permiso'));
    await expect(homes.details(user.id, homeId)).rejects.toThrow('Sin permiso');
    expect(repo.find).not.toHaveBeenCalled();
  });
  it('HU1.1 informa cuando el hogar ya no existe', async () => {
    repo.find.mockResolvedValue(null);
    await expect(homes.details(user.id, homeId)).rejects.toMatchObject({ status: 404 });
  });
  it('HU1.1 cambia el hogar activo sin modificar otras sesiones', async () => {
    await homes.select(user, homeId);
    expect(repo.select).toHaveBeenCalledWith(homeId, user.sessionHash);
  });
  it('HU1.1 editar requiere permisos y deja actividad', async () => {
    await homes.update(user.id, homeId, data);
    expect(access.lockHome).toHaveBeenCalledWith(user.id, homeId, client);
    expect(repo.update).toHaveBeenCalledWith(homeId, data, client);
    expect(activities.add).toHaveBeenCalled();
  });
  it('HU1.1 archivar cancela recordatorios y conserva el historial', async () => {
    await homes.archive(user.id, homeId);
    expect(repo.archive).toHaveBeenCalledWith(homeId, client);
    expect(notifications.cancelHome).toHaveBeenCalledWith(homeId, client);
  });
  it('HU1.1 un usuario sin permisos no puede archivar', async () => {
    access.lockHome.mockRejectedValue(new Error('Sin permiso'));
    await expect(homes.archive(user.id, homeId)).rejects.toThrow('Sin permiso');
    expect(repo.archive).not.toHaveBeenCalled();
  });
});
