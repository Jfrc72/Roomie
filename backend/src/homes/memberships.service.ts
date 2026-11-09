import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { HomeAccessService } from '../access/home-access.service';
import { ActivitiesService } from '../activities/activities.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MembershipsRepository } from './memberships.repository';
import { canRemoveAdmin } from './homes.rules';

@Injectable()
export class MembershipsService {
  constructor(
    private readonly repository: MembershipsRepository,
    private readonly db: DatabaseService,
    private readonly access: HomeAccessService,
    private readonly activities: ActivitiesService,
    private readonly notifications: NotificationsService,
  ) {}

  change(userId: string, homeId: string, membershipId: string, role: 'admin' | 'member' | null) {
    return this.db.transaction(async client => {
      await this.access.lockHome(userId, homeId, client);
      const member = await this.repository.find(homeId, membershipId, client);
      if (!member) throw new NotFoundException('Integrante no encontrado.');
      if (member.role === 'admin' && role !== 'admin') {
        const count = await this.repository.adminCount(homeId, client);
        if (!canRemoveAdmin(member.role, role, count)) throw new ConflictException('Debe quedar al menos un administrador. Asigna otro primero.');
      }
      if (role === null) {
        await this.repository.remove(member, client);
        await this.activities.add(homeId, userId, 'retiró a un integrante del apartamento', client);
      } else {
        await this.repository.changeRole(member.id, role, client);
        await this.activities.add(homeId, userId, 'actualizó el rol de un integrante', client);
        await this.notifications.notify(client, { homeId, userId: member.user_id, title: 'Tu rol cambió', message: `Tu nuevo rol es ${role === 'admin' ? 'administrador' : 'integrante'}.`, href: '/apartamento' });
      }
      return { message: 'Integrantes actualizados.' };
    });
  }
}
