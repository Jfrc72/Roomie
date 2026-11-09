import { Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';
import { Delivery, Reminder, PushSubscription } from '../notifications/notifications.entity';

export interface PendingDelivery extends Delivery {
  title: string; message: string; href: string; home_id: string; user_id: string; email: string;
  email_enabled: boolean; push_enabled: boolean;
}

@Injectable()
export class JobsRepository {
  constructor(private readonly db: DatabaseService) {}
  reminders(client: PoolClient) {
    return this.db.query<Reminder>(`SELECT r.* FROM reminders r JOIN notification_preferences p ON p.user_id=r.user_id
      WHERE r.processed_at IS NULL AND r.due_at-make_interval(hours=>p.reminder_hours)<=now() FOR UPDATE OF r SKIP LOCKED`, [], client);
  }
  async processed(id: string, client: PoolClient) { await this.db.query('UPDATE reminders SET processed_at=now() WHERE id=$1', [id], client); }
  deliveries(client: PoolClient) {
    return this.db.query<PendingDelivery>(`SELECT d.*,n.title,n.message,n.href,n.home_id,n.user_id,u.email,p.email_enabled,p.push_enabled
      FROM deliveries d JOIN notifications n ON n.id=d.notification_id JOIN users u ON u.id=n.user_id
      JOIN notification_preferences p ON p.user_id=u.id WHERE d.sent_at IS NULL AND d.attempts<5 AND d.next_attempt_at<=now()
      ORDER BY d.next_attempt_at LIMIT 10 FOR UPDATE OF d SKIP LOCKED`, [], client);
  }
  async authorized(row: PendingDelivery, client: PoolClient) {
    return (await this.db.query(`SELECT m.id FROM memberships m JOIN homes h ON h.id=m.home_id JOIN users u ON u.id=m.user_id
      WHERE m.user_id=$1 AND m.home_id=$2 AND m.active AND u.active AND h.archived_at IS NULL`, [row.user_id, row.home_id], client)).length > 0;
  }
  async discard(id: string, client: PoolClient) { await this.db.query('DELETE FROM deliveries WHERE id=$1', [id], client); }
  subscriptions(userId: string, client: PoolClient) { return this.db.query<PushSubscription>('SELECT * FROM push_subscriptions WHERE user_id=$1', [userId], client); }
  async removeSubscription(id: string, client: PoolClient) { await this.db.query('DELETE FROM push_subscriptions WHERE id=$1', [id], client); }
  async sent(id: string, client: PoolClient) { await this.db.query('UPDATE deliveries SET sent_at=now() WHERE id=$1', [id], client); }
  async retry(id: string, error: string, client: PoolClient) {
    await this.db.query("UPDATE deliveries SET attempts=attempts+1,last_error=$1,next_attempt_at=now()+interval '5 minutes' WHERE id=$2", [error.slice(0, 300), id], client);
  }
}
