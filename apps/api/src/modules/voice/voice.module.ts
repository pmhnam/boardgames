import { Module } from '@nestjs/common';
import { RoomsModule } from '../rooms/rooms.module.js';
import { VoiceGateway } from './voice.gateway.js';
import { VoiceService } from './voice.service.js';

@Module({
  imports: [RoomsModule],
  providers: [VoiceService, VoiceGateway],
})
export class VoiceModule {}
