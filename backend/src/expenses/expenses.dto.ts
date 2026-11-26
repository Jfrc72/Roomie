import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { MAX_MONEY } from '../common/money.rules';
import { IsDateOnly, IsMoney, OmitOnly, Trim } from '../common/validators';

/** Cuerpo para registrar un gasto y para reemplazar uno existente (PATCH). */
export class ExpenseDto {
  @ApiProperty({ example: 'Mercado de la semana', minLength: 2, maxLength: 255, description: 'Concepto del gasto.' })
  @Trim()
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  title: string;

  @ApiProperty({ example: 'Alimentación', minLength: 1, maxLength: 50, description: 'Categoría libre; la interfaz ofrece Servicios, Arriendo, Alimentación, Mercado y Varios.' })
  @Trim()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  category: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Persona que pagó. Por defecto, quien registra el gasto. Debe ser integrante activo.' })
  @OmitOnly()
  @IsUUID()
  paid_by_id?: string;

  @ApiProperty({ example: 120550.5, minimum: 0.01, maximum: MAX_MONEY, description: 'Monto total en pesos: mayor que cero y con máximo dos decimales.' })
  @IsMoney()
  total_amount: number;

  @ApiProperty({ example: '2026-11-25', description: 'Fecha del gasto como YYYY-MM-DD, sin hora.' })
  @IsDateOnly()
  expense_date: string;

  @ApiProperty({
    type: [String], format: 'uuid', minItems: 1, maxItems: 8,
    description: 'Integrantes activos entre quienes se divide el gasto. El pagador siempre participa, aunque no esté en la lista.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(8)
  @IsUUID('all', { each: true })
  participant_ids: string[];
}

/** Abono de quien consulta a otro integrante. */
export class PaymentDto {
  @ApiProperty({ format: 'uuid', description: 'Integrante que recibe el pago. No puede ser quien lo registra.' })
  @IsUUID()
  receiver_id: string;

  @ApiProperty({ example: 25000, minimum: 0.01, maximum: MAX_MONEY, description: 'Monto del abono. No puede superar el saldo pendiente con esa persona.' })
  @IsMoney()
  amount: number;
}
