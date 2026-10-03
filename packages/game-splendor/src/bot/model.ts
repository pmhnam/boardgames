import type { SplendorAction } from '../domain/actions.js';
import type { DevelopmentCard, Noble } from '../domain/cards.js';
import { MAX_RESERVED } from '../domain/config.js';
import { addTokens, emptyTokens, type GemCounts, type TokenCounts } from '../domain/gems.js';
import { getAvailableGemColors, getDoubleColors, getTakeCount } from '../rules/gems.rules.js';
import { NO_LEGAL_MOVES, type LegalMoves } from '../rules/legal-moves.js';
import { canAfford, getPayment } from '../rules/purchase.rules.js';
import type { PlayerView, SplendorView } from '../visibility/public-view.js';

/** One player, as far as the bot's seat can see them. */
export interface Seat {
  playerId: string;
  tokens: TokenCounts;
  bonuses: GemCounts;
  points: number;
  cardCount: number;
  /** Reserved cards whose face is known. Another player's unseen reserves are not in here. */
  reserved: DevelopmentCard[];
  reservedCount: number;
}

/**
 * The table rebuilt from a view, in the shapes the rule functions take, so the bot can try
 * moves with the engine's own rules. It holds nothing the view does not.
 */
export interface Model {
  me: Seat;
  opponents: Seat[];
  bank: TokenCounts;
  market: DevelopmentCard[];
  nobles: Noble[];
  targetScore: number;
}

function readSeat(playerId: string, player: PlayerView): Seat {
  return {
    playerId,
    tokens: player.tokens,
    bonuses: player.bonuses,
    points: player.points,
    cardCount: player.purchased.length,
    reserved: player.reserved.flatMap((entry) => (entry.hidden ? [] : [entry.card])),
    reservedCount: player.reserved.length,
  };
}

export function readView(view: SplendorView, playerId: string): Model {
  const seats = view.turnOrder.flatMap((id) => {
    const player = view.players[id];
    return player ? [readSeat(id, player)] : [];
  });
  const me = seats.find((seat) => seat.playerId === playerId);
  if (!me) throw new Error(`Player ${playerId} is not in this game`);
  return {
    me,
    opponents: seats.filter((seat) => seat !== me),
    bank: view.bank,
    market: [view.market[1], view.market[2], view.market[3]].flatMap((row) =>
      row.filter((card) => card !== null),
    ),
    nobles: view.nobles,
    targetScore: view.targetScore,
  };
}

/** The same table from an opponent's chair, with what this seat knows of everyone. */
export function asSeenBy(model: Model, opponent: Seat): Model {
  return {
    ...model,
    me: opponent,
    opponents: [model.me, ...model.opponents.filter((seat) => seat !== opponent)],
  };
}

/** The cards the bot's seat could buy: face up, or in its own reserve. */
export function getTargets(model: Model): DevelopmentCard[] {
  return [...model.market, ...model.me.reserved];
}

/**
 * What the seat could do on a later turn of a plan. Unseen cards are left out: the bot does
 * not plan around what it cannot know.
 */
export function getPlannedMoves(model: Model): LegalMoves {
  const { me, bank } = model;
  return {
    ...NO_LEGAL_MOVES,
    gemColors: getAvailableGemColors(bank),
    takeCount: getTakeCount(bank),
    doubleColors: getDoubleColors(bank),
    buyable: getTargets(model)
      .filter((card) => canAfford(me, card.cost))
      .map((card) => card.id),
    reservable: me.reservedCount < MAX_RESERVED ? model.market.map((card) => card.id) : [],
  };
}

function withGold(model: Model): Model {
  if (model.bank.gold === 0) return model;
  return {
    ...model,
    bank: addTokens(model.bank, { gold: 1 }, -1),
    me: { ...model.me, tokens: addTokens(model.me.tokens, { gold: 1 }) },
  };
}

/**
 * The seat's own action applied to the model, mirroring the engine. A slot emptied here stays
 * empty: what the deck would put there is unknown.
 */
export function applyToModel(model: Model, action: SplendorAction): Model {
  const { me } = model;
  switch (action.type) {
    case 'TAKE_GEMS': {
      const taken = emptyTokens();
      for (const color of action.colors) taken[color] += 1;
      return {
        ...model,
        bank: addTokens(model.bank, taken, -1),
        me: { ...me, tokens: addTokens(me.tokens, taken) },
      };
    }
    case 'RESERVE_CARD': {
      const card = model.market.find((candidate) => candidate.id === action.cardId);
      if (!card) return model;
      return withGold({
        ...model,
        market: model.market.filter((candidate) => candidate !== card),
        me: { ...me, reserved: [...me.reserved, card], reservedCount: me.reservedCount + 1 },
      });
    }
    case 'RESERVE_FROM_DECK':
      return withGold({ ...model, me: { ...me, reservedCount: me.reservedCount + 1 } });
    case 'BUY_CARD': {
      const card = getTargets(model).find((candidate) => candidate.id === action.cardId);
      const payment = card && getPayment(me, card.cost);
      if (!card || !payment) return model;
      const fromReserve = me.reserved.includes(card);
      return {
        ...model,
        bank: addTokens(model.bank, payment),
        market: model.market.filter((candidate) => candidate !== card),
        me: {
          ...me,
          tokens: addTokens(me.tokens, payment, -1),
          bonuses: { ...me.bonuses, [card.bonus]: me.bonuses[card.bonus] + 1 },
          points: me.points + card.points,
          cardCount: me.cardCount + 1,
          reserved: me.reserved.filter((candidate) => candidate !== card),
          reservedCount: me.reservedCount - (fromReserve ? 1 : 0),
        },
      };
    }
    case 'RETURN_GEMS':
      return {
        ...model,
        bank: addTokens(model.bank, action.tokens),
        me: { ...me, tokens: addTokens(me.tokens, action.tokens, -1) },
      };
    case 'CHOOSE_NOBLE': {
      const noble = model.nobles.find((candidate) => candidate.id === action.nobleId);
      if (!noble) return model;
      return {
        ...model,
        nobles: model.nobles.filter((candidate) => candidate !== noble),
        me: { ...me, points: me.points + noble.points },
      };
    }
    case 'PASS':
      return model;
  }
}
