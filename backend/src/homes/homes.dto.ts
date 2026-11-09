import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsString, Matches, MaxLength, MinLength, ValidateIf } from 'class-validator';

export class HomeDto {
  @ApiProperty({ example: 'Apartamento 301', minLength: 2, maxLength: 80 })
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name: string;

  @ApiPropertyOptional({ example: 'Bogotá', maxLength: 200, default: '' })
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxLength(200)
  address = '';

  @ApiPropertyOptional({ maxLength: 500, default: '' })
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxLength(500)
  description = '';
}

export class InviteDto {
  @ApiProperty({ example: 'roommate@example.com', maxLength: 254 })
  @Transform(({ value }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  @IsEmail()
  @MaxLength(254)
  email: string;
}

export class AcceptInvitationDto {
  @ApiProperty({ description: 'Token de 64 caracteres del enlace de invitación', pattern: '^[a-f0-9]{64}$' })
  @Matches(/^[a-f0-9]{64}$/)
  token: string;
}

export class RoleDto {
  @ApiProperty({ enum: ['admin', 'member'] })
  @IsIn(['admin', 'member'])
  role: 'admin' | 'member';
}
