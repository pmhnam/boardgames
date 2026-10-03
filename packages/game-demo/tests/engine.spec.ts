import { describe, expect, it } from 'vitest';
import { runMatch, seats, type ScriptedAction } from '@bgp/game-core/testing';
import { BLOCKED, GridClaimGame, GridClaimRuleCodes, type GridClaimAction } from '../src/index.js';
import { getLegalPositions } from '../src/rules/placement.rules.js';
import { P1, P2, at, context, stateFromBoard } from './fixtures/states.js';

const engine = GridClaimGame.engine;
const place = (row: number, col: number): GridClaimAction => ({
  type: 'PLACE_PIECE',
  position: at(row, col),
});

/** Plays a full game where every player always takes their first legal cell. */
function scriptFullGame(seed: string): ScriptedAction<GridClaimAction>[] {
  const script: ScriptedAction<GridClaimAction>[] = [];
  let state = engine.createInitialState({
    gameId: 'g',
    players: seats(2),
    seed,
    config: engine.defaultConfig,
  });
  while (engine.getGameStatus(state) === 'playing') {
    const playerId = state.turn.activePlayerId;
    const position = getLegalPositions(state, playerId)[0];
    if (!position) throw new Error('active player has no legal move');
    const action: GridClaimAction = { type: 'PLACE_PIECE', position };
    script.push({ playerId, action });
    state = engine.applyAction(state, action, context(playerId));
  }
  return script;
}

describe('createInitialState', () => {
  it('is deterministic for a seed', () => {
    const input = {
      gameId: 'g',
      players: seats(2),
      seed: 'match-123',
      config: engine.defaultConfig,
    };
    expect(engine.createInitialState(input)).toEqual(engine.createInitialState(input));
  });

  it('varies with the seed', () => {
    const boards = new Set(
      ['a', 'b', 'c', 'd', 'e'].map((seed) =>
        JSON.stringify(
          engine.createInitialState({
            gameId: 'g',
            players: seats(2),
            seed,
            config: engine.defaultConfig,
          }).cells,
        ),
      ),
    );
    expect(boards.size).toBeGreaterThan(1);
  });

  it('sets up a 5x5 board with three blocked cells and a valid first player', () => {
    const state = engine.createInitialState({
      gameId: 'g',
      players: seats(2),
      seed: 's',
      config: engine.defaultConfig,
    });
    expect(state.cells).toHaveLength(25);
    expect(state.cells.filter((cell) => cell === BLOCKED)).toHaveLength(3);
    expect(state.playerIds).toContain(state.turn.activePlayerId);
    expect(engine.getGameStatus(state)).toBe('playing');
    expect(engine.getResult(state)).toBeNull();
  });

  it('rejects a wrong player count', () => {
    expect(() =>
      engine.createInitialState({
        gameId: 'g',
        players: seats(3),
        seed: 's',
        config: engine.defaultConfig,
      }),
    ).toThrow();
  });
});

describe('config', () => {
  it('sets up the board the config describes', () => {
    const state = engine.createInitialState({
      gameId: 'g',
      players: seats(2),
      seed: 's',
      config: { boardSize: 4, blockedCellCount: 1, targetScore: 6 },
    });
    expect(state.size).toBe(4);
    expect(state.cells).toHaveLength(16);
    expect(state.cells.filter((cell) => cell === BLOCKED)).toHaveLength(1);
    expect(state.targetScore).toBe(6);
  });

  it('accepts its own default and drops unknown fields', () => {
    expect(engine.parseConfig({ ...engine.defaultConfig, extra: 1 })).toEqual({
      ok: true,
      config: engine.defaultConfig,
    });
  });

  it.each([
    null,
    {},
    { boardSize: 2, blockedCellCount: 0, targetScore: 5 },
    { boardSize: 5, blockedCellCount: 24, targetScore: 5 },
    { boardSize: 5, blockedCellCount: 3, targetScore: 0 },
    { boardSize: 5.5, blockedCellCount: 3, targetScore: 10 },
  ])('rejects %j', (raw) => {
    expect(engine.parseConfig(raw).ok).toBe(false);
  });
});

