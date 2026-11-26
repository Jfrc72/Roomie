import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user';
import { SessionUser } from '../auth/auth.entity';
import { SessionGuard } from '../auth/session.guard';
import { uuidPipe } from '../common/params';
import { ApiData, ApiErrors, ApiHomeQuery, ApiIdParam, CreatedResponse, MessageResponse } from '../common/swagger';
import { ExpenseDto } from './expenses.dto';
import { ExpensesOverview } from './expenses.responses';
import { ExpensesService } from './expenses.service';

@ApiTags('Gastos')
@ApiCookieAuth()
@ApiErrors([401])
@UseGuards(SessionGuard)
@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expenses: ExpensesService) {}

  @Get()
  @ApiOperation({ summary: 'Listar los gastos con el resumen del mes, los saldos entre integrantes y los pagos recientes' })
  @ApiHomeQuery()
  @ApiData(ExpensesOverview, 'Hasta 100 gastos con sus cuotas, el resumen del mes, lo que le deben y debe a quien consulta, y los 10 pagos más recientes.')
  @ApiErrors([400, 403], { 400: 'Falta `homeId` o no es un identificador válido.', 403: 'Quien consulta no pertenece al apartamento.' })
  list(@CurrentUser() user: SessionUser, @Query('homeId') homeId?: string) {
    return this.expenses.list(user.id, homeId);
  }

  @Post()
  @HttpCode(200)
  @ApiOperation({ summary: 'Registrar un gasto y dividirlo exactamente, a centavos, entre los participantes' })
  @ApiHomeQuery()
  @ApiData(CreatedResponse, 'Gasto registrado. La cuota de quien pagó queda pagada y las demás pendientes.')
  @ApiErrors([400, 403], { 400: 'Monto, fecha o participantes inválidos, o integrantes que no pertenecen al apartamento.', 403: 'Quien registra no pertenece al apartamento.' })
  create(@CurrentUser() user: SessionUser, @Query('homeId') homeId: string | undefined, @Body() data: ExpenseDto) {
    return this.expenses.create(user, homeId, data);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Editar un gasto: reemplaza sus datos y recalcula las cuotas; quien registró el gasto o un administrador' })
  @ApiIdParam('Identificador del gasto.')
  @ApiData(MessageResponse, 'Gasto actualizado. Los abonos ya registrados se conservan.')
  @ApiErrors([400, 403, 404], { 403: 'Solo quien registró el gasto o un administrador puede modificarlo.', 404: 'El gasto no existe o está eliminado.' })
  update(@CurrentUser() user: SessionUser, @Param('id', uuidPipe) id: string, @Body() data: ExpenseDto) {
    return this.expenses.update(user, id, data);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar un gasto de forma reversible; quien registró el gasto o un administrador' })
  @ApiIdParam('Identificador del gasto.')
  @ApiData(MessageResponse, 'Gasto eliminado. Se puede deshacer con la ruta de restauración.')
  @ApiErrors([400, 403, 404], { 403: 'Solo quien registró el gasto o un administrador puede eliminarlo.', 404: 'El gasto no existe o ya está eliminado.' })
  remove(@CurrentUser() user: SessionUser, @Param('id', uuidPipe) id: string) {
    return this.expenses.remove(user, id);
  }

  @Post(':id/restore')
  @HttpCode(200)
  @ApiOperation({ summary: 'Deshacer la eliminación de un gasto; quien lo registró o un administrador' })
  @ApiIdParam('Identificador del gasto eliminado.')
  @ApiData(MessageResponse, 'Gasto restaurado con sus cuotas.')
  @ApiErrors([400, 403, 404], { 403: 'Solo quien registró el gasto o un administrador puede restaurarlo.', 404: 'No hay un gasto eliminado con ese identificador.' })
  restore(@CurrentUser() user: SessionUser, @Param('id', uuidPipe) id: string) {
    return this.expenses.restore(user, id);
  }
}
