import type { ParseConfigResult } from '@bgp/game-core';

export const GRID_CLAIM_GAME_TYPE = 'grid-claim';
export const GRID_CLAIM_ENGINE_VERSION = 1;

export const PLAYER_COUNT = 2;

export interface GridClaimConfig {
  boardSize: number;
  blockedCellCount: number;
  targetScore: number;
}

export const DEFAULT_GRID_CLAIM_CONFIG: GridClaimConfig = {
  boardSize: 5,
  blockedCellCount: 3,
  targetScore: 10,
};

const MIN_BOARD_SIZE = 3;
const MAX_BOARD_SIZE = 9;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseConfig(raw: unknown): ParseConfigResult<GridClaimConfig> {
  if (!isRecord(raw)) return { ok: false, message: 'Config must be an object.' };
  const { boardSize, blockedCellCount, targetScore } = raw;

  if (
    !Number.isInteger(boardSize) ||
    (boardSize as number) < MIN_BOARD_SIZE ||
    (boardSize as number) > MAX_BOARD_SIZE
  ) {
    return {
      ok: false,
      message: `boardSize must be an integer from ${MIN_BOARD_SIZE} to ${MAX_BOARD_SIZE}.`,
    };
  }
  const cellCount = (boardSize as number) ** 2;
  if (
    !Number.isInteger(blockedCellCount) ||
    (blockedCellCount as number) < 0 ||
    (blockedCellCount as number) > cellCount - PLAYER_COUNT
  ) {
    return {
      ok: false,
      message: `blockedCellCount must be an integer from 0 to ${cellCount - PLAYER_COUNT}.`,
    };
  }
  if (!Number.isInteger(targetScore) || (targetScore as number) < 1) {
    return { ok: false, message: 'targetScore must be a positive integer.' };
  }

  return {
    ok: true,
    config: {
      boardSize: boardSize as number,
      blockedCellCount: blockedCellCount as number,
      targetScore: targetScore as number,
    },
  };
}
