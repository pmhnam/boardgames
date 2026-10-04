import { expect } from 'vitest';
import { deepFreeze, seats } from '@bgp/game-core/testing';
import type { WerewolfAction } from '../../src/domain/actions.js';
import {
  fillSpecialRoles,
  type WerewolfConfig,
  type WerewolfSettings,
} from '../../src/domain/game-config.js';
import { SPECIAL_ROLE_IDS, type RoleId, type SpecialRoleCounts } from '../../src/domain/roles.js';
import type { WerewolfState } from '../../src/domain/state.js';
import { WerewolfGame } from '../../src/index.js';

export const engine = WerewolfGame.engine;
export const gameConfig = engine.defaultConfig;

export const SPECTATOR = { type: 'spectator' } as const;
export const ADMIN = { type: 'admin' } as const;

export function asPlayer(playerId: string) {
  return { type: 'player', playerId } as const;
}

export function context(actorPlayerId: string) {
  return { actorPlayerId, requestId: 'req', now: '2000-01-01T00:00:00.000Z' };
}

/** A config that differs from the default only in what a test cares about. */
export function configWith(patch: {
  rules?: Partial<WerewolfConfig['rules']>;
  roles?: Partial<WerewolfConfig['roles']>;
}): WerewolfConfig {
  return {
    ...gameConfig,
    rules: { ...gameConfig.rules, ...patch.rules },
    roles: { ...gameConfig.roles, ...patch.roles },
  };
}

export function countSpecialRoles(roles: readonly RoleId[]): SpecialRoleCounts {
  const counts = fillSpecialRoles({});
  for (const role of SPECIAL_ROLE_IDS)
    counts[role] = roles.filter((dealt) => dealt === role).length;
  return counts;
}

export function customSettings(
  roles: Partial<SpecialRoleCounts>,
  revealRoleOnDeath = true,
): WerewolfSettings {
  return { preset: 'custom', roles: fillSpecialRoles(roles), revealRoleOnDeath };
}

/**
 * A fresh game in which seat N plays `roles[N]` (so `p1` plays the first). The deal is
 * replaced after setup, so a test never depends on what a seed happens to shuffle.
 */
export function newGame(
  roles: readonly RoleId[],
  options: { config?: WerewolfConfig; revealRoleOnDeath?: boolean } = {},
): WerewolfState {
  const config = options.config ?? gameConfig;
  const state = engine.createInitialState({
    gameId: 'g',
    players: seats(roles.length),
    seed: 'fixture',
    config,
    settings: customSettings(countSpecialRoles(roles), options.revealRoleOnDeath ?? true),
  });
  const players = { ...state.players };
  state.seatOrder.forEach((playerId, index) => {
    const role = roles[index] ?? 'villager';
    const player = players[playerId];
    if (!player) throw new Error(`Unknown player ${playerId}`);
    players[playerId] = {
      ...player,
      role,
      extraLives: role === 'elder' ? config.rules.elderExtraLives : 0,
    };
  });
  return deepFreeze({ ...state, players });
}

export function apply(state: WerewolfState, action: WerewolfAction, playerId: string) {
  return deepFreeze(engine.applyAction(state, action, context(playerId)));
}

export function validate(state: WerewolfState, action: WerewolfAction, playerId: string) {
  return engine.validateAction(state, action, context(playerId));
}

/** An illegal action must be refused by the validator and by the reducer, with the same code. */
export function expectRejected(
  state: WerewolfState,
  action: WerewolfAction,
  code: string,
  playerId: string,
): void {
  expect(validate(state, action, playerId)).toMatchObject({ valid: false, code });
  expect(() => engine.applyAction(state, action, context(playerId))).toThrowError(
    expect.objectContaining({ code }),
  );
}

export function legalFor(state: WerewolfState, playerId: string) {
  const me = engine.getPublicView(state, asPlayer(playerId)).me;
  if (!me) throw new Error(`${playerId} has no view of their own`);
  return me.legal;
}

export interface NightChoices {
  /** Who every werewolf votes to attack. */
  attack?: string;
  inspect?: string;
  protect?: string;
  heal?: boolean;
  poison?: string | null;
  couple?: [string, string];
}

/**
 * Plays a whole night: everyone the match waits on does their part, with these choices where
 * a test cares and the first legal target where it does not.
 */
export function playNight(
  state: WerewolfState,
  choices: NightChoices = {},
  until: 'dawn' | 'witch' = 'dawn',
): WerewolfState {
  let current = state;
  while (current.phase === 'NIGHT' && !(until === 'witch' && current.night?.step === 'WITCH')) {
    const playerId = engine.getCurrentPlayerIds(current)[0];
    if (playerId === undefined) throw new Error('The night is waiting on nobody');
    const legal = legalFor(current, playerId);
    const first = legal.targets[0] ?? '';
    const second = legal.targets[1] ?? '';
    const actions: Partial<Record<WerewolfAction['type'], WerewolfAction>> = {
      SLEEP: { type: 'SLEEP' },
      WOLF_VOTE: { type: 'WOLF_VOTE', targetId: choices.attack ?? first },
      SEER_INSPECT: { type: 'SEER_INSPECT', targetId: choices.inspect ?? first },
      GUARD_PROTECT: { type: 'GUARD_PROTECT', targetId: choices.protect ?? first },
      WITCH_DECIDE: {
        type: 'WITCH_DECIDE',
        heal: choices.heal ?? false,
        poisonTargetId: choices.poison ?? null,
      },
      CUPID_LINK: {
        type: 'CUPID_LINK',
        firstId: choices.couple?.[0] ?? first,
        secondId: choices.couple?.[1] ?? second,
      },
    };
    const action = legal.action === null ? undefined : actions[legal.action];
    if (!action) throw new Error(`Nothing scripted for ${String(legal.action)}`);
    current = apply(current, action, playerId);
  }
  return current;
}

/** Plays a night up to the moment the witch is woken. */
export function playUntilWitch(state: WerewolfState, choices: NightChoices = {}): WerewolfState {
  return playNight(state, choices, 'witch');
}

/** Everyone alive says they are done talking, until the vote opens. */
export function openVote(state: WerewolfState): WerewolfState {
  let current = state;
  while (current.phase === 'DAY_DISCUSSION') {
    const playerId = engine.getCurrentPlayerIds(current)[0];
    if (playerId === undefined) throw new Error('The discussion is waiting on nobody');
    current = apply(current, { type: 'READY_TO_VOTE' }, playerId);
  }
  return current;
}

/**
 * Plays a whole day. Everyone votes for `targetId` (the target, who cannot vote for
 * themselves, votes to spare everyone) unless `votes` says otherwise for them.
 */
export function playDay(
  state: WerewolfState,
  targetId: string | null,
  votes: Record<string, string | null> = {},
): WerewolfState {
  let current = openVote(state);
  while (current.phase === 'DAY_VOTE') {
    const voterId = engine.getCurrentPlayerIds(current)[0];
    if (voterId === undefined) throw new Error('The vote is waiting on nobody');
    const choice = voterId in votes ? (votes[voterId] ?? null) : targetId;
    current = apply(
      current,
      { type: 'CAST_VOTE', targetId: choice === voterId ? null : choice },
      voterId,
    );
  }
  return current;
}

export function alive(state: WerewolfState): string[] {
  return state.seatOrder.filter((playerId) => state.players[playerId]?.alive);
}

export function lastLog(state: WerewolfState) {
  const entry = state.log.at(-1);
  if (!entry) throw new Error('Nothing has been logged');
  return entry;
}
