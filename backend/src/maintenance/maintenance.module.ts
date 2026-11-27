import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { ActivitiesModule } from '../activities/activities.module';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { MaintenanceController } from './maintenance.controller';
import { MaintenanceRepository } from './maintenance.repository';
import { MaintenanceService } from './maintenance.service';

@Module({
  imports: [DatabaseModule, AuthModule, AccessModule, ActivitiesModule],
  controllers: [MaintenanceController],
  providers: [MaintenanceRepository, MaintenanceService],
  exports: [MaintenanceService],
})
export class MaintenanceModule {}
