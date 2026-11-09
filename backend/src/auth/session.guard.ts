import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthRequest } from './current-user';
import { COOKIE } from './passwords';

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const value = request.headers.cookie?.split(';').map(part => part.trim()).find(part => part.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
    const user = value ? await this.auth.currentUser(value) : null;
    if (!user) throw new UnauthorizedException('Inicia sesión para continuar.');
    request.user = user;
    return true;
  }
}
