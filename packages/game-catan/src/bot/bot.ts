import type { BotDecisionInput, BotStrategy, SeededRandom } from '@bgp/game-core';
import type { CatanAction } from '../domain/actions.js';
import { INVENTION_CARDS } from '../domain/config.js';
import {
  RESOURCES,
  addResources,
  countResources,
  emptyResources,
  hasResources,
  type Resource,
  type ResourceCounts,
} from '../domain/resources.js';
import { listLegalActions } from '../rules/legal-moves.js';
import { listCards } from '../rules/robber.rules.js';
import type { CatanView } from '../visibility/public-view.js';
import {
  evaluateRoad,
  evaluateRobberHex,
  evaluateSite,
  findLeader,
  findSpare,
  getYield,
  isRobbed,
} from './evaluate.js';
import {
  choosePlan,
  getShortfall,
  listOpponents,
  listReachableSites,
  readView,
  type Model,
  type Plan,
} from './model.js';

/** How often the easy bot does something other than end its turn, when it has the choice. */
const EASY_BUSY_CHANCE = 0.5;
/** How close to winning a proposer may be before the hard bot stops trading with them. */
const TRADE_EMBARGO_MARGIN = 2;
/** How many cards more than it gets a bot will give in a trade it otherwise likes. */
const TRADE_GENEROSITY = 1;
/** A hand larger than this is half lost to a 7, so the planning bots spend it down. */
const SAFE_HAND = 7;
/** Roads the planning bots keep in reserve rather than build with spare cards. */
const ROADS_IN_RESERVE = 2;

/** Picks the best-scoring option; ties are broken at random so games do not repeat. */
function pickBest<T>(options: readonly T[], value: (option: T) => number, random: SeededRandom): T {
  let best: T[] = [];
  let bestValue = -Infinity;
  for (const option of options) {
    const optionValue = value(option);
    if (optionValue > bestValue) {
      best = [option];
      bestValue = optionValue;
    } else if (optionValue === bestValue) {
      best.push(option);
    }
  }
  return random.pick(best);
}

function listOptions(model: Model): CatanAction[] {
  return listLegalActions(model.view.legal, {
    step: model.view.turn.step,
    resources: model.hand,
    supplyRates: model.me.supplyRates,
    supply: model.view.supply,
  });
}

function pickCards(
  hand: Readonly<ResourceCounts>,
  count: number,
  random: SeededRandom,
): Partial<ResourceCounts> {
  const picked: Partial<ResourceCounts> = {};
  for (const resource of random.shuffle(listCards(hand)).slice(0, count)) {
    picked[resource] = (picked[resource] ?? 0) + 1;
  }
  return picked;
}

/** Gives up the cards the plan needs least, one at a time. */
export function chooseDiscard(model: Model, count: number): Partial<ResourceCounts> {
  const cost = choosePlan(model)?.cost ?? emptyResources();
  const hand = { ...model.hand };
  const discarded: Partial<ResourceCounts> = {};
  for (let given = 0; given < count; given += 1) {
    const resource = findSpare(hand, cost);
    if (!resource) break;
    hand[resource] -= 1;
    discarded[resource] = (discarded[resource] ?? 0) + 1;
  }
  return discarded;
}

/**
 * Says yes to an offer that brings a card the plan is short of, leaves the cards the plan
 * needs alone and is not lopsided. The hard bot also refuses to help a player about to win.
 */
export function chooseResponse(model: Model, aware: boolean): boolean {
  const { view } = model;
  const { offer } = view.turn;
  const plan = choosePlan(model);
  if (!offer || !view.legal.canAccept || !plan) return false;

  const shortfall = getShortfall(model.hand, plan.cost);
  const helps = RESOURCES.some((resource) => offer.give[resource] > 0 && shortfall[resource] > 0);
  const keepsPlan = RESOURCES.every(
    (resource) =>
      offer.receive[resource] === 0 ||
      model.hand[resource] - offer.receive[resource] >= plan.cost[resource],
  );
  const fair = countResources(offer.receive) <= countResources(offer.give) + TRADE_GENEROSITY;
  const proposer = view.players[view.turn.activePlayerId];
  const nearlyWon = (proposer?.publicPoints ?? 0) >= view.victoryPointsToWin - TRADE_EMBARGO_MARGIN;
  return helps && keepsPlan && fair && !(aware && nearlyWon);
}

function chooseRobberMove(model: Model, aware: boolean, random: SeededRandom): CatanAction {
  const targets = Object.entries(model.view.legal.robberTargets);
  const [hex, victims] = pickBest(
    targets,
    // Between hexes that block as much, one with somebody to rob is better.
    ([target, robbable]) =>
      evaluateRobberHex(model, target, aware) + (robbable.length > 0 ? 0.5 : 0),
    random,
  );
  if (victims.length === 0) return { type: 'MOVE_ROBBER', hex };
  const victimId = aware
    ? findLeader(model, victims)
    : pickBest(victims, (id) => model.view.players[id]?.resourceCount ?? 0, random);
  return { type: 'MOVE_ROBBER', hex, victimId: victimId ?? victims[0] };
}

