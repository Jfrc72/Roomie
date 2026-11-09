import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { AccessModule } from '../access/access.module';
import { ActivitiesModule } from '../activities/activities.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { HomesController } from './homes.controller';
import { InvitationsController } from './invitations.controller';
import { HomesRepository } from './homes.repository';
import { InvitationsRepository } from './invitations.repository';
import { MembershipsRepository } from './memberships.repository';
import { HomesService } from './homes.service';
import { InvitationsService } from './invitations.service';
import { MembershipsService } from './memberships.service';

@Module({
  imports: [DatabaseModule, AuthModule, AccessModule, ActivitiesModule, NotificationsModule],
  controllers: [HomesController, InvitationsController],
  providers: [HomesRepository, InvitationsRepository, MembershipsRepository, HomesService, InvitationsService, MembershipsService],
})
export class HomesModule {}
