import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { MatchesModule } from '../matches/matches.module.js';
import { RoomsModule } from '../rooms/rooms.module.js';
import { RealtimeGateway } from './realtime.gateway.js';

@Module({
  imports: [AuthModule, RoomsModule, MatchesModule],
  providers: [RealtimeGateway],
})
export class RealtimeModule {}
