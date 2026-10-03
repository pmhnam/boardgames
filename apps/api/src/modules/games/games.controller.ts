import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import type { GameConfigDto, GameDefinitionDto } from '@bgp/shared-types';
import { z } from 'zod';
import { AdminGuard } from '../../common/guards/admin.guard.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { GameConfigService } from './game-config.service.js';
import { GameRegistry } from './game-registry.js';

/** The envelope only. What goes inside `config` is the game engine's business. */
const updateConfigSchema = z.object({
  config: z.unknown(),
  note: z.string().trim().max(500).optional(),
});

@Controller('games')
export class GamesController {
  constructor(
    private readonly registry: GameRegistry,
    private readonly configs: GameConfigService,
  ) {}

  @Get()
  list(): GameDefinitionDto[] {
    return this.registry.list().map(({ definition, engine }) => ({
      gameType: definition.gameType,
      displayName: definition.displayName,
      minPlayers: definition.minPlayers,
      maxPlayers: definition.maxPlayers,
      supportsBots: definition.supportsBots,
      supportsSpectators: definition.supportsSpectators,
      engineVersion: engine.engineVersion,
    }));
  }

  @Get(':gameType/config')
  getConfig(@Param('gameType') gameType: string): Promise<GameConfigDto> {
    return this.configs.getCurrent(gameType);
  }

  @Put(':gameType/config')
  @UseGuards(AdminGuard)
  publishConfig(
    @Param('gameType') gameType: string,
    @Body(new ZodValidationPipe(updateConfigSchema)) body: z.infer<typeof updateConfigSchema>,
  ): Promise<GameConfigDto> {
    return this.configs.publish(gameType, body.config, body.note || null);
  }
}
