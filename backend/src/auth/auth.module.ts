import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { DatabaseModule } from '../database/database.module';
import { AuthController, SessionController } from './auth.controller';
import { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';
import { SessionGuard } from './session.guard';

@Module({ imports: [DatabaseModule, AccessModule], controllers: [AuthController, SessionController], providers: [AuthRepository, AuthService, SessionGuard], exports: [AuthService, SessionGuard] })
export class AuthModule {}
