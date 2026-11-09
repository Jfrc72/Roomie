import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'juan@roomie.test', maxLength: 254 })
  @Transform(({ value }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiProperty({ minLength: 1, maxLength: 128, format: 'password' })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password: string;
}

export class RegisterDto extends LoginDto {
  @ApiProperty({ example: 'Juan', minLength: 2, maxLength: 80 })
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name: string;

  @ApiProperty({ minLength: 10, maxLength: 128, format: 'password' })
  @IsString()
  @MinLength(10)
  @MaxLength(128)
  declare password: string;
}

export class ProfileDto {
  @ApiProperty({ example: 'Juan', minLength: 2, maxLength: 80 })
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name: string;
}

export class CurrentPasswordDto {
  @ApiProperty({ format: 'password' })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  current: string;
}

export class ChangePasswordDto extends CurrentPasswordDto {
  @ApiProperty({ minLength: 10, maxLength: 128, format: 'password' })
  @IsString()
  @MinLength(10)
  @MaxLength(128)
  password: string;
}
