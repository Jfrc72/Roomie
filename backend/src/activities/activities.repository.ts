import { Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class ActivitiesRepository {
  constructor(private readonly db: DatabaseService) {}
  async add(homeId: string, userId: string, message: string, client: PoolClient) {
    await this.db.query('INSERT INTO activities(home_id,actor_id,message) VALUES($1,$2,$3)', [homeId, userId, message], client);
  }
  list(homeId: string) {
    return this.db.query<{ id: string; message: string; created_at: Date; actor: string | null }>(
      `SELECT a.id,a.message,a.created_at,u.name AS actor FROM activities a
       LEFT JOIN users u ON u.id=a.actor_id WHERE home_id=$1 ORDER BY a.created_at DESC LIMIT 12`, [homeId],
    );
  }
}
