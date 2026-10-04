import type { Alignment, OutcomeReason, Role, Sighting } from '@bgp/game-avalon';

export const ROLE_LABEL: Record<Role, string> = {
  MERLIN: 'Merlin',
  PERCIVAL: 'Percival',
  LOYAL_SERVANT: 'Loyal Servant',
  ASSASSIN: 'Assassin',
  MORGANA: 'Morgana',
  MORDRED: 'Mordred',
  OBERON: 'Oberon',
  MINION: 'Minion of Mordred',
};

export const ROLE_BLURB: Record<Role, string> = {
  MERLIN:
    'You know who is evil. Guide the good side without being found out: if the Assassin names you at the end, evil wins.',
  PERCIVAL: 'You know who Merlin is. Keep the Assassin from working it out.',
  LOYAL_SERVANT: 'You know nobody. Work out who to trust and send good teams.',
  ASSASSIN: 'If good wins three quests, you name Merlin. Get it right and evil wins after all.',
  MORGANA: 'Percival sees you as he sees Merlin, and cannot tell you apart.',
  MORDRED: 'Merlin does not know you are evil.',
  OBERON: 'You do not know the rest of evil, and they do not know you.',
  MINION: 'Get onto quests and fail them without being found out.',
};

/** What a host is told an optional role adds. */
export const ROLE_EFFECT: Partial<Record<Role, string>> = {
  PERCIVAL: 'good, knows Merlin',
  MORGANA: 'evil, looks like Merlin to Percival',
  MORDRED: 'evil, hidden from Merlin',
  OBERON: 'evil, unknown to the rest of evil',
};

export const ALIGNMENT_LABEL: Record<Alignment, string> = { GOOD: 'Good', EVIL: 'Evil' };

export const SIGHTING_LABEL: Record<Sighting, string> = {
  EVIL: 'Evil',
  MERLIN_OR_MORGANA: 'Merlin or Morgana',
};

export const OUTCOME_TEXT: Record<OutcomeReason, string> = {
  QUESTS_FAILED: 'Evil wins: three quests failed.',
  TEAMS_REJECTED: 'Evil wins: the table could not agree on a team.',
  MERLIN_ASSASSINATED: 'Evil wins: the Assassin found Merlin.',
  MERLIN_SURVIVED: 'Good wins: three quests succeeded and Merlin survived.',
};

/** "Loyal Servant ×2" for roles dealt more than once, in the order the game lists them. */
export function describeRoles(roles: readonly Role[]): string {
  return [...new Set(roles)]
    .map((role) => {
      const count = roles.filter((dealt) => dealt === role).length;
      return count > 1 ? `${ROLE_LABEL[role]} ×${count}` : ROLE_LABEL[role];
    })
    .join(', ');
}
