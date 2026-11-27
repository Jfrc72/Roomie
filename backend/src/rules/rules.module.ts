import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { AccessModule } from '../access/access.module';
import { ActivitiesModule } from '../activities/activities.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RulesController } from './rules.controller';
import { RulesRepository } from './rules.repository';
import { RulesService } from './rules.service';
import { RuleReportsService } from './rule-reports.service';
import { AssistantService } from './assistant.service';
import { assistantConfigProvider } from './assistant.config';

@Module({
  imports: [DatabaseModule, AuthModule, AccessModule, ActivitiesModule, NotificationsModule],
  controllers: [RulesController],
  providers: [RulesRepository, RulesService, RuleReportsService, AssistantService, assistantConfigProvider],
})
export class RulesModule {}
