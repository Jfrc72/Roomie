import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SessionUser } from '../auth/auth.entity';
import { CurrentUser } from '../auth/current-user';
import { SessionGuard } from '../auth/session.guard';
import { PreferencesDto, ReadNotificationDto, SubscriptionDto } from './notifications.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('Notificaciones')
@ApiCookieAuth()
@ApiResponse({ status: 200, description: 'Confirmación de la operación.', schema: { example: { data: { message: 'Preferencias guardadas.' } } } })
@ApiResponse({ status: 400, description: 'Datos inválidos, canal no configurado o proveedor push no admitido.' })
@ApiResponse({ status: 401, description: 'Se necesita una sesión activa.' })
@ApiResponse({ status: 403, description: 'La persona no pertenece al apartamento del aviso.' })
@ApiResponse({ status: 404, description: 'El aviso no existe o pertenece a otra persona.' })
@UseGuards(SessionGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get('preferences')
  @ApiOperation({ summary: 'Consultar preferencias propias y disponibilidad de correo y push' })
  @ApiResponse({ status: 200, schema: { example: { data: { email_enabled: false, push_enabled: false, reminder_hours: 24, emailAvailable: false, pushAvailable: false } } } })
  preferences(@CurrentUser() user: SessionUser) { return this.notifications.preferences(user.id); }

  @Patch('preferences')
  @ApiOperation({ summary: 'Elegir canales y anticipación de recordatorios, entre 0 y 168 horas' })
  save(@CurrentUser() user: SessionUser, @Body() data: PreferencesDto) { return this.notifications.savePreferences(user.id, data); }

  @Post('subscriptions')
  @HttpCode(200)
  @ApiOperation({ summary: 'Registrar el dispositivo del usuario con su suscripción PushManager' })
  subscribe(@CurrentUser() user: SessionUser, @Body() data: SubscriptionDto) { return this.notifications.subscribe(user.id, data); }

  @Get()
  @ApiQuery({ name: 'homeId', required: false, type: String, description: 'UUID del apartamento; sin él devuelve una lista vacía.' })
  @ApiOperation({ summary: 'Listar hasta 100 avisos propios del apartamento, sin los eliminados' })
  @ApiResponse({ status: 200, schema: { example: { data: [{ id: 'UUID', title: 'Tu rol cambió', message: 'Tu nuevo rol es administrador.', href: '/apartamento', read_at: null, created_at: '2026-10-30T12:00:00Z' }] } } })
  list(@CurrentUser() user: SessionUser, @Query('homeId') homeId?: string) { return this.notifications.list(user.id, homeId); }

  @Patch(':id')
  @ApiOperation({ summary: 'Marcar un aviso propio como leído o no leído' })
  read(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Body() data: ReadNotificationDto) { return this.notifications.change(user.id, id, data.read); }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar un aviso de la bandeja y cancelar sus entregas pendientes' })
  dismiss(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) { return this.notifications.change(user.id, id, null); }
}
