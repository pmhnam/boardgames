import { Controller, Get, Param } from '@nestjs/common';
import type { GameConfigDto, GameDefinitionDto } from '@bgp/shared-types';
import { GameConfigService, toGameDefinitionDto } from './game-config.service.js';
import { GameRegistry } from './game-registry.js';

@Controller('games')
export class GamesController {
  constructor(
    private readonly registry: GameRegistry,
    private readonly configs: GameConfigService,
  ) {}

  @Get()
  list(): GameDefinitionDto[] {
    return this.registry.list().map(toGameDefinitionDto);
  }

  @Get(':gameType/config')
  getConfig(@Param('gameType') gameType: string): Promise<GameConfigDto> {
    return this.configs.getCurrent(gameType);
  }
}
