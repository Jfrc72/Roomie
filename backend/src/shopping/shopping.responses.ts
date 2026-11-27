import { ApiProperty } from '@nestjs/swagger';
import { SHOPPING_STATUSES } from './shopping.entity';

export class ShoppingItemView {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: 'Jabón de loza' }) title: string;
  @ApiProperty({ example: 'Limpieza' }) category: string;
  @ApiProperty({ example: 2 }) quantity: number;
  @ApiProperty({ example: 8500 }) estimated_price: number;
  @ApiProperty({ enum: SHOPPING_STATUSES }) status: string;
  @ApiProperty({ format: 'uuid', description: 'Cuenta de quien agregó el producto.' }) added_by: string;
  @ApiProperty({ example: 'Miguel' }) added_by_name: string;
  @ApiProperty({ type: String, format: 'uuid', nullable: true, description: 'Cuenta de quien lo marcó como comprado.' }) bought_by: string | null;
  @ApiProperty({ type: String, nullable: true }) bought_by_name: string | null;
  @ApiProperty({ type: String, format: 'uuid', nullable: true, description: 'Membresía asignada para comprarlo.' }) assigned_membership_id: string | null;
  @ApiProperty({ type: String, nullable: true, description: 'Nombre de quien debe comprarlo.' }) assigned_to: string | null;
  @ApiProperty({ description: 'true si quien consulta puede editar o eliminar el producto (lo agregó o es administrador).' }) can_edit: boolean;
  @ApiProperty({ type: String, format: 'date-time' }) created_at: string | Date;
}

/** Resumen que consume el inicio (Dashboard). */
export class ShoppingDigest {
  pending: number;
}
