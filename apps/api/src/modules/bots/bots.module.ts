import { Module } from '@nestjs/common';
import { GamesModule } from '../games/games.module.js';
import { MatchesModule } from '../matches/matches.module.js';
import { BotRunnerService } from './bot-runner.service.js';

@Module({
  imports: [GamesModule, MatchesModule],
  providers: [BotRunnerService],
})
export class BotsModule {}
