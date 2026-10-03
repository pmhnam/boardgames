import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ConfigModule } from './config/config.module.js';
import { DatabaseModule } from './infrastructure/database/database.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { GamesModule } from './modules/games/games.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { MatchesModule } from './modules/matches/matches.module.js';
import { RealtimeModule } from './modules/realtime/realtime.module.js';
import { RoomsModule } from './modules/rooms/rooms.module.js';
import { UsersModule } from './modules/users/users.module.js';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    EventEmitterModule.forRoot(),
    HealthModule,
    UsersModule,
    AuthModule,
    GamesModule,
    RoomsModule,
    MatchesModule,
    RealtimeModule,
  ],
})
export class AppModule {}
