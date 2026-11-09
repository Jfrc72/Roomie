import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnsupportedMediaTypeException } from '@nestjs/common';
import { Request } from 'express';
import { requestOriginAllowed } from './http';

@Injectable()
export class OriginGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    if (!requestOriginAllowed(request)) throw new ForbiddenException('Origen de la solicitud no permitido.');
    if (!['GET', 'HEAD', 'OPTIONS', 'DELETE'].includes(request.method) && !request.headers['content-type']?.includes('application/json')) {
      throw new UnsupportedMediaTypeException('Envía los datos como JSON.');
    }
    return true;
  }
}
