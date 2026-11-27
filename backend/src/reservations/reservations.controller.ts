import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user';
import { SessionUser } from '../auth/auth.entity';
import { SessionGuard } from '../auth/session.guard';
import { requireHomeId, uuidPipe } from '../common/params';
import { ApiHomeQuery } from '../common/swagger';
import { ReservationDto } from './reservations.dto';
import { ReservationsService } from './reservations.service';

@ApiTags('Reservas')
@ApiCookieAuth()
@ApiResponse({ status: 400, description: 'Campos inválidos, horario no permitido o recurso que no es del hogar.' })
@ApiResponse({ status: 401, description: 'Se necesita una sesión activa.' })
@ApiResponse({ status: 403, description: 'La persona no pertenece al hogar o no puede cancelar la reserva.' })
@UseGuards(SessionGuard)
@Controller('reservations')
export class ReservationsController {
  constructor(private readonly reservations: ReservationsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar reservas activas próximas o, con from y to, las que se cruzan con ese rango (máximo 31 días)' })
  @ApiHomeQuery()
  @ApiQuery({ name: 'from', required: false, example: '2026-11-23T05:00:00.000Z' })
  @ApiQuery({ name: 'to', required: false, example: '2026-11-30T05:00:00.000Z' })
  @ApiResponse({ status: 200, schema: { example: { data: [{ id: 'UUID', resource_id: 'UUID', resource: 'Lavadora', user_id: 'UUID', member: 'Tomás', member_active: true, starts_at: '2026-12-01T15:00:00.000Z', ends_at: '2026-12-01T16:00:00.000Z', can_cancel: true }] } } })
  list(@CurrentUser() user: SessionUser, @Query('homeId') homeId: string | undefined, @Query('from') from?: string, @Query('to') to?: string) {
    return this.reservations.list(user.id, requireHomeId(homeId), from, to);
  }

  @Post()
  @HttpCode(200)
  @ApiOperation({ summary: 'Reservar un recurso para quien hace la solicitud; programa su recordatorio' })
  @ApiHomeQuery()
  @ApiResponse({ status: 200, schema: { example: { data: { id: 'UUID', message: 'Reserva creada.' } } } })
  @ApiResponse({ status: 409, description: 'El horario se cruza con otra reserva activa del mismo recurso.' })
  create(@CurrentUser() user: SessionUser, @Query('homeId') homeId: string | undefined, @Body() data: ReservationDto) { return this.reservations.create(user.id, requireHomeId(homeId), data); }

  @Delete(':id')
  @ApiOperation({ summary: 'Cancelar una reserva y liberar su horario; quien reservó o un administrador' })
  @ApiResponse({ status: 200, schema: { example: { data: { message: 'Reserva cancelada.' } } } })
  @ApiResponse({ status: 404, description: 'La reserva no existe.' })
  @ApiResponse({ status: 409, description: 'La reserva ya fue cancelada o ya terminó.' })
  cancel(@CurrentUser() user: SessionUser, @Param('id', uuidPipe) id: string) { return this.reservations.cancel(user, id); }
}
