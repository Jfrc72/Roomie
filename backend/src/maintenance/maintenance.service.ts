import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PoolClient } from 'pg';
import { HomeAccessService } from '../access/home-access.service';
import { ActivitiesService } from '../activities/activities.service';
import { SessionUser } from '../auth/auth.entity';
import { DatabaseService } from '../database/database.service';
import { hasChanges, requireHomeId } from '../common/params';
import { canManageRecord } from '../common/permissions.rules';
import { MaintenanceReportDto, UpdateMaintenanceReportDto } from './maintenance.dto';
import { MaintenanceReport } from './maintenance.entity';
import { MaintenanceRepository } from './maintenance.repository';
import { MaintenanceDigest, MaintenanceOverview } from './maintenance.responses';
import { applyChanges, canUpdateReport, invalidFilter, normalizeFilters, RawFilters, toReportView } from './maintenance.rules';

type Action = 'eliminar' | 'restaurar';

@Injectable()
export class MaintenanceService {
  constructor(
    private readonly repository: MaintenanceRepository,
    private readonly db: DatabaseService,
    private readonly access: HomeAccessService,
    private readonly activities: ActivitiesService,
  ) {}

  /** Reportes filtrados por estado, prioridad y categoría, más los contadores de todo el apartamento. */
  async list(userId: string, homeIdParam: string | undefined, raw: RawFilters): Promise<MaintenanceOverview> {
    const homeId = requireHomeId(homeIdParam);
    const role = await this.access.requireHome(userId, homeId);
    const invalid = invalidFilter(raw);
    if (invalid) throw new BadRequestException(`Filtro de ${invalid} no válido.`);
    const [rows, counts] = await Promise.all([this.repository.list(homeId, normalizeFilters(raw)), this.repository.counts(homeId)]);
    return { reports: rows.map(row => toReportView(row, role, userId)), counts };
  }

  /** Resumen para el inicio. No revisa el acceso: DashboardService ya comprobó la pertenencia al apartamento. */
  async summary(homeId: string): Promise<MaintenanceDigest> {
    return { urgent: await this.repository.urgentCount(homeId) };
  }

  async create(user: SessionUser, homeIdParam: string | undefined, data: MaintenanceReportDto) {
    const homeId = requireHomeId(homeIdParam);
    await this.access.requireHome(user.id, homeId);
    return this.db.transaction(async client => {
      await this.access.lockHome(user.id, homeId, client, false);
      await this.requireAssignee(homeId, data.assigned_membership_id, client);
      const id = await this.repository.insert(homeId, user.id, data, client);
      await this.activities.add(homeId, user.id, `reportó "${data.title}" para mantenimiento`, client);
      return { id, message: 'Reporte creado.' };
    });
  }

  /** Quien reportó, el responsable o un administrador pueden actualizar el reporte, cambiar su estado y reasignarlo. */
  async update(user: SessionUser, id: string, patch: UpdateMaintenanceReportDto) {
    if (!hasChanges(patch)) throw new BadRequestException('Indica qué deseas actualizar.');
    return this.db.transaction(async client => {
      const report = await this.repository.lock(id, false, client);
      if (!report) throw new NotFoundException('Reporte no encontrado.');
      const role = await this.access.lockHome(user.id, report.home_id, client, false);
      const assigneeUserId = report.assigned_membership_id ? await this.repository.assigneeUserId(report.home_id, report.assigned_membership_id, client) : null;
      if (!canUpdateReport(role, report.reported_by, assigneeUserId, user.id)) {
        throw new ForbiddenException('Solo quien reportó, el responsable o un administrador puede actualizar el reporte.');
      }
      await this.requireAssignee(report.home_id, patch.assigned_membership_id, client);
      const changes = applyChanges(report, patch);
      await this.repository.update(id, changes, client);
      await this.activities.add(report.home_id, user.id, `actualizó el reporte "${changes.title}"`, client);
      return { message: 'Reporte actualizado.' };
    });
  }

  remove(user: SessionUser, id: string) {
    return this.db.transaction(async client => {
      const report = await this.lockRecord(user, id, false, 'eliminar', client);
      await this.repository.setDeleted(id, true, client);
      await this.activities.add(report.home_id, user.id, `eliminó el reporte "${report.title}"`, client);
      return { message: 'Reporte eliminado.' };
    });
  }

  restore(user: SessionUser, id: string) {
    return this.db.transaction(async client => {
      const report = await this.lockRecord(user, id, true, 'restaurar', client);
      await this.repository.setDeleted(id, false, client);
      await this.activities.add(report.home_id, user.id, `restauró el reporte "${report.title}"`, client);
      return { message: 'Reporte restaurado.' };
    });
  }

  /** Bloquea el reporte y luego su apartamento, siempre en ese orden. Eliminar y restaurar: quien reportó o un administrador. */
  private async lockRecord(user: SessionUser, id: string, deleted: boolean, action: Action, client: PoolClient): Promise<MaintenanceReport> {
    const report = await this.repository.lock(id, deleted, client);
    if (!report) throw new NotFoundException(deleted ? 'Reporte eliminado no encontrado.' : 'Reporte no encontrado.');
    const role = await this.access.lockHome(user.id, report.home_id, client, false);
    if (!canManageRecord(role, report.reported_by, user.id)) {
      throw new ForbiddenException(`Solo quien reportó o un administrador puede ${action} el reporte.`);
    }
    return report;
  }

  /** El responsable es opcional, pero si se indica debe ser un integrante activo del apartamento. */
  private async requireAssignee(homeId: string, membershipId: string | null | undefined, client: PoolClient) {
    if (!membershipId) return;
    if (!await this.repository.isActiveMembership(homeId, membershipId, client)) {
      throw new BadRequestException('El responsable debe pertenecer al apartamento.');
    }
  }
}
