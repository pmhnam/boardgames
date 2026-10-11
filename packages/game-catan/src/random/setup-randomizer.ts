import { createSeededRandom, type SeededRandom } from '@bgp/game-core';
import type { FramePiece, Tile } from '../domain/default-board.js';
import { DEVELOPMENT_CARD_TYPES, type DevelopmentCardType } from '../domain/development-cards.js';
import {
  getTable,
  layFrame,
  type BoardSetup,
  type CatanConfig,
  type Port,
  type TableConfig,
} from '../domain/game-config.js';
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

/**
 * The frame pieces in a new order. A piece only fits where one of its own length was, so the
 * extension's short pieces change places among themselves and the long ones likewise.
 */
export function shuffleFrame(random: SeededRandom, pieces: readonly FramePiece[]): FramePiece[] {
  const shuffled = new Map<number, FramePiece[]>();
  for (const { length } of pieces) {
    if (shuffled.has(length)) continue;
    shuffled.set(length, random.shuffle(pieces.filter((piece) => piece.length === length)));
  }
  return pieces.map((piece) => {
    const next = shuffled.get(piece.length)?.shift();
    if (!next) throw new Error(`No frame piece of length ${piece.length} left`);
    return next;
  });
}

/** The variable setup: hexes at random, discs spiralling in from a corner, frame shuffled. */
function dealVariable(random: SeededRandom, table: TableConfig) {
  const terrains = random.shuffle(
    TERRAINS.flatMap((terrain) =>
      Array.from({ length: table.terrainCounts[terrain] }, () => terrain),
    ),
  );
  const corner = random.int(CORNER_COUNT);
  const pieces = shuffleFrame(random, table.frame.pieces);
  return {
    tiles: layNumberDiscs(table.hexes, terrains, table.numberDiscs, corner),
    ports: layFrame(table.hexes, table.frame.start, pieces),
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
  const table = getTable(config, input.playerCount);
  const startingPlayerIndex = random.int(input.playerCount);
  const developmentDeck = random.shuffle(
    DEVELOPMENT_CARD_TYPES.flatMap((type) =>
      Array.from({ length: table.developmentCards[type] }, () => type),
    ),
  );
  // The fixed setup is the base game's: `validateSetup` keeps larger tables away from it.
  const board =
    input.boardSetup === 'fixed'
      ? {
          tiles: config.fixedSetup.tiles.map((tile) => ({ ...tile })),
          ports: layFrame(config.hexes, config.frame.start, config.frame.pieces),
        }
      : dealVariable(random, table);
  return { ...board, developmentDeck, startingPlayerIndex };
}
