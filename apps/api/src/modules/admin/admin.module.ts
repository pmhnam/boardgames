import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { GamesModule } from '../games/games.module.js';
import { MatchesModule } from '../matches/matches.module.js';
import { RoomsModule } from '../rooms/rooms.module.js';
import { UsersModule } from '../users/users.module.js';
import { AdminGamesController } from './admin-games.controller.js';
import { AdminMatchesController } from './admin-matches.controller.js';
import { AdminRoomsController } from './admin-rooms.controller.js';
import { AdminSessionController } from './admin-session.controller.js';
import { AdminUsersController } from './admin-users.controller.js';

/**
 * HTTP surface of the admin area. Controllers here only check the caller is an administrator
 * and delegate: every rule stays in the module that owns the thing being managed.
 */
@Module({
  imports: [AuthModule, GamesModule, MatchesModule, RoomsModule, UsersModule],
  controllers: [
    AdminSessionController,
    AdminGamesController,
    AdminMatchesController,
    AdminRoomsController,
    AdminUsersController,
  ],
})
export class AdminModule {}
