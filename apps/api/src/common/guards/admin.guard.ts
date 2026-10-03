import { timingSafeEqual } from 'node:crypto';
import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { ErrorCodes } from '@bgp/shared-types';
import type { Request } from 'express';
import { AppConfig } from '../../config/app-config.js';
import { AppError } from '../errors/app-error.js';

export const ADMIN_TOKEN_HEADER = 'x-admin-token';

function matches(expected: string, provided: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Guards operator-only endpoints with a shared secret (ADMIN_TOKEN). There are no user roles
 * yet; with no secret configured the endpoints are simply off.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly config: AppConfig) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.config.adminToken;
    if (expected === null) {
      throw new AppError(
        ErrorCodes.Forbidden,
        'Admin endpoints are disabled: ADMIN_TOKEN is not set on the server.',
        403,
      );
    }
    const provided = context.switchToHttp().getRequest<Request>().headers[ADMIN_TOKEN_HEADER];
    if (typeof provided !== 'string' || !matches(expected, provided)) {
      throw new AppError(ErrorCodes.Forbidden, 'A valid admin token is required.', 403);
    }
    return true;
  }
}
