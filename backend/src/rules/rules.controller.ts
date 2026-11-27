import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user';
import { SessionUser } from '../auth/auth.entity';
import { SessionGuard } from '../auth/session.guard';
import { requireHomeId, uuidPipe } from '../common/params';
import { ApiHomeQuery } from '../common/swagger';
import { AssistantDto, ReportDto, RuleDto } from './rules.dto';
import { RulesService } from './rules.service';
import { RuleReportsService } from './rule-reports.service';
import { AssistantService } from './assistant.service';

const version = { id: 'UUID', version: 2, content: 'Silencio desde las 10 p. m.', notes: 'Horarios de silencio', created_at: '2026-11-22T15:00:00.000Z', author: 'Tomás' };

@ApiTags('Acuerdos')
@ApiCookieAuth()
@ApiResponse({ status: 400, description: 'Campos o identificadores inválidos.' })
@ApiResponse({ status: 401, description: 'Se necesita una sesión activa.' })
@ApiResponse({ status: 403, description: 'La persona no pertenece al hogar o no es administradora.' })
@UseGuards(SessionGuard)
@Controller('rules')
export class RulesController {
  constructor(private readonly rules: RulesService, private readonly reports: RuleReportsService, private readonly assistant: AssistantService) {}

  @Get()
  @ApiOperation({ summary: 'Consultar la versión vigente, quién la aceptó, el historial y los reportes de incumplimiento' })
  @ApiHomeQuery()
  @ApiResponse({ status: 200, schema: { example: { data: {
    current: version, accepted_by_me: true, history: [],
    acceptances: [{ membership_id: 'UUID', user_id: 'UUID', name: 'Tomás', accepted_at: '2026-11-22T15:00:00.000Z' }],
    reports: [{ id: 'UUID', clause: 'Silencio desde las 10 p. m.', description: '', reporter: 'Juan', reported: null, created_at: '2026-11-22T15:00:00.000Z', resolved_at: null }],
  } } } })
  list(@CurrentUser() user: SessionUser, @Query('homeId') homeId: string | undefined) { return this.rules.list(user.id, requireHomeId(homeId)); }

  @Post()
  @HttpCode(200)
  @ApiOperation({ summary: 'Publicar la versión siguiente del reglamento; solo administradores. Quien publica la acepta y los demás reciben un aviso' })
  @ApiHomeQuery()
  @ApiResponse({ status: 200, schema: { example: { data: { id: 'UUID', version: 2, message: 'Versión publicada.' } } } })
  @ApiResponse({ status: 409, description: 'El texto es igual al de la versión vigente.' })
  publish(@CurrentUser() user: SessionUser, @Query('homeId') homeId: string | undefined, @Body() data: RuleDto) { return this.rules.publish(user, requireHomeId(homeId), data); }

  @Post('reports')
  @HttpCode(200)
  @ApiOperation({ summary: 'Reportar el incumplimiento de un acuerdo vigente; avisa a los administradores y a la persona señalada' })
  @ApiHomeQuery()
  @ApiResponse({ status: 200, schema: { example: { data: { id: 'UUID', message: 'Reporte enviado.' } } } })
  @ApiResponse({ status: 409, description: 'El hogar aún no tiene reglamento.' })
  report(@CurrentUser() user: SessionUser, @Query('homeId') homeId: string | undefined, @Body() data: ReportDto) { return this.reports.report(user, requireHomeId(homeId), data); }

  @Post('reports/:id/resolve')
  @HttpCode(200)
  @ApiOperation({ summary: 'Marcar un reporte como resuelto y avisar a quien lo hizo; solo administradores' })
  @ApiResponse({ status: 200, schema: { example: { data: { message: 'Reporte resuelto.' } } } })
  @ApiResponse({ status: 404, description: 'El reporte no existe.' })
  @ApiResponse({ status: 409, description: 'El reporte ya estaba resuelto.' })
  resolve(@CurrentUser() user: SessionUser, @Param('id', uuidPipe) id: string) { return this.reports.resolve(user, id); }

  @Get('assistant')
  @ApiOperation({ summary: 'Saber si el asistente usa IA real (ANTHROPIC_API_KEY configurada) o respuestas simuladas' })
  @ApiHomeQuery()
  @ApiResponse({ status: 200, schema: { example: { data: { mode: 'ai', model: 'claude-opus-5-5' } } } })
  assistantStatus(@CurrentUser() user: SessionUser, @Query('homeId') homeId: string | undefined) { return this.assistant.status(user.id, requireHomeId(homeId)); }

  @Post('assistant')
  @HttpCode(200)
  @ApiOperation({ summary: 'Pedir acuerdos al asistente con IA; solo administradores. Envía la petición, el borrador y los nombres de los integrantes a la API de Claude' })
  @ApiHomeQuery()
  @ApiResponse({ status: 200, schema: { example: { data: { text: 'Te propongo una rotación semanal para 4 personas.', clauses: ['Rotación semanal de tareas:\nSemana 1: ...'] } } } })
  @ApiResponse({ status: 422, description: 'El modelo no puede ayudar con esa petición.' })
  @ApiResponse({ status: 429, description: 'Demasiadas consultas seguidas o el proveedor está ocupado.' })
  @ApiResponse({ status: 502, description: 'El modelo no devolvió una respuesta válida.' })
  @ApiResponse({ status: 503, description: 'La IA no está configurada o no responde.' })
  ask(@CurrentUser() user: SessionUser, @Query('homeId') homeId: string | undefined, @Body() data: AssistantDto) { return this.assistant.ask(user.id, requireHomeId(homeId), data); }

  @Post(':id/accept')
  @HttpCode(200)
  @ApiOperation({ summary: 'Aceptar la versión vigente; una versión anterior responde 409' })
  @ApiResponse({ status: 200, schema: { example: { data: { message: 'Aceptaste el reglamento.' } } } })
  @ApiResponse({ status: 404, description: 'La versión no existe.' })
  @ApiResponse({ status: 409, description: 'Hay una versión más reciente.' })
  accept(@CurrentUser() user: SessionUser, @Param('id', uuidPipe) id: string) { return this.rules.accept(user.id, id); }
}
