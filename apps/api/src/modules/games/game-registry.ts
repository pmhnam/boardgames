import { Injectable } from '@nestjs/common';
import type { GameModule } from '@bgp/game-core';
import { ErrorCodes } from '@bgp/shared-types';
import { AppError } from '../../common/errors/app-error.js';

@Injectable()
export class GameRegistry {
  private readonly games = new Map<string, GameModule>();

  register(game: GameModule): void {
    const { gameType } = game.definition;
    if (game.engine.gameType !== gameType) {
      throw new Error(`Engine/definition gameType mismatch for ${gameType}`);
    }
    if (this.games.has(gameType)) {
      throw new Error(`Game type already registered: ${gameType}`);
    }
    this.games.set(gameType, game);
  }

  get(gameType: string): GameModule {
    const game = this.games.get(gameType);
    if (!game) {
      throw new AppError(ErrorCodes.UnknownGameType, `Unknown game type: ${gameType}`, 404);
    }
    return game;
  }

  /**
   * The engine for a stored match. Refuses a match saved by a different engine version: its
   * state may not have the shape the current rules expect.
   */
  getForMatch(match: { gameType: string; engineVersion: number }): GameModule {
    const game = this.get(match.gameType);
    if (game.engine.engineVersion !== match.engineVersion) {
      throw new AppError(
        ErrorCodes.MatchOutdated,
        'This match was started under older rules and can no longer be opened.',
        409,
        {
          matchEngineVersion: match.engineVersion,
          currentEngineVersion: game.engine.engineVersion,
        },
      );
    }
    return game;
  }

  list(): GameModule[] {
    return [...this.games.values()];
  }
}
