import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { ActivitiesModule } from '../activities/activities.module';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PollsController } from './polls.controller';
import { PollsRepository } from './polls.repository';
import { PollsService } from './polls.service';

@Module({
  imports: [DatabaseModule, AuthModule, AccessModule, ActivitiesModule, NotificationsModule],
  controllers: [PollsController],
  providers: [PollsRepository, PollsService],
  exports: [PollsService],
})
export class PollsModule {}
