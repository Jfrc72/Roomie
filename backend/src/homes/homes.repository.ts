import { Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';
import { HomeDto } from './homes.dto';
import { Home, HomeMember } from './homes.entity';

@Injectable()
export class HomesRepository {
  constructor(private readonly db: DatabaseService) {}
  async create(data: HomeDto, userId: string, client: PoolClient) {
    const [row] = await this.db.query<Home>('INSERT INTO homes(name,address,description) VALUES($1,$2,$3) RETURNING *', [data.name, data.address, data.description], client);
    await this.db.query("INSERT INTO memberships(home_id,user_id,role) VALUES($1,$2,'admin')", [row.id, userId], client);
    return Object.assign(new Home(), row);
  }
  async find(homeId: string) {
    const [row] = await this.db.query<Home>('SELECT * FROM homes WHERE id=$1 AND archived_at IS NULL', [homeId]);
    return row ? Object.assign(new Home(), row) : null;
  }
  members(homeId: string) {
    return this.db.query<HomeMember>(`SELECT u.id,u.name,u.email,m.id AS membership_id,m.role FROM memberships m
      JOIN users u ON u.id=m.user_id WHERE m.home_id=$1 AND m.active ORDER BY m.joined_at`, [homeId]);
  }
  async select(homeId: string, sessionHash: string, client?: PoolClient) {
    await this.db.query('UPDATE sessions SET active_home_id=$1 WHERE token_hash=$2', [homeId, sessionHash], client);
  }
  async update(homeId: string, data: HomeDto, client: PoolClient) {
    await this.db.query('UPDATE homes SET name=$1,address=$2,description=$3 WHERE id=$4', [data.name, data.address, data.description, homeId], client);
  }
  async archive(homeId: string, client: PoolClient) {
    await this.db.query('UPDATE homes SET archived_at=now() WHERE id=$1', [homeId], client);
    await this.db.query('UPDATE sessions SET active_home_id=null WHERE active_home_id=$1', [homeId], client);
    await this.db.query("UPDATE invitations SET status='revoked' WHERE home_id=$1 AND status='pending'", [homeId], client);
  }
}
