import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { AccessModule } from '../access/access.module';
import { ActivitiesModule } from '../activities/activities.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ResourcesController } from './resources.controller';
import { ReservationsController } from './reservations.controller';
import { ResourcesRepository } from './resources.repository';
import { ReservationsRepository } from './reservations.repository';
import { ResourcesService } from './resources.service';
import { ReservationsService } from './reservations.service';

@Module({
  imports: [DatabaseModule, AuthModule, AccessModule, ActivitiesModule, NotificationsModule],
  controllers: [ResourcesController, ReservationsController],
  providers: [ResourcesRepository, ReservationsRepository, ResourcesService, ReservationsService],
  exports: [ReservationsService],
})
export class ReservationsModule {}
