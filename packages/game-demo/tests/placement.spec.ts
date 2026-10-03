import { describe, expect, it } from 'vitest';
import { GridClaimGame, GridClaimRuleCodes } from '../src/index.js';
import { getLegalPositions } from '../src/rules/placement.rules.js';
import { P1, P2, at, context, emptyBoard, ownerAt, stateFromBoard } from './fixtures/states.js';

const engine = GridClaimGame.engine;
const place = (row: number, col: number) => ({
  type: 'PLACE_PIECE' as const,
  position: at(row, col),
});

function expectRejected(
  state: Parameters<typeof engine.validateAction>[0],
  action: ReturnType<typeof place>,
  playerId: string,
  code: string,
) {
  const result = engine.validateAction(state, action, context(playerId));
  expect(result).toMatchObject({ valid: false, code });
  expect(() => engine.applyAction(state, action, context(playerId))).toThrowError(
    expect.objectContaining({ code }),
  );
}

describe('PLACE_PIECE', () => {
  it('rejects placement outside the board', () => {
    const state = stateFromBoard(emptyBoard);
    expectRejected(state, place(5, 0), P1, GridClaimRuleCodes.InvalidPosition);
    expectRejected(state, place(0, -1), P1, GridClaimRuleCodes.InvalidPosition);
  });

  it("rejects another player's turn", () => {
    const state = stateFromBoard(emptyBoard);
    expectRejected(state, place(0, 0), P2, GridClaimRuleCodes.NotYourTurn);
  });

  it('rejects a blocked cell', () => {
    const state = stateFromBoard(['#....', '.....', '.....', '.....', '.....']);
    expectRejected(state, place(0, 0), P1, GridClaimRuleCodes.CellBlocked);
  });

  it('rejects an occupied cell', () => {
    const state = stateFromBoard(['2....', '.....', '.....', '.....', '.....']);
    expectRejected(state, place(0, 0), P1, GridClaimRuleCodes.CellOccupied);
  });

  it("rejects a cell next to the opponent's last piece", () => {
    const state = stateFromBoard(['.....', '.....', '..2..', '.....', '.....'], {
      lastPlacementByPlayer: { [P1]: null, [P2]: at(2, 2) },
    });
    expectRejected(state, place(2, 3), P1, GridClaimRuleCodes.AdjacentToOpponentLastPiece);
    expectRejected(state, place(1, 2), P1, GridClaimRuleCodes.AdjacentToOpponentLastPiece);
    // Diagonals are fine.
    expect(engine.validateAction(state, place(1, 1), context(P1))).toEqual({ valid: true });
  });

  it("allows a cell next to the opponent's older pieces", () => {
    const state = stateFromBoard(['2....', '.....', '..2..', '.....', '.....'], {
      lastPlacementByPlayer: { [P1]: null, [P2]: at(2, 2) },
    });
    expect(engine.validateAction(state, place(0, 1), context(P1))).toEqual({ valid: true });
  });

  it('places a piece on a valid cell and passes the turn', () => {
    const state = stateFromBoard(emptyBoard);
    const next = engine.applyAction(state, place(1, 1), context(P1));

    expect(ownerAt(next, at(1, 1))).toBe(P1);
    expect(next.lastPlacementByPlayer[P1]).toEqual(at(1, 1));
    expect(next.turn).toEqual({ number: 2, activePlayerId: P2 });
    expect(next.phase).toBe('PLAYING');
  });

  it('does not mutate the previous state', () => {
    const state = stateFromBoard(emptyBoard);
    const snapshot = JSON.parse(JSON.stringify(state));
    engine.applyAction(state, place(1, 1), context(P1));
    expect(state).toEqual(snapshot);
  });

  it('lists exactly the cells that validate', () => {
    const state = stateFromBoard(['#1...', '.....', '..2..', '.....', '.....'], {
      lastPlacementByPlayer: { [P1]: at(0, 1), [P2]: at(2, 2) },
    });
    // 25 cells - 1 blocked - 2 occupied - 4 next to P2's last piece.
    expect(getLegalPositions(state, P1)).toHaveLength(18);
  });
});

describe('parseAction', () => {
  it('accepts a well-formed action and drops unknown fields', () => {
    const result = engine.parseAction({
      type: 'PLACE_PIECE',
      position: { row: 1, col: 2, extra: true },
      scoreAfterMove: 99,
      nextPlayerId: P1,
    });
    expect(result).toEqual({ ok: true, action: { type: 'PLACE_PIECE', position: at(1, 2) } });
  });

  it.each([
    null,
    'PLACE_PIECE',
    {},
    { type: 'UNKNOWN' },
    { type: 'PLACE_PIECE' },
    { type: 'PLACE_PIECE', position: { row: '1', col: 2 } },
    { type: 'PLACE_PIECE', position: { row: 1.5, col: 2 } },
  ])('rejects malformed payload %j', (raw) => {
    expect(engine.parseAction(raw).ok).toBe(false);
  });
});
