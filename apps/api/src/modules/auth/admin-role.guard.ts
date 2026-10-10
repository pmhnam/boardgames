import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { ErrorCodes } from '@bgp/shared-types';
import type { AuthenticatedRequest } from '../../common/decorators/current-user.decorator.js';
import { AppError } from '../../common/errors/app-error.js';

/** Lets administrators through. Goes after AuthGuard, which says who is asking. */
@Injectable()
export class AdminRoleGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const user = context.switchToHttp().getRequest<AuthenticatedRequest>().user;
    if (user?.role !== 'admin') {
      throw new AppError(ErrorCodes.Forbidden, 'Administrators only.', 403);
    }
    return true;
  }
}
