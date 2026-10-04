import type { BotDecisionInput, BotLevel, BotStrategy, SeededRandom } from '@bgp/game-core';
import type { BangAction } from '../domain/actions.js';
import { getWeaponRangeOf, isBlue, type CardKind } from '../domain/cards.js';
import type { PlayOption } from '../rules/legal-moves.js';
import type { BangView, CardView, MyView, PlayerView } from '../visibility/public-view.js';

/** How often the easy bot ends its turn with cards it could still play. */
const EASY_STOP_CHANCE = 0.25;
/** How often the easy bot lets a shot through that it could have dodged. */
const EASY_PASS_CHANCE = 0.3;
/** A player the bot will not see hurt scores this or lower. */
const PROTECTED = -10;

/** The cards aimed at a player that are no favour to them. */
const HOSTILE: readonly CardKind[] = ['bang', 'missed', 'duel', 'jail', 'panic', 'catBalou'];

/** What a card is worth holding on to, for deciding what to discard and what to take. */
const KEEP_VALUE: Record<CardKind, number> = {
  beer: 9,
  gatling: 8,
  wellsFargo: 8,
  missed: 7,
  barrel: 7,
  stagecoach: 6,
  bang: 6,
  indians: 6,
  panic: 6,
  mustang: 5,
  scope: 5,
  generalStore: 5,
  catBalou: 5,
  duel: 4,
  saloon: 4,
  winchester: 4,
  revCarabine: 4,
  remington: 3,
  schofield: 3,
  volcanic: 3,
  jail: 3,
  dynamite: 2,
};

/** Cards that are simply good to play the moment they can be, best first. */
const PLAY_AT_ONCE: readonly CardKind[] = [
  'wellsFargo',
  'stagecoach',
  'generalStore',
  'barrel',
  'mustang',
  'scope',
  'beer',
];

interface Table {
  view: BangView;
  me: MyView;
  level: BotLevel;
  random: SeededRandom;
  /** The viewer's own seat. */
  self: PlayerView;
  /** Everyone else still alive. */
  others: PlayerView[];
  hand: Map<string, CardView>;
  /** How much the bot wants each other player hurt: above zero a target, below it a friend. */
  scores: Map<string, number>;
}

/** How many hostile cards each player has aimed at each other one, as far as the log goes back. */
function countHostility(view: BangView): Map<string, Map<string, number>> {
  const counts = new Map<string, Map<string, number>>();
  for (const entry of view.log) {
    if (entry.type !== 'PLAY' || entry.targetId === null) continue;
    if (!HOSTILE.includes(entry.card.kind)) continue;
    const row = counts.get(entry.playerId) ?? new Map<string, number>();
    row.set(entry.targetId, (row.get(entry.targetId) ?? 0) + 1);
    counts.set(entry.playerId, row);
  }
  return counts;
}

/**
 * The chance that a living player whose role is hidden is on the viewer's side, from the
 * roles the match was dealt and the ones the dead have shown.
 */
function getFriendOdds(view: BangView, me: MyView): number {
  const strangers = view.players.filter(
    (player) => player.alive && player.role === null && player.playerId !== me.playerId,
  ).length;
  if (strangers === 0 || me.role === 'renegade') return 0;
  const side = me.role === 'outlaw' ? 'outlaw' : 'deputy';
  const shown = view.players.filter((player) => !player.alive && player.role === side).length;
  const friends = view.roleCounts[side] - shown - (me.role === side ? 1 : 0);
  return Math.max(0, friends) / strangers;
}

/**
 * Reads the table from one seat. Roles are hidden, so everyone is judged by what they have
 * done: whoever goes after the sheriff is taken for an outlaw. The hard level also counts
 * the roles still unaccounted for, to tell how likely a stranger is to be a friend, and on
 * the side of the law takes whoever goes after the sheriff's attackers for a deputy.
 */
