import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import type { AnyGameEngine, GameModule } from '@bgp/game-core';
import {
  ErrorCodes,
  type AdminGameConfigDto,
  type AdminGameDto,
  type ConfigAuthorDto,
  type GameConfigDocumentDto,
  type GameConfigDto,
  type GameConfigSummaryDto,
  type GameDefinitionDto,
  type Page,
} from '@bgp/shared-types';
import { AppError } from '../../common/errors/app-error.js';
import {
  GameConfigRepository,
  type GameConfigRecord,
  type GameConfigSummaryRecord,
  type GameConfigWithAuthor,
} from './game-config.repository.js';
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

function toAuthor(record: {
  createdBy: string | null;
  authorName: string | null;
}): ConfigAuthorDto | null {
  if (record.createdBy === null) return null;
  return { id: record.createdBy, displayName: record.authorName ?? '' };
}

function toSummaryDto(record: GameConfigSummaryRecord): GameConfigSummaryDto {
  return {
    gameType: record.gameType,
    version: record.version,
    note: record.note,
    createdAt: record.createdAt.toISOString(),
    createdBy: toAuthor(record),
  };
}

function toAdminDto(record: GameConfigWithAuthor, engine: AnyGameEngine): AdminGameConfigDto {
  const parsed = engine.parseConfig(record.config);
  return {
    ...toDto(record),
    createdBy: toAuthor(record),
    engineError: parsed.ok ? null : parsed.message,
  };
}

export function toGameDefinitionDto({ definition, engine }: GameModule): GameDefinitionDto {
  return {
    gameType: definition.gameType,
    displayName: definition.displayName,
    minPlayers: definition.minPlayers,
    maxPlayers: definition.maxPlayers,
    supportsBots: definition.supportsBots,
    supportsSpectators: definition.supportsSpectators,
    engineVersion: engine.engineVersion,
  };
}

/** Who is publishing, and from which version their edit started. */
export interface PublishOptions {
  note: string | null;
  expectedVersion: number;
  authorId: string;
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
      const { gameType } = definition;
      const latest = await this.configs.findLatest(gameType);

      if (!latest) {
        // Losing this race to another instance is fine: version 1 then already exists.
        const seeded = await this.configs.insert({
          gameType,
          version: FIRST_VERSION,
          config: engine.defaultConfig,
          note: 'Seeded from the engine default.',
        });
        if (seeded) this.logger.log(`Seeded config v${FIRST_VERSION} for ${gameType}`);
        continue;
      }

      // An engine upgrade can change what a config looks like. A stored config the new engine
      // cannot read would block every new match, so it is superseded (never overwritten) by the
      // engine's default. The old version stays in the table for reference.
      const parsed = engine.parseConfig(latest.config);
      if (!parsed.ok) {
        const reset = await this.configs.insert({
          gameType,
          version: latest.version + 1,
          config: engine.defaultConfig,
          note: `Reset to the engine default: v${latest.version} is not valid for engine v${engine.engineVersion} (${parsed.message})`,
        });
        if (reset) {
          this.logger.warn(
            `Config v${latest.version} for ${gameType} is not valid for the current engine; published the engine default as v${reset.version}`,
          );
        }
      }
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

  /** Every registered game with the config version new matches are set up from. */
  async listForAdmin(): Promise<AdminGameDto[]> {
    const latest = new Map((await this.configs.listLatest()).map((row) => [row.gameType, row]));
    return this.registry.list().flatMap((game) => {
      const current = latest.get(game.definition.gameType);
      if (!current) return [];
      return {
        ...toGameDefinitionDto(game),
        currentVersion: current.version,
        currentPublishedAt: current.createdAt.toISOString(),
      };
    });
  }

  async listVersions(
    gameType: string,
    page: { limit: number; offset: number },
  ): Promise<Page<GameConfigSummaryDto>> {
    this.registry.get(gameType);
    const [records, total] = await Promise.all([
      this.configs.listVersions(gameType, page),
      this.configs.countVersions(gameType),
    ]);
    return { items: records.map(toSummaryDto), total, ...page };
  }

  async getVersion(gameType: string, version: number): Promise<AdminGameConfigDto> {
    const { engine } = this.registry.get(gameType);
    return toAdminDto(await this.requireVersion(gameType, version), engine);
  }

  /** What the engine ships with: the document version 1 was seeded from. */
  getDefault(gameType: string): GameConfigDocumentDto {
    return { config: this.registry.get(gameType).engine.defaultConfig };
  }

  /** Checks a document the way publishing would, without storing anything. */
  validate(gameType: string, rawConfig: unknown): GameConfigDocumentDto {
    return { config: this.parse(gameType, rawConfig) };
  }

  /** Publishes a new version. Matches already in progress keep the config they started with. */
  async publish(
    gameType: string,
    rawConfig: unknown,
    options: PublishOptions,
  ): Promise<AdminGameConfigDto> {
    const { engine } = this.registry.get(gameType);
    const config = this.parse(gameType, rawConfig);

    const latest = await this.requireLatest(gameType);
    // The author was looking at an older version: publishing would silently undo what came since.
    if (latest.version !== options.expectedVersion) throw this.conflict(latest.version);

    const record = await this.configs.insert({
      gameType,
      version: latest.version + 1,
      config,
      note: options.note,
      createdBy: options.authorId,
    });
    // Two people published from the same version at the same moment, and this one came second.
    if (!record) throw this.conflict(latest.version + 1);

    this.logger.log({
      event: 'game_config_published',
      gameType,
      version: record.version,
      byUserId: options.authorId,
    });
    return toAdminDto(await this.requireVersion(gameType, record.version), engine);
  }

  /** Publishes an earlier version's document again as the newest. History is never rewritten. */
  async restore(
    gameType: string,
    version: number,
    options: PublishOptions,
  ): Promise<AdminGameConfigDto> {
    this.registry.get(gameType);
    const source = await this.requireVersion(gameType, version);
    return this.publish(gameType, source.config, {
      ...options,
      note: options.note ?? `Restored from v${version}.`,
    });
  }

  private parse(gameType: string, rawConfig: unknown): unknown {
    const parsed = this.registry.get(gameType).engine.parseConfig(rawConfig);
    if (!parsed.ok) throw new AppError(ErrorCodes.InvalidGameConfig, parsed.message, 400);
    return parsed.config;
  }

  private conflict(latestVersion: number): AppError {
    return new AppError(
      ErrorCodes.GameConfigConflict,
      'A newer config has been published for this game. Reload and try again.',
      409,
      { latestVersion },
    );
  }

  private async requireVersion(gameType: string, version: number): Promise<GameConfigWithAuthor> {
    const record = await this.configs.findVersion(gameType, version);
    if (!record) {
      throw new AppError(ErrorCodes.NotFound, `${gameType} has no config v${version}.`, 404);
    }
    return record;
  }

  private async requireLatest(gameType: string): Promise<GameConfigRecord> {
    const record = await this.configs.findLatest(gameType);
    if (!record) {
      throw new AppError(ErrorCodes.InvalidGameConfig, `No config stored for ${gameType}.`, 500);
    }
    return record;
  }
}
