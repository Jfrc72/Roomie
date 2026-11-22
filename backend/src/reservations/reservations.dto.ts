import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsUUID, MaxLength, MinLength, ValidateIf } from 'class-validator';
import { IsDateTime, Trim } from '../common/validation';

export class ResourceDto {
  @ApiProperty({ example: 'Lavadora', minLength: 2, maxLength: 80, description: 'No se repite entre los recursos activos del hogar' })
  @Trim()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name: string;

  @ApiPropertyOptional({ example: 'En el patio', maxLength: 300, default: '' })
  @Trim()
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxLength(300)
  description = '';
}

export class ReservationDto {
  @ApiProperty({ format: 'uuid', description: 'Recurso activo del hogar' })
  @IsUUID()
  resource_id: string;

  @ApiProperty({ example: '2026-12-01T15:00:00.000Z', description: 'Fecha ISO con zona horaria; debe estar en el futuro' })
  @IsDateTime()
  starts_at: string;

  @ApiProperty({ example: '2026-12-01T16:00:00.000Z', description: 'Posterior al inicio; como máximo 7 días después' })
  @IsDateTime()
  ends_at: string;
}