function scoreOthers(view: BangView, me: MyView, level: BotLevel): Map<string, number> {
  const hostility = countHostility(view);
  const aimed = (fromId: string, atId: string | undefined): number =>
    atId === undefined ? 0 : (hostility.get(fromId)?.get(atId) ?? 0);

  const hard = level === 'hard';
  const alive = view.players.filter((player) => player.alive);
  const sheriffId = alive.find((player) => player.role === 'sheriff')?.playerId;
  const againstSheriff = (playerId: string) => aimed(playerId, sheriffId);
  /** Hostile cards a player has aimed at those who went after the sheriff. */
  const againstOutlaws = (playerId: string) =>
    alive
      .filter((other) => againstSheriff(other.playerId) > 0)
      .reduce((sum, other) => sum + aimed(playerId, other.playerId), 0);
  const friendOdds = hard ? getFriendOdds(view, me) : 0;

  const scores = new Map<string, number>();
  for (const other of alive) {
    const otherId = other.playerId;
    if (otherId === me.playerId) continue;
    const isSheriff = otherId === sheriffId;
    const lawful = hard ? againstOutlaws(otherId) : 0;
    const grudge = aimed(otherId, me.playerId);

    let score: number;
    if (me.role === 'sheriff') {
      // Killing a deputy costs every card held, so a likely one weighs heavier than it would.
      score = 1 - 3 * friendOdds + 2 * grudge - 2 * lawful;
    } else if (me.role === 'deputy') {
      const stranger = 1 - 2 * friendOdds;
      score = isSheriff ? PROTECTED : stranger + 2 * againstSheriff(otherId) - 2 * lawful + grudge;
    } else if (me.role === 'outlaw') {
      const stranger = 1 - 2 * friendOdds;
      score = isSheriff ? 10 : stranger - 2 * againstSheriff(otherId) + grudge;
    } else {
      // A renegade needs the sheriff alive until the two of them are all that is left.
      // Until then the outlaws, who would end the match by killing the sheriff, go first.
      const outlawish = hard ? 2 * againstSheriff(otherId) : 0;
      score = isSheriff ? (alive.length === 2 ? 5 : PROTECTED) : 2 + outlawish + grudge;
    }
    scores.set(otherId, score);
  }
  return scores;
}

function kindOf(table: Table, cardId: string): CardKind | undefined {
  return table.hand.get(cardId)?.kind;
}

/** The hand's least valuable cards. */
function cheapest(table: Table, count: number, among = table.me.hand): string[] {
  return [...among]
    .sort((a, b) => KEEP_VALUE[a.kind] - KEEP_VALUE[b.kind])
    .slice(0, count)
    .map((card) => card.id);
}

function endTurn(table: Table): BangAction {
  const { legal, hand } = table.me;
  const discardIds =
    table.level === 'easy'
      ? table.random.shuffle(hand.map((card) => card.id)).slice(0, legal.discardCount)
      : cheapest(table, legal.discardCount);
  return { type: 'END_TURN', discardIds };
}

function playOn(
  option: PlayOption,
  targetId: string | null = null,
  targetCardId: string | null = null,
): BangAction {
  return { type: 'PLAY_CARD', cardId: option.cardId, targetId, targetCardId };
}

/** The targets of a card the bot would be glad to hurt, most wanted first. */
function rankTargets(table: Table, option: PlayOption): PlayerView[] {
  const targets = option.targets ?? [];
  return table.others
    .filter((other) => targets.includes(other.playerId))
    .filter((other) => (table.scores.get(other.playerId) ?? 0) > 0)
    .sort((a, b) => appeal(table, b) - appeal(table, a));
}

/**
 * How good a target a player the bot wants hurt is. The hard bot also weighs how close they
 * are to going down, and whether they can do anything about it.
 */
function appeal(table: Table, target: PlayerView): number {
  const score = table.scores.get(target.playerId) ?? 0;
  if (table.level !== 'hard') return score;
  const nearDeath = target.life <= 1 ? 3 : target.life === 2 ? 1.5 : 0;
  const helpless = target.handCount === 0 ? 1 : 0;
  const walled = target.inPlay.some((card) => card.kind === 'barrel') ? 0.5 : 0;
  return score + nearDeath + helpless - walled;
}

