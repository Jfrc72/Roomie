import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { HomeAccessService } from '../access/home-access.service';
import { ActivitiesService } from '../activities/activities.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SessionUser } from '../auth/auth.entity';
import { hashToken, token } from '../auth/passwords';
import { InvitationsRepository } from './invitations.repository';
import { invitationProblem } from './homes.rules';

@Injectable()
export class InvitationsService {
  constructor(
    private readonly repository: InvitationsRepository,
    private readonly db: DatabaseService,
    private readonly access: HomeAccessService,
    private readonly activities: ActivitiesService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(userId: string, homeId: string) {
    await this.access.requireHome(userId, homeId, true);
    return this.repository.list(homeId);
  }

  create(userId: string, homeId: string, email: string) {
    return this.db.transaction(async client => {
      await this.access.lockHome(userId, homeId, client);
      if (await this.repository.count(homeId, client) >= 8) throw new ConflictException('El apartamento ya tiene 8 integrantes.');
      if (await this.repository.hasEmail(homeId, email, client)) throw new ConflictException('Esta persona ya pertenece al apartamento.');
      const value = token();
      await this.repository.create(homeId, email, hashToken(value), userId, client);
      await this.activities.add(homeId, userId, 'creó una invitación', client);
      return { url: `${process.env.APP_URL || 'http://localhost:3000'}/invitaciones?token=${value}`, message: 'Invitación creada. Comparte el enlace con la persona invitada.' };
    });
  }

  revoke(userId: string, homeId: string, invitationId: string) {
    return this.db.transaction(async client => {
      await this.access.lockHome(userId, homeId, client);
      if (!await this.repository.revoke(homeId, invitationId, client)) throw new NotFoundException('Invitación no encontrada.');
      return { message: 'Invitación cancelada.' };
    });
  }

  accept(user: SessionUser, value: string) {
    return this.db.transaction(async client => {
      const invite = await this.repository.find(hashToken(value), client);
      if (!invite) throw new NotFoundException('Invitación no encontrada.');
      // El bloqueo del hogar impide superar el cupo con dos aceptaciones simultáneas.
      if (!await this.repository.lockHome(invite.home_id, client)) throw new ConflictException('Este apartamento fue archivado.');
      const fresh = await this.repository.refresh(invite.id, client);
      const problem = invitationProblem({
        status: fresh.status, expiresAt: fresh.expires_at, email: fresh.email, userEmail: user.email,
        count: await this.repository.count(invite.home_id, client),
        existing: await this.repository.alreadyMember(invite.home_id, user.id, client),
      });
      if (problem === 'expired') throw new ConflictException('Esta invitación venció o ya fue utilizada.');
      if (problem === 'email') throw new ForbiddenException('Inicia sesión con el correo al que fue enviada la invitación.');
      if (problem === 'member') throw new ConflictException('Ya perteneces a este apartamento.');
      if (problem === 'capacity') throw new ConflictException('El apartamento llegó al límite de 8 integrantes.');
      await this.repository.accept(invite, user.id, user.sessionHash, client);
      await this.activities.add(invite.home_id, user.id, 'se unió al apartamento', client);
      await this.notifications.notify(client, { homeId: invite.home_id, userId: invite.created_by, title: 'Un nuevo roommate', message: `${user.name} aceptó la invitación.`, href: '/apartamento' });
      return { message: 'Ya eres parte del apartamento.' };
    });
  }
}