describe('end of game', () => {
  it('finishes when the mover reaches the target score', () => {
    // P1 has a 2x2 square (8). Adding (0,2) gives 5 pieces + 5 pairs = 10.
    const state = stateFromBoard(['11...', '11...', '.....', '...22', '...22']);
    const next = engine.applyAction(state, place(0, 2), context(P1));

    expect(engine.getGameStatus(next)).toBe('finished');
    expect(next.winnerPlayerIds).toEqual([P1]);
    expect(engine.getCurrentPlayerIds(next)).toEqual([]);
    expect(engine.getResult(next)).toEqual({
      winnerPlayerIds: [P1],
      scores: { [P1]: 10, [P2]: 8 },
    });
  });

  it('finishes when the next player cannot move, highest score wins', () => {
    const state = stateFromBoard(['1#2##', '#####', '#####', '#####', '####.'], {
      turn: { number: 3, activePlayerId: P1 },
    });
    // P1 takes the last free cell; P2 then has no legal placement. Scores: 2 vs 1.
    const next = engine.applyAction(state, place(4, 4), context(P1));
    expect(next.phase).toBe('FINISHED');
    expect(next.winnerPlayerIds).toEqual([P1]);
  });

  it('shares the win when nobody can move and scores are level', () => {
    const state = stateFromBoard(['1#2##', '#####', '##2##', '#####', '####.'], {
      turn: { number: 4, activePlayerId: P1 },
    });
    expect(engine.applyAction(state, place(4, 4), context(P1)).winnerPlayerIds).toEqual([P1, P2]);
  });

  it('rejects actions once finished', () => {
    const state = stateFromBoard(['11...', '11...', '.....', '.....', '.....'], {
      phase: 'FINISHED',
      winnerPlayerIds: [P1],
    });
    expect(engine.validateAction(state, place(4, 4), context(P1))).toMatchObject({
      valid: false,
      code: GridClaimRuleCodes.GameNotPlaying,
    });
  });
});

describe('public view', () => {
  it('only offers legal positions to the active player', () => {
    const state = stateFromBoard(['.....', '.....', '.....', '.....', '.....']);
    const active = engine.getPublicView(state, { type: 'player', playerId: P1 });
    const waiting = engine.getPublicView(state, { type: 'player', playerId: P2 });
    const spectator = engine.getPublicView(state, { type: 'spectator' });

    expect(active.legalPositions).toHaveLength(25);
    expect(waiting.legalPositions).toEqual([]);
    expect(spectator.legalPositions).toEqual([]);
    expect(spectator.scores).toEqual({ [P1]: 0, [P2]: 0 });
  });
});

describe('full matches', () => {
  const seeds = ['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta'];

  it.each(seeds)('replays identically from seed + actions (%s)', (seed) => {
    const actions = scriptFullGame(seed);
    const first = runMatch(engine, { seed, players: seats(2), actions });
    const second = runMatch(engine, { seed, players: seats(2), actions });

    expect(first).toEqual(second);
    expect(engine.getGameStatus(first)).toBe('finished');
    expect(first.winnerPlayerIds.length).toBeGreaterThan(0);
  });

  it.each(seeds)('keeps invariants on every step (%s)', (seed) => {
    let state = engine.createInitialState({
      gameId: 'g',
      players: seats(2),
      seed,
      config: engine.defaultConfig,
    });
    let pieces = 0;

    for (const step of scriptFullGame(seed)) {
      expect(state.playerIds).toContain(state.turn.activePlayerId);
      const previousTurn = state.turn.number;
      state = engine.applyAction(state, step.action, context(step.playerId));
      pieces += 1;

      expect(state.cells).toHaveLength(25);
      expect(state.cells.filter((cell) => cell === BLOCKED)).toHaveLength(3);
      expect(state.cells.filter((cell) => cell !== null && cell !== BLOCKED)).toHaveLength(pieces);
      expect(state.turn.number).toBeGreaterThanOrEqual(previousTurn);
      const view = engine.getPublicView(state, { type: 'spectator' });
      for (const score of Object.values(view.scores)) expect(Number.isFinite(score)).toBe(true);
    }
  });
});
