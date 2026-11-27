import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class DashboardRepository {
  constructor(private readonly db: DatabaseService) {}
  tasks(homeId: string, userId: string) {
    return this.db.query<{ id: string; title: string; due_at: Date | null }>(`SELECT t.id,t.title,t.due_at FROM tasks t JOIN memberships m ON m.id=t.assigned_membership_id
      WHERE t.home_id=$1 AND m.user_id=$2 AND t.status<>'completed' ORDER BY t.due_at ASC NULLS LAST,t.created_at LIMIT 5`, [homeId, userId]);
  }
  async taskCount(homeId: string, userId: string) {
    const [row] = await this.db.query<{ total: number }>(`SELECT count(*)::int AS total FROM tasks t JOIN memberships m ON m.id=t.assigned_membership_id
      WHERE t.home_id=$1 AND m.user_id=$2 AND t.status<>'completed'`, [homeId, userId]);
    return row.total;
  }
  async reservation(homeId: string) {
    const [row] = await this.db.query<{ name: string; starts_at: Date }>(`SELECT s.name,r.starts_at FROM reservations r JOIN resources s ON s.id=r.resource_id
      WHERE r.home_id=$1 AND r.status='active' AND r.starts_at>now() ORDER BY r.starts_at LIMIT 1`, [homeId]);
    return row ?? null;
  }
}
