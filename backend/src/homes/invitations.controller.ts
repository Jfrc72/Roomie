import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SessionUser } from '../auth/auth.entity';
import { CurrentUser } from '../auth/current-user';
import { SessionGuard } from '../auth/session.guard';
import { AcceptInvitationDto } from './homes.dto';
import { InvitationsService } from './invitations.service';

@ApiTags('Apartamentos e integrantes')
@ApiCookieAuth()
@ApiResponse({ status: 200, schema: { example: { data: { message: 'Ya eres parte del apartamento.' } } } })
@ApiResponse({ status: 400, description: 'El token no tiene el formato esperado.' })
@ApiResponse({ status: 401, description: 'Se necesita una sesión activa.' })
@ApiResponse({ status: 404, description: 'La invitación no existe.' })
@ApiResponse({ status: 403, description: 'La cuenta no tiene el correo invitado.' })
@ApiResponse({ status: 409, description: 'Invitación vencida, usada o apartamento sin cupo.' })
@UseGuards(SessionGuard)
@Controller('invitations')
export class InvitationsController {
  constructor(private readonly invitations: InvitationsService) {}
  @Post()
  @HttpCode(200)
  @ApiOperation({ summary: 'Aceptar una invitación con la cuenta del correo indicado' })
  accept(@CurrentUser() user: SessionUser, @Body() data: AcceptInvitationDto) { return this.invitations.accept(user, data.token); }
}
