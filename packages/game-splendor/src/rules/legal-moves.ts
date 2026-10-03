import type { SplendorAction } from '../domain/actions.js';
import { TIERS, getCard, getNoble, type Noble, type Tier } from '../domain/cards.js';
import { TOKEN_COLORS, type GemColor, type TokenCounts } from '../domain/gems.js';
import type { SplendorState } from '../domain/state.js';
import { getBonuses } from '../scoring/score.js';
import {
  getAvailableGemColors,
  getDoubleColors,
  getExcessTokens,
  getTakeCount,
} from './gems.rules.js';
import { getEligibleNobles } from './noble.rules.js';
import { canAfford, type Wallet } from './purchase.rules.js';
import { validateReserveLimit } from './reserve.rules.js';
import { getPlayer } from './turn.rules.js';

/** What the player to move may do. Everything is empty for anyone else. */
export interface LegalMoves {
  /** Colours the bank can give a gem of. */
  gemColors: GemColor[];
  /** How many different colours must be taken together. */
  takeCount: number;
  /** Colours two gems may be taken from. */
  doubleColors: GemColor[];
  /** Face-up and own reserved cards the player can pay for. */
  buyable: string[];
  /** Face-up cards the player may reserve. */
  reservable: string[];
  /** Decks the player may reserve the top card of. */
  reservableTiers: Tier[];
  /** Tokens to give back before the turn can go on. */
  mustReturn: number;
  /** Nobles to pick one of. */
  nobleChoices: string[];
  canPass: boolean;
}

export const NO_LEGAL_MOVES: LegalMoves = {
  gemColors: [],
  takeCount: 0,
  doubleColors: [],
  buyable: [],
  reservable: [],
  reservableTiers: [],
  mustReturn: 0,
  nobleChoices: [],
  canPass: false,
};

export function getWallet(
  state: Pick<SplendorState, 'config' | 'players'>,
  playerId: string,
): Wallet {
  const player = getPlayer(state, playerId);
  return { tokens: player.tokens, bonuses: getBonuses(state.config, player.purchased) };
}

export function getMarketCardIds(market: SplendorState['market']): string[] {
  return TIERS.flatMap((tier) => market[tier].filter((cardId) => cardId !== null));
}

/** The cards a player may buy from: the face-up ones and their own reserve. */
export function getPurchaseSources(
  state: Pick<SplendorState, 'market' | 'players'>,
  playerId: string,
): string[] {
  const reserved = getPlayer(state, playerId).reserved.map((entry) => entry.cardId);
  return [...getMarketCardIds(state.market), ...reserved];
}

export function getWaitingNobles(state: Pick<SplendorState, 'config' | 'nobles'>): Noble[] {
  return state.nobles.map((nobleId) => getNoble(state.config.nobles, nobleId));
}

export function getNobleChoices(
  state: Pick<SplendorState, 'config' | 'nobles' | 'players'>,
  playerId: string,
): Noble[] {
  return getEligibleNobles(getWaitingNobles(state), getWallet(state, playerId).bonuses);
}

/** The single source of truth for what the active player may do; the validator agrees with it. */
export function getLegalMoves(state: SplendorState, playerId: string): LegalMoves {
  const player = getPlayer(state, playerId);

  if (state.turn.step === 'RETURN_GEMS') {
    return { ...NO_LEGAL_MOVES, mustReturn: getExcessTokens(player.tokens) };
  }
  if (state.turn.step === 'CHOOSE_NOBLE') {
    return {
      ...NO_LEGAL_MOVES,
      nobleChoices: getNobleChoices(state, playerId).map((noble) => noble.id),
    };
  }

  const wallet = getWallet(state, playerId);
  const mayReserve = validateReserveLimit(player).valid;
  const gemColors = getAvailableGemColors(state.bank);
  const buyable = getPurchaseSources(state, playerId).filter((cardId) =>
    canAfford(wallet, getCard(state.config.cards, cardId).cost),
  );
  const reservable = mayReserve ? getMarketCardIds(state.market) : [];
  const reservableTiers = mayReserve ? TIERS.filter((tier) => state.decks[tier].length > 0) : [];

  return {
    gemColors,
    takeCount: getTakeCount(state.bank),
    doubleColors: getDoubleColors(state.bank),
    buyable,
    reservable,
    reservableTiers,
    mustReturn: 0,
    nobleChoices: [],
    canPass:
      gemColors.length === 0 &&
      buyable.length === 0 &&
      reservable.length === 0 &&
      reservableTiers.length === 0,
  };
}

function combinations<T>(items: readonly T[], size: number): T[][] {
  if (size === 0) return [[]];
  return items.flatMap((item, index) =>
    combinations(items.slice(index + 1), size - 1).map((rest) => [item, ...rest]),
  );
}

/** Every way of giving back `count` of the tokens held. */
export function listReturns(tokens: Readonly<TokenCounts>, count: number): Partial<TokenCounts>[] {
  const walk = (index: number, left: number): Partial<TokenCounts>[] => {
    const color = TOKEN_COLORS[index];
    if (color === undefined) return left === 0 ? [{}] : [];
    const results: Partial<TokenCounts>[] = [];
    for (let given = 0; given <= Math.min(left, tokens[color]); given += 1) {
      for (const rest of walk(index + 1, left - given)) {
        results.push(given > 0 ? { [color]: given, ...rest } : rest);
      }
    }
    return results;
  };
  return walk(0, count);
}

/**
 * Spells out `legal` as concrete actions. It needs nothing but the view's `legal` and the
 * player's own tokens, so a bot can use it from its seat.
 */
export function listLegalActions(
  legal: LegalMoves,
  tokens: Readonly<TokenCounts>,
): SplendorAction[] {
  if (legal.mustReturn > 0) {
    return listReturns(tokens, legal.mustReturn).map((returned) => ({
      type: 'RETURN_GEMS',
      tokens: returned,
    }));
  }
  if (legal.nobleChoices.length > 0) {
    return legal.nobleChoices.map((nobleId) => ({ type: 'CHOOSE_NOBLE', nobleId }));
  }

  const takes =
    legal.takeCount > 0 ? combinations(legal.gemColors, legal.takeCount) : ([] as GemColor[][]);
  return [
    ...legal.buyable.map((cardId): SplendorAction => ({ type: 'BUY_CARD', cardId })),
    ...takes.map((colors): SplendorAction => ({ type: 'TAKE_GEMS', colors })),
    ...legal.doubleColors.map((color): SplendorAction => ({
      type: 'TAKE_GEMS',
      colors: [color, color],
    })),
    ...legal.reservable.map((cardId): SplendorAction => ({ type: 'RESERVE_CARD', cardId })),
    ...legal.reservableTiers.map((tier): SplendorAction => ({ type: 'RESERVE_FROM_DECK', tier })),
    ...(legal.canPass ? [{ type: 'PASS' } as const] : []),
  ];
}
