import { Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';
import { PollDto } from './polls.dto';
import { LockedPoll, OptionRow, PollRow, Tally, VoterRow } from './polls.entity';

const LOCKED = 'SELECT id,home_id,title,rule,status,closes_at,created_by FROM polls WHERE id=$1';

@Injectable()
export class PollsRepository {
  constructor(private readonly db: DatabaseService) {}

  // ── Lecturas ────────────────────────────────────────────────────────────────────────────

  /** Abiertas primero y luego cerradas, de la más reciente a la más antigua. */
  list(homeId: string, userId: string) {
    return this.db.query<PollRow>(
      `SELECT p.id,p.title,p.description,p.rule,p.anonymous,p.closes_at,p.status,p.created_by,c.name AS creator,
        p.created_at,p.closed_at,p.eligible_count,
        (SELECT v.option_id FROM votes v JOIN memberships m ON m.id=v.membership_id
          WHERE v.poll_id=p.id AND m.user_id=$2) AS my_option_id,
        (SELECT count(*)::int FROM votes v JOIN memberships m ON m.id=v.membership_id
          WHERE v.poll_id=p.id AND (m.active OR p.status='closed')) AS voters
       FROM polls p JOIN users c ON c.id=p.created_by WHERE p.home_id=$1
       ORDER BY p.status='closed', COALESCE(p.closed_at,p.created_at) DESC`,
      [homeId, userId],
    );
  }

  options(pollIds: string[]) {
    return this.db.query<OptionRow>(
      `SELECT o.id,o.poll_id,o.label,count(v.membership_id)::int AS votes FROM poll_options o
       LEFT JOIN votes v ON v.option_id=o.id WHERE o.poll_id=ANY($1) GROUP BY o.id ORDER BY o.position`,
      [pollIds],
    );
  }

  /** Quiénes votaron cada opción; solo de votaciones públicas ya cerradas. */
  voterNames(pollIds: string[]) {
    return this.db.query<VoterRow>(
      `SELECT v.option_id,u.name FROM votes v JOIN polls p ON p.id=v.poll_id
       JOIN memberships m ON m.id=v.membership_id JOIN users u ON u.id=m.user_id
       WHERE v.poll_id=ANY($1) AND p.status='closed' AND NOT p.anonymous ORDER BY u.name`,
      [pollIds],
    );
  }

  async activeMemberCount(homeId: string) {
    const [row] = await this.db.query<{ total: number }>('SELECT count(*)::int AS total FROM memberships WHERE home_id=$1 AND active', [homeId]);
    return row.total;
  }

  // ── Escrituras (siempre dentro de una transacción) ──────────────────────────────────────

  async insert(homeId: string, userId: string, data: PollDto, client: PoolClient) {
    const [row] = await this.db.query<{ id: string }>(
      'INSERT INTO polls(home_id,title,description,rule,anonymous,closes_at,created_by) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id',
      [homeId, data.title, data.description ?? '', data.rule ?? 'simple', data.anonymous ?? false, data.closes_at ?? null, userId], client,
    );
    return row.id;
  }

  /** Inserta todas las opciones en una sola sentencia, conservando el orden en que se escribieron. */
  async insertOptions(pollId: string, labels: string[], client: PoolClient) {
    await this.db.query(
      'INSERT INTO poll_options(poll_id,label,position) SELECT $1,label,ord FROM unnest($2::text[]) WITH ORDINALITY AS o(label,ord)',
      [pollId, labels], client,
    );
  }

  async otherMemberIds(homeId: string, exceptUserId: string, client: PoolClient) {
    const rows = await this.db.query<{ user_id: string }>('SELECT user_id FROM memberships WHERE home_id=$1 AND active AND user_id<>$2', [homeId, exceptUserId], client);
    return rows.map(row => row.user_id);
  }

  /** Votar comparte la fila (FOR SHARE) y cerrar la bloquea (FOR UPDATE): ningún voto entra después del recuento. */
  async lockForVote(id: string, client: PoolClient) {
    const [row] = await this.db.query<LockedPoll>(`${LOCKED} FOR SHARE`, [id], client);
    return row ?? null;
  }

  async lockForClose(id: string, client: PoolClient) {
    const [row] = await this.db.query<LockedPoll>(`${LOCKED} FOR UPDATE`, [id], client);
    return row ?? null;
  }

  /** Votaciones abiertas con fecha vencida (de un apartamento o de todos); `SKIP LOCKED` evita que dos procesos cierren la misma. */
  lockExpired(homeId: string | null, client: PoolClient) {
    return this.db.query<LockedPoll>(
      `SELECT id,home_id,title,rule,status,closes_at,created_by FROM polls
       WHERE status='open' AND closes_at<=now() AND ($1::uuid IS NULL OR home_id=$1) FOR UPDATE SKIP LOCKED`,
      [homeId], client,
    );
  }

  async activeMembershipId(homeId: string, userId: string, client: PoolClient) {
    const [row] = await this.db.query<{ id: string }>('SELECT id FROM memberships WHERE home_id=$1 AND user_id=$2 AND active FOR SHARE', [homeId, userId], client);
    return row?.id ?? null;
  }

  async optionBelongsToPoll(optionId: string, pollId: string, client: PoolClient) {
    const rows = await this.db.query('SELECT id FROM poll_options WHERE id=$1 AND poll_id=$2', [optionId, pollId], client);
    return rows.length > 0;
  }

  /** Un voto por integrante: mientras la votación siga abierta, votar de nuevo cambia el voto. */
  async saveVote(pollId: string, optionId: string, membershipId: string, client: PoolClient) {
    await this.db.query(
      `INSERT INTO votes(poll_id,option_id,membership_id) VALUES($1,$2,$3)
       ON CONFLICT(poll_id,membership_id) DO UPDATE SET option_id=excluded.option_id,voted_at=now()`,
      [pollId, optionId, membershipId], client,
    );
  }

  /** Al cerrar solo cuentan los votos de quienes siguen activos; los de integrantes retirados se descartan. */
  async discardInactiveVotes(pollId: string, client: PoolClient) {
    await this.db.query('DELETE FROM votes v USING memberships m WHERE v.poll_id=$1 AND m.id=v.membership_id AND NOT m.active', [pollId], client);
  }

  async activeMemberIds(homeId: string, client: PoolClient) {
    const rows = await this.db.query<{ user_id: string }>('SELECT user_id FROM memberships WHERE home_id=$1 AND active', [homeId], client);
    return rows.map(row => row.user_id);
  }

  async markClosed(pollId: string, eligible: number, client: PoolClient) {
    await this.db.query("UPDATE polls SET status='closed',closed_at=now(),eligible_count=$2 WHERE id=$1", [pollId, eligible], client);
  }

  tally(pollId: string, client: PoolClient) {
    return this.db.query<Tally>(
      `SELECT o.label,count(v.membership_id)::int AS votes FROM poll_options o
       LEFT JOIN votes v ON v.option_id=o.id WHERE o.poll_id=$1 GROUP BY o.id ORDER BY o.position`,
      [pollId], client,
    );
  }
}
