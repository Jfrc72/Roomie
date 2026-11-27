import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsBoolean, IsIn, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { IsOffsetDateTime, Nullable, OmitOnly, Trim } from '../common/validators';
import { POLL_RULES } from './polls.entity';

const trimEach = () => Transform(({ value }) => (Array.isArray(value) ? value.map(item => (typeof item === 'string' ? item.trim() : item)) : value));

/** Cuerpo para abrir una votación. */
export class PollDto {
  @ApiProperty({ example: '¿Pintamos la sala?', minLength: 2, maxLength: 120, description: 'La pregunta que se somete a votación.' })
  @Trim()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  title: string;

  @ApiPropertyOptional({ example: 'Elegimos un color entre todos.', maxLength: 500, default: '' })
  @OmitOnly()
  @Trim()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ enum: POLL_RULES, default: 'simple', description: 'simple: gana la opción con más votos; unanimous: gana solo si todos los integrantes habilitados eligen la misma.' })
  @OmitOnly()
  @IsIn(POLL_RULES)
  rule?: string;

  @ApiPropertyOptional({ default: false, description: 'En una votación anónima nunca se muestra quién eligió cada opción.' })
  @OmitOnly()
  @IsBoolean()
  anonymous?: boolean;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true, example: '2026-12-01T17:00:00-05:00', description: 'Fecha de cierre automático, con zona horaria y en el futuro. Sin valor, se cierra manualmente.' })
  @Nullable()
  @IsOffsetDateTime()
  closes_at?: string | null;

  @ApiProperty({ type: [String], minItems: 2, maxItems: 10, example: ['Verde', 'Blanco'], description: 'Entre 2 y 10 opciones distintas (sin distinguir mayúsculas), de hasta 80 caracteres.' })
  @trimEach()
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(80, { each: true })
  @ArrayUnique((option: unknown) => String(option).toLowerCase())
  options: string[];
}

/** Voto de quien consulta. */
export class VoteDto {
  @ApiProperty({ format: 'uuid', description: 'Opción elegida; debe pertenecer a la votación.' })
  @IsUUID()
  option_id: string;
}
