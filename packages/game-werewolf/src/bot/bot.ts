import type { BotDecisionInput, BotStrategy, SeededRandom } from '@bgp/game-core';
import type { WerewolfAction } from '../domain/actions.js';
import { isWolf } from '../domain/roles.js';
import type { MyView, WerewolfView } from '../visibility/public-view.js';

/** How often the easy witch spends a potion she could keep. */
const EASY_HEAL_CHANCE = 0.5;
const EASY_POISON_CHANCE = 0.15;
/** Votes a player must have drawn before the hard witch spends her poison on them. */
const POISON_SUSPICION = 2;

/** The players this bot will not turn on: its lover and, for a werewolf, the pack. */
function getAllies(view: WerewolfView, me: MyView): string[] {
  const allies = view.lovers?.includes(me.playerId) ? [...view.lovers] : [];
  if (isWolf(me.role)) {
    for (const player of view.players) {
      if (player.role !== null && isWolf(player.role)) allies.push(player.playerId);
    }
  }
  return allies.filter((playerId) => playerId !== me.playerId);
}

/** The options left after setting some aside, or all of them if that leaves none. */
function prefer(options: readonly string[], unwanted: readonly string[]): string[] {
  const kept = options.filter((option) => !unwanted.includes(option));
  return kept.length > 0 ? kept : [...options];
}

/** Votes each player drew the last time the village voted. */
function getLastVotes(view: WerewolfView): Map<string, number> {
  const drawn = new Map<string, number>();
  const last = view.log.findLast((entry) => entry.type === 'VOTE');
  if (last?.type !== 'VOTE') return drawn;
  for (const { targetId } of last.votes) {
    if (targetId !== null) drawn.set(targetId, (drawn.get(targetId) ?? 0) + 1);
  }
  return drawn;
}

/** Whoever among the options the village leaned on hardest last time, if it leaned on anyone. */
function findSuspect(view: WerewolfView, options: readonly string[], atLeast = 1): string | null {
  const drawn = getLastVotes(view);
  let suspect: string | null = null;
  let most = atLeast - 1;
  for (const option of options) {
    const votes = drawn.get(option) ?? 0;
    if (votes > most) {
      suspect = option;
      most = votes;
    }
  }
  return suspect;
}

/** Who this bot wants gone, by day or with a last shot. */
function chooseAccused(
  view: WerewolfView,
  me: MyView,
  level: BotDecisionInput<WerewolfView>['level'],
  random: SeededRandom,
): string {
  const targets = me.legal.targets;
  if (level === 'easy') return random.pick(targets);

  const found = me.inspections.filter((seen) => seen.isWolf).map((seen) => seen.targetId);
  const caught = targets.find((targetId) => found.includes(targetId));
  if (caught !== undefined) return caught;

  const cleared = me.inspections.filter((seen) => !seen.isWolf).map((seen) => seen.targetId);
  const options = prefer(prefer(targets, getAllies(view, me)), cleared);
  const suspect = level === 'hard' ? findSuspect(view, options) : null;
  return suspect ?? random.pick(options);
}

function chooseVictim(view: WerewolfView, me: MyView, random: SeededRandom): string {
  const targets = me.legal.targets;
  // A pack that splits its votes attacks nobody: follow whoever chose first.
  const lead = me.packVotes.find((vote) => targets.includes(vote.targetId));
  if (lead) return lead.targetId;
  return random.pick(prefer(targets, getAllies(view, me)));
}

function chooseWitch(
  view: WerewolfView,
  me: MyView,
  level: BotDecisionInput<WerewolfView>['level'],
  random: SeededRandom,
): WerewolfAction {
  const { canHeal, targets } = me.legal;
  if (level === 'easy') {
    const poisons = targets.length > 0 && random.next() < EASY_POISON_CHANCE;
    return {
      type: 'WITCH_DECIDE',
      heal: canHeal && random.next() < EASY_HEAL_CHANCE,
      poisonTargetId: poisons ? random.pick(targets) : null,
    };
  }
  const suspect =
    level === 'hard'
      ? findSuspect(view, prefer(targets, getAllies(view, me)), POISON_SUSPICION)
      : null;
  const poisonTargetId = suspect !== null && targets.includes(suspect) ? suspect : null;
  return { type: 'WITCH_DECIDE', heal: canHeal, poisonTargetId };
}

function chooseCouple(
  me: MyView,
  level: BotDecisionInput<WerewolfView>['level'],
  random: SeededRandom,
): WerewolfAction {
  const pool = level === 'easy' ? me.legal.targets : prefer(me.legal.targets, [me.playerId]);
  const [firstId, secondId] = random.shuffle(pool);
  if (firstId === undefined || secondId === undefined) throw new Error('Cupid needs two players.');
  return { type: 'CUPID_LINK', firstId, secondId };
}

/**
 * A seat-filler rather than a mind reader: it cannot talk, so it plays its role's night
 * action sensibly and votes on what it has seen. Easy picks any legal move; normal protects
 * its allies and acts on what its role knows; hard also follows where the last vote leaned.
 */
export const WerewolfBot: BotStrategy<WerewolfView, WerewolfAction> = {
  chooseAction({ view, level, random }) {
    const me = view.me;
    if (!me || me.legal.action === null) throw new Error('This seat has nothing to do.');
    const targets = me.legal.targets;

    switch (me.legal.action) {
      case 'SLEEP':
        return { type: 'SLEEP' };
      case 'READY_TO_VOTE':
        return { type: 'READY_TO_VOTE' };
      case 'CUPID_LINK':
        return chooseCouple(me, level, random);
      case 'WOLF_VOTE':
        return { type: 'WOLF_VOTE', targetId: chooseVictim(view, me, random) };
      case 'SEER_INSPECT': {
        const seen = me.inspections.map((inspection) => inspection.targetId);
        const unknown = level === 'easy' ? targets : prefer(targets, seen);
        return { type: 'SEER_INSPECT', targetId: random.pick(unknown) };
      }
      case 'GUARD_PROTECT':
        return { type: 'GUARD_PROTECT', targetId: random.pick(targets) };
      case 'WITCH_DECIDE':
        return chooseWitch(view, me, level, random);
      case 'CAST_VOTE':
        return { type: 'CAST_VOTE', targetId: chooseAccused(view, me, level, random) };
      case 'HUNTER_SHOOT':
        return { type: 'HUNTER_SHOOT', targetId: chooseAccused(view, me, level, random) };
    }
  },
};
