import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user';
import { SessionUser } from '../auth/auth.entity';
import { SessionGuard } from '../auth/session.guard';
import { uuidPipe } from '../common/params';
import { ApiData, ApiErrors, ApiHomeQuery, ApiIdParam, CreatedResponse, MessageResponse } from '../common/swagger';
import { PollDto, VoteDto } from './polls.dto';
import { PollView } from './polls.responses';
import { PollsService } from './polls.service';

@ApiTags('Votaciones')
@ApiCookieAuth()
@ApiErrors([401])
@UseGuards(SessionGuard)
@Controller('polls')
export class PollsController {
  constructor(private readonly polls: PollsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar las votaciones: primero las abiertas y luego las cerradas, con su resultado' })
  @ApiHomeQuery()
  @ApiData(PollView, 'Votaciones del apartamento. Las vencidas se cierran antes de listar. Abiertas: sin recuentos. Cerradas: recuentos y, si son públicas, quién eligió cada opción.', { isArray: true })
  @ApiErrors([400, 403], { 400: 'Falta `homeId` o no es un identificador válido.', 403: 'Quien consulta no pertenece al apartamento.' })
  list(@CurrentUser() user: SessionUser, @Query('homeId') homeId?: string) {
    return this.polls.list(user.id, homeId);
  }

  @Post()
  @HttpCode(200)
  @ApiOperation({ summary: 'Abrir una votación con 2 a 10 opciones; los demás integrantes reciben un aviso' })
  @ApiHomeQuery()
  @ApiData(CreatedResponse, 'Votación abierta.')
  @ApiErrors([400, 403], { 400: 'Pregunta, opciones, tipo de decisión o fecha de cierre inválidos (la fecha debe estar en el futuro).', 403: 'Quien abre la votación no pertenece al apartamento.' })
  create(@CurrentUser() user: SessionUser, @Query('homeId') homeId: string | undefined, @Body() data: PollDto) {
    return this.polls.create(user, homeId, data);
  }

  @Post(':id/votes')
  @HttpCode(200)
  @ApiOperation({ summary: 'Votar o cambiar el voto mientras la votación esté abierta' })
  @ApiIdParam('Identificador de la votación.')
  @ApiData(MessageResponse, 'Voto guardado.')
  @ApiErrors([400, 403, 404, 409], {
    400: 'La opción no pertenece a la votación o el identificador es inválido.',
    403: 'Quien vota no es integrante activo del apartamento.',
    404: 'La votación no existe.',
    409: 'La votación ya está cerrada o venció.',
  })
  vote(@CurrentUser() user: SessionUser, @Param('id', uuidPipe) id: string, @Body() data: VoteDto) {
    return this.polls.vote(user, id, data.option_id);
  }

  @Post(':id/close')
  @HttpCode(200)
  @ApiOperation({ summary: 'Cerrar la votación y publicar su resultado; quien la creó o un administrador' })
  @ApiIdParam('Identificador de la votación.')
  @ApiData(MessageResponse, 'Votación cerrada. Los integrantes reciben el resultado.')
  @ApiErrors([400, 403, 404, 409], {
    403: 'Solo quien creó la votación o un administrador pueden cerrarla.',
    404: 'La votación no existe.',
    409: 'La votación ya estaba cerrada.',
  })
  close(@CurrentUser() user: SessionUser, @Param('id', uuidPipe) id: string) {
    return this.polls.close(user, id);
  }
}
