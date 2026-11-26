import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PollsModule } from '../polls/polls.module';
import { JobsRepository } from './jobs.repository';
import { NotificationDeliveryService } from './notification-delivery.service';
import { JobsService } from './jobs.service';

@Module({ imports: [DatabaseModule, NotificationsModule, PollsModule], providers: [JobsRepository, NotificationDeliveryService, JobsService], exports: [JobsService] })
export class JobsModule {}
