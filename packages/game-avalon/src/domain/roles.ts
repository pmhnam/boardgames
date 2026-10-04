/** Every role, good first. Lists of roles shown to players keep this order. */
export const ROLES = [
  'MERLIN',
  'PERCIVAL',
  'LOYAL_SERVANT',
  'ASSASSIN',
  'MORGANA',
  'MORDRED',
  'OBERON',
  'MINION',
] as const;
export type Role = (typeof ROLES)[number];

export type Alignment = 'GOOD' | 'EVIL';

/** Roles a host may add. Merlin and the Assassin are always in play. */
export const OPTIONAL_ROLES = ['PERCIVAL', 'MORGANA', 'MORDRED', 'OBERON'] as const;
export type OptionalRole = (typeof OPTIONAL_ROLES)[number];

const ALIGNMENTS: Record<Role, Alignment> = {
  MERLIN: 'GOOD',
  PERCIVAL: 'GOOD',
  LOYAL_SERVANT: 'GOOD',
  ASSASSIN: 'EVIL',
  MORGANA: 'EVIL',
  MORDRED: 'EVIL',
  OBERON: 'EVIL',
  MINION: 'EVIL',
};

export function alignmentOf(role: Role): Alignment {
  return ALIGNMENTS[role];
}

export function isOptionalRole(value: unknown): value is OptionalRole {
  return OPTIONAL_ROLES.includes(value as OptionalRole);
}
