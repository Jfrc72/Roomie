import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { MAX_MONEY } from '../common/money.rules';
import { IsMoney, Nullable, OmitOnly, Trim } from '../common/validators';
import { MAINTENANCE_PRIORITIES, MAINTENANCE_STATUSES } from './maintenance.entity';

/** Cuerpo para reportar un problema del apartamento. */
export class MaintenanceReportDto {
  @ApiProperty({ example: 'Fuga en el lavaplatos', minLength: 3, maxLength: 255 })
  @Trim()
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  title: string;

  @ApiPropertyOptional({ example: 'Gotea al cerrar la llave', maxLength: 2000, default: '' })
  @OmitOnly()
  @Trim()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({ example: 'Plomería', minLength: 1, maxLength: 50, description: 'Categoría libre; la interfaz ofrece Plomería, Electricidad, Carpintería, Electrodomésticos, Estructura y Otros.' })
  @Trim()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  category: string;

  @ApiPropertyOptional({ example: 45000, nullable: true, minimum: 0, maximum: MAX_MONEY, description: 'Costo estimado en pesos, con máximo dos decimales. Sin valor, no hay estimación.' })
  @Nullable()
  @IsMoney({ allowZero: true })
  estimated_cost?: number | null;

  @ApiPropertyOptional({ enum: MAINTENANCE_PRIORITIES, default: 'MEDIA' })
  @OmitOnly()
  @IsIn(MAINTENANCE_PRIORITIES)
  priority?: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true, description: 'Membresía (no cuenta) del integrante activo responsable. Sin valor, queda sin responsable.' })
  @Nullable()
  @IsUUID()
  assigned_membership_id?: string | null;
}

/** Cambios parciales de un reporte: solo se modifican los campos enviados. */
export class UpdateMaintenanceReportDto {
  @ApiPropertyOptional({ minLength: 3, maxLength: 255 })
  @OmitOnly()
  @Trim()
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional({ maxLength: 2000 })
  @OmitOnly()
  @Trim()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ minLength: 1, maxLength: 50 })
  @OmitOnly()
  @Trim()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  category?: string;

  @ApiPropertyOptional({ nullable: true, minimum: 0, maximum: MAX_MONEY, description: 'Nuevo costo estimado; `null` lo borra.' })
  @Nullable()
  @IsMoney({ allowZero: true })
  estimated_cost?: number | null;

  @ApiPropertyOptional({ enum: MAINTENANCE_PRIORITIES })
  @OmitOnly()
  @IsIn(MAINTENANCE_PRIORITIES)
  priority?: string;

  @ApiPropertyOptional({ enum: MAINTENANCE_STATUSES, description: 'Estado de la reparación.' })
  @OmitOnly()
  @IsIn(MAINTENANCE_STATUSES)
  status?: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true, description: 'Nuevo responsable; `null` quita la asignación.' })
  @Nullable()
  @IsUUID()
  assigned_membership_id?: string | null;
}
