import type { LogEntry, NightState, WerewolfState } from '../domain/state.js';
import { killPlayers } from './death.rules.js';
import { getOwingPlayerIds } from './legal-moves.js';
import { getPlayer, updatePlayer } from './players.js';
import { tallyVillageVote, tallyWolfVote } from './vote.rules.js';
import { findWinner, getWinnerPlayerIds } from './win.rules.js';

function emptyNight(step: NightState['step']): NightState {
  return {
    step,
    acted: [],
    wolfVotes: {},
    protections: {},
    attackedId: null,
    healed: false,
    poisons: {},
  };
}

function addLog(state: WerewolfState, entry: LogEntry): WerewolfState {
  return { ...state, log: [...state.log, entry] };
}

/** Night falls. Cupid goes first on the opening night; otherwise everyone acts at once. */
export function startNight(state: WerewolfState): WerewolfState {
  const night: WerewolfState = {
    ...state,
    phase: 'NIGHT',
    night: emptyNight('CUPID'),
    day: null,
    afterShots: null,
  };
  if (state.round === 1 && getOwingPlayerIds(night).length > 0) return night;
  return { ...night, night: emptyNight('MAIN') };
}

function startDay(state: WerewolfState): WerewolfState {
  return {
    ...state,
    phase: 'DAY_DISCUSSION',
    night: null,
    day: { ready: [], votes: {} },
    afterShots: null,
  };
}

/**
 * Where the match goes after people have died. Hunters fire before anyone is declared the
 * winner: a last shot can still turn the result.
 */
export function settle(state: WerewolfState, next: 'DAY_DISCUSSION' | 'NIGHT'): WerewolfState {
  if (state.pendingHunters.length > 0) {
    return { ...state, phase: 'HUNTER_SHOT', night: null, day: null, afterShots: next };
  }
  const winner = findWinner(state);
  if (winner !== null) {
    return {
      ...state,
      phase: 'FINISHED',
      night: null,
      day: null,
      afterShots: null,
      winner,
      winnerPlayerIds: getWinnerPlayerIds(state, winner),
    };
  }
  return next === 'NIGHT' ? startNight({ ...state, round: state.round + 1 }) : startDay(state);
}

/** Dawn: the attack lands unless something stopped it, the poison always does. */
function resolveNight(state: WerewolfState, night: NightState): WerewolfState {
  let spared = state;
  const victims: string[] = [];

  const attackedId = night.attackedId;
  if (attackedId !== null) {
    const guarded = Object.values(night.protections).includes(attackedId);
    const target = getPlayer(state, attackedId);
    if (guarded || night.healed) {
      // Saved by someone else: an elder keeps their own protection for another night.
    } else if (target.extraLives > 0) {
      spared = updatePlayer(state, attackedId, { extraLives: target.extraLives - 1 });
    } else {
      victims.push(attackedId);
    }
  }
  victims.push(...Object.values(night.poisons));

  const { state: after, deaths } = killPlayers(spared, victims);
  return settle(addLog(after, { type: 'NIGHT', round: state.round, deaths }), 'DAY_DISCUSSION');
}

/** Moves the night on once everyone the current step was waiting for has acted. */
export function advanceNight(state: WerewolfState): WerewolfState {
  const night = state.night;
  if (!night || getOwingPlayerIds(state).length > 0) return state;

  if (night.step === 'CUPID') return { ...state, night: emptyNight('MAIN') };
  if (night.step === 'MAIN') {
    const woken: NightState = {
      ...night,
      step: 'WITCH',
      acted: [],
      attackedId: tallyWolfVote(state),
    };
    const waiting = { ...state, night: woken };
    return getOwingPlayerIds(waiting).length > 0 ? waiting : resolveNight(state, woken);
  }
  return resolveNight(state, night);
}

/** The talking ends when more than half of the living say they are done. */
export function advanceDiscussion(state: WerewolfState): WerewolfState {
  const day = state.day;
  if (!day) return state;
  const alive = state.seatOrder.filter((playerId) => getPlayer(state, playerId).alive);
  if (day.ready.length * 2 <= alive.length) return state;
  return advanceVote({ ...state, phase: 'DAY_VOTE' });
}

/** Counts the votes once every voter has cast one, and carries out the result. */
export function advanceVote(state: WerewolfState): WerewolfState {
  const day = state.day;
  if (!day || getOwingPlayerIds(state).length > 0) return state;

  const executedId = tallyVillageVote(day.votes);
  const votes = state.seatOrder
    .filter((voterId) => voterId in day.votes)
    .map((voterId) => ({ voterId, targetId: day.votes[voterId] ?? null }));

  let after = state;
  let deaths: string[] = [];
  let spared = false;
  let powersLost = false;
  if (executedId !== null) {
    const condemned = getPlayer(state, executedId);
    if (condemned.role === 'idiot' && condemned.canVote) {
      spared = true;
      after = updatePlayer(state, executedId, { canVote: false, roleRevealed: true });
    } else {
      // An elder's death at the village's own hands costs it its powers, the hunter's shot included.
      powersLost = condemned.role === 'elder' && !state.powersLost;
      const killed = killPlayers(powersLost ? { ...state, powersLost: true } : state, [executedId]);
      after = killed.state;
      deaths = killed.deaths;
    }
  }

  const entry: LogEntry = {
    type: 'VOTE',
    round: state.round,
    votes,
    executedId,
    spared,
    powersLost,
    deaths,
  };
  return settle(addLog(after, entry), 'NIGHT');
}

/** The first hunter in line fires, or holds fire. */
export function resolveShot(state: WerewolfState, targetId: string | null): WerewolfState {
  const [hunterId, ...waiting] = state.pendingHunters;
  if (hunterId === undefined) return state;

  const { state: after, deaths } = killPlayers(
    { ...state, pendingHunters: waiting },
    targetId === null ? [] : [targetId],
  );
  const entry: LogEntry = { type: 'SHOT', round: state.round, hunterId, targetId, deaths };
  return settle(addLog(after, entry), state.afterShots ?? 'NIGHT');
}
