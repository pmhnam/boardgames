import {
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { AdminMatchDto, Page } from '@bgp/shared-types';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { AdminRoleGuard } from '../auth/admin-role.guard.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { GameActionService } from '../matches/game-action.service.js';
import { MatchesService } from '../matches/matches.service.js';
import { matchListQuerySchema, type MatchListQuery } from './admin.schemas.js';

@Controller('admin/matches')
@UseGuards(AuthGuard, AdminRoleGuard)
export class AdminMatchesController {
  constructor(
    private readonly matches: MatchesService,
    private readonly actions: GameActionService,
  ) {}

  @Get()
  list(
    @Query(new ZodValidationPipe(matchListQuerySchema)) query: MatchListQuery,
  ): Promise<Page<AdminMatchDto>> {
    const { limit, offset, ...filter } = query;
    return this.matches.listForAdmin(filter, { limit, offset });
  }

  @Get(':matchId')
  get(@Param('matchId', ParseUUIDPipe) matchId: string): Promise<AdminMatchDto> {
    return this.matches.getForAdmin(matchId);
  }

  /** Ends a match in progress with no result, e.g. one that is stuck. */
  @Post(':matchId/abandon')
  @HttpCode(200)
  async abandon(
    @CurrentUser() user: AuthenticatedUser,
    @Param('matchId', ParseUUIDPipe) matchId: string,
  ): Promise<AdminMatchDto> {
    await this.actions.abandon({ matchId, byUserId: user.userId, now: new Date() });
    return this.matches.getForAdmin(matchId);
  }
}
