import { Body, Controller, HttpCode, Post, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user';
import { SessionUser } from '../auth/auth.entity';
import { SessionGuard } from '../auth/session.guard';
import { ApiData, ApiErrors, ApiHomeQuery, MessageResponse } from '../common/swagger';
import { PaymentDto } from './expenses.dto';
import { ExpensesService } from './expenses.service';

@ApiTags('Gastos')
@ApiCookieAuth()
@ApiErrors([401])
@UseGuards(SessionGuard)
@Controller('payments')
export class PaymentsController {
  constructor(private readonly expenses: ExpensesService) {}

  @Post()
  @HttpCode(200)
  @ApiOperation({ summary: 'Registrar un abono a otro integrante, sin superar el saldo pendiente con esa persona' })
  @ApiHomeQuery()
  @ApiData(MessageResponse, 'Pago registrado: reduce el saldo y, al saldarlo, las cuotas quedan pagadas.')
  @ApiErrors([400, 403], {
    400: 'Monto inválido, pago a uno mismo, integrante ajeno al apartamento o pago mayor al saldo pendiente.',
    403: 'Quien paga no pertenece al apartamento.',
  })
  pay(@CurrentUser() user: SessionUser, @Query('homeId') homeId: string | undefined, @Body() data: PaymentDto) {
    return this.expenses.pay(user, homeId, data);
  }
}
