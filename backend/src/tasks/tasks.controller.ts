import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user';
import { SessionUser } from '../auth/auth.entity';
import { SessionGuard } from '../auth/session.guard';
import { requireHomeId, uuidPipe } from '../common/params';
import { ApiHomeQuery } from '../common/swagger';
import { CreateTaskDto, UpdateTaskDto } from './tasks.dto';
import { TasksService } from './tasks.service';

const task = {
  id: 'UUID', home_id: 'UUID', title: 'Sacar la basura', description: '', assigned_membership_id: 'UUID', assignee_user_id: 'UUID',
  assignee: 'Miguel', assignee_active: true, due_at: '2026-12-01T22:00:00.000Z', priority: 'high', status: 'pending',
  created_by: 'UUID', creator: 'Tomás', created_at: '2026-11-22T15:00:00.000Z', completed_at: null, can_edit: true,
};

@ApiTags('Tareas')
@ApiCookieAuth()
@ApiResponse({ status: 400, description: 'Campos inválidos, fecha límite pasada o responsable que no es integrante activo.' })
@ApiResponse({ status: 401, description: 'Se necesita una sesión activa.' })
@ApiResponse({ status: 403, description: 'La persona no pertenece al hogar o no puede modificar la tarea.' })
@ApiResponse({ status: 404, description: 'La tarea no existe.' })
@UseGuards(SessionGuard)
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get()
  @ApiOperation({ summary: 'Listar tareas abiertas y completadas en los últimos 30 días; can_edit indica si la persona puede editarlas' })
  @ApiHomeQuery()
  @ApiResponse({ status: 200, schema: { example: { data: [task] } } })
  list(@CurrentUser() user: SessionUser, @Query('homeId') homeId: string | undefined) { return this.tasks.list(user.id, requireHomeId(homeId)); }

  @Post()
  @HttpCode(200)
  @ApiOperation({ summary: 'Crear una tarea en estado pendiente; avisa al responsable y programa su recordatorio' })
  @ApiHomeQuery()
  @ApiResponse({ status: 200, schema: { example: { data: { id: 'UUID', message: 'Tarea creada.' } } } })
  create(@CurrentUser() user: SessionUser, @Query('homeId') homeId: string | undefined, @Body() data: CreateTaskDto) { return this.tasks.create(user, requireHomeId(homeId), data); }

  @Get(':id')
  @ApiOperation({ summary: 'Consultar una tarea con su historial de estados' })
  @ApiResponse({ status: 200, schema: { example: { data: { ...task, history: [{ id: 'UUID', previous_status: null, new_status: 'pending', created_at: '2026-11-22T15:00:00.000Z', actor: 'Tomás' }] } } } })
  detail(@CurrentUser() user: SessionUser, @Param('id', uuidPipe) id: string) { return this.tasks.detail(user.id, id); }

  @Patch(':id')
  @ApiOperation({ summary: 'Editar campos o cambiar el estado. Creador o administrador; sin responsable, cualquier integrante puede empezarla o completarla' })
  @ApiResponse({ status: 200, schema: { example: { data: { message: 'Tarea actualizada.' } } } })
  update(@CurrentUser() user: SessionUser, @Param('id', uuidPipe) id: string, @Body() data: UpdateTaskDto) { return this.tasks.update(user, id, data); }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar la tarea con su historial y su recordatorio; creador o administrador' })
  @ApiResponse({ status: 200, schema: { example: { data: { message: 'Tarea eliminada.' } } } })
  remove(@CurrentUser() user: SessionUser, @Param('id', uuidPipe) id: string) { return this.tasks.remove(user.id, id); }
}
