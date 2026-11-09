import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { AuthRequest } from '../auth/current-user';
import { HomeAccessService } from './home-access.service';

@Injectable()
export class HomeGuard implements CanActivate {
  constructor(private readonly access: HomeAccessService) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const homeId = request.params.id ?? request.query.homeId;
    await this.access.requireHome(request.user.id, String(homeId ?? ''));
    return true;
  }
}
