import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { HomeAccessService } from '../access/home-access.service';
import { ActivitiesService } from '../activities/activities.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SessionUser } from '../auth/auth.entity';
import { RuleDto } from './rules.dto';
import { RulesRepository } from './rules.repository';

@Injectable()
export class RulesService {
  constructor(
    private readonly repository: RulesRepository,
    private readonly db: DatabaseService,
    private readonly access: HomeAccessService,
    private readonly activities: ActivitiesService,
    private readonly notifications: NotificationsService,
  ) {}

  // La versión vigente es la más reciente; las aceptaciones listan a los integrantes activos.
  async list(userId: string, homeId: string) {
    await this.access.requireHome(userId, homeId);
    const [[current, ...history], reports] = await Promise.all([this.repository.versions(homeId), this.repository.reports(homeId)]);
    if (!current) return { current: null, accepted_by_me: false, acceptances: [], history, reports };
    const acceptances = await this.repository.acceptances(homeId, current.id);
    return { current, accepted_by_me: acceptances.some(a => a.user_id === userId && a.accepted_at), acceptances, history, reports };
  }

  publish(user: SessionUser, homeId: string, data: RuleDto) {
    return this.db.transaction(async client => {
      // Bloquear el hogar numera las versiones sin repetir aunque publiquen dos administradores a la vez.
      await this.access.lockHome(user.id, homeId, client);
      const latest = await this.repository.latest(homeId, client);
      if (latest?.content === data.content) throw new ConflictException('El texto es igual al de la versión vigente.');
      const version = (latest?.version ?? 0) + 1;
      const id = await this.repository.createVersion({ homeId, version, content: data.content, notes: data.notes, userId: user.id }, client);
      // Quien publica la versión la acepta al publicarla.
      await this.repository.accept(id, homeId, user.id, client);
      await this.activities.add(homeId, user.id, `publicó la versión ${version} del reglamento`, client);
      for (const userId of await this.repository.otherMembers(homeId, user.id, client)) await this.notifications.notify(client, {
        homeId, userId, title: 'Nuevo reglamento', message: `${user.name} publicó la versión ${version}. Léela y acéptala.`,
        href: '/reglamento', sourceKey: `rules:${id}:${userId}`,
      });
      return { id, version, message: 'Versión publicada.' };
    });
  }

  accept(userId: string, versionId: string) {
    return this.db.transaction(async client => {
      const rule = await this.repository.findVersion(versionId, client);
      if (!rule) throw new NotFoundException('Versión no encontrada.');
      await this.access.requireHome(userId, rule.home_id, false, client);
      const latest = await this.repository.latest(rule.home_id, client);
      if (latest?.id !== rule.id) throw new ConflictException('Hay una versión más reciente del reglamento; acepta esa.');
      if (!await this.repository.accept(rule.id, rule.home_id, userId, client)) return { message: 'Ya habías aceptado esta versión.' };
      await this.activities.add(rule.home_id, userId, `aceptó la versión ${rule.version} del reglamento`, client);
      return { message: 'Aceptaste el reglamento.' };
    });
  }
}
