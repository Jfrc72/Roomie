import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { HomeAccessRepository } from './home-access.repository';
import { HomeAccessService } from './home-access.service';
import { HomeGuard } from './home.guard';

@Module({ imports: [DatabaseModule], providers: [HomeAccessRepository, HomeAccessService, HomeGuard], exports: [HomeAccessService, HomeGuard] })
export class AccessModule {}