/** Which of a player's cards a Panic! or a Cat Balou should take: null is one from the hand. */
function chooseLoot(table: Table, target: PlayerView): string | null {
  const onTable = target.inPlay.filter((card) => card.kind !== 'jail' && card.kind !== 'dynamite');
  if (table.level === 'easy') {
    const options: Array<string | null> = target.inPlay.map((card) => card.id);
    if (target.handCount > 0) options.push(null);
    return table.random.pick(options);
  }
  const best = [...onTable].sort((a, b) => KEEP_VALUE[b.kind] - KEEP_VALUE[a.kind])[0];
  if (best) return best.id;
  if (target.handCount > 0) return null;
  return target.inPlay[0]?.id ?? null;
}

function playAnything(table: Table): BangAction {
  const { legal } = table.me;
  if (legal.plays.length === 0 || table.random.next() < EASY_STOP_CHANCE) return endTurn(table);
  const option = table.random.pick(legal.plays);
  if (option.targets === null) return playOn(option);
  const targetId = table.random.pick(option.targets);
  const target = table.others.find((other) => other.playerId === targetId);
  const kind = kindOf(table, option.cardId);
  const takes = kind === 'panic' || kind === 'catBalou';
  return playOn(option, targetId, takes && target ? chooseLoot(table, target) : null);
}

/** Whether a card that hits everyone else does the bot more good than harm. */
function worthHittingAll(table: Table): boolean {
  let balance = 0;
  for (const other of table.others) {
    const score = table.scores.get(other.playerId) ?? 0;
    // Never be the one to finish off somebody the bot is there to protect.
    if (score <= PROTECTED && other.life <= 1) return false;
    balance += Math.sign(score);
  }
  return balance > 0;
}

function choosePlay(table: Table): BangAction {
  const { legal } = table.me;
  const options = new Map<CardKind, PlayOption>();
  for (const option of legal.plays) {
    const kind = kindOf(table, option.cardId);
    if (kind !== undefined && !options.has(kind)) options.set(kind, option);
  }

  for (const kind of PLAY_AT_ONCE) {
    const option = options.get(kind);
    if (option) return playOn(option);
  }
  // A weapon is worth playing if it reaches further than the one held; a Volcanic, if there
  // are the BANG! cards to make use of it and no longer gun to give up for it.
  const bangs = table.me.hand.filter((card) => card.kind === 'bang').length;
  for (const [kind, option] of options) {
    const range = getWeaponRangeOf(kind);
    if (range === undefined) continue;
    const rapid = kind === 'volcanic' && bangs >= 2 && table.self.range <= range;
    if (range > table.self.range || rapid) return playOn(option);
  }
  const saloon = options.get('saloon');
  if (saloon && table.self.life < table.self.maxLife) return playOn(saloon);
  const dynamite = options.get('dynamite');
  if (dynamite && table.self.life > 3) return playOn(dynamite);

  for (const kind of ['gatling', 'indians'] as const) {
    const option = options.get(kind);
    if (option && worthHittingAll(table)) return playOn(option);
  }
  for (const kind of ['jail', 'panic', 'catBalou', 'bang', 'missed', 'duel'] as const) {
    const option = options.get(kind);
    if (!option) continue;
    const target = rankTargets(table, option)[0];
    if (!target) continue;
    // A duel is lost by whoever runs out of BANG! cards first: the hard bot does not start
    // one empty-handed against a full hand.
    if (kind === 'duel' && table.level === 'hard' && bangs < 1 && target.handCount >= 3) continue;
    const takes = kind === 'panic' || kind === 'catBalou';
    return playOn(option, target.playerId, takes ? chooseLoot(table, target) : null);
  }
  // Two cards that would be discarded anyway are better spent on a life point.
  if (legal.canHeal && legal.discardCount >= 2) {
    return { type: 'DISCARD_TO_HEAL', cardIds: cheapest(table, 2) };
  }
  return endTurn(table);
}

