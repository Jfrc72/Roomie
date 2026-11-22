import { Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';
import { AcceptanceRow, ReportRow, RuleReport, RuleVersion, RuleVersionRow } from './rules.entity';

@Injectable()
export class RulesRepository {
  constructor(private readonly db: DatabaseService) {}

  versions(homeId: string) {
    return this.db.query<RuleVersionRow>(`SELECT r.id,r.version,r.content,r.notes,r.created_at,u.name AS author FROM rule_versions r
      JOIN users u ON u.id=r.created_by WHERE r.home_id=$1 ORDER BY r.version DESC`, [homeId]);
  }
  // Pendientes primero; luego los más recientes.
  reports(homeId: string) {
    return this.db.query<ReportRow>(`SELECT r.id,r.clause,r.description,r.created_at,r.resolved_at,u.name AS reporter,t.name AS reported
      FROM rule_reports r JOIN users u ON u.id=r.reported_by
      LEFT JOIN memberships m ON m.id=r.reported_membership_id LEFT JOIN users t ON t.id=m.user_id
      WHERE r.home_id=$1 ORDER BY r.resolved_at IS NOT NULL, r.created_at DESC LIMIT 30`, [homeId]);
  }
  // Integrantes activos con su aceptación de la versión indicada; primero quienes ya aceptaron.
  acceptances(homeId: string, versionId: string) {
    return this.db.query<AcceptanceRow>(`SELECT m.id AS membership_id,u.name,a.accepted_at,m.user_id FROM memberships m
      JOIN users u ON u.id=m.user_id
      LEFT JOIN rule_acceptances a ON a.membership_id=m.id AND a.rule_version_id=$2
      WHERE m.home_id=$1 AND m.active ORDER BY a.accepted_at IS NULL, u.name`, [homeId, versionId]);
  }
  async latest(homeId: string, client: PoolClient) {
    const [row] = await this.db.query<Pick<RuleVersion, 'id' | 'version' | 'content'>>('SELECT id,version,content FROM rule_versions WHERE home_id=$1 ORDER BY version DESC LIMIT 1', [homeId], client);
    return row ?? null;
  }
  async findVersion(versionId: string, client: PoolClient) {
    const [row] = await this.db.query<Pick<RuleVersion, 'id' | 'home_id' | 'version'>>('SELECT id,home_id,version FROM rule_versions WHERE id=$1', [versionId], client);
    return row ?? null;
  }
  async createVersion(data: { homeId: string; version: number; content: string; notes: string; userId: string }, client: PoolClient) {
    const [row] = await this.db.query<{ id: string }>('INSERT INTO rule_versions(home_id,version,content,notes,created_by) VALUES($1,$2,$3,$4,$5) RETURNING id',
      [data.homeId, data.version, data.content, data.notes, data.userId], client);
    return row.id;
  }
  // Devuelve false si la persona ya había aceptado esa versión.
  async accept(versionId: string, homeId: string, userId: string, client: PoolClient) {
    const rows = await this.db.query(`INSERT INTO rule_acceptances(rule_version_id,membership_id)
      SELECT $1,id FROM memberships WHERE home_id=$2 AND user_id=$3 AND active
      ON CONFLICT DO NOTHING RETURNING accepted_at`, [versionId, homeId, userId], client);
    return rows.length > 0;
  }
  async otherMembers(homeId: string, userId: string, client: PoolClient) {
    return (await this.db.query<{ user_id: string }>('SELECT user_id FROM memberships WHERE home_id=$1 AND active AND user_id<>$2', [homeId, userId], client)).map(row => row.user_id);
  }
  async admins(homeId: string, client: PoolClient) {
    return (await this.db.query<{ user_id: string }>("SELECT user_id FROM memberships WHERE home_id=$1 AND active AND role='admin'", [homeId], client)).map(row => row.user_id);
  }
  async activeMember(membershipId: string, homeId: string, client: PoolClient) {
    const [row] = await this.db.query<{ user_id: string; name: string }>(`SELECT m.user_id,u.name FROM memberships m JOIN users u ON u.id=m.user_id
      WHERE m.id=$1 AND m.home_id=$2 AND m.active FOR SHARE OF m`, [membershipId, homeId], client);
    return row ?? null;
  }
  async memberNames(homeId: string) {
    return (await this.db.query<{ name: string }>('SELECT u.name FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.home_id=$1 AND m.active ORDER BY m.joined_at', [homeId])).map(row => row.name);
  }
  async createReport(data: { homeId: string; versionId: string; clause: string; description: string; userId: string; reportedMembershipId: string | null }, client: PoolClient) {
    const [row] = await this.db.query<{ id: string }>(`INSERT INTO rule_reports(home_id,rule_version_id,clause,description,reported_by,reported_membership_id)
      VALUES($1,$2,$3,$4,$5,$6) RETURNING id`, [data.homeId, data.versionId, data.clause, data.description, data.userId, data.reportedMembershipId], client);
    return row.id;
  }
  async lockReport(reportId: string, client: PoolClient) {
    const [row] = await this.db.query<Pick<RuleReport, 'id' | 'home_id' | 'clause' | 'reported_by' | 'resolved_at'>>(
      'SELECT id,home_id,clause,reported_by,resolved_at FROM rule_reports WHERE id=$1 FOR UPDATE', [reportId], client);
    return row ?? null;
  }
  async resolveReport(reportId: string, userId: string, client: PoolClient) {
    await this.db.query('UPDATE rule_reports SET resolved_at=now(),resolved_by=$2 WHERE id=$1', [reportId, userId], client);
  }
}
