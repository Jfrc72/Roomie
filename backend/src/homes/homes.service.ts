import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { HomeAccessService } from '../access/home-access.service';
import { ActivitiesService } from '../activities/activities.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SessionUser } from '../auth/auth.entity';
import { HomeDto } from './homes.dto';
import { HomesRepository } from './homes.repository';

@Injectable()
export class HomesService {
  constructor(
    private readonly repository: HomesRepository,
    private readonly db: DatabaseService,
    private readonly access: HomeAccessService,
    private readonly activities: ActivitiesService,
    private readonly notifications: NotificationsService,
  ) {}

  create(user: SessionUser, data: HomeDto) {
    return this.db.transaction(async client => {
      const home = await this.repository.create(data, user.id, client);
      await this.repository.select(home.id, user.sessionHash, client);
      await this.activities.add(home.id, user.id, 'creó el apartamento', client);
      return home;
    });
  }

  async details(userId: string, homeId: string) {
    await this.access.requireHome(userId, homeId);
    const home = await this.repository.find(homeId);
    if (!home) throw new NotFoundException('Apartamento no encontrado.');
    return { ...home, members: await this.repository.members(homeId) };
  }

  async select(user: SessionUser, homeId: string) {
    await this.access.requireHome(user.id, homeId);
    await this.repository.select(homeId, user.sessionHash);
    return { message: 'Apartamento seleccionado.' };
  }

  update(userId: string, homeId: string, data: HomeDto) {
    return this.db.transaction(async client => {
      await this.access.lockHome(userId, homeId, client);
      await this.repository.update(homeId, data, client);
      await this.activities.add(homeId, userId, 'actualizó los datos del apartamento', client);
      return { message: 'Apartamento actualizado.' };
    });
  }

  archive(userId: string, homeId: string) {
    return this.db.transaction(async client => {
      await this.access.lockHome(userId, homeId, client);
      await this.repository.archive(homeId, client);
      await this.notifications.cancelHome(homeId, client);
      await this.activities.add(homeId, userId, 'archivó el apartamento', client);
      return { message: 'Apartamento archivado.' };
    });
  }
}