function chooseResponse(table: Table): BangAction {
  const { legal } = table.me;
  const pass: BangAction = { type: 'RESPOND', cardId: null };

  if (legal.prompt === 'DYING') {
    return legal.canHeal ? { type: 'DISCARD_TO_HEAL', cardIds: cheapest(table, 2) } : pass;
  }
  if (legal.responses.length === 0) return pass;
  if (table.level === 'easy') {
    return table.random.next() < EASY_PASS_CHANCE
      ? pass
      : { type: 'RESPOND', cardId: table.random.pick(legal.responses) };
  }
  // Half an answer to a shot that needs two is a card thrown away.
  const owed = table.view.pending?.missedNeeded ?? 0;
  if (legal.prompt === 'BANG' && legal.responses.length < owed) return pass;

  // Calamity Janet answers with whichever of her two kinds of card she can best spare.
  const wanted: CardKind = legal.prompt === 'BANG' ? 'missed' : 'bang';
  const cardId =
    legal.responses.find((id) => kindOf(table, id) === wanted) ?? legal.responses[0] ?? null;
  return { type: 'RESPOND', cardId };
}

function choosePick(table: Table): BangAction {
  const { legal } = table.me;
  const offered = table.view.pending?.cards ?? [];
  if (table.level === 'easy' || offered.length === 0) {
    return {
      type: 'PICK_CARDS',
      cardIds: table.random.shuffle(legal.picks).slice(0, legal.pickCount),
    };
  }
  const best = [...offered]
    .filter((card) => legal.picks.includes(card.id))
    // A blue card already on the table in front of the bot cannot be played a second time.
    .sort((a, b) => pickValue(table, b) - pickValue(table, a))
    .slice(0, legal.pickCount);
  return { type: 'PICK_CARDS', cardIds: best.map((card) => card.id) };
}

function pickValue(table: Table, card: CardView): number {
  const held = table.self.inPlay.some((inPlay) => inPlay.kind === card.kind);
  return isBlue(card.kind) && held ? 0 : KEEP_VALUE[card.kind];
}

function chooseDraw(table: Table): BangAction {
  const { legal } = table.me;
  const fromDeck: BangAction = { type: 'DRAW', source: 'deck', targetId: null };
  const fromDiscard: BangAction = { type: 'DRAW', source: 'discard', targetId: null };

  if (table.level === 'easy') {
    const options: BangAction[] = [fromDeck];
    if (legal.drawFromDiscard) options.push(fromDiscard);
    for (const targetId of legal.drawFromPlayers) {
      options.push({ type: 'DRAW', source: 'player', targetId });
    }
    return table.random.pick(options);
  }
  const top = table.view.discardTop;
  if (legal.drawFromDiscard && top && KEEP_VALUE[top.kind] >= 7) return fromDiscard;
  // A card from an enemy's hand is a card they no longer have.
  const victim = table.others
    .filter((other) => legal.drawFromPlayers.includes(other.playerId))
    .filter((other) => (table.scores.get(other.playerId) ?? 0) > 0)
    .sort((a, b) => (table.scores.get(b.playerId) ?? 0) - (table.scores.get(a.playerId) ?? 0))[0];
  return victim ? { type: 'DRAW', source: 'player', targetId: victim.playerId } : fromDeck;
}

/**
 * Plays from one seat's view alone. Easy plays any legal move; normal plays its role against
 * whoever has shown their hand; hard also works out how likely a stranger is to be a friend,
 * and picks off whoever is closest to going down.
 */
export const BangBot: BotStrategy<BangView, BangAction> = {
  chooseAction({ view, level, random }: BotDecisionInput<BangView>): BangAction {
    const me = view.me;
    const self = view.players.find((player) => player.playerId === me?.playerId);
    if (!me || !self || me.legal.prompt === null) {
      throw new Error('The match is not waiting on this seat.');
    }
    const table: Table = {
      view,
      me,
      level,
      random,
      self,
      others: view.players.filter((player) => player.alive && player.playerId !== me.playerId),
      hand: new Map(me.hand.map((card) => [card.id, card])),
      scores: scoreOthers(view, me, level),
    };

    switch (me.legal.prompt) {
      case 'PLAY':
        return level === 'easy' ? playAnything(table) : choosePlay(table);
      case 'STORE':
      case 'KIT':
        return choosePick(table);
      case 'DRAW':
        return chooseDraw(table);
      default:
        return chooseResponse(table);
    }
  },
};
