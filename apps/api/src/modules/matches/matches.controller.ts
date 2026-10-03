import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import {
  ErrorCodes,
  type MatchDto,
  type MatchHistoryDto,
  type MatchReplayDto,
} from '@bgp/shared-types';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator.js';
import { AppError } from '../../common/errors/app-error.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { MatchesService } from './matches.service.js';

@Controller()
@UseGuards(AuthGuard)
export class MatchesController {
  constructor(private readonly matches: MatchesService) {}

  @Get('matches/:matchId')
  get(
    @Param('matchId', ParseUUIDPipe) matchId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MatchDto> {
    return this.matches.getMatch(matchId, user.userId);
  }

  @Get('matches/:matchId/history')
  history(
    @Param('matchId', ParseUUIDPipe) matchId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MatchHistoryDto> {
    return this.matches.getHistory(matchId, user.userId);
  }

  @Get('matches/:matchId/replay')
  replay(
    @Param('matchId', ParseUUIDPipe) matchId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MatchReplayDto> {
    return this.matches.getReplay(matchId, user.userId);
  }

  @Get('users/:userId/matches')
  listForUser(
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MatchDto[]> {
    if (userId !== user.userId) {
      throw new AppError(ErrorCodes.Forbidden, 'You can only list your own matches.', 403);
    }
    return this.matches.listForUser(userId);
  }
}
