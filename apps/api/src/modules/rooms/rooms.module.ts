import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { GamesModule } from '../games/games.module.js';
import { MatchesModule } from '../matches/matches.module.js';
import { UsersModule } from '../users/users.module.js';
import { RoomsController } from './rooms.controller.js';
import { RoomsRepository } from './rooms.repository.js';
import { RoomsService } from './rooms.service.js';

@Module({
  imports: [AuthModule, GamesModule, MatchesModule, UsersModule],
  controllers: [RoomsController],
  providers: [RoomsRepository, RoomsService],
  exports: [RoomsService],
})
export class RoomsModule {}
