import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';
import { HomeAccessService } from '../access/home-access.service';
import { ActivitiesService } from '../activities/activities.service';
import { ResourceDto } from './reservations.dto';
import { upcomingMessage } from './reservations.rules';
import { ResourcesRepository } from './resources.repository';

@Injectable()
export class ResourcesService {
  constructor(
    private readonly repository: ResourcesRepository,
    private readonly db: DatabaseService,
    private readonly access: HomeAccessService,
    private readonly activities: ActivitiesService,
  ) {}

  async list(userId: string, homeId: string) {
    await this.access.requireHome(userId, homeId);
    return this.repository.list(homeId);
  }

  // Un nombre repetido entre los recursos activos responde 409 por el índice único.
  async create(userId: string, homeId: string, data: ResourceDto) {
    await this.access.requireHome(userId, homeId, true);
    return this.db.transaction(async client => {
      const resource = await this.repository.create(homeId, data, client);
      await this.activities.add(homeId, userId, `agregó el recurso "${data.name}"`, client);
      return resource;
    });
  }

  update(userId: string, resourceId: string, data: ResourceDto) {
    return this.db.transaction(async client => {
      const resource = await this.lock(userId, resourceId, client);
      await this.repository.update(resource.id, data, client);
      await this.activities.add(resource.home_id, userId, `actualizó el recurso "${data.name}"`, client);
      return { message: 'Recurso actualizado.' };
    });
  }

  retire(userId: string, resourceId: string) {
    return this.db.transaction(async client => {
      const resource = await this.lock(userId, resourceId, client);
      const total = await this.repository.upcomingReservations(resource.id, client);
      if (total) throw new ConflictException(upcomingMessage(total));
      await this.repository.retire(resource.id, client);
      await this.activities.add(resource.home_id, userId, `retiró el recurso "${resource.name}"`, client);
      return { message: 'Recurso retirado.' };
    });
  }

  private async lock(userId: string, resourceId: string, client: PoolClient) {
    const resource = await this.repository.lock(resourceId, client);
    if (!resource) throw new NotFoundException('Recurso no encontrado.');
    await this.access.requireHome(userId, resource.home_id, true, client);
    return resource;
  }
}
