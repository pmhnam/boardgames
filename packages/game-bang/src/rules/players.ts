import type { Card, CardKind } from '../domain/cards.js';
import type { BangState, PlayerState } from '../domain/state.js';

export function getPlayer(state: BangState, playerId: string): PlayerState {
  const player = state.players[playerId];
  if (!player) throw new Error(`Unknown player ${playerId}`);
  return player;
}

export function getCard(state: BangState, cardId: string): Card {
  const card = state.cards[cardId];
  if (!card) throw new Error(`Unknown card ${cardId}`);
  return card;
}

export function kindOf(state: BangState, cardId: string): CardKind {
  return getCard(state, cardId).kind;
}

/** In seat order. */
export function getAliveIds(state: BangState): string[] {
  return state.seatOrder.filter((playerId) => state.players[playerId]?.alive);
}

/** The card of this kind a player has on the table, if any. */
export function findInPlay(
  state: BangState,
  player: PlayerState,
  kind: CardKind,
): string | undefined {
  return player.inPlay.find((cardId) => kindOf(state, cardId) === kind);
}

/** Everyone alive in turn order, starting to the left of a player, who is left out. */
export function getOthersFrom(state: BangState, playerId: string): string[] {
  const at = state.seatOrder.indexOf(playerId);
  const round = [...state.seatOrder.slice(at + 1), ...state.seatOrder.slice(0, at)];
  return round.filter((otherId) => state.players[otherId]?.alive);
}

/** Who plays after a player, who need not be alive themselves. */
export function getNextAliveId(state: BangState, playerId: string): string {
  return getOthersFrom(state, playerId)[0] ?? playerId;
}

/** Who the match is waiting on. There is always exactly one such player while it is on. */
export function getOwingPlayerId(state: BangState): string | null {
  if (state.phase === 'FINISHED') return null;
  const top = state.pending.at(-1);
  if (!top) return state.turn.playerId;
  if (top.type === 'BANG' || top.type === 'INDIANS' || top.type === 'STORE') {
    return top.queue[0] ?? null;
  }
  return top.playerId;
}
