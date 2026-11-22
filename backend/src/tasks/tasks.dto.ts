import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsString, IsUUID, MaxLength, MinLength, ValidateIf } from 'class-validator';
import { IsDateTime, Trim } from '../common/validation';
import { taskPriorities, TaskPriority, taskStatuses, TaskStatus } from './tasks.rules';

const present = (_object: object, value: unknown) => value !== undefined;
const filled = (_object: object, value: unknown) => value !== undefined && value !== null;

export class CreateTaskDto {
  @ApiProperty({ example: 'Sacar la basura', minLength: 2, maxLength: 120 })
  @Trim()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  title: string;

  @ApiPropertyOptional({ example: 'Bolsas negras el martes', maxLength: 500, default: '' })
  @Trim()
  @ValidateIf(present)
  @IsString()
  @MaxLength(500)
  description = '';

  @ApiPropertyOptional({ description: 'Membresía activa del responsable', format: 'uuid', nullable: true, default: null })
  @ValidateIf(filled)
  @IsUUID()
  assigned_membership_id: string | null = null;

  @ApiPropertyOptional({ description: 'Fecha ISO con zona horaria; no puede estar en el pasado', example: '2026-12-01T22:00:00.000Z', nullable: true, default: null })
  @ValidateIf(filled)
  @IsDateTime()
  due_at: string | null = null;

  @ApiPropertyOptional({ enum: taskPriorities, default: 'medium' })
  @ValidateIf(present)
  @IsIn(taskPriorities)
  priority: TaskPriority = 'medium';
}

// Todos los campos son opcionales: se cambian solo los que llegan.
export class UpdateTaskDto {
  @ApiPropertyOptional({ minLength: 2, maxLength: 120 })
  @Trim()
  @ValidateIf(present)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  title?: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @Trim()
  @ValidateIf(present)
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true, description: 'null deja la tarea sin responsable' })
  @ValidateIf(filled)
  @IsUUID()
  assigned_membership_id?: string | null;

  @ApiPropertyOptional({ example: '2026-12-01T22:00:00.000Z', nullable: true })
  @ValidateIf(filled)
  @IsDateTime()
  due_at?: string | null;

  @ApiPropertyOptional({ enum: taskPriorities })
  @ValidateIf(present)
  @IsIn(taskPriorities)
  priority?: TaskPriority;

  @ApiPropertyOptional({ enum: taskStatuses })
  @ValidateIf(present)
  @IsIn(taskStatuses)
  status?: TaskStatus;
}
