import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { ActivitiesModule } from '../activities/activities.module';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { ShoppingController } from './shopping.controller';
import { ShoppingRepository } from './shopping.repository';
import { ShoppingService } from './shopping.service';

@Module({
  imports: [DatabaseModule, AuthModule, AccessModule, ActivitiesModule],
  controllers: [ShoppingController],
  providers: [ShoppingRepository, ShoppingService],
  exports: [ShoppingService],
})
export class ShoppingModule {}
