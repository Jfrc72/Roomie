import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AccessModule } from '../access/access.module';
import { ActivitiesModule } from '../activities/activities.module';
import { ExpensesModule } from '../expenses/expenses.module';
import { MaintenanceModule } from '../maintenance/maintenance.module';
import { ShoppingModule } from '../shopping/shopping.module';
import { TasksModule } from '../tasks/tasks.module';
import { ReservationsModule } from '../reservations/reservations.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

// Inicio no consulta tablas propias: reúne el resumen que expone cada módulo.
@Module({
  imports: [AuthModule, AccessModule, ActivitiesModule, ExpensesModule, ShoppingModule, MaintenanceModule, TasksModule, ReservationsModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
