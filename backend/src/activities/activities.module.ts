import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { ActivitiesRepository } from './activities.repository';
import { ActivitiesService } from './activities.service';

@Module({ imports: [DatabaseModule], providers: [ActivitiesRepository, ActivitiesService], exports: [ActivitiesService] })
export class ActivitiesModule {}
