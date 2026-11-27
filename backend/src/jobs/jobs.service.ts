import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PollsService } from '../polls/polls.service';
import { JobsRepository } from './jobs.repository';
import { NotificationDeliveryService } from './notification-delivery.service';

@Injectable()
export class JobsService {
  constructor(private readonly db: DatabaseService, private readonly repository: JobsRepository, private readonly notifications: NotificationsService, private readonly delivery: NotificationDeliveryService, private readonly polls: PollsService) {}

  async tick() {
    await this.db.transaction(async client => {
      for (const reminder of await this.repository.reminders(client)) {
        await this.notifications.notify(client, { homeId: reminder.home_id, userId: reminder.user_id, title: reminder.title, message: reminder.message, href: reminder.href, sourceKey: `reminder:${reminder.id}:${reminder.due_at.toISOString()}` });
        await this.repository.processed(reminder.id, client);
      }
    });
    await this.db.transaction(async client => {
      for (const row of await this.repository.deliveries(client)) {
        const enabled = row.channel === 'email' ? row.email_enabled : row.push_enabled;
        if (!enabled || !await this.repository.authorized(row, client)) {
          await this.repository.discard(row.id, client);
          continue;
        }
        try {
          if (row.channel === 'email') await this.delivery.email(row);
          else {
            const subscriptions = await this.repository.subscriptions(row.user_id, client);
            if (!subscriptions.length) throw new Error('Sin dispositivos push registrados');
            for (const subscription of subscriptions) {
              try { await this.delivery.push(row, subscription); }
              catch (error) {
                if ([404, 410].includes((error as { statusCode: number }).statusCode)) await this.repository.removeSubscription(subscription.id, client);
                else throw error;
              }
            }
          }
          await this.repository.sent(row.id, client);
        } catch (error) {
          await this.repository.retry(row.id, (error as Error).message, client);
        }
      }
    });
    // Las votaciones con fecha de cierre vencida se cierran solas, sin atribuirlas a ninguna persona.
    await this.polls.closeExpired();
  }
}
