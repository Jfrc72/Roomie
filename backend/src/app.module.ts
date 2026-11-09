import { Controller, Get, Module, ServiceUnavailableException } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DatabaseModule } from './database/database.module';
import { DatabaseService } from './database/database.service';
import { AuthModule } from './auth/auth.module';
import { AccessModule } from './access/access.module';
import { ActivitiesModule } from './activities/activities.module';
import { HomesModule } from './homes/homes.module';
import { NotificationsModule } from './notifications/notifications.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { OriginGuard } from './common/origin.guard';

@ApiTags('Estado del servidor')
@Controller('health')
class HealthController {
  constructor(private readonly db: DatabaseService) {}
  @Get()
  @ApiOperation({ summary: 'Comprobar que NestJS puede consultar PostgreSQL' })
  @ApiResponse({ status: 200, schema: { example: { data: { status: 'ok', backend: 'NestJS' } } } })
  @ApiResponse({ status: 503, description: 'No hay conexión con PostgreSQL.' })
  async health() {
    try { await this.db.query('SELECT 1'); }
    catch { throw new ServiceUnavailableException('La base de datos no está disponible.'); }
    return { status: 'ok', backend: 'NestJS' };
  }
}

@Module({
  imports: [DatabaseModule, AuthModule, AccessModule, ActivitiesModule, HomesModule, NotificationsModule, DashboardModule],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: OriginGuard }],
})
export class AppModule {}
