import { GameRuleError, type GameActionContext } from '@bgp/game-core';
import type { WerewolfAction } from '../domain/actions.js';
import { isWolf } from '../domain/roles.js';
import type { NightState, WerewolfState } from '../domain/state.js';
import { advanceDiscussion, advanceNight, advanceVote, resolveShot } from '../rules/flow.rules.js';
import { getPlayer, updatePlayer } from '../rules/players.js';
import { validateAction } from './validate-action.js';

/** Records one player's part in the night, then moves the night on if it was the last. */
function actAtNight(
  state: WerewolfState,
  playerId: string,
  record: (night: NightState) => Partial<NightState> = () => ({}),
): WerewolfState {
  const night = state.night;
  if (!night) return state;
  return advanceNight({
    ...state,
    night: { ...night, ...record(night), acted: [...night.acted, playerId] },
  });
}

export function applyAction(
  state: WerewolfState,
  action: WerewolfAction,
  context: GameActionContext,
): WerewolfState {
  const validation = validateAction(state, action, context);
  if (!validation.valid) throw new GameRuleError(validation.code, validation.message);

  const playerId = context.actorPlayerId;
  switch (action.type) {
    case 'CUPID_LINK':
      return actAtNight({ ...state, lovers: [action.firstId, action.secondId] }, playerId);

    case 'WOLF_VOTE':
      return actAtNight(state, playerId, (night) => ({
        wolfVotes: { ...night.wolfVotes, [playerId]: action.targetId },
      }));

    case 'SEER_INSPECT': {
      const seer = getPlayer(state, playerId);
      const inspection = {
        round: state.round,
        targetId: action.targetId,
        isWolf: isWolf(getPlayer(state, action.targetId).role),
      };
      return actAtNight(
        updatePlayer(state, playerId, { inspections: [...seer.inspections, inspection] }),
        playerId,
      );
    }

    case 'GUARD_PROTECT':
      return actAtNight(
        updatePlayer(state, playerId, { lastProtectedId: action.targetId }),
        playerId,
        (night) => ({ protections: { ...night.protections, [playerId]: action.targetId } }),
      );

    case 'SLEEP':
      return actAtNight(state, playerId);

    case 'WITCH_DECIDE': {
      const witch = getPlayer(state, playerId);
      const poisonTargetId = action.poisonTargetId;
      const used = updatePlayer(state, playerId, {
        healUsed: witch.healUsed || action.heal,
        poisonUsed: witch.poisonUsed || poisonTargetId !== null,
      });
      return actAtNight(used, playerId, (night) => ({
        healed: night.healed || action.heal,
        poisons:
          poisonTargetId === null
            ? night.poisons
            : { ...night.poisons, [playerId]: poisonTargetId },
      }));
    }

    case 'READY_TO_VOTE': {
      const day = state.day;
      if (!day) return state;
      return advanceDiscussion({ ...state, day: { ...day, ready: [...day.ready, playerId] } });
    }

    case 'CAST_VOTE': {
      const day = state.day;
      if (!day) return state;
      return advanceVote({
        ...state,
        day: { ...day, votes: { ...day.votes, [playerId]: action.targetId } },
      });
    }

    case 'HUNTER_SHOOT':
      return resolveShot(state, action.targetId);
  }
}
