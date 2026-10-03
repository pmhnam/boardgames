import { Module } from '@nestjs/common';
import { AdminGuard } from '../../common/guards/admin.guard.js';
import { GameConfigRepository } from './game-config.repository.js';
import { GameConfigService } from './game-config.service.js';
import { GameRegistry } from './game-registry.js';
import { GamesController } from './games.controller.js';
import { registeredGames } from './registered-games.js';

@Module({
  controllers: [GamesController],
  providers: [
    AdminGuard,
    GameConfigRepository,
    GameConfigService,
    {
      provide: GameRegistry,
      useFactory: () => {
        const registry = new GameRegistry();
        for (const game of registeredGames) registry.register(game);
        return registry;
      },
    },
  ],
  exports: [GameRegistry, GameConfigService],
})
export class GamesModule {}
