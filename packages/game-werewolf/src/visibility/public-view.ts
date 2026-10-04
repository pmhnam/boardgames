import type { GameViewer } from '@bgp/game-core';
import { isWolf, type RoleCounts, type RoleId } from '../domain/roles.js';
import type {
  Inspection,
  LogEntry,
  PlayerState,
  WerewolfPhase,
  WerewolfState,
  Winner,
} from '../domain/state.js';
import { getLegalMoves, type LegalMoves } from '../rules/legal-moves.js';

export interface PlayerView {
  playerId: string;
  alive: boolean;
  canVote: boolean;
  /** Null unless the viewer knows it: their own, a packmate's, one revealed to the table. */
  role: RoleId | null;
  /** Whether the whole table has been shown this player's role. */
  revealed: boolean;
}

/** What only the viewer knows. */
export interface MyView {
  playerId: string;
  role: RoleId;
  alive: boolean;
  /** Tonight's pack votes so far, for a werewolf to follow. */
  packVotes: Array<{ wolfId: string; targetId: string }>;
  /** What a seer has learned. */
  inspections: Inspection[];
  /** The potions a witch has left; null for everyone else. */
  potions: { heal: boolean; poison: boolean } | null;
  /** The pack's victim, shown to a witch who could still save them. */
  attackedId: string | null;
  /** Who a bodyguard watched last night. */
  lastProtectedId: string | null;
  /** What the viewer may do right now. */
  legal: LegalMoves;
}

export interface WerewolfView {
  phase: WerewolfPhase;
  round: number;
  /** In seat order. */
  players: PlayerView[];
  /** The cast the match was dealt: public, as when the cards are shown before a game. */
  roleCounts: RoleCounts;
  revealRoleOnDeath: boolean;
  /** By day: who is done talking, and who has voted. Never what they voted. */
  ready: string[];
  voted: string[];
  /** The dead hunter the table is waiting on. */
  shooterId: string | null;
  log: LogEntry[];
  /** The couple, if the viewer is in it or is cupid; everyone learns it at the end. */
  lovers: [string, string] | null;
  winner: Winner | null;
  winnerPlayerIds: string[];
  /** Null for anyone watching. */
  me: MyView | null;
}

function copyLog(log: readonly LogEntry[]): LogEntry[] {
  return log.map((entry): LogEntry => {
    if (entry.type === 'NIGHT') {
      return { type: 'NIGHT', round: entry.round, deaths: [...entry.deaths] };
    }
    if (entry.type === 'SHOT') {
      return {
        type: 'SHOT',
        round: entry.round,
        hunterId: entry.hunterId,
        targetId: entry.targetId,
        deaths: [...entry.deaths],
      };
    }
    return {
      type: 'VOTE',
      round: entry.round,
      votes: entry.votes.map(({ voterId, targetId }) => ({ voterId, targetId })),
      executedId: entry.executedId,
      spared: entry.spared,
      powersLost: entry.powersLost,
      deaths: [...entry.deaths],
    };
  });
}

function buildMyView(state: WerewolfState, playerId: string, me: PlayerState): MyView {
  const night = state.night;
  const legal = getLegalMoves(state, playerId);
  const inPack = isWolf(me.role);
  const isWitch = me.role === 'witch';

  return {
    playerId,
    role: me.role,
    alive: me.alive,
    packVotes:
      inPack && night
        ? state.seatOrder
            .filter((wolfId) => wolfId in night.wolfVotes)
            .map((wolfId) => ({ wolfId, targetId: night.wolfVotes[wolfId] ?? '' }))
        : [],
    inspections: me.inspections.map(({ round, targetId, isWolf: found }) => ({
      round,
      targetId,
      isWolf: found,
    })),
    potions: isWitch ? { heal: !me.healUsed, poison: !me.poisonUsed } : null,
    attackedId:
      legal.action === 'WITCH_DECIDE' && !me.healUsed ? (night?.attackedId ?? null) : null,
    lastProtectedId: me.role === 'bodyguard' ? me.lastProtectedId : null,
    legal: {
      action: legal.action,
      targets: [...legal.targets],
      canSkip: legal.canSkip,
      canHeal: legal.canHeal,
    },
  };
}

/**
 * Builds what one viewer may see, field by field. While the match is on, a role leaves the
 * server only for its owner, a werewolf's packmates, or once it has been revealed to the
 * table; nothing about a night in progress leaves at all, beyond the viewer's own part in it.
 * Anyone watching sees what a villager with no role would.
 */
export function getPublicView(state: WerewolfState, viewer: GameViewer): WerewolfView {
  const viewerId = viewer.type === 'player' ? viewer.playerId : null;
  const me = viewerId === null ? undefined : state.players[viewerId];
  const over = state.phase === 'FINISHED';
  const inPack = me !== undefined && isWolf(me.role);

  const knowsRole = (playerId: string, player: PlayerState): boolean =>
    over || player.roleRevealed || playerId === viewerId || (inPack && isWolf(player.role));
  const knowsLovers =
    state.lovers !== null &&
    (over || me?.role === 'cupid' || (viewerId !== null && state.lovers.includes(viewerId)));

  const day = state.day;
  return {
    phase: state.phase,
    round: state.round,
    players: state.seatOrder.flatMap((playerId) => {
      const player = state.players[playerId];
      if (!player) return [];
      return {
        playerId,
        alive: player.alive,
        canVote: player.canVote,
        role: knowsRole(playerId, player) ? player.role : null,
        revealed: over || player.roleRevealed,
      };
    }),
    roleCounts: { ...state.setup.roleCounts },
    revealRoleOnDeath: state.setup.revealRoleOnDeath,
    ready: day ? [...day.ready] : [],
    voted: day ? state.seatOrder.filter((playerId) => playerId in day.votes) : [],
    shooterId: state.phase === 'HUNTER_SHOT' ? (state.pendingHunters[0] ?? null) : null,
    log: copyLog(state.log),
    lovers: knowsLovers && state.lovers ? [state.lovers[0], state.lovers[1]] : null,
    winner: state.winner,
    winnerPlayerIds: [...state.winnerPlayerIds],
    me: viewerId !== null && me ? buildMyView(state, viewerId, me) : null,
  };
}
