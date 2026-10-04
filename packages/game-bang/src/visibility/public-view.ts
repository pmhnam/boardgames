import type { GameViewer } from '@bgp/game-core';
import type { CardKind, Suit } from '../domain/cards.js';
import type { CharacterId } from '../domain/characters.js';
import type { RoleCounts, RoleId, Winner } from '../domain/roles.js';
import type {
  BangPhase,
  BangState,
  CheckReason,
  DiscardReason,
  Pending,
  PlayerState,
} from '../domain/state.js';
import { getDistance, getWeaponRange } from '../rules/distance.rules.js';
import { getLegalMoves, type LegalMoves, type Prompt } from '../rules/legal-moves.js';
import { getCard, getOwingPlayerId } from '../rules/players.js';

/** A card the viewer is allowed to see, with what is printed on it. */
export interface CardView {
  id: string;
  kind: CardKind;
  suit: Suit;
  rank: number;
}

export interface PlayerView {
  playerId: string;
  alive: boolean;
  /** Null unless the viewer knows it: their own, the sheriff's, an eliminated player's. */
  role: RoleId | null;
  character: CharacterId;
  life: number;
  maxLife: number;
  handCount: number;
  inPlay: CardView[];
  /** How far this player's BANG! reaches. */
  range: number;
  /** How far the viewer sees this player; null for anyone watching, the dead and oneself. */
  distance: number | null;
}

/** What the table is waiting for, as far as everyone may know. */
export interface PendingView {
  type: Prompt;
  /** Who it is waiting on. */
  playerId: string;
  /** Whose card caused it. */
  sourceId: string | null;
  /** Who it will come to next. */
  waitingIds: string[];
  /** Missed! cards still owed to a BANG!. */
  missedNeeded: number;
  /** The cards on offer: public at the General Store, Kit Carlson's own business otherwise. */
  cards: CardView[];
}

export type LogEntryView = { id: number } & (
  | { type: 'TURN'; playerId: string }
  | { type: 'PLAY'; playerId: string; card: CardView; targetId: string | null }
  | { type: 'RESPONSE'; playerId: string; card: CardView }
  | { type: 'CHECK'; playerId: string; reason: CheckReason; cards: CardView[]; passed: boolean }
  | { type: 'HIT'; playerId: string; amount: number; sourceId: string | null }
  | {
      type: 'DRAW';
      playerId: string;
      count: number;
      from: 'deck' | 'discard';
      shown: CardView | null;
    }
  /** `card` is null when the viewer may not know which card changed hands. */
  | {
      type: 'TAKE';
      playerId: string;
      fromId: string;
      card: CardView | null;
      fromHand: boolean;
      discarded: boolean;
    }
  | { type: 'PICK'; playerId: string; card: CardView }
  | { type: 'DISCARD'; playerId: string; cards: CardView[]; reason: DiscardReason }
  | {
      type: 'DEATH';
      playerId: string;
      role: RoleId;
      killerId: string | null;
      lootedById: string | null;
    }
);

/** What only the viewer knows. */
export interface MyView {
  playerId: string;
  role: RoleId;
  hand: CardView[];
  /** What the viewer may do right now. */
  legal: LegalMoves;
}

export interface BangView {
  phase: BangPhase;
  turn: { number: number; playerId: string; bangsPlayed: number };
  /** In seat order. */
  players: PlayerView[];
  /** The roles the match was dealt: public, as when the cards are counted out before a game. */
  roleCounts: RoleCounts;
  deckCount: number;
  discardCount: number;
  discardTop: CardView | null;
  pending: PendingView | null;
  log: LogEntryView[];
  winner: Winner | null;
  winnerPlayerIds: string[];
  /** Null for anyone watching. */
  me: MyView | null;
}

function showCard(state: BangState, cardId: string): CardView {
  const card = getCard(state, cardId);
  return { id: cardId, kind: card.kind, suit: card.suit, rank: card.rank };
}

