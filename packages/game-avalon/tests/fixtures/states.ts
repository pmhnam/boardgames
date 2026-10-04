import { expect } from 'vitest';
import { deepFreeze, seats } from '@bgp/game-core/testing';
import type { AvalonAction } from '../../src/domain/actions.js';
import { getRolesInPlay } from '../../src/domain/game-config.js';
import type { OptionalRole, Role } from '../../src/domain/roles.js';
import type { AvalonState } from '../../src/domain/state.js';
import { AvalonGame } from '../../src/index.js';
import { getLeaderId } from '../../src/rules/table.rules.js';

export const engine = AvalonGame.engine;
export const gameConfig = engine.defaultConfig;

export function context(actorPlayerId: string) {
  return { actorPlayerId, requestId: 'req', now: '2000-01-01T00:00:00.000Z' };
}

/** A fresh game exactly as the engine deals it, frozen so mutation fails loudly. */
export function newGame(
  options: { seed?: string; players?: number; roles?: OptionalRole[]; lady?: boolean } = {},
): AvalonState {
  return deepFreeze(
    engine.createInitialState({
      gameId: 'g',
      players: seats(options.players ?? 5),
      seed: options.seed ?? 'fixture',
      config: gameConfig,
      settings: { roles: options.roles ?? [], ladyOfTheLake: options.lady ?? false },
    }),
  );
}

/**
 * A fresh game with nothing left to the shuffle: p1 leads first and the roles are dealt in
 * seat order, good first. At five players that is Merlin, two Loyal Servants, the Assassin and
 * a Minion. With the Lady in play, the last seat holds her.
 */
export function table(
  options: { players?: number; roles?: OptionalRole[]; lady?: boolean; dealt?: Role[] } = {},
): AvalonState {
  const state = newGame(options);
  const dealt =
    options.dealt ?? getRolesInPlay(state.seatOrder.length, options.roles ?? [], gameConfig);
  if (!dealt || dealt.length !== state.seatOrder.length) throw new Error('Roles do not fit');
  const lastSeat = state.seatOrder.at(-1) as string;
  return deepFreeze({
    ...state,
    firstLeaderIndex: 0,
    roles: Object.fromEntries(state.seatOrder.map((playerId, seat) => [playerId, dealt[seat]])),
    lady: state.lady && { holderId: lastSeat, inspections: [] },
  }) as AvalonState;
}

export function leader(state: AvalonState): string {
  return getLeaderId(state);
}

export function withRole(state: AvalonState, role: Role): string[] {
  return state.seatOrder.filter((playerId) => state.roles[playerId] === role);
}

export function apply(state: AvalonState, action: AvalonAction, playerId: string): AvalonState {
  return deepFreeze(engine.applyAction(state, action, context(playerId)));
}

export function validate(state: AvalonState, action: AvalonAction, playerId: string) {
  return engine.validateAction(state, action, context(playerId));
}

/** The leader proposes: the first seats by default. */
export function propose(state: AvalonState, team?: string[]): AvalonState {
  const size = state.rules.teamSizes[state.quests.length] as number;
  return apply(
    state,
    { type: 'PROPOSE_TEAM', team: team ?? state.seatOrder.slice(0, size) },
    leader(state),
  );
}

/** Everyone votes, in seat order. Those listed reject; pass `true` to have everyone reject. */
export function vote(state: AvalonState, rejecting: string[] | boolean = []): AvalonState {
  const proposal = state.proposals.length;
  return state.seatOrder.reduce((current, playerId) => {
    const approve =
      rejecting === true ? false : rejecting === false || !rejecting.includes(playerId);
    return apply(current, { type: 'VOTE', proposal, approve }, playerId);
  }, state);
}

/** Every team member plays a card, in seat order. Those listed play Fail. */
export function playQuest(state: AvalonState, failing: string[] = []): AvalonState {
  const quest = state.quests.length;
  return (state.current.team ?? []).reduce(
    (current, playerId) =>
      apply(
        current,
        { type: 'PLAY_QUEST_CARD', quest, success: !failing.includes(playerId) },
        playerId,
      ),
    state,
  );
}

/** A whole quest: proposed, approved by all and played. */
export function runQuest(
  state: AvalonState,
  options: { team?: string[]; failing?: string[] } = {},
): AvalonState {
  return playQuest(vote(propose(state, options.team)), options.failing);
}

/** An illegal action must be refused by the validator and by the reducer, with the same code. */
export function expectRejected(
  state: AvalonState,
  action: AvalonAction,
  code: string,
  playerId: string,
): void {
  expect(validate(state, action, playerId)).toMatchObject({ valid: false, code });
  expect(() => engine.applyAction(state, action, context(playerId))).toThrowError(
    expect.objectContaining({ code }),
  );
}
