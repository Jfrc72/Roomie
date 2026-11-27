import { ApiProperty } from '@nestjs/swagger';
import { MAX_MONEY } from '../common/money.rules';

// Modelos de las respuestas, solo para documentar la API en Swagger y tipar al servicio.
const STATUS = ['PENDIENTE', 'PAGADO'];

export class ExpenseShareView {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ format: 'uuid' }) user_id: string;
  @ApiProperty({ example: 'Tomás' }) member: string;
  @ApiProperty({ example: 50.01, description: 'Cuota en pesos. Las cuotas de un gasto suman exactamente su total.' }) amount: number;
  @ApiProperty({ enum: STATUS }) status: string;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) paid_at: string | null;
}

export class ExpenseView {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: 'Mercado de la semana' }) title: string;
  @ApiProperty({ example: 'Alimentación' }) category: string;
  @ApiProperty({ example: 100.01, maximum: MAX_MONEY }) total_amount: number;
  @ApiProperty({ example: '2026-11-25', description: 'YYYY-MM-DD, sin hora.' }) expense_date: string;
  @ApiProperty({ format: 'uuid', description: 'Quien pagó.' }) paid_by: string;
  @ApiProperty({ example: 'Miguel' }) paid_by_name: string;
  @ApiProperty({ format: 'uuid', description: 'Quien registró el gasto.' }) created_by: string;
  @ApiProperty({ enum: STATUS, nullable: true, description: 'Estado de la cuota de quien consulta; null si no participa en el gasto.' }) user_status: string | null;
  @ApiProperty({ type: [ExpenseShareView] }) shares: ExpenseShareView[];
  @ApiProperty({ description: 'true si quien consulta puede editar o eliminar el gasto (lo registró o es administrador).' }) can_edit: boolean;
}

export class BalanceView {
  @ApiProperty({ format: 'uuid' }) user_id: string;
  @ApiProperty({ example: 'Tomás' }) member: string;
  @ApiProperty({ example: 50, description: 'Saldo neto con esa persona, ya descontados los abonos.' }) amount: number;
}

export class BalancesView {
  @ApiProperty({ type: [BalanceView], description: 'Personas que le deben dinero a quien consulta.' }) owes_me: BalanceView[];
  @ApiProperty({ type: [BalanceView], description: 'Personas a quienes debe dinero quien consulta.' }) i_owe: BalanceView[];
}

export class PaymentView {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ format: 'uuid' }) payer_id: string;
  @ApiProperty({ example: 'Tomás' }) payer: string;
  @ApiProperty({ format: 'uuid' }) receiver_id: string;
  @ApiProperty({ example: 'Miguel' }) receiver: string;
  @ApiProperty({ example: 10 }) amount: number;
  @ApiProperty({ type: String, format: 'date-time' }) created_at: string | Date;
}

export class ExpensesSummaryView {
  @ApiProperty({ example: 100.01, description: 'Gastos del mes en curso en todo el apartamento.' }) total_month: number;
  @ApiProperty({ example: 50.01, description: 'Parte de quien consulta en los gastos del mes.' }) your_share: number;
  @ApiProperty({ example: 50, description: 'Total que le deben a quien consulta.' }) you_are_owed: number;
  @ApiProperty({ example: 0, description: 'Total que debe quien consulta.' }) you_owe: number;
}

export class ExpensesOverview {
  @ApiProperty({ type: [ExpenseView], description: 'Hasta 100 gastos recientes, del más nuevo al más antiguo.' }) expenses: ExpenseView[];
  @ApiProperty({ type: BalancesView }) balances: BalancesView;
  @ApiProperty({ type: [PaymentView], description: 'Los 10 pagos más recientes entre integrantes.' }) payments: PaymentView[];
  @ApiProperty({ type: ExpensesSummaryView }) summary: ExpensesSummaryView;
}

/** Resumen que consume el inicio (Dashboard). */
export class ExpensesDigest {
  balance: number;
  recent: { id: string; title: string; amount: number }[];
}
