import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { AccessModule } from '../access/access.module';
import { ActivitiesModule } from '../activities/activities.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { TasksController } from './tasks.controller';
import { TasksRepository } from './tasks.repository';
import { TasksService } from './tasks.service';

@Module({
  imports: [DatabaseModule, AuthModule, AccessModule, ActivitiesModule, NotificationsModule],
  controllers: [TasksController],
  providers: [TasksRepository, TasksService],
  exports: [TasksService],
})
export class TasksModule {}