function chooseRoad(model: Model, aware: boolean, random: SeededRandom): string {
  return pickBest(model.view.legal.roadEdges, (edge) => evaluateRoad(model, edge, aware), random);
}

/** The two cards an Invention should take: what the plan lacks, then what produces least. */
function chooseInventionPicks(model: Model, plan: Plan | null): Resource[] | null {
  const supply = { ...model.view.supply };
  const shortfall = plan ? getShortfall(model.hand, plan.cost) : emptyResources();
  const picks: Resource[] = [];
  while (picks.length < INVENTION_CARDS) {
    const available = RESOURCES.filter((resource) => supply[resource] > 0);
    if (available.length === 0) return null;
    const pick = [...available].sort(
      (a, b) => shortfall[b] - shortfall[a] || supply[b] - supply[a],
    )[0] as Resource;
    picks.push(pick);
    supply[pick] -= 1;
    shortfall[pick] = Math.max(0, shortfall[pick] - 1);
  }
  return picks;
}

/** The one development card worth playing now, if any. Only one may be played a turn. */
function chooseCardPlay(model: Model, plan: Plan | null): CatanAction | null {
  const playable = model.view.legal.playableCards;
  const shortfall = plan ? getShortfall(model.hand, plan.cost) : emptyResources();
  const missing = plan?.missing ?? 0;

  if (playable.includes('invention') && missing > 0 && missing <= INVENTION_CARDS) {
    const picks = chooseInventionPicks(model, plan);
    if (picks) return { type: 'PLAY_INVENTION', resources: picks };
  }
  if (playable.includes('knight')) return { type: 'PLAY_KNIGHT' };
  if (playable.includes('roadBuilding')) return { type: 'PLAY_ROAD_BUILDING' };
  if (playable.includes('monopoly')) {
    const othersHold = listOpponents(model).some(
      (playerId) => (model.view.players[playerId]?.resourceCount ?? 0) > 0,
    );
    if (othersHold) {
      const resource = [...RESOURCES].sort((a, b) => shortfall[b] - shortfall[a])[0] as Resource;
      return { type: 'PLAY_MONOPOLY', resource };
    }
  }
  if (playable.includes('invention')) {
    const picks = chooseInventionPicks(model, plan);
    if (picks) return { type: 'PLAY_INVENTION', resources: picks };
  }
  return null;
}

/** Whether the seat could pay a cost without setting its plan back. */
function isSpare(model: Model, cost: Readonly<ResourceCounts>, plan: Plan | null): boolean {
  if (!hasResources(model.hand, cost)) return false;
  if (!plan) return true;
  const after = addResources(model.hand, cost, -1);
  return countResources(getShortfall(after, plan.cost)) === plan.missing;
}

/**
 * A trade with the supply that brings the plan a card it lacks for cards it does not need.
 * The normal bot only makes the trade that completes its plan; the hard bot works towards it.
 */
function chooseSupplyTrade(model: Model, plan: Plan | null, aware: boolean): CatanAction | null {
  if (!model.view.legal.canTrade || !plan || plan.missing === 0) return null;
  if (!aware && plan.missing > 1) return null;

  const shortfall = getShortfall(model.hand, plan.cost);
  const receive = RESOURCES.filter(
    (resource) => shortfall[resource] > 0 && model.view.supply[resource] > 0,
  ).sort((a, b) => shortfall[b] - shortfall[a])[0];
  const give = RESOURCES.filter(
    (resource) => model.hand[resource] - plan.cost[resource] >= model.me.supplyRates[resource],
  ).sort(
    (a, b) =>
      model.hand[b] - plan.cost[b] - (model.hand[a] - plan.cost[a]) ||
      model.me.supplyRates[a] - model.me.supplyRates[b],
  )[0];
  if (!receive || !give) return null;
  return { type: 'SUPPLY_TRADE', give, receive };
}

