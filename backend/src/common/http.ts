import { ArgumentsHost, CallHandler, Catch, ExceptionFilter, HttpException, Injectable, NestInterceptor } from '@nestjs/common';
import { Request, Response } from 'express';
import { map } from 'rxjs';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    let status = 500;
    let message = 'No pudimos completar la operación. Intenta nuevamente.';
    if (error instanceof HttpException) {
      status = error.getStatus();
      const detail = error.getResponse();
      message = typeof detail === 'string' ? detail : (detail as { message: string }).message;
    } else if ((error as { code?: string })?.code === '23505') {
      status = 409;
      message = 'Ya existe un registro con estos datos.';
    } else {
      console.error('API Nest:', error instanceof Error ? error.message : 'Error desconocido');
    }
    response.status(status).json({ error: message });
  }
}

@Injectable()
export class DataInterceptor implements NestInterceptor {
  intercept(_context: unknown, next: CallHandler) {
    return next.handle().pipe(map((data: unknown) => ({ data })));
  }
}

export function requestOriginAllowed(request: Pick<Request, 'method' | 'headers'>) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return true;
  return request.headers.origin === new URL(process.env.APP_URL || 'http://localhost:3000').origin;
}
