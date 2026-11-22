import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { HomeAccessService } from '../access/home-access.service';
import { ActivitiesService } from '../activities/activities.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SessionUser } from '../auth/auth.entity';
import { ReportDto } from './rules.dto';
import { RulesRepository } from './rules.repository';
import { clauseInRules, compact, excerpt } from './rules.rules';

// Cualquier integrante reporta un incumplimiento del reglamento vigente; se avisa a los administradores
// y a la persona señalada. Solo un administrador lo marca como resuelto.
@Injectable()
export class RuleReportsService {
  constructor(
    private readonly repository: RulesRepository,
    private readonly db: DatabaseService,
    private readonly access: HomeAccessService,
    private readonly activities: ActivitiesService,
    private readonly notifications: NotificationsService,
  ) {}

  async report(user: SessionUser, homeId: string, data: ReportDto) {
    await this.access.requireHome(user.id, homeId);
    return this.db.transaction(async client => {
      const current = await this.repository.latest(homeId, client);
      if (!current) throw new ConflictException('Aún no hay un reglamento publicado.');
      if (!clauseInRules(current.content, data.clause)) throw new BadRequestException('Elige un acuerdo del reglamento vigente.');
      let reported: { user_id: string; name: string } | null = null;
      if (data.reported_membership_id) {
        reported = await this.repository.activeMember(data.reported_membership_id, homeId, client);
        if (!reported) throw new BadRequestException('La persona señalada debe ser un integrante activo.');
        if (reported.user_id === user.id) throw new BadRequestException('No puedes reportarte a ti mismo.');
      }
      // Se guarda el texto del acuerdo: sigue legible aunque se publique otra versión.
      const clause = compact(data.clause);
      const id = await this.repository.createReport({
        homeId, versionId: current.id, clause, description: data.description, userId: user.id, reportedMembershipId: data.reported_membership_id,
      }, client);
      await this.activities.add(homeId, user.id, 'reportó un incumplimiento del reglamento', client);
      const recipients = new Set(await this.repository.admins(homeId, client));
      if (reported) recipients.add(reported.user_id);
      recipients.delete(user.id);
      for (const recipient of recipients) await this.notifications.notify(client, {
        homeId, userId: recipient, title: 'Incumplimiento reportado', href: '/reglamento', sourceKey: `rule-report:${id}:${recipient}`,
        message: recipient === reported?.user_id
          ? `${user.name} reportó que no cumpliste: "${excerpt(clause)}"`
          : `${user.name} reportó un incumplimiento${reported ? ` de ${reported.name}` : ''}: "${excerpt(clause)}"`,
      });
      return { id, message: 'Reporte enviado.' };
    });
  }

  resolve(user: SessionUser, reportId: string) {
    return this.db.transaction(async client => {
      const report = await this.repository.lockReport(reportId, client);
      if (!report) throw new NotFoundException('Reporte no encontrado.');
      await this.access.requireHome(user.id, report.home_id, true, client);
      if (report.resolved_at) throw new ConflictException('Este reporte ya está resuelto.');
      await this.repository.resolveReport(report.id, user.id, client);
      await this.activities.add(report.home_id, user.id, 'marcó como resuelto un incumplimiento del reglamento', client);
      if (report.reported_by !== user.id) await this.notifications.notify(client, {
        homeId: report.home_id, userId: report.reported_by, title: 'Incumplimiento resuelto',
        message: `${user.name} marcó como resuelto tu reporte: "${excerpt(report.clause)}"`, href: '/reglamento', sourceKey: `rule-report:${report.id}:resolved`,
      });
      return { message: 'Reporte resuelto.' };
    });
  }
}
