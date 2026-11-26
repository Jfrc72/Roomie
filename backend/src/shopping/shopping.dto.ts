import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';
import { MAX_MONEY } from '../common/money.rules';
import { IsMoney, Nullable, OmitOnly, Trim } from '../common/validators';
import { SHOPPING_STATUSES } from './shopping.entity';

/** Cuerpo para agregar un producto a la lista. */
export class ShoppingItemDto {
  @ApiProperty({ example: 'Papel higiénico', minLength: 2, maxLength: 255 })
  @Trim()
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  title: string;

  @ApiProperty({ example: 'Hogar', minLength: 1, maxLength: 50, description: 'Categoría libre; la interfaz ofrece Alimentos, Limpieza, Utensilios, Hogar y Varios.' })
  @Trim()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  category: string;

  @ApiProperty({ example: 2, minimum: 1, maximum: 9999, description: 'Cantidad entera de al menos 1.' })
  @IsInt()
  @Min(1)
  @Max(9999)
  quantity: number;

  @ApiPropertyOptional({ example: 8500, minimum: 0, maximum: MAX_MONEY, default: 0, description: 'Precio estimado en pesos, con máximo dos decimales. Si se omite vale 0.' })
  @OmitOnly()
  @IsMoney({ allowZero: true })
  estimated_price?: number;

  @ApiPropertyOptional({ format: 'uuid', nullable: true, description: 'Membresía (no cuenta) del integrante activo que debe comprarlo. Sin valor, queda sin asignar.' })
  @Nullable()
  @IsUUID()
  assigned_membership_id?: string | null;
}

/** Cambios parciales de un producto: solo se modifican los campos enviados. */
export class UpdateShoppingItemDto {
  @ApiPropertyOptional({ minLength: 2, maxLength: 255 })
  @OmitOnly()
  @Trim()
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional({ minLength: 1, maxLength: 50 })
  @OmitOnly()
  @Trim()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  category?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 9999 })
  @OmitOnly()
  @IsInt()
  @Min(1)
  @Max(9999)
  quantity?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: MAX_MONEY, description: 'Precio estimado en pesos, con máximo dos decimales.' })
  @OmitOnly()
  @IsMoney({ allowZero: true })
  estimated_price?: number;

  @ApiPropertyOptional({ format: 'uuid', nullable: true, description: 'Nuevo comprador asignado; `null` quita la asignación.' })
  @Nullable()
  @IsUUID()
  assigned_membership_id?: string | null;

  @ApiPropertyOptional({ enum: SHOPPING_STATUSES, description: 'COMPRADO registra a quien lo marca como comprador; PENDIENTE lo reactiva y borra al comprador. Cualquier integrante puede cambiarlo.' })
  @OmitOnly()
  @IsIn(SHOPPING_STATUSES)
  status?: string;
}