/** The planning bots' turn once the dice are rolled: build, then play, buy, trade, pass. */
function chooseMainAction(model: Model, aware: boolean, random: SeededRandom): CatanAction {
  const { view, hand } = model;
  const { legal } = view;

  if (legal.cityVertices.length > 0) {
    // The settlement that produces most gains most from doubling.
    const vertex = pickBest(
      legal.cityVertices,
      (site) => RESOURCES.reduce((sum, resource) => sum + getYield(model, site)[resource], 0),
      random,
    );
    return { type: 'BUILD_CITY', vertex };
  }
  if (legal.settlementVertices.length > 0) {
    const vertex = pickBest(
      legal.settlementVertices,
      (site) => evaluateSite(model, site, aware),
      random,
    );
    return { type: 'BUILD_SETTLEMENT', vertex };
  }

  const plan = choosePlan(model);
  const play = chooseCardPlay(model, plan);
  if (play) return play;

  const crowded = countResources(hand) > SAFE_HAND;
  if (
    legal.canBuyDevelopmentCard &&
    (plan?.goal === 'developmentCard' || isSpare(model, view.costs.developmentCard, plan))
  ) {
    return { type: 'BUY_DEVELOPMENT_CARD' };
  }
  if (legal.roadEdges.length > 0) {
    const leadsSomewhere = plan?.goal === 'road';
    const spare =
      isSpare(model, view.costs.road, plan) &&
      model.me.piecesLeft.roads > ROADS_IN_RESERVE &&
      (crowded || listReachableSites(model).length === 0);
    if (leadsSomewhere || spare) {
      return { type: 'BUILD_ROAD', edge: chooseRoad(model, aware, random) };
    }
  }

  return chooseSupplyTrade(model, plan, aware) ?? { type: 'END_TURN' };
}

/** normal and hard: the same plan, with the hard bot weighing more of the table. */
function choosePlanned(model: Model, aware: boolean, random: SeededRandom): CatanAction {
  const { view } = model;
  const { legal } = view;

  if (legal.mustDiscard > 0) {
    return { type: 'DISCARD', resources: chooseDiscard(model, legal.mustDiscard) };
  }
  if (legal.canRespond) return { type: 'RESPOND_TRADE', accept: chooseResponse(model, aware) };
  // The bots make no offers of their own, but one could be handed a seat with one open.
  if (legal.canCancelTrade) {
    const [partner] = legal.accepters;
    return partner ? { type: 'CONFIRM_TRADE', playerId: partner } : { type: 'CANCEL_TRADE' };
  }
  if (Object.keys(legal.robberTargets).length > 0) return chooseRobberMove(model, aware, random);

  if (view.turn.step === 'SETUP_SETTLEMENT') {
    const vertex = pickBest(
      legal.settlementVertices,
      (site) => evaluateSite(model, site, aware),
      random,
    );
    return { type: 'PLACE_SETUP_SETTLEMENT', vertex };
  }
  if (view.turn.step === 'SETUP_ROAD') {
    return { type: 'PLACE_SETUP_ROAD', edge: chooseRoad(model, aware, random) };
  }
  if (view.turn.freeRoads > 0) {
    return { type: 'BUILD_ROAD', edge: chooseRoad(model, aware, random) };
  }
  if (legal.canRoll) {
    // Getting the robber off its own hex before the roll is worth a knight to the hard bot.
    const freesItself = aware && legal.playableCards.includes('knight') && isRobbed(model);
    return freesItself ? { type: 'PLAY_KNIGHT' } : { type: 'ROLL_DICE' };
  }
  return chooseMainAction(model, aware, random);
}

const WORTH_POINTS = ['BUILD_CITY', 'BUILD_SETTLEMENT', 'BUY_DEVELOPMENT_CARD'];

/**
 * easy: any legal move, read straight off `legal`. It takes whatever is worth points when it
 * can, so its games still end. This is also what the platform falls back on, so it must
 * handle every step.
 */
function chooseAtRandom(model: Model, random: SeededRandom): CatanAction {
  const { legal } = model.view;
  if (legal.mustDiscard > 0) {
    return { type: 'DISCARD', resources: pickCards(model.hand, legal.mustDiscard, random) };
  }

  const options = listOptions(model);
  if (options.length === 0) throw new Error('CATAN bot asked to move with no legal move');
  const scoring = options.filter((action) => WORTH_POINTS.includes(action.type));
  if (scoring.length > 0) return random.pick(scoring);

  const busy = options.filter(
    (action) => action.type !== 'SUPPLY_TRADE' && action.type !== 'END_TURN',
  );
  if (busy.length > 0 && (!legal.canEndTurn || random.next() < EASY_BUSY_CHANCE)) {
    return random.pick(busy);
  }
  return legal.canEndTurn ? { type: 'END_TURN' } : random.pick(options);
}

/**
 * - easy: a random legal move, building when it can;
 * - normal: settles where the dice roll most, saves for the nearest thing it can build, and
 *   robs whoever holds most cards;
 * - hard: also counts ports and the resources it lacks, trades with the supply towards its
 *   plan, robs and refuses to trade with whoever is nearest to winning.
 *
 * None of them makes offers to the other players; all of them answer offers.
 */
export const CatanBot: BotStrategy<CatanView, CatanAction> = {
  chooseAction({ view, playerId, level, random }: BotDecisionInput<CatanView>) {
    const model = readView(view, playerId);
    return level === 'easy'
      ? chooseAtRandom(model, random)
      : choosePlanned(model, level === 'hard', random);
  },
};
