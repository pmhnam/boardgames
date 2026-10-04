import { createSeededRandom, type SeededRandom } from '@bgp/game-core';
import type { Tile } from '../domain/default-board.js';
import { DEVELOPMENT_CARD_TYPES, type DevelopmentCardType } from '../domain/development-cards.js';
import type { BoardSetup, CatanConfig } from '../domain/game-config.js';
import { hexKey, hexNeighbours, type Hex } from '../domain/hex.js';
import { TERRAINS, type Terrain } from '../domain/resources.js';

export interface RandomSetup {
  /** One tile per hex, in the order of the config's hexes. */
  tiles: Tile[];
  /** Shuffled. Cards are drawn from the end. */
  developmentDeck: DevelopmentCardType[];
  startingPlayerIndex: number;
}

/** The numbers rolled most often, printed in red on the tokens. */
const RED_NUMBERS = [6, 8];
/** How many times a random board is dealt again to keep the red numbers apart. */
const MAX_DEALS = 500;

function hasRedNeighbours(hexes: readonly Hex[], tiles: readonly Tile[]): boolean {
  const isRed = (tile: Tile | undefined) =>
    tile !== undefined && RED_NUMBERS.includes(tile.number ?? 0);
  const byKey = new Map(hexes.map((hex, index) => [hexKey(hex), tiles[index]]));
  return hexes.some(
    (hex, index) =>
      isRed(tiles[index]) &&
      hexNeighbours(hex).some((neighbour) => isRed(byKey.get(hexKey(neighbour)))),
  );
}

function dealNumbers(
  random: SeededRandom,
  terrains: readonly Terrain[],
  numberTokens: readonly number[],
): Tile[] {
  const numbers = random.shuffle(numberTokens);
  return terrains.map((terrain) => ({
    terrain,
    number: terrain === 'desert' ? null : (numbers.pop() ?? null),
  }));
}

function randomTiles(random: SeededRandom, config: CatanConfig): Tile[] {
  const terrains = random.shuffle(
    TERRAINS.flatMap((terrain) =>
      Array.from({ length: config.terrainCounts[terrain] }, () => terrain),
    ),
  );
  let tiles = dealNumbers(random, terrains, config.numberTokens);
  if (!config.keepRedNumbersApart) return tiles;

  // Some sets of tokens cannot be kept apart at all: after enough deals, play the last one.
  for (let deal = 1; deal < MAX_DEALS && hasRedNeighbours(config.hexes, tiles); deal += 1) {
    tiles = dealNumbers(random, terrains, config.numberTokens);
  }
  return tiles;
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
  const tiles =
    input.boardSetup === 'beginner'
      ? config.beginnerTiles.map((tile) => ({ ...tile }))
      : randomTiles(random, config);
  return { tiles, developmentDeck, startingPlayerIndex };
}
