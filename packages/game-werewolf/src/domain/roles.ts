export const ROLE_IDS = [
  'villager',
  'werewolf',
  'alphaWerewolf',
  'seer',
  'bodyguard',
  'witch',
  'hunter',
  'cupid',
  'elder',
  'idiot',
] as const;
export type RoleId = (typeof ROLE_IDS)[number];

/** Every role but the plain villager, who fills whatever seats the others leave. */
export const SPECIAL_ROLE_IDS = [
  'werewolf',
  'alphaWerewolf',
  'seer',
  'bodyguard',
  'witch',
  'hunter',
  'cupid',
  'elder',
  'idiot',
] as const satisfies readonly RoleId[];
export type SpecialRoleId = (typeof SPECIAL_ROLE_IDS)[number];

export type Faction = 'village' | 'werewolves';

/** What a role does while the rest of the village sleeps. */
export type NightDuty = 'WOLF_VOTE' | 'SEER_INSPECT' | 'GUARD_PROTECT';

export interface RoleDefinition {
  faction: Faction;
  /** The action the role owes in the main step of every night, if it has one. */
  nightDuty: NightDuty | null;
  /** Lost for good if the village executes an elder. */
  isVillagePower: boolean;
}

/** The rules look roles up here rather than branching on their names. */
export const ROLES: Record<RoleId, RoleDefinition> = {
  villager: { faction: 'village', nightDuty: null, isVillagePower: false },
  werewolf: { faction: 'werewolves', nightDuty: 'WOLF_VOTE', isVillagePower: false },
  alphaWerewolf: { faction: 'werewolves', nightDuty: 'WOLF_VOTE', isVillagePower: false },
  seer: { faction: 'village', nightDuty: 'SEER_INSPECT', isVillagePower: true },
  bodyguard: { faction: 'village', nightDuty: 'GUARD_PROTECT', isVillagePower: true },
  witch: { faction: 'village', nightDuty: null, isVillagePower: true },
  hunter: { faction: 'village', nightDuty: null, isVillagePower: true },
  cupid: { faction: 'village', nightDuty: null, isVillagePower: false },
  elder: { faction: 'village', nightDuty: null, isVillagePower: false },
  idiot: { faction: 'village', nightDuty: null, isVillagePower: false },
};

export type RoleCounts = Record<RoleId, number>;
export type SpecialRoleCounts = Record<SpecialRoleId, number>;

export function isRoleId(value: unknown): value is RoleId {
  return typeof value === 'string' && (ROLE_IDS as readonly string[]).includes(value);
}

export function isWolf(role: RoleId): boolean {
  return ROLES[role].faction === 'werewolves';
}

export function countWolves(roles: Partial<SpecialRoleCounts>): number {
  return SPECIAL_ROLE_IDS.reduce((sum, role) => sum + (isWolf(role) ? (roles[role] ?? 0) : 0), 0);
}
