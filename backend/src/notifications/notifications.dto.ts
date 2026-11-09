import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsDefined, IsInt, IsNumber, IsOptional, IsString, IsUrl, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';

export class PreferencesDto {
  @ApiProperty({ example: false })
  @IsBoolean()
  email_enabled: boolean;

  @ApiProperty({ example: false })
  @IsBoolean()
  push_enabled: boolean;

  @ApiProperty({ minimum: 0, maximum: 168, example: 24 })
  @IsInt()
  @Min(0)
  @Max(168)
  reminder_hours: number;
}

export class ReadNotificationDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  read: boolean;
}

export class PushKeysDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  p256dh: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  auth: string;
}

export class SubscriptionDto {
  @ApiProperty({ description: 'Endpoint HTTPS obtenido con PushManager.subscribe' })
  @IsUrl({ require_protocol: true })
  @MaxLength(2000)
  endpoint: string;

  @ApiPropertyOptional({ type: Number, nullable: true, description: 'Vencimiento que entrega el navegador; puede ser null.' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  expirationTime?: number | null;

  @ApiProperty({ type: PushKeysDto })
  @Type(() => PushKeysDto)
  @IsDefined()
  @ValidateNested()
  keys: PushKeysDto;
}
