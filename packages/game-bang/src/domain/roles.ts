export const ROLE_IDS = ['sheriff', 'deputy', 'outlaw', 'renegade'] as const;
export type RoleId = (typeof ROLE_IDS)[number];

export type RoleCounts = Record<RoleId, number>;

/** The roles dealt besides the sheriff, of whom there is always exactly one. */
export type OtherRoleCounts = Record<Exclude<RoleId, 'sheriff'>, number>;

/** Who a match can be won by. The law is the sheriff and the deputies together. */
export type Winner = 'law' | 'outlaws' | 'renegade';
