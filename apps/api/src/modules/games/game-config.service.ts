import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { ErrorCodes, type GameConfigDto } from '@bgp/shared-types';
import { AppError } from '../../common/errors/app-error.js';
import { GameConfigRepository, type GameConfigRecord } from './game-config.repository.js';
import { GameRegistry } from './game-registry.js';

const FIRST_VERSION = 1;

function toDto(record: GameConfigRecord): GameConfigDto {
  return {
    gameType: record.gameType,
    version: record.version,
    config: record.config,
    note: record.note,
    createdAt: record.createdAt.toISOString(),
  };
}

/**
 * The database is the source of truth for each game's configuration. An engine's
 * `defaultConfig` only seeds the first version; the engine still decides what is valid.
 */
@Injectable()
export class GameConfigService implements OnApplicationBootstrap {
  private readonly logger = new Logger(GameConfigService.name);

  constructor(
    private readonly configs: GameConfigRepository,
    private readonly registry: GameRegistry,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    for (const { definition, engine } of this.registry.list()) {
      if (await this.configs.findLatest(definition.gameType)) continue;
      // Losing this race to another instance is fine: version 1 then already exists.
      const seeded = await this.configs.insert({
        gameType: definition.gameType,
        version: FIRST_VERSION,
        config: engine.defaultConfig,
        note: 'Seeded from the engine default.',
      });
      if (seeded) this.logger.log(`Seeded config v${FIRST_VERSION} for ${definition.gameType}`);
    }
  }

  async getCurrent(gameType: string): Promise<GameConfigDto> {
    this.registry.get(gameType);
    return toDto(await this.requireLatest(gameType));
  }

  /**
   * The current config, re-validated by the engine so a row the engine can no longer run
   * (edited by hand, or written for an older engine) fails here rather than mid-game.
   */
  async getCurrentForPlay(gameType: string): Promise<{ version: number; config: unknown }> {
    const { engine } = this.registry.get(gameType);
    const record = await this.requireLatest(gameType);
    const parsed = engine.parseConfig(record.config);
    if (!parsed.ok) {
      throw new AppError(
        ErrorCodes.InvalidGameConfig,
        `Stored config v${record.version} for ${gameType} is not valid: ${parsed.message}`,
        500,
      );
    }
    return { version: record.version, config: parsed.config };
  }

  async getCurrentVersion(gameType: string): Promise<number> {
    return (await this.requireLatest(gameType)).version;
  }

  /** Publishes a new version. Matches already in progress keep the config they started with. */
  async publish(gameType: string, rawConfig: unknown, note: string | null): Promise<GameConfigDto> {
    const { engine } = this.registry.get(gameType);
    const parsed = engine.parseConfig(rawConfig);
    if (!parsed.ok) throw new AppError(ErrorCodes.InvalidGameConfig, parsed.message, 400);

    const latest = await this.requireLatest(gameType);
    const record = await this.configs.insert({
      gameType,
      version: latest.version + 1,
      config: parsed.config,
      note,
    });
    if (!record) {
      throw new AppError(
        ErrorCodes.GameConfigConflict,
        'Someone else just published a config for this game. Reload and try again.',
        409,
      );
    }

    this.logger.log({ event: 'game_config_published', gameType, version: record.version });
    return toDto(record);
  }

  private async requireLatest(gameType: string): Promise<GameConfigRecord> {
    const record = await this.configs.findLatest(gameType);
    if (!record) {
      throw new AppError(ErrorCodes.InvalidGameConfig, `No config stored for ${gameType}.`, 500);
    }
    return record;
  }
}
