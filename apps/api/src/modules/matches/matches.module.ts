import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { GamesModule } from '../games/games.module.js';
import { GameActionService } from './game-action.service.js';
import { MatchRepository } from './match.repository.js';
import { MatchesController } from './matches.controller.js';
import { MatchesService } from './matches.service.js';
import { MatchCleanupService } from './match-cleanup.service.js';

@Module({
  imports: [AuthModule, GamesModule],
  controllers: [MatchesController],
  providers: [MatchRepository, MatchesService, GameActionService, MatchCleanupService],
  exports: [MatchesService, GameActionService, MatchRepository],
})
export class MatchesModule {}
