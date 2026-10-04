import type { WerewolfActionType } from '../domain/actions.js';
import { ROLES, isWolf } from '../domain/roles.js';
import type { PlayerState, WerewolfState } from '../domain/state.js';
import { getAliveIds, hasPower } from './players.js';

/** What one player may do right now. The validator, the views and the bots all read this. */
export interface LegalMoves {
  /** The one kind of action this player owes, or null when there is nothing for them to do. */
  action: WerewolfActionType | null;
  /** Who that action may name. For a witch, who she may poison. */
  targets: string[];
  /** Whether naming nobody is allowed: a vote to spare everyone, a hunter holding fire. */
  canSkip: boolean;
  /** Whether a witch may save tonight's victim. */
  canHeal: boolean;
}

const NOTHING: LegalMoves = { action: null, targets: [], canSkip: false, canHeal: false };

function move(action: WerewolfActionType, patch: Partial<LegalMoves> = {}): LegalMoves {
  return { ...NOTHING, action, ...patch };
}

function others(state: WerewolfState, playerId: string): string[] {
  return getAliveIds(state).filter((id) => id !== playerId);
}

/** Every living player owes one action in the main step, so that acting gives no role away. */
function getMainStepMoves(state: WerewolfState, playerId: string, player: PlayerState): LegalMoves {
  const duty = hasPower(state, player) ? ROLES[player.role].nightDuty : null;
  if (duty === 'WOLF_VOTE') {
    const prey = getAliveIds(state).filter((id) => !isWolf(state.players[id]?.role ?? 'villager'));
    return move('WOLF_VOTE', { targets: prey });
  }
  if (duty === 'SEER_INSPECT') return move('SEER_INSPECT', { targets: others(state, playerId) });
  if (duty === 'GUARD_PROTECT') {
    const targets = getAliveIds(state).filter(
      (id) =>
        id !== player.lastProtectedId && (id !== playerId || state.setup.rules.guardCanProtectSelf),
    );
    if (targets.length > 0) return move('GUARD_PROTECT', { targets });
  }
  return move('SLEEP');
}

function getWitchMoves(state: WerewolfState, playerId: string, player: PlayerState): LegalMoves {
  if (player.role !== 'witch' || !hasPower(state, player)) return NOTHING;
  if (player.healUsed && player.poisonUsed) return NOTHING;
  const attackedId = state.night?.attackedId ?? null;
  return move('WITCH_DECIDE', {
    targets: player.poisonUsed ? [] : others(state, playerId),
    canSkip: true,
    canHeal:
      !player.healUsed &&
      attackedId !== null &&
      (attackedId !== playerId || state.setup.rules.witchCanHealSelf),
  });
}

function getNightMoves(state: WerewolfState, playerId: string, player: PlayerState): LegalMoves {
  const night = state.night;
  if (!night || !player.alive || night.acted.includes(playerId)) return NOTHING;
  if (night.step === 'CUPID') {
    return player.role === 'cupid' ? move('CUPID_LINK', { targets: getAliveIds(state) }) : NOTHING;
  }
  if (night.step === 'MAIN') return getMainStepMoves(state, playerId, player);
  return getWitchMoves(state, playerId, player);
}

export function getLegalMoves(state: WerewolfState, playerId: string): LegalMoves {
  const player = state.players[playerId];
  if (!player) return NOTHING;

  if (state.phase === 'NIGHT') return getNightMoves(state, playerId, player);
  if (state.phase === 'DAY_DISCUSSION') {
    return player.alive && !state.day?.ready.includes(playerId) ? move('READY_TO_VOTE') : NOTHING;
  }
  if (state.phase === 'DAY_VOTE') {
    const voted = state.day !== null && playerId in state.day.votes;
    return player.alive && player.canVote && !voted
      ? move('CAST_VOTE', { targets: others(state, playerId), canSkip: true })
      : NOTHING;
  }
  if (state.phase === 'HUNTER_SHOT') {
    // The hunter is already dead: everyone still standing is a target.
    return state.pendingHunters[0] === playerId
      ? move('HUNTER_SHOOT', { targets: getAliveIds(state), canSkip: true })
      : NOTHING;
  }
  return NOTHING;
}

/** Who the match is waiting on, in seat order. */
export function getOwingPlayerIds(state: WerewolfState): string[] {
  return state.seatOrder.filter((playerId) => getLegalMoves(state, playerId).action !== null);
}
