import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsString, IsUUID, MaxLength, MinLength, ValidateIf } from 'class-validator';
import { Trim } from '../common/validation';

const present = (_object: object, value: unknown) => value !== undefined;

export class RuleDto {
  @ApiProperty({ example: 'Cada persona lava lo que usa en la cocina el mismo día.\n\nSilencio desde las 10 p. m.', minLength: 10, maxLength: 10000, description: 'Un acuerdo por párrafo' })
  @Trim()
  @IsString()
  @MinLength(10)
  @MaxLength(10000)
  content: string;

  @ApiPropertyOptional({ example: 'Se agregan horarios de silencio', maxLength: 200, default: '' })
  @Trim()
  @ValidateIf(present)
  @IsString()
  @MaxLength(200)
  notes = '';
}

export class ReportDto {
  @ApiProperty({ example: 'Silencio desde las 10 p. m.', maxLength: 300, description: 'Acuerdo de la versión vigente' })
  @Trim()
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  clause: string;

  @ApiPropertyOptional({ example: 'Hubo música hasta la 1 a. m.', maxLength: 500, default: '' })
  @Trim()
  @ValidateIf(present)
  @IsString()
  @MaxLength(500)
  description = '';

  @ApiPropertyOptional({ format: 'uuid', nullable: true, default: null, description: 'Integrante activo al que se atribuye; no puede ser quien reporta' })
  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsUUID()
  reported_membership_id: string | null = null;
}

export class AssistantDto {
  @ApiProperty({ example: 'Somos cuatro y nadie cumple las tareas', minLength: 1, maxLength: 300 })
  @Trim()
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  prompt: string;

  @ApiPropertyOptional({ description: 'Borrador actual del reglamento', maxLength: 10000, default: '' })
  @ValidateIf(present)
  @IsString()
  @MaxLength(10000)
  draft = '';

  @ApiPropertyOptional({ enum: ['es', 'en'], default: 'es', description: 'Idioma de la respuesta' })
  @ValidateIf(present)
  @IsIn(['es', 'en'])
  language: 'es' | 'en' = 'es';
}
