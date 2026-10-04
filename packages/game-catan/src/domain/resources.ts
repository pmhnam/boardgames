export const RESOURCES = ['brick', 'wood', 'wool', 'wheat', 'ore'] as const;
export type Resource = (typeof RESOURCES)[number];
export type ResourceCounts = Record<Resource, number>;

export const TERRAINS = ['hills', 'forest', 'pasture', 'fields', 'mountains', 'desert'] as const;
export type Terrain = (typeof TERRAINS)[number];

/** What each terrain produces. The desert produces nothing. */
export const TERRAIN_RESOURCE: Record<Terrain, Resource | null> = {
  hills: 'brick',
  forest: 'wood',
  pasture: 'wool',
  fields: 'wheat',
  mountains: 'ore',
  desert: null,
};

export function isResource(value: unknown): value is Resource {
  return RESOURCES.includes(value as Resource);
}

export function isTerrain(value: unknown): value is Terrain {
  return TERRAINS.includes(value as Terrain);
}

export function emptyResources(): ResourceCounts {
  return { brick: 0, wood: 0, wool: 0, wheat: 0, ore: 0 };
}

/** `base` plus (or, with sign -1, minus) `delta`. */
export function addResources(
  base: Readonly<ResourceCounts>,
  delta: Readonly<Partial<ResourceCounts>>,
  sign: 1 | -1 = 1,
): ResourceCounts {
  const result = { ...base };
  for (const resource of RESOURCES) result[resource] += sign * (delta[resource] ?? 0);
  return result;
}

export function countResources(counts: Readonly<Partial<ResourceCounts>>): number {
  return RESOURCES.reduce((sum, resource) => sum + (counts[resource] ?? 0), 0);
}

export function hasResources(
  held: Readonly<ResourceCounts>,
  needed: Readonly<Partial<ResourceCounts>>,
): boolean {
  return RESOURCES.every((resource) => held[resource] >= (needed[resource] ?? 0));
}

/** A full count from a partial one. */
export function resources(counts: Readonly<Partial<ResourceCounts>> = {}): ResourceCounts {
  return addResources(emptyResources(), counts);
}
