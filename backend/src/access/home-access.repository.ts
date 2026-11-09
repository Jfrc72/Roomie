import { Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class HomeAccessRepository {
  constructor(private readonly db: DatabaseService) {}

  async role(userId: string, homeId: string, client?: PoolClient) {
    const [row] = await this.db.query<{ role: 'admin' | 'member' }>(
      `SELECT m.role FROM memberships m JOIN homes h ON h.id=m.home_id
       WHERE m.home_id=$1 AND m.user_id=$2 AND m.active AND h.archived_at IS NULL`, [homeId, userId], client,
    );
    return row?.role;
  }

  async lockHome(homeId: string, client: PoolClient) {
    await this.db.query('SELECT id FROM homes WHERE id=$1 FOR UPDATE', [homeId], client);
  }

  async canCloseAccount(userId: string, client: PoolClient) {
    await this.db.query(`SELECT h.id FROM homes h JOIN memberships m ON m.home_id=h.id
      WHERE m.user_id=$1 AND m.active AND h.archived_at IS NULL ORDER BY h.id FOR UPDATE OF h`, [userId], client);
    const rows = await this.db.query(`SELECT m.id FROM memberships m JOIN homes h ON h.id=m.home_id
      WHERE m.user_id=$1 AND m.active AND m.role='admin' AND h.archived_at IS NULL
      AND NOT EXISTS(SELECT 1 FROM memberships other WHERE other.home_id=m.home_id AND other.user_id<>$1 AND other.active AND other.role='admin')`, [userId], client);
    return rows.length === 0;
  }
}
