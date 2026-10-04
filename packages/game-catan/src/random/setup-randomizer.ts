import { createSeededRandom, type SeededRandom } from '@bgp/game-core';
import type { FramePiece, Tile } from '../domain/default-board.js';
import { DEVELOPMENT_CARD_TYPES, type DevelopmentCardType } from '../domain/development-cards.js';
import { layFrame, type BoardSetup, type CatanConfig, type Port } from '../domain/game-config.js';
import { hexKey, type Hex } from '../domain/hex.js';
import { TERRAINS, type Terrain } from '../domain/resources.js';
import { CORNER_COUNT, listSpiral } from '../domain/spiral.js';

export interface RandomSetup {
  /** One tile per hex, in the order of the config's hexes. */
  tiles: Tile[];
  /** Where the frame pieces put the ports. */
  ports: Port[];
  /** Shuffled. Cards are drawn from the end. */
  developmentDeck: DevelopmentCardType[];
  startingPlayerIndex: number;
}

/**
 * Lays the number discs in their letter order along the spiral from one corner of the island,
 * passing over the deserts.
 */
export function layNumberDiscs(
  hexes: readonly Hex[],
  terrains: readonly Terrain[],
  discs: readonly number[],
  corner: number,
): Tile[] {
  const terrainAt = new Map(hexes.map((hex, index) => [hexKey(hex), terrains[index]]));
  const numberAt = new Map<string, number>();
  let next = 0;
  for (const hex of listSpiral(hexes, corner)) {
    if (terrainAt.get(hexKey(hex)) === 'desert') continue;
    const disc = discs[next];
    if (disc !== undefined) numberAt.set(hexKey(hex), disc);
    next += 1;
  }
  return hexes.map((hex, index) => ({
    terrain: terrains[index] as Terrain,
    number: numberAt.get(hexKey(hex)) ?? null,
  }));
}

/** The variable setup: hexes at random, discs spiralling in from a corner, frame shuffled. */
function dealVariable(random: SeededRandom, config: CatanConfig) {
  const terrains = random.shuffle(
    TERRAINS.flatMap((terrain) =>
      Array.from({ length: config.terrainCounts[terrain] }, () => terrain),
    ),
  );
  const corner = random.int(CORNER_COUNT);
  const pieces: FramePiece[] = random.shuffle(config.frame.pieces);
  return {
    tiles: layNumberDiscs(config.hexes, terrains, config.numberDiscs, corner),
    ports: layFrame(config.hexes, config.frame.start, pieces),
  };
}

/**
 * Everything the seed decides before the first turn. Dice and robbery are drawn during the
 * match: see `drawRandom`.
 */
export function randomizeSetup(input: {
  seed: string;
  playerCount: number;
  config: CatanConfig;
  boardSetup: BoardSetup;
}): RandomSetup {
  const random = createSeededRandom(input.seed);
  const { config } = input;
  const startingPlayerIndex = random.int(input.playerCount);
  const developmentDeck = random.shuffle(
    DEVELOPMENT_CARD_TYPES.flatMap((type) =>
      Array.from({ length: config.developmentCards[type] }, () => type),
    ),
  );
  const board =
    input.boardSetup === 'fixed'
      ? {
          tiles: config.fixedSetup.tiles.map((tile) => ({ ...tile })),
          ports: layFrame(config.hexes, config.frame.start, config.frame.pieces),
        }
      : dealVariable(random, config);
  return { ...board, developmentDeck, startingPlayerIndex };
}
