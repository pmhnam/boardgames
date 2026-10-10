import { Controller, Get, UseGuards } from '@nestjs/common';
import type { UserDto } from '@bgp/shared-types';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator.js';
import { AdminRoleGuard } from '../auth/admin-role.guard.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { AuthService } from '../auth/auth.service.js';

@Controller('admin/session')
@UseGuards(AuthGuard, AdminRoleGuard)
export class AdminSessionController {
  constructor(private readonly auth: AuthService) {}

  /** Lets the web app confirm a stored session still belongs to an administrator. */
  @Get()
  current(@CurrentUser() user: AuthenticatedUser): Promise<UserDto> {
    return this.auth.getUser(user.userId);
  }
}
