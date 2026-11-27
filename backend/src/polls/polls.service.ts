import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PoolClient } from 'pg';
import { HomeAccessService } from '../access/home-access.service';
import { ActivitiesService } from '../activities/activities.service';
import { SessionUser } from '../auth/auth.entity';
import { requireHomeId } from '../common/params';
import { DatabaseService } from '../database/database.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PollDto } from './polls.dto';
import { LockedPoll } from './polls.entity';
import { PollsRepository } from './polls.repository';
import { PollView } from './polls.responses';
import { buildPollViews, canClosePoll, isExpired, pollResult } from './polls.rules';

@Injectable()
export class PollsService {
  constructor(
    private readonly repository: PollsRepository,
    private readonly db: DatabaseService,
    private readonly access: HomeAccessService,
    private readonly activities: ActivitiesService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Votaciones del apartamento. Antes de listar se cierran las que ya vencieron. */
  async list(userId: string, homeIdParam?: string): Promise<PollView[]> {
    const homeId = requireHomeId(homeIdParam);
    const role = await this.access.requireHome(userId, homeId);
    await this.closeExpired(homeId);
    const polls = await this.repository.list(homeId, userId);
    const ids = polls.map(poll => poll.id);
    const [options, voters, active] = await Promise.all([this.repository.options(ids), this.repository.voterNames(ids), this.repository.activeMemberCount(homeId)]);
    return buildPollViews(polls, options, voters, active, role, userId);
  }

  /** Abre una votación y avisa a los demás integrantes del apartamento. */
  async create(user: SessionUser, homeIdParam: string | undefined, data: PollDto) {
    const homeId = requireHomeId(homeIdParam);
    await this.access.requireHome(user.id, homeId);
    if (data.closes_at && new Date(data.closes_at).getTime() <= Date.now()) throw new BadRequestException('La fecha de cierre debe estar en el futuro.');
    return this.db.transaction(async client => {
      const id = await this.repository.insert(homeId, user.id, data, client);
      await this.repository.insertOptions(id, data.options, client);
      await this.activities.add(homeId, user.id, `abrió la votación "${data.title}"`, client);
      for (const memberId of await this.repository.otherMemberIds(homeId, user.id, client)) {
        await this.notifications.notify(client, {
          homeId, userId: memberId, title: 'Nueva votación', message: `${user.name} abrió "${data.title}".`,
          href: '/votaciones', sourceKey: `poll:${id}:created:${memberId}`,
        });
      }
      return { id, message: 'Votación abierta.' };
    });
  }

  /** Guarda el voto de quien consulta; mientras la votación esté abierta se puede cambiar. */
  vote(user: SessionUser, pollId: string, optionId: string) {
    return this.db.transaction(async client => {
      const poll = await this.repository.lockForVote(pollId, client);
      if (!poll) throw new NotFoundException('Votación no encontrada.');
      await this.access.requireHome(user.id, poll.home_id, false, client);
      if (poll.status !== 'open' || isExpired(poll.closes_at)) throw new ConflictException('Esta votación ya está cerrada.');
      const membershipId = await this.repository.activeMembershipId(poll.home_id, user.id, client);
      if (!membershipId) throw new ForbiddenException('No tienes acceso a este apartamento.');
      if (!await this.repository.optionBelongsToPoll(optionId, poll.id, client)) throw new BadRequestException('Elige una opción de esta votación.');
      await this.repository.saveVote(poll.id, optionId, membershipId, client);
      return { message: 'Voto guardado.' };
    });
  }

  /** Cierra y publica el resultado; solo quien creó la votación o un administrador. */
  close(user: SessionUser, pollId: string) {
    return this.db.transaction(async client => {
      const poll = await this.repository.lockForClose(pollId, client);
      if (!poll) throw new NotFoundException('Votación no encontrada.');
      const role = await this.access.requireHome(user.id, poll.home_id, false, client);
      if (poll.status !== 'open') throw new ConflictException('Esta votación ya está cerrada.');
      if (!canClosePoll(role, poll.created_by, user.id)) throw new ForbiddenException('Solo quien creó la votación o un administrador pueden cerrarla.');
      await this.closePoll(client, poll, user.id);
      return { message: 'Votación cerrada.' };
    });
  }

  /** Cierra las votaciones cuya fecha ya pasó, sin atribuirlas a ninguna persona. Lo llaman el worker y el listado. */
  async closeExpired(homeId?: string) {
    await this.db.transaction(async client => {
      for (const poll of await this.repository.lockExpired(homeId ?? null, client)) await this.closePoll(client, poll, null);
    });
  }

  /** La fila de la votación debe estar bloqueada con FOR UPDATE. `actorId` es null en el cierre automático. */
  private async closePoll(client: PoolClient, poll: LockedPoll, actorId: string | null) {
    await this.repository.discardInactiveVotes(poll.id, client);
    const memberIds = await this.repository.activeMemberIds(poll.home_id, client);
    await this.repository.markClosed(poll.id, memberIds.length, client);
    const options = await this.repository.tally(poll.id, client);
    await this.activities.add(poll.home_id, actorId, `cerró la votación "${poll.title}"`, client);
    const message = `"${poll.title}": ${pollResult(options, poll.rule, memberIds.length).text}`;
    for (const memberId of memberIds) {
      if (memberId === actorId) continue;
      await this.notifications.notify(client, {
        homeId: poll.home_id, userId: memberId, title: 'Votación cerrada', message, href: '/votaciones', sourceKey: `poll:${poll.id}:closed:${memberId}`,
      });
    }
  }
}
