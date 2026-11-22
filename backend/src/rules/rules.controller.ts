import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user';
import { SessionUser } from '../auth/auth.entity';
import { SessionGuard } from '../auth/session.guard';
import { HomeIdPipe, idPipe } from '../common/validation';
import { ReportDto, RuleDto } from './rules.dto';
import { RulesService } from './rules.service';
import { RuleReportsService } from './rule-reports.service';

const version = { id: 'UUID', version: 2, content: 'Silencio desde las 10 p. m.', notes: 'Horarios de silencio', created_at: '2026-11-22T15:00:00.000Z', author: 'Tomás' };

@ApiTags('Acuerdos')
@ApiCookieAuth()
@ApiResponse({ status: 400, description: 'Campos o identificadores inválidos.' })
@ApiResponse({ status: 401, description: 'Se necesita una sesión activa.' })
@ApiResponse({ status: 403, description: 'La persona no pertenece al hogar o no es administradora.' })
@UseGuards(SessionGuard)
@Controller('rules')
export class RulesController {
  constructor(private readonly rules: RulesService, private readonly reports: RuleReportsService) {}

  @Get()
  @ApiOperation({ summary: 'Consultar la versión vigente, quién la aceptó, el historial y los reportes de incumplimiento' })
  @ApiQuery({ name: 'homeId', format: 'uuid' })
  @ApiResponse({ status: 200, schema: { example: { data: {
    current: version, accepted_by_me: true, history: [],
    acceptances: [{ membership_id: 'UUID', user_id: 'UUID', name: 'Tomás', accepted_at: '2026-11-22T15:00:00.000Z' }],
    reports: [{ id: 'UUID', clause: 'Silencio desde las 10 p. m.', description: '', reporter: 'Juan', reported: null, created_at: '2026-11-22T15:00:00.000Z', resolved_at: null }],
  } } } })
  list(@CurrentUser() user: SessionUser, @Query('homeId', HomeIdPipe) homeId: string) { return this.rules.list(user.id, homeId); }

  @Post()
  @HttpCode(200)
  @ApiOperation({ summary: 'Publicar la versión siguiente del reglamento; solo administradores. Quien publica la acepta y los demás reciben un aviso' })
  @ApiQuery({ name: 'homeId', format: 'uuid' })
  @ApiResponse({ status: 200, schema: { example: { data: { id: 'UUID', version: 2, message: 'Versión publicada.' } } } })
  @ApiResponse({ status: 409, description: 'El texto es igual al de la versión vigente.' })
  publish(@CurrentUser() user: SessionUser, @Query('homeId', HomeIdPipe) homeId: string, @Body() data: RuleDto) { return this.rules.publish(user, homeId, data); }

  @Post('reports')
  @HttpCode(200)
  @ApiOperation({ summary: 'Reportar el incumplimiento de un acuerdo vigente; avisa a los administradores y a la persona señalada' })
  @ApiQuery({ name: 'homeId', format: 'uuid' })
  @ApiResponse({ status: 200, schema: { example: { data: { id: 'UUID', message: 'Reporte enviado.' } } } })
  @ApiResponse({ status: 409, description: 'El hogar aún no tiene reglamento.' })
  report(@CurrentUser() user: SessionUser, @Query('homeId', HomeIdPipe) homeId: string, @Body() data: ReportDto) { return this.reports.report(user, homeId, data); }

  @Post('reports/:id/resolve')
  @HttpCode(200)
  @ApiOperation({ summary: 'Marcar un reporte como resuelto y avisar a quien lo hizo; solo administradores' })
  @ApiResponse({ status: 200, schema: { example: { data: { message: 'Reporte resuelto.' } } } })
  @ApiResponse({ status: 404, description: 'El reporte no existe.' })
  @ApiResponse({ status: 409, description: 'El reporte ya estaba resuelto.' })
  resolve(@CurrentUser() user: SessionUser, @Param('id', idPipe) id: string) { return this.reports.resolve(user, id); }

  @Post(':id/accept')
  @HttpCode(200)
  @ApiOperation({ summary: 'Aceptar la versión vigente; una versión anterior responde 409' })
  @ApiResponse({ status: 200, schema: { example: { data: { message: 'Aceptaste el reglamento.' } } } })
  @ApiResponse({ status: 404, description: 'La versión no existe.' })
  @ApiResponse({ status: 409, description: 'Hay una versión más reciente.' })
  accept(@CurrentUser() user: SessionUser, @Param('id', idPipe) id: string) { return this.rules.accept(user.id, id); }
}
