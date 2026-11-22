import 'reflect-metadata';
import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { ApiExceptionFilter, DataInterceptor } from './common/http';
import { COOKIE } from './auth/passwords';

async function bootstrap() {
  if (existsSync('../.env')) loadEnvFile('../.env');
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true,
    exceptionFactory: () => new BadRequestException('Revisa los campos: los datos no son válidos.'),
  }));
  app.useGlobalFilters(new ApiExceptionFilter());
  app.useGlobalInterceptors(new DataInterceptor());
  app.enableShutdownHooks();

  const config = new DocumentBuilder().setTitle('Roomie ciclo 2').setVersion('0.1.0')
    .setDescription('Cuentas, apartamentos, integrantes, notificaciones e inicio (Juan); tareas, reservas, acuerdos y asistente con IA (Tomás). Las escrituras requieren JSON y el encabezado Origin igual a APP_URL. Las respuestas usan {data} o {error}.')
    .addCookieAuth(COOKIE).build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, { jsonDocumentUrl: 'api/docs-json', swaggerOptions: { withCredentials: true } });
  await app.listen(Number(process.env.API_PORT || 3001), process.env.API_HOST || '127.0.0.1');
}
bootstrap().catch(error => { console.error(error); process.exitCode = 1; });
