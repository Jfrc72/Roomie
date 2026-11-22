import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { AccessModule } from '../access/access.module';
import { ActivitiesModule } from '../activities/activities.module';
import { TasksModule } from '../tasks/tasks.module';
import { ReservationsModule } from '../reservations/reservations.module';
import { DashboardController } from './dashboard.controller';
import { DashboardRepository } from './dashboard.repository';
import { DashboardService } from './dashboard.service';

@Module({ imports: [DatabaseModule, AuthModule, AccessModule, ActivitiesModule, TasksModule, ReservationsModule], controllers: [DashboardController], providers: [DashboardRepository, DashboardService] })
export class DashboardModule {}
