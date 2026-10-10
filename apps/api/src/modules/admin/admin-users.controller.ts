import { Body, Controller, Get, Param, ParseUUIDPipe, Put, Query, UseGuards } from '@nestjs/common';
import type { AdminUserDetailDto, AdminUserDto, Page } from '@bgp/shared-types';
import type { z } from 'zod';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { AdminRoleGuard } from '../auth/admin-role.guard.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { MatchesService } from '../matches/matches.service.js';
import { RoomsService } from '../rooms/rooms.service.js';
import { UsersService } from '../users/users.service.js';
import { setDisabledSchema, userListQuerySchema, type UserListQuery } from './admin.schemas.js';

@Controller('admin/users')
@UseGuards(AuthGuard, AdminRoleGuard)
export class AdminUsersController {
  constructor(
    private readonly users: UsersService,
    private readonly rooms: RoomsService,
    private readonly matches: MatchesService,
  ) {}

  @Get()
  list(
    @Query(new ZodValidationPipe(userListQuerySchema)) query: UserListQuery,
  ): Promise<Page<AdminUserDto>> {
    const { limit, offset, q, bots } = query;
    return this.users.listForAdmin({ q, includeBots: bots === 'true' }, { limit, offset });
  }

  /** One person, with where they are seated and what they have played lately. */
  @Get(':userId')
  async get(@Param('userId', ParseUUIDPipe) userId: string): Promise<AdminUserDetailDto> {
    const user = await this.users.getForAdmin(userId);
    const [rooms, recentMatches] = await Promise.all([
      this.rooms.listForMember(userId),
      this.matches.listForUser(userId),
    ]);
    return { user, rooms, recentMatches };
  }

  @Put(':userId/disabled')
  setDisabled(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body(new ZodValidationPipe(setDisabledSchema)) body: z.infer<typeof setDisabledSchema>,
  ): Promise<AdminUserDto> {
    return this.users.setDisabled(actor.userId, userId, body.disabled);
  }
}
