import { Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';
import { MaintenanceReportDto } from './maintenance.dto';
import { MaintenanceChanges, MaintenanceFilters, MaintenanceReport, MaintenanceReportRow, StatusCounts } from './maintenance.entity';

@Injectable()
export class MaintenanceRepository {
  constructor(private readonly db: DatabaseService) {}

  /** Reportes vigentes que cumplen los filtros (`null` = sin filtrar), de mayor a menor prioridad. */
  list(homeId: string, filters: MaintenanceFilters) {
    return this.db.query<MaintenanceReportRow>(
      `SELECT r.id,r.title,r.description,r.category,r.estimated_cost,r.priority,r.status,
        r.reported_by,u.name AS reported_by_name,r.assigned_membership_id,assignee.name AS assigned_to,
        m.user_id AS assigned_user_id,r.created_at,r.updated_at
       FROM maintenance_reports r JOIN users u ON u.id=r.reported_by
       LEFT JOIN memberships m ON m.id=r.assigned_membership_id
       LEFT JOIN users assignee ON assignee.id=m.user_id
       WHERE r.home_id=$1 AND r.deleted_at IS NULL AND ($2::text IS NULL OR r.status=$2)
         AND ($3::text IS NULL OR r.priority=$3) AND ($4::text IS NULL OR r.category=$4)
       ORDER BY CASE r.priority WHEN 'URGENTE' THEN 0 WHEN 'ALTA' THEN 1 WHEN 'MEDIA' THEN 2 ELSE 3 END,
         r.created_at DESC`,
      [homeId, filters.status, filters.priority, filters.category],
    );
  }

  /** Contadores de todo el apartamento: no dependen de los filtros del listado. */
  async counts(homeId: string) {
    const [row] = await this.db.query<StatusCounts>(
      `SELECT count(*) FILTER (WHERE status='PENDIENTE')::int AS pending,
        count(*) FILTER (WHERE status='EN_PROGRESO')::int AS in_progress,
        count(*) FILTER (WHERE status='RESUELTO')::int AS resolved
       FROM maintenance_reports WHERE home_id=$1 AND deleted_at IS NULL`,
      [homeId],
    );
    return row;
  }

  async urgentCount(homeId: string) {
    const [row] = await this.db.query<{ total: number }>(
      `SELECT count(*)::int AS total FROM maintenance_reports
       WHERE home_id=$1 AND priority IN ('ALTA','URGENTE') AND status<>'RESUELTO' AND deleted_at IS NULL`,
      [homeId],
    );
    return row.total;
  }

  /** Bloquea la fila para que las ediciones simultáneas del mismo reporte se ejecuten de una en una. */
  async lock(id: string, deleted: boolean, client: PoolClient) {
    const [row] = await this.db.query<MaintenanceReport>(
      `SELECT * FROM maintenance_reports WHERE id=$1 AND deleted_at IS ${deleted ? 'NOT NULL' : 'NULL'} FOR UPDATE`, [id], client,
    );
    return row ? Object.assign(new MaintenanceReport(), row) : null;
  }

  /** Cuenta (user_id) a la que pertenece una membresía del apartamento; no exige que siga activa. */
  async assigneeUserId(homeId: string, membershipId: string, client: PoolClient) {
    const [row] = await this.db.query<{ user_id: string }>('SELECT user_id FROM memberships WHERE id=$1 AND home_id=$2', [membershipId, homeId], client);
    return row?.user_id ?? null;
  }

  /** `membershipId` es el id de la membresía, no el de la cuenta; debe estar activa en ese apartamento. */
  async isActiveMembership(homeId: string, membershipId: string, client: PoolClient) {
    const rows = await this.db.query('SELECT id FROM memberships WHERE id=$1 AND home_id=$2 AND active FOR SHARE', [membershipId, homeId], client);
    return rows.length > 0;
  }

  async insert(homeId: string, userId: string, data: MaintenanceReportDto, client: PoolClient) {
    const [row] = await this.db.query<{ id: string }>(
      `INSERT INTO maintenance_reports(home_id,title,description,category,estimated_cost,priority,reported_by,assigned_membership_id)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [homeId, data.title, data.description ?? '', data.category, data.estimated_cost == null ? null : data.estimated_cost.toFixed(2),
        data.priority ?? 'MEDIA', userId, data.assigned_membership_id ?? null], client,
    );
    return row.id;
  }

  async update(id: string, changes: MaintenanceChanges, client: PoolClient) {
    await this.db.query(
      `UPDATE maintenance_reports SET title=$1,description=$2,category=$3,estimated_cost=$4,priority=$5,status=$6,
        assigned_membership_id=$7,updated_at=now() WHERE id=$8`,
      [changes.title, changes.description, changes.category, changes.estimated_cost, changes.priority, changes.status, changes.assigned_membership_id, id], client,
    );
  }

  /** Borrado lógico: el reporte se oculta pero se conserva para poder deshacerlo. */
  async setDeleted(id: string, deleted: boolean, client: PoolClient) {
    await this.db.query('UPDATE maintenance_reports SET deleted_at=CASE WHEN $2 THEN now() END,updated_at=now() WHERE id=$1', [id, deleted], client);
  }
}
