import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { AccessModule } from '../access/access.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsRepository } from './notifications.repository';
import { NotificationsService } from './notifications.service';

@Module({ imports: [DatabaseModule, AuthModule, AccessModule], controllers: [NotificationsController], providers: [NotificationsRepository, NotificationsService], exports: [NotificationsService] })
export class NotificationsModule {}
