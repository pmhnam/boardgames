import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import type { AuthenticatedRequest } from '../../common/decorators/current-user.decorator.js';
import { AuthService } from './auth.service.js';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const [scheme, token] = (request.headers.authorization ?? '').split(' ');
    const userId = await this.auth.verifyAccessToken(scheme === 'Bearer' ? token : undefined);
    request.user = { userId };
    return true;
  }
}
