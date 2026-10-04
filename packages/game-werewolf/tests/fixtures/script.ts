import { createSeededRandom } from '@bgp/game-core';
import { deepFreeze, seats, type ScriptedAction } from '@bgp/game-core/testing';
import type { WerewolfAction } from '../../src/domain/actions.js';
import type { WerewolfConfig, WerewolfSettings } from '../../src/domain/game-config.js';
import type { LegalMoves } from '../../src/rules/legal-moves.js';
import { asPlayer, context, engine } from './states.js';

/** Every action a player's `legal` allows, spelled out. */
export function listLegalActions(legal: LegalMoves): WerewolfAction[] {
  const { targets } = legal;
  const orNobody: Array<string | null> = legal.canSkip ? [...targets, null] : [...targets];
  switch (legal.action) {
    case null:
      return [];
    case 'SLEEP':
    case 'READY_TO_VOTE':
      return [{ type: legal.action }];
    case 'WOLF_VOTE':
    case 'SEER_INSPECT':
    case 'GUARD_PROTECT': {
      const type = legal.action;
      return targets.map((targetId) => ({ type, targetId }));
    }
    case 'CAST_VOTE':
    case 'HUNTER_SHOOT': {
      const type = legal.action;
      return orNobody.map((targetId) => ({ type, targetId }));
    }
    case 'CUPID_LINK':
      return targets.flatMap((firstId) =>
        targets
          .filter((secondId) => secondId !== firstId)
          .map((secondId) => ({ type: 'CUPID_LINK' as const, firstId, secondId })),
      );
    case 'WITCH_DECIDE':
      return [false, ...(legal.canHeal ? [true] : [])].flatMap((heal) =>
        orNobody.map((poisonTargetId) => ({ type: 'WITCH_DECIDE' as const, heal, poisonTargetId })),
      );
  }
}

/** Every action a client could send in a match with these players, legal or not. */
export function listEveryAction(playerIds: readonly string[]): WerewolfAction[] {
  const orNobody: Array<string | null> = [...playerIds, null];
  return [
    { type: 'SLEEP' },
    { type: 'READY_TO_VOTE' },
    ...playerIds.flatMap((targetId): WerewolfAction[] => [
      { type: 'WOLF_VOTE', targetId },
      { type: 'SEER_INSPECT', targetId },
      { type: 'GUARD_PROTECT', targetId },
    ]),
    ...orNobody.flatMap((targetId): WerewolfAction[] => [
      { type: 'CAST_VOTE', targetId },
      { type: 'HUNTER_SHOOT', targetId },
      { type: 'WITCH_DECIDE', heal: false, poisonTargetId: targetId },
      { type: 'WITCH_DECIDE', heal: true, poisonTargetId: targetId },
    ]),
    ...playerIds.flatMap((firstId) =>
      playerIds.map((secondId): WerewolfAction => ({ type: 'CUPID_LINK', firstId, secondId })),
    ),
  ];
}

/**
 * Writes a whole game by picking legal moves at random from each player's own view. Whoever
 * the match waits on acts in a random order, as they would around a real table.
 */
export function scriptFullGame(
  seed: string,
  playerCount: number,
  config: WerewolfConfig = engine.defaultConfig,
  settings?: WerewolfSettings,
): ScriptedAction<WerewolfAction>[] {
  const parsed = engine.parseSettings(settings, config);
  if (!parsed.ok) throw new Error(parsed.message);
  const random = createSeededRandom(`script-${seed}`);
  let state = deepFreeze(
    engine.createInitialState({
      gameId: 'test-game',
      players: seats(playerCount),
      seed,
      config,
      settings: parsed.settings,
    }),
  );

  const script: ScriptedAction<WerewolfAction>[] = [];
  while (engine.getGameStatus(state) === 'playing') {
    if (script.length > 5000) throw new Error('Scripted game did not end');
    const playerId = random.pick(engine.getCurrentPlayerIds(state));
    const me = engine.getPublicView(state, asPlayer(playerId)).me;
    if (!me) throw new Error('A seated player has no view of their own');
    const action = random.pick(listLegalActions(me.legal));
    script.push({ playerId, action });
    state = deepFreeze(engine.applyAction(state, action, context(playerId)));
  }
  return script;
}
