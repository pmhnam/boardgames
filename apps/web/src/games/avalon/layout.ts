import type { Role } from '@bgp/game-avalon';

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

/** What a host is told an optional role adds. */
export const ROLE_EFFECT: Partial<Record<Role, string>> = {
  PERCIVAL: 'good, knows Merlin',
  MORGANA: 'evil, looks like Merlin to Percival',
  MORDRED: 'evil, hidden from Merlin',
  OBERON: 'evil, unknown to the rest of evil',
};
