import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { AccessModule } from '../access/access.module';
import { ActivitiesModule } from '../activities/activities.module';
import { ExpensesModule } from '../expenses/expenses.module';
import { MaintenanceModule } from '../maintenance/maintenance.module';
import { ShoppingModule } from '../shopping/shopping.module';
import { DashboardController } from './dashboard.controller';
import { DashboardRepository } from './dashboard.repository';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [DatabaseModule, AuthModule, AccessModule, ActivitiesModule, ExpensesModule, ShoppingModule, MaintenanceModule],
  controllers: [DashboardController],
  providers: [DashboardRepository, DashboardService],
})
export class DashboardModule {}
