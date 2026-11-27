import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user';
import { SessionUser } from '../auth/auth.entity';
import { SessionGuard } from '../auth/session.guard';
import { requireHomeId, uuidPipe } from '../common/params';
import { ApiHomeQuery } from '../common/swagger';
import { ResourceDto } from './reservations.dto';
import { ResourcesService } from './resources.service';

@ApiTags('Reservas')
@ApiCookieAuth()
@ApiResponse({ status: 400, description: 'Campos o identificadores inválidos.' })
@ApiResponse({ status: 401, description: 'Se necesita una sesión activa.' })
@ApiResponse({ status: 403, description: 'La persona no pertenece al hogar o no es administradora.' })
@UseGuards(SessionGuard)
@Controller('resources')
export class ResourcesController {
  constructor(private readonly resources: ResourcesService) {}

  @Get()
  @ApiOperation({ summary: 'Listar los recursos activos del hogar' })
  @ApiHomeQuery()
  @ApiResponse({ status: 200, schema: { example: { data: [{ id: 'UUID', name: 'Lavadora', description: 'En el patio' }] } } })
  list(@CurrentUser() user: SessionUser, @Query('homeId') homeId: string | undefined) { return this.resources.list(user.id, requireHomeId(homeId)); }

  @Post()
  @HttpCode(200)
  @ApiOperation({ summary: 'Agregar un recurso reservable; solo administradores' })
  @ApiHomeQuery()
  @ApiResponse({ status: 200, schema: { example: { data: { id: 'UUID', name: 'Lavadora', description: 'En el patio' } } } })
  @ApiResponse({ status: 409, description: 'Ya hay un recurso activo con ese nombre.' })
  create(@CurrentUser() user: SessionUser, @Query('homeId') homeId: string | undefined, @Body() data: ResourceDto) { return this.resources.create(user.id, requireHomeId(homeId), data); }

  @Patch(':id')
  @ApiOperation({ summary: 'Editar nombre y descripción del recurso; solo administradores' })
  @ApiResponse({ status: 200, schema: { example: { data: { message: 'Recurso actualizado.' } } } })
  @ApiResponse({ status: 404, description: 'El recurso no existe o ya fue retirado.' })
  @ApiResponse({ status: 409, description: 'Ya hay un recurso activo con ese nombre.' })
  update(@CurrentUser() user: SessionUser, @Param('id', uuidPipe) id: string, @Body() data: ResourceDto) { return this.resources.update(user.id, id, data); }

  @Delete(':id')
  @ApiOperation({ summary: 'Retirar el recurso sin borrar sus reservas pasadas; solo administradores' })
  @ApiResponse({ status: 200, schema: { example: { data: { message: 'Recurso retirado.' } } } })
  @ApiResponse({ status: 404, description: 'El recurso no existe o ya fue retirado.' })
  @ApiResponse({ status: 409, description: 'El recurso tiene reservas próximas.' })
  retire(@CurrentUser() user: SessionUser, @Param('id', uuidPipe) id: string) { return this.resources.retire(user.id, id); }
}
