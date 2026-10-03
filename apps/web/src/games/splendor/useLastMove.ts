import {
  GEM_COLORS,
  TIERS,
  TOKEN_COLORS,
  type PlayerView,
  type SplendorView,
} from '@bgp/game-splendor';
import type { GameStateMessage } from '@bgp/shared-types';
import { useEffect, useRef, useState } from 'react';
import { TIER_LABEL, TOKEN_NAME } from './layout';

export interface LastMove {
  playerId: string;
  /** What they did, without their name: "bought a blue card worth 2 points". */
  text: string;
  /** Cards turned over to refill the market. */
  freshCardIds: string[];
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

function describeChange(before: PlayerView, after: PlayerView): string | null {
  const parts: string[] = [];
  const bought = after.purchased.find(
    (card) => !before.purchased.some((old) => old.id === card.id),
  );
  if (bought) {
    const worth = bought.points > 0 ? ` worth ${plural(bought.points, 'point')}` : '';
    parts.push(`bought a ${TOKEN_NAME[bought.bonus]} card${worth}`);
  } else if (after.reserved.length > before.reserved.length) {
    const entry = after.reserved.at(-1);
    if (entry) {
      parts.push(
        entry.hidden
          ? `reserved an unseen tier ${TIER_LABEL[entry.tier]} card`
          : `reserved a tier ${TIER_LABEL[entry.card.tier]} card`,
      );
    }
  } else {
    const taken = GEM_COLORS.filter((color) => after.tokens[color] > before.tokens[color]).map(
      (color) => `${after.tokens[color] - before.tokens[color]} ${TOKEN_NAME[color]}`,
    );
    const returned = TOKEN_COLORS.reduce(
      (sum, color) => sum + Math.max(0, before.tokens[color] - after.tokens[color]),
      0,
    );
    if (taken.length > 0) parts.push(`took ${taken.join(', ')}`);
    else if (returned > 0) parts.push(`gave back ${plural(returned, 'token')}`);
  }

  const noble = after.nobles.find((held) => !before.nobles.some((old) => old.id === held.id));
  if (noble) parts.push(`was visited by ${noble.name}`);
  return parts.length > 0 ? parts.join(' and ') : null;
}

function compare(before: SplendorView, after: SplendorView): LastMove | null {
  const seen = new Set(TIERS.flatMap((tier) => before.market[tier].map((card) => card?.id)));
  const freshCardIds = TIERS.flatMap((tier) =>
    after.market[tier].flatMap((card) => (card && !seen.has(card.id) ? [card.id] : [])),
  );
  for (const playerId of after.turnOrder) {
    const [was, is] = [before.players[playerId], after.players[playerId]];
    const text = was && is ? describeChange(was, is) : null;
    if (text) return { playerId, text, freshCardIds };
  }
  // Nothing moved, yet the turn did: that player had no move.
  return before.turn.number !== after.turn.number
    ? { playerId: before.turn.activePlayerId, text: 'passed', freshCardIds }
    : null;
}

/**
 * What the latest action changed, worked out from the two views either side of it. It shows
 * only what those views show: a card reserved unseen is still just "an unseen card".
 */
export function useLastMove(message: GameStateMessage<SplendorView>): LastMove | null {
  const previous = useRef(message);
  const [move, setMove] = useState<LastMove | null>(null);

  useEffect(() => {
    const before = previous.current;
    previous.current = message;
    if (before.gameId !== message.gameId || before.version === message.version) return;
    // Only a single step forward is one action; a jump (resync, replay scrubbing) is not.
    setMove(message.version === before.version + 1 ? compare(before.state, message.state) : null);
  }, [message]);

  return move;
}
