import { GameRuleError, type CreateInitialStateInput } from '@bgp/game-core';
import { BLOCKED, type Cell } from '../domain/board.js';
import { GRID_CLAIM_ENGINE_VERSION, PLAYER_COUNT, type GridClaimConfig } from '../domain/config.js';
import type { GridClaimState } from '../domain/state.js';
import { randomizeSetup } from '../random/setup-randomizer.js';

export function createInitialState(
  input: CreateInitialStateInput<GridClaimConfig>,
): GridClaimState {
  const { boardSize, blockedCellCount, targetScore } = input.config;

  if (input.players.length !== PLAYER_COUNT) {
    throw new GameRuleError(
      'INVALID_PLAYER_COUNT',
      `Grid Claim needs exactly ${PLAYER_COUNT} players.`,
    );
  }

  const playerIds = [...input.players]
    .sort((a, b) => a.seat - b.seat)
    .map((player) => player.playerId);

  const setup = randomizeSetup({
    seed: input.seed,
    cellCount: boardSize * boardSize,
    blockedCount: blockedCellCount,
    playerIds,
  });

  const cells: Cell[] = Array.from({ length: boardSize * boardSize }, (_, index) =>
    setup.blockedIndexes.includes(index) ? BLOCKED : null,
  );

  return {
    id: input.gameId,
    engineVersion: GRID_CLAIM_ENGINE_VERSION,
    phase: 'PLAYING',
    size: boardSize,
    targetScore,
    playerIds,
    cells,
    turn: { number: 1, activePlayerId: setup.startingPlayerId },
    lastPlacementByPlayer: Object.fromEntries(playerIds.map((playerId) => [playerId, null])),
    winnerPlayerIds: [],
  };
}
