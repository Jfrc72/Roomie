import { Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';
import { Home, Invitation } from './homes.entity';

@Injectable()
export class InvitationsRepository {
  constructor(private readonly db: DatabaseService) {}
  list(homeId: string) {
    return this.db.query<Pick<Invitation, 'id' | 'email' | 'status' | 'expires_at'>>('SELECT id,email,status,expires_at FROM invitations WHERE home_id=$1 ORDER BY created_at DESC LIMIT 30', [homeId]);
  }
  async count(homeId: string, client: PoolClient) {
    const [row] = await this.db.query<{ total: number }>('SELECT count(*)::int AS total FROM memberships WHERE home_id=$1 AND active', [homeId], client);
    return row.total;
  }
  async hasEmail(homeId: string, email: string, client: PoolClient) {
    const rows = await this.db.query('SELECT m.id FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.home_id=$1 AND m.active AND u.email=$2', [homeId, email], client);
    return rows.length > 0;
  }
  async create(homeId: string, email: string, hash: string, userId: string, client: PoolClient) {
    await this.db.query("UPDATE invitations SET status='revoked' WHERE home_id=$1 AND email=$2 AND status='pending'", [homeId, email], client);
    await this.db.query("INSERT INTO invitations(home_id,email,token_hash,created_by,expires_at) VALUES($1,$2,$3,$4,now()+interval '7 days')", [homeId, email, hash, userId], client);
  }
  async revoke(homeId: string, invitationId: string, client: PoolClient) {
    return (await this.db.query("UPDATE invitations SET status='revoked' WHERE id=$1 AND home_id=$2 AND status='pending' RETURNING id", [invitationId, homeId], client)).length > 0;
  }
  async find(hash: string, client: PoolClient) {
    const [row] = await this.db.query<Invitation>('SELECT * FROM invitations WHERE token_hash=$1', [hash], client);
    return row ? Object.assign(new Invitation(), row) : null;
  }
  async lockHome(homeId: string, client: PoolClient) {
    const [row] = await this.db.query<Home>('SELECT id,archived_at FROM homes WHERE id=$1 FOR UPDATE', [homeId], client);
    return row && !row.archived_at;
  }
  async refresh(invitationId: string, client: PoolClient) {
    const [row] = await this.db.query<Invitation>('SELECT * FROM invitations WHERE id=$1 FOR UPDATE', [invitationId], client);
    return Object.assign(new Invitation(), row);
  }
  async alreadyMember(homeId: string, userId: string, client: PoolClient) {
    const [row] = await this.db.query<{ active: boolean }>('SELECT active FROM memberships WHERE home_id=$1 AND user_id=$2', [homeId, userId], client);
    return Boolean(row?.active);
  }
  async accept(invitation: Invitation, userId: string, sessionHash: string, client: PoolClient) {
    await this.db.query("INSERT INTO memberships(home_id,user_id,role) VALUES($1,$2,'member') ON CONFLICT(home_id,user_id) DO UPDATE SET active=true,role='member'", [invitation.home_id, userId], client);
    await this.db.query("UPDATE invitations SET status='accepted' WHERE id=$1", [invitation.id], client);
    await this.db.query('UPDATE sessions SET active_home_id=$1 WHERE token_hash=$2', [invitation.home_id, sessionHash], client);
  }
}
