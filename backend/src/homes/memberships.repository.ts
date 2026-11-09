import { Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';
import { Membership } from './homes.entity';

@Injectable()
export class MembershipsRepository {
  constructor(private readonly db: DatabaseService) {}
  async find(homeId: string, membershipId: string, client: PoolClient) {
    const [row] = await this.db.query<Membership>('SELECT * FROM memberships WHERE id=$1 AND home_id=$2 AND active', [membershipId, homeId], client);
    return row ? Object.assign(new Membership(), row) : null;
  }
  async adminCount(homeId: string, client: PoolClient) {
    const [row] = await this.db.query<{ total: number }>("SELECT count(*)::int AS total FROM memberships WHERE home_id=$1 AND active AND role='admin'", [homeId], client);
    return row.total;
  }
  async remove(member: Membership, client: PoolClient) {
    await this.db.query('UPDATE memberships SET active=false WHERE id=$1', [member.id], client);
    await this.db.query('UPDATE sessions SET active_home_id=null WHERE user_id=$1 AND active_home_id=$2', [member.user_id, member.home_id], client);
  }
  async changeRole(memberId: string, role: string, client: PoolClient) {
    await this.db.query('UPDATE memberships SET role=$1 WHERE id=$2', [role, memberId], client);
  }
}
