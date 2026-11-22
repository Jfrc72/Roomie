import { ResourcesService } from '../src/reservations/resources.service';
import { ResourcesRepository } from '../src/reservations/resources.repository';
import { DatabaseService } from '../src/database/database.service';
import { HomeAccessService } from '../src/access/home-access.service';
import { ActivitiesService } from '../src/activities/activities.service';
import { client, database, homeId, service, user } from './helpers';

const resourceId = '00000000-0000-4000-8000-000000000040';
const data = { name: 'Lavadora', description: 'En el patio' };

describe('Recursos reservables', () => {
  let resources: ResourcesService;
  const repo = { list: jest.fn(), create: jest.fn(), lock: jest.fn(), update: jest.fn(), upcomingReservations: jest.fn(), retire: jest.fn() };
  const access = { requireHome: jest.fn() };
  const activities = { add: jest.fn() };
  beforeEach(async () => {
    jest.resetAllMocks();
    repo.lock.mockResolvedValue({ id: resourceId, home_id: homeId, name: 'Lavadora' });
    repo.upcomingReservations.mockResolvedValue(0);
    resources = await service(ResourcesService, [
      { provide: ResourcesRepository, useValue: repo }, { provide: DatabaseService, useValue: database() },
      { provide: HomeAccessService, useValue: access }, { provide: ActivitiesService, useValue: activities },
    ]);
  });
  it('HU5.1 solo un administrador agrega recursos', async () => {
    access.requireHome.mockRejectedValue(new Error('Se requiere administrador'));
    await expect(resources.create(user.id, homeId, data)).rejects.toThrow('Se requiere administrador');
    expect(access.requireHome).toHaveBeenCalledWith(user.id, homeId, true);
    expect(repo.create).not.toHaveBeenCalled();
  });
  it('HU5.1 agrega el recurso y lo registra en la actividad', async () => {
    repo.create.mockResolvedValue({ id: resourceId, ...data });
    expect(await resources.create(user.id, homeId, data)).toEqual({ id: resourceId, ...data });
    expect(activities.add).toHaveBeenCalledWith(homeId, user.id, 'agregó el recurso "Lavadora"', client);
  });
  it('HU5.1 edita el recurso después de bloquearlo y comprobar el rol en su hogar', async () => {
    await resources.update(user.id, resourceId, { name: 'Sala', description: 'Piso uno' });
    expect(access.requireHome).toHaveBeenCalledWith(user.id, homeId, true, client);
    expect(repo.update).toHaveBeenCalledWith(resourceId, { name: 'Sala', description: 'Piso uno' }, client);
  });
  it('HU5.1 no retira un recurso con reservas próximas', async () => {
    repo.upcomingReservations.mockResolvedValue(2);
    await expect(resources.retire(user.id, resourceId)).rejects.toMatchObject({ status: 409, message: 'Este recurso tiene 2 reservas próximas. Cancélalas antes de retirarlo.' });
    expect(repo.retire).not.toHaveBeenCalled();
  });
  it('HU5.1 retirar es una baja lógica que conserva sus reservas pasadas', async () => {
    expect(await resources.retire(user.id, resourceId)).toEqual({ message: 'Recurso retirado.' });
    expect(repo.retire).toHaveBeenCalledWith(resourceId, client);
    expect(activities.add).toHaveBeenCalledWith(homeId, user.id, 'retiró el recurso "Lavadora"', client);
  });
  it('HU5.1 un recurso retirado o inexistente responde 404', async () => {
    repo.lock.mockResolvedValue(null);
    await expect(resources.update(user.id, resourceId, data)).rejects.toMatchObject({ status: 404 });
    expect(access.requireHome).not.toHaveBeenCalled();
  });
  it('HU5.1 los integrantes consultan los recursos activos de su hogar', async () => {
    repo.list.mockResolvedValue([{ id: resourceId, ...data }]);
    expect(await resources.list(user.id, homeId)).toHaveLength(1);
    expect(access.requireHome).toHaveBeenCalledWith(user.id, homeId);
  });
});
