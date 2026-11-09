import { Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';
import { Notification, NotificationInput, NotificationPreference } from './notifications.entity';
import { PreferencesDto, SubscriptionDto } from './notifications.dto';

@Injectable()
export class NotificationsRepository {
  constructor(private readonly db: DatabaseService) {}
  async preferences(userId: string, client?: PoolClient) {
    const [row] = await this.db.query<NotificationPreference>('SELECT email_enabled,push_enabled,reminder_hours FROM notification_preferences WHERE user_id=$1', [userId], client);
    return row ? Object.assign(new NotificationPreference(), row) : { email_enabled: false, push_enabled: false, reminder_hours: 24 };
  }
  async savePreferences(userId: string, data: PreferencesDto) {
    await this.db.query(`INSERT INTO notification_preferences(user_id,email_enabled,push_enabled,reminder_hours) VALUES($1,$2,$3,$4)
      ON CONFLICT(user_id) DO UPDATE SET email_enabled=$2,push_enabled=$3,reminder_hours=$4`, [userId, data.email_enabled, data.push_enabled, data.reminder_hours]);
  }
  list(userId: string, homeId: string) {
    return this.db.query<Notification>('SELECT id,title,message,href,read_at,created_at FROM notifications WHERE user_id=$1 AND home_id=$2 AND dismissed_at IS NULL ORDER BY created_at DESC LIMIT 100', [userId, homeId]);
  }
  async find(userId: string, id: string, client: PoolClient) {
    const [row] = await this.db.query<Notification>('SELECT home_id FROM notifications WHERE id=$1 AND user_id=$2 AND dismissed_at IS NULL FOR UPDATE', [id, userId], client);
    return row ? Object.assign(new Notification(), row) : null;
  }
  async read(userId: string, id: string, read: boolean, client: PoolClient) {
    await this.db.query('UPDATE notifications SET read_at=CASE WHEN $1 THEN now() ELSE null END WHERE id=$2 AND user_id=$3', [read, id, userId], client);
  }
  async dismiss(userId: string, id: string, client: PoolClient) {
    await this.db.query('UPDATE notifications SET dismissed_at=now() WHERE id=$1 AND user_id=$2', [id, userId], client);
    await this.db.query('DELETE FROM deliveries WHERE notification_id=$1', [id], client);
  }
  async subscribe(userId: string, data: SubscriptionDto) {
    await this.db.query(`INSERT INTO push_subscriptions(user_id,endpoint,p256dh,auth) VALUES($1,$2,$3,$4)
      ON CONFLICT(endpoint) DO UPDATE SET user_id=$1,p256dh=$3,auth=$4`, [userId, data.endpoint, data.keys.p256dh, data.keys.auth]);
  }
  async activeMember(homeId: string, userId: string, client: PoolClient) {
    return (await this.db.query(`SELECT m.id FROM memberships m JOIN homes h ON h.id=m.home_id JOIN users u ON u.id=m.user_id
      WHERE m.home_id=$1 AND m.user_id=$2 AND m.active AND u.active AND h.archived_at IS NULL`, [homeId, userId], client)).length > 0;
  }
  async insert(data: NotificationInput, client: PoolClient) {
    const [row] = await this.db.query<{ id: string }>(`INSERT INTO notifications(home_id,user_id,title,message,href,source_key)
      VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(source_key) DO NOTHING RETURNING id`, [data.homeId, data.userId, data.title, data.message, data.href, data.sourceKey || null], client);
    return row?.id;
  }
  async delivery(notificationId: string, channel: string, client: PoolClient) {
    await this.db.query('INSERT INTO deliveries(notification_id,channel) VALUES($1,$2)', [notificationId, channel], client);
  }
  async schedule(data: NotificationInput & { sourceKey: string; dueAt: Date }, client: PoolClient) {
    await this.db.query(`INSERT INTO reminders(home_id,user_id,source_key,title,message,href,due_at) VALUES($1,$2,$3,$4,$5,$6,$7)
      ON CONFLICT(source_key) DO UPDATE SET user_id=excluded.user_id,title=excluded.title,message=excluded.message,href=excluded.href,due_at=excluded.due_at,processed_at=null`, [data.homeId, data.userId, data.sourceKey, data.title, data.message, data.href, data.dueAt], client);
  }
  async cancel(sourceKey: string, client: PoolClient) {
    await this.db.query('DELETE FROM reminders WHERE source_key=$1', [sourceKey], client);
  }
  async cancelHome(homeId: string, client: PoolClient) {
    await this.db.query('DELETE FROM reminders WHERE home_id=$1', [homeId], client);
    await this.db.query('DELETE FROM deliveries WHERE notification_id IN (SELECT id FROM notifications WHERE home_id=$1)', [homeId], client);
  }
}
