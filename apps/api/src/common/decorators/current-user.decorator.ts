import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { UserRole } from '@bgp/shared-types';
import type { Request } from 'express';

export interface AuthenticatedUser {
  userId: string;
  /** Read from the database on every request, never from the token. */
  role: UserRole;
}

export type AuthenticatedRequest = Request & { user?: AuthenticatedUser };

/** The user derived from the verified access token. Never read identity from a payload. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const user = context.switchToHttp().getRequest<AuthenticatedRequest>().user;
    if (!user) throw new Error('CurrentUser used on a route without AuthGuard');
    return user;
  },
);
