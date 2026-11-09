import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { SessionUser } from './auth.entity';

export interface AuthRequest extends Request { user: SessionUser }
export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext) =>
  context.switchToHttp().getRequest<AuthRequest>().user,
);
