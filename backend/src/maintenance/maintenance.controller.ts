import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user';
import { SessionUser } from '../auth/auth.entity';
import { SessionGuard } from '../auth/session.guard';
import { uuidPipe } from '../common/params';
import { ApiData, ApiErrors, ApiHomeQuery, ApiIdParam, CreatedResponse, MessageResponse } from '../common/swagger';
import { MaintenanceReportDto, UpdateMaintenanceReportDto } from './maintenance.dto';
import { MAINTENANCE_PRIORITIES, MAINTENANCE_STATUSES } from './maintenance.entity';
import { MaintenanceOverview } from './maintenance.responses';
import { MaintenanceService } from './maintenance.service';

@ApiTags('Mantenimiento')
@ApiCookieAuth()
@ApiErrors([401])
@UseGuards(SessionGuard)
@Controller('maintenance')
export class MaintenanceController {
  constructor(private readonly maintenance: MaintenanceService) {}

  @Get()
  @ApiOperation({ summary: 'Listar los reportes de mantenimiento con filtros y contadores por estado' })
  @ApiHomeQuery()
  @ApiQuery({ name: 'status', required: false, enum: MAINTENANCE_STATUSES, description: 'Solo reportes en ese estado.' })
  @ApiQuery({ name: 'priority', required: false, enum: MAINTENANCE_PRIORITIES, description: 'Solo reportes con esa prioridad.' })
  @ApiQuery({ name: 'category', required: false, description: 'Solo reportes de esa categoría (texto exacto).' })
  @ApiData(MaintenanceOverview, 'Reportes de mayor a menor prioridad y contadores de todo el apartamento.')
  @ApiErrors([400, 403], { 400: 'Falta `homeId`, o el filtro de estado o de prioridad no es válido.', 403: 'Quien consulta no pertenece al apartamento.' })
  list(
    @CurrentUser() user: SessionUser,
    @Query('homeId') homeId?: string,
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('category') category?: string,
  ) {
    return this.maintenance.list(user.id, homeId, { status, priority, category });
  }

  @Post()
  @HttpCode(200)
  @ApiOperation({ summary: 'Reportar un daño o problema del apartamento' })
  @ApiHomeQuery()
  @ApiData(CreatedResponse, 'Reporte creado en estado PENDIENTE.')
  @ApiErrors([400, 403], { 400: 'Datos inválidos o responsable que no es integrante activo del apartamento.', 403: 'Quien reporta no pertenece al apartamento.' })
  create(@CurrentUser() user: SessionUser, @Query('homeId') homeId: string | undefined, @Body() data: MaintenanceReportDto) {
    return this.maintenance.create(user, homeId, data);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Editar un reporte, cambiar su estado o reasignarlo; quien reportó, el responsable o un administrador' })
  @ApiIdParam('Identificador del reporte.')
  @ApiData(MessageResponse, 'Reporte actualizado.')
  @ApiErrors([400, 403, 404], {
    400: 'Cuerpo vacío, datos inválidos o responsable que no es integrante activo.',
    403: 'Solo quien reportó, el responsable o un administrador puede actualizar el reporte.',
    404: 'El reporte no existe o está eliminado.',
  })
  update(@CurrentUser() user: SessionUser, @Param('id', uuidPipe) id: string, @Body() data: UpdateMaintenanceReportDto) {
    return this.maintenance.update(user, id, data);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar un reporte de forma reversible; quien reportó o un administrador' })
  @ApiIdParam('Identificador del reporte.')
  @ApiData(MessageResponse, 'Reporte eliminado. Se puede deshacer con la ruta de restauración.')
  @ApiErrors([400, 403, 404], { 403: 'Solo quien reportó o un administrador puede eliminar el reporte.', 404: 'El reporte no existe o ya está eliminado.' })
  remove(@CurrentUser() user: SessionUser, @Param('id', uuidPipe) id: string) {
    return this.maintenance.remove(user, id);
  }

  @Post(':id/restore')
  @HttpCode(200)
  @ApiOperation({ summary: 'Deshacer la eliminación de un reporte; quien reportó o un administrador' })
  @ApiIdParam('Identificador del reporte eliminado.')
  @ApiData(MessageResponse, 'Reporte restaurado.')
  @ApiErrors([400, 403, 404], { 403: 'Solo quien reportó o un administrador puede restaurar el reporte.', 404: 'No hay un reporte eliminado con ese identificador.' })
  restore(@CurrentUser() user: SessionUser, @Param('id', uuidPipe) id: string) {
    return this.maintenance.restore(user, id);
  }
}
