import { ActivitiesService } from '../src/activities/activities.service';
import { ActivitiesRepository } from '../src/activities/activities.repository';
import { client, homeId, service, user } from './helpers';

describe('Actividad del apartamento', () => {
  it('guarda la actividad en la transacción de la operación', async () => {
    const repository = { add: jest.fn() };
    const activities = await service(ActivitiesService, [{ provide: ActivitiesRepository, useValue: repository }]);
    await activities.add(homeId, user.id, 'creó el apartamento', client);
    expect(repository.add).toHaveBeenCalledWith(homeId, user.id, 'creó el apartamento', client);
  });
  it('devuelve solo la actividad del hogar solicitado', async () => {
    const repository = { list: jest.fn().mockResolvedValue([{ message: 'Nueva tarea' }]) };
    const activities = await service(ActivitiesService, [{ provide: ActivitiesRepository, useValue: repository }]);
    expect(await activities.list(homeId)).toEqual([{ message: 'Nueva tarea' }]);
    expect(repository.list).toHaveBeenCalledWith(homeId);
  });
});
