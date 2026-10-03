import { deepFreeze } from '@bgp/game-core/testing';
import { BLOCKED, toIndex, type Cell, type Position } from '../../src/domain/board.js';
import type { GridClaimState } from '../../src/domain/state.js';

export const P1 = 'p1';
export const P2 = 'p2';

/**
 * Builds a frozen 5x5 state from an ASCII board: `.` empty, `#` blocked, `1`/`2` pieces.
 */
export function stateFromBoard(
  rows: string[],
  overrides: Partial<Omit<GridClaimState, 'cells'>> = {},
): GridClaimState {
  const size = rows.length;
  const cells: Cell[] = rows.flatMap((row) =>
    [...row].map((char) => (char === '#' ? BLOCKED : char === '1' ? P1 : char === '2' ? P2 : null)),
  );
  return deepFreeze({
    id: 'fixture',
    engineVersion: 1,
    phase: 'PLAYING',
    size,
    targetScore: 10,
    playerIds: [P1, P2],
    cells,
    turn: { number: 1, activePlayerId: P1 },
    lastPlacementByPlayer: { [P1]: null, [P2]: null },
    winnerPlayerIds: [],
    ...overrides,
  });
}

export const emptyBoard = ['.....', '.....', '.....', '.....', '.....'];

export function at(row: number, col: number): Position {
  return { row, col };
}

export function ownerAt(state: GridClaimState, position: Position): Cell {
  return state.cells[toIndex(state.size, position)] ?? null;
}

export function context(actorPlayerId: string) {
  return { actorPlayerId, requestId: 'req', now: '2000-01-01T00:00:00.000Z' };
}
