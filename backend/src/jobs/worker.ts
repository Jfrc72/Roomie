import 'reflect-metadata';
import { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { JobsModule } from './jobs.module';
import { JobsService } from './jobs.service';

let context: INestApplicationContext | undefined;
export async function runNotificationJobs() {
  context ??= await NestFactory.createApplicationContext(JobsModule, { logger: ['error', 'warn'] });
  await context.get(JobsService).tick();
}
export async function closeNotificationWorker() {
  await context?.close();
  context = undefined;
}