function buildLog(state: BangState, viewerId: string | null): LogEntryView[] {
  const over = state.phase === 'FINISHED';
  const show = (cardId: string) => showCard(state, cardId);

  return state.log.map((entry): LogEntryView => {
    const { id, playerId } = entry;
    switch (entry.type) {
      case 'TURN':
        return { id, type: 'TURN', playerId };
      case 'PLAY':
        return { id, type: 'PLAY', playerId, card: show(entry.cardId), targetId: entry.targetId };
      case 'RESPONSE':
        return { id, type: 'RESPONSE', playerId, card: show(entry.cardId) };
      case 'CHECK':
        return {
          id,
          type: 'CHECK',
          playerId,
          reason: entry.reason,
          cards: entry.cardIds.map(show),
          passed: entry.passed,
        };
      case 'HIT':
        return { id, type: 'HIT', playerId, amount: entry.amount, sourceId: entry.sourceId };
      case 'DRAW':
        return {
          id,
          type: 'DRAW',
          playerId,
          count: entry.count,
          from: entry.from,
          shown: entry.shownCardId === null ? null : show(entry.shownCardId),
        };
      case 'TAKE': {
        // A card that went from one hand to another is known to those two alone.
        const known =
          over ||
          !entry.fromHand ||
          entry.discarded ||
          viewerId === playerId ||
          viewerId === entry.fromId;
        return {
          id,
          type: 'TAKE',
          playerId,
          fromId: entry.fromId,
          card: known ? show(entry.cardId) : null,
          fromHand: entry.fromHand,
          discarded: entry.discarded,
        };
      }
      case 'PICK':
        return { id, type: 'PICK', playerId, card: show(entry.cardId) };
      case 'DISCARD':
        return {
          id,
          type: 'DISCARD',
          playerId,
          cards: entry.cardIds.map(show),
          reason: entry.reason,
        };
      case 'DEATH':
        return {
          id,
          type: 'DEATH',
          playerId,
          role: entry.role,
          killerId: entry.killerId,
          lootedById: entry.lootedById,
        };
    }
  });
}

function buildPending(state: BangState, viewerId: string | null): PendingView | null {
  const frame: Pending | undefined = state.pending.at(-1);
  const playerId = getOwingPlayerId(state);
  if (!frame || playerId === null) return null;

  const queued = frame.type === 'BANG' || frame.type === 'INDIANS' || frame.type === 'STORE';
  let sourceId: string | null = null;
  if (frame.type === 'BANG' || frame.type === 'INDIANS') sourceId = frame.sourceId;
  if (frame.type === 'DUEL') sourceId = frame.opponentId;
  if (frame.type === 'DYING') sourceId = frame.killerId;

  let cardIds: string[] = [];
  if (frame.type === 'STORE') cardIds = frame.cardIds;
  if (frame.type === 'KIT' && viewerId === frame.playerId) cardIds = frame.cardIds;

  return {
    type: frame.type,
    playerId,
    sourceId,
    waitingIds: queued ? frame.queue.slice(1) : [],
    missedNeeded: frame.type === 'BANG' ? frame.missedNeeded : 0,
    cards: cardIds.map((cardId) => showCard(state, cardId)),
  };
}

function copyLegal(legal: LegalMoves): LegalMoves {
  return {
    prompt: legal.prompt,
    plays: legal.plays.map(({ cardId, targets }) => ({
      cardId,
      targets: targets === null ? null : [...targets],
    })),
    discardCount: legal.discardCount,
    responses: [...legal.responses],
    canPass: legal.canPass,
    picks: [...legal.picks],
    pickCount: legal.pickCount,
    drawFromDiscard: legal.drawFromDiscard,
    drawFromPlayers: [...legal.drawFromPlayers],
    canHeal: legal.canHeal,
  };
}

/**
 * Builds what one viewer may see, field by field. While the match is on, a role leaves the
 * server only for its owner, for the sheriff's, or once its player is eliminated; a hand
 * leaves it only for its owner, as a count for everyone else; the deck only as a count.
 * Anyone watching sees what the table sees.
 */
export function getPublicView(state: BangState, viewer: GameViewer): BangView {
  const viewerId = viewer.type === 'player' ? viewer.playerId : null;
  const me = viewerId === null ? undefined : state.players[viewerId];
  const over = state.phase === 'FINISHED';

  const knowsRole = (playerId: string, player: PlayerState): boolean =>
    over || !player.alive || player.role === 'sheriff' || playerId === viewerId;
  const top = state.discard.at(-1);

  return {
    phase: state.phase,
    turn: {
      number: state.turn.number,
      playerId: state.turn.playerId,
      bangsPlayed: state.turn.bangsPlayed,
    },
    players: state.seatOrder.flatMap((playerId) => {
      const player = state.players[playerId];
      if (!player) return [];
      const seen = viewerId !== null && me?.alive === true && player.alive && playerId !== viewerId;
      return {
        playerId,
        alive: player.alive,
        role: knowsRole(playerId, player) ? player.role : null,
        character: player.character,
        life: player.life,
        maxLife: player.maxLife,
        handCount: player.hand.length,
        inPlay: player.inPlay.map((cardId) => showCard(state, cardId)),
        range: getWeaponRange(state, playerId),
        distance: seen ? getDistance(state, viewerId, playerId) : null,
      };
    }),
    roleCounts: { ...state.setup.roleCounts },
    deckCount: state.deck.length,
    discardCount: state.discard.length,
    discardTop: top === undefined ? null : showCard(state, top),
    pending: buildPending(state, viewerId),
    log: buildLog(state, viewerId),
    winner: state.winner,
    winnerPlayerIds: [...state.winnerPlayerIds],
    me:
      viewerId !== null && me
        ? {
            playerId: viewerId,
            role: me.role,
            hand: me.hand.map((cardId) => showCard(state, cardId)),
            legal: copyLegal(getLegalMoves(state, viewerId)),
          }
        : null,
  };
}
