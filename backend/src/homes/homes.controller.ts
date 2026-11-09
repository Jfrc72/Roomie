import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user';
import { SessionUser } from '../auth/auth.entity';
import { SessionGuard } from '../auth/session.guard';
import { HomeDto, InviteDto, RoleDto } from './homes.dto';
import { HomesService } from './homes.service';
import { InvitationsService } from './invitations.service';
import { MembershipsService } from './memberships.service';

@ApiTags('Apartamentos e integrantes')
@ApiCookieAuth()
@ApiResponse({ status: 200, description: 'Confirmación de la operación.', schema: { example: { data: { message: 'Integrantes actualizados.' } } } })
@ApiResponse({ status: 400, description: 'Campos o identificadores inválidos.' })
@ApiResponse({ status: 401, description: 'Se necesita una sesión activa.' })
@ApiResponse({ status: 403, description: 'La persona no pertenece al hogar o no tiene el rol requerido.' })
@ApiResponse({ status: 404, description: 'No existe la invitación o el integrante.' })
@ApiResponse({ status: 409, description: 'Cupo completo, integrante repetido o último administrador.' })
@UseGuards(SessionGuard)
@Controller('homes')
export class HomesController {
  constructor(private readonly homes: HomesService, private readonly invitations: InvitationsService, private readonly members: MembershipsService) {}

  @Post()
  @HttpCode(200)
  @ApiOperation({ summary: 'Crear apartamento; quien lo crea queda como administrador' })
  @ApiResponse({ status: 200, schema: { example: { data: { id: 'UUID del apartamento creado' } } } })
  create(@CurrentUser() user: SessionUser, @Body() data: HomeDto) { return this.homes.create(user, data); }

  @Get(':id')
  @ApiOperation({ summary: 'Consultar el apartamento y sus integrantes activos' })
  @ApiResponse({ status: 200, schema: { example: { data: { id: 'UUID', name: 'Apartamento 302', address: 'Bogotá', description: '', members: [{ id: 'UUID de la cuenta', membership_id: 'UUID de la membresía', name: 'Juan', email: 'juan@roomie.test', role: 'admin' }] } } } })
  details(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) { return this.homes.details(user.id, id); }

  @Post(':id/select')
  @HttpCode(200)
  @ApiOperation({ summary: 'Elegir el apartamento activo de esta sesión' })
  select(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) { return this.homes.select(user, id); }

  @Patch(':id')
  @ApiOperation({ summary: 'Editar los datos del apartamento; solo administradores' })
  update(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Body() data: HomeDto) { return this.homes.update(user.id, id, data); }

  @Delete(':id')
  @ApiOperation({ summary: 'Archivar el apartamento y cancelar sus avisos pendientes; conserva el historial' })
  archive(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) { return this.homes.archive(user.id, id); }

  @Get(':id/invitations')
  @ApiOperation({ summary: 'Listar invitaciones sin mostrar sus tokens; solo administradores' })
  @ApiResponse({ status: 200, schema: { example: { data: [{ id: 'UUID', email: 'roommate@roomie.test', status: 'pending', expires_at: '2026-11-06T12:00:00Z' }] } } })
  listInvitations(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) { return this.invitations.list(user.id, id); }

  @Post(':id/invitations')
  @HttpCode(200)
  @ApiOperation({ summary: 'Invitar por correo con un enlace de un solo uso, válido durante siete días' })
  @ApiResponse({ status: 200, schema: { example: { data: { url: 'http://localhost:3000/invitaciones?token=TOKEN', message: 'Invitación creada. Comparte el enlace con la persona invitada.' } } } })
  invite(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Body() data: InviteDto) { return this.invitations.create(user.id, id, data.email); }

  @Delete(':id/invitations/:invitationId')
  @ApiOperation({ summary: 'Cancelar una invitación pendiente del apartamento' })
  revoke(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Param('invitationId', ParseUUIDPipe) invitationId: string) { return this.invitations.revoke(user.id, id, invitationId); }

  @Patch(':id/members/:membershipId')
  @ApiOperation({ summary: 'Cambiar el rol de un integrante; siempre debe quedar un administrador' })
  role(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Param('membershipId', ParseUUIDPipe) memberId: string, @Body() data: RoleDto) { return this.members.change(user.id, id, memberId, data.role); }

  @Delete(':id/members/:membershipId')
  @ApiOperation({ summary: 'Retirar acceso al integrante sin borrar su historial' })
  remove(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Param('membershipId', ParseUUIDPipe) memberId: string) { return this.members.change(user.id, id, memberId, null); }
}
