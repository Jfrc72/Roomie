import { BadRequestException, CanActivate, ExecutionContext, INestApplication, Provider, Type, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AuthRequest } from '../src/auth/current-user';
import { SessionUser } from '../src/auth/auth.entity';
import { SessionGuard } from '../src/auth/session.guard';
import { ApiExceptionFilter, DataInterceptor } from '../src/common/http';
import { user as defaultUser } from './helpers';

export interface ApiReply {
  status: number;
  body: { data?: unknown; error?: string };
}

export interface TestApi {
  call(path: string, method?: string, body?: unknown): Promise<ApiReply>;
  close(): Promise<void>;
}

/**
 * Levanta los controladores indicados con una aplicación Nest real y la misma configuración global que main.ts
 * (prefijo /api, ValidationPipe, filtro de errores e interceptor {data}). Solo se sustituyen la sesión
 * (`sessionUser`, o null para simular que no hay sesión) y los servicios, que llegan como `providers` simulados.
 */
export async function startApi(controllers: Type[], providers: Provider[], sessionUser: SessionUser | null = defaultUser): Promise<TestApi> {
  const session: CanActivate = {
    canActivate(context: ExecutionContext) {
      if (!sessionUser) throw new UnauthorizedException('Inicia sesión para continuar.');
      context.switchToHttp().getRequest<AuthRequest>().user = sessionUser;
      return true;
    },
  };
  const moduleRef = await Test.createTestingModule({ controllers, providers }).overrideGuard(SessionGuard).useValue(session).compile();
  const app: INestApplication = moduleRef.createNestApplication({ logger: false });
  app.setGlobalPrefix('api');
  // Debe coincidir con backend/src/main.ts.
  app.useGlobalPipes(new ValidationPipe({
    transform: true, whitelist: true, forbidNonWhitelisted: true,
    exceptionFactory: () => new BadRequestException('Revisa los campos: los datos no son válidos.'),
  }));
  app.useGlobalFilters(new ApiExceptionFilter());
  app.useGlobalInterceptors(new DataInterceptor());
  await app.listen(0, '127.0.0.1');
  const base = await app.getUrl();
  return {
    async call(path, method = 'GET', body) {
      const response = await fetch(`${base}/api${path}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      return { status: response.status, body: await response.json() };
    },
    close: () => app.close(),
  };
}
