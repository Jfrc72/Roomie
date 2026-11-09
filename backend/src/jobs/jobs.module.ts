import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { JobsRepository } from './jobs.repository';
import { NotificationDeliveryService } from './notification-delivery.service';
import { JobsService } from './jobs.service';

@Module({ imports: [DatabaseModule, NotificationsModule], providers: [JobsRepository, NotificationDeliveryService, JobsService], exports: [JobsService] })
export class JobsModule {}
