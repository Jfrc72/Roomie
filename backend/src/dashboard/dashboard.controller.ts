import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SessionGuard } from '../auth/session.guard';
import { SessionUser } from '../auth/auth.entity';
import { CurrentUser } from '../auth/current-user';
import { HomeGuard } from '../access/home.guard';
import { DashboardService } from './dashboard.service';

@ApiTags('Inicio')
@ApiCookieAuth()
@ApiResponse({ status: 200, schema: { example: { data: { summary: { balance: 0, pendingTasks: 0, shoppingItems: 0, urgentMaintenance: 0, nextReservation: null, tasks: [], expenses: [] }, activities: [] } } } })
@ApiResponse({ status: 401, description: 'Se necesita una sesión activa.' })
@ApiResponse({ status: 403, description: 'El apartamento no pertenece a la cuenta.' })
@UseGuards(SessionGuard, HomeGuard)
@Controller('homes/:id/dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}
  @Get()
  @ApiOperation({ summary: 'Consultar resumen de tareas, reservas, gastos, compras, mantenimiento y actividad del hogar' })
  get(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) { return this.dashboard.get(user.id, id); }
}
