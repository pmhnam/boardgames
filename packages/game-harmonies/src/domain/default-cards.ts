import type { AnimalCard, CardTerrain, HabitatCell } from './cards.js';

/** [q, r, terrain, height, animalSlot?] */
type CellSpec = [number, number, CardTerrain, number, true?];

function card(
  sourceId: number,
  name: string,
  pointsByAnimalsPlaced: number[],
  cells: CellSpec[],
): AnimalCard {
  return {
    id: `animal-${String(sourceId).padStart(2, '0')}`,
    sourceId,
    name,
    pointsByAnimalsPlaced,
    habitat: {
      cells: cells.map(([q, r, terrain, height, animalSlot]): HabitatCell => ({
        q,
        r,
        terrain,
        height,
        animalSlot: animalSlot === true,
      })),
    },
  };
}

const SLOT = true;

/**
 * The 32 animal cards of the base set: habitats and scores as supplied for this project. The
 * Vietnamese names are ours (the source data has none) and, like everything here, can be changed
 * in the stored config. This only seeds the first stored config.
 */
// prettier-ignore
export const DEFAULT_ANIMAL_CARDS: readonly AnimalCard[] = [
  card(1, 'Rái cá', [0, 4, 9, 15], [[0, 0, 'TREE', 3], [-1, 0, 'WATER', 1], [-2, 0, 'WATER', 1, SLOT]]),
  card(2, 'Cá hồi', [0, 4, 10, 16], [[0, 0, 'MOUNTAIN', 1], [-1, 1, 'MOUNTAIN', 1], [-1, 0, 'WATER', 1, SLOT]]),
  card(3, 'Kỳ nhông', [0, 3, 6, 10, 16], [[0, 0, 'MOUNTAIN', 3], [-1, 0, 'WATER', 1, SLOT]]),
  card(4, 'Ếch', [0, 5, 10, 16], [[0, 0, 'TREE', 1], [-1, 0, 'TREE', 1], [-2, 0, 'WATER', 1, SLOT]]),
  card(5, 'Vịt', [0, 2, 4, 6, 10, 15], [[0, 0, 'TREE', 1], [-1, 0, 'WATER', 1, SLOT]]),
  card(6, 'Thiên nga', [0, 2, 4, 8, 13], [[0, 0, 'BUILDING', 2], [-1, 0, 'WATER', 1, SLOT]]),
  card(7, 'Hồng hạc', [0, 4, 10, 16], [[0, 0, 'FIELD', 1], [-1, 0, 'WATER', 1, SLOT], [-1, 1, 'FIELD', 1]]),
  card(8, 'Chuột', [0, 5, 10, 16], [[0, 0, 'FIELD', 1], [-1, 0, 'FIELD', 1], [-2, 0, 'BUILDING', 2, SLOT]]),
  card(9, 'Mèo', [0, 5, 10, 17], [[0, 0, 'FIELD', 1], [0, -1, 'BUILDING', 2, SLOT], [-1, -1, 'FIELD', 1]]),
  card(10, 'Cò', [0, 5, 10, 17], [[0, 0, 'WATER', 1], [0, -1, 'BUILDING', 2, SLOT], [-1, -1, 'WATER', 1]]),
  card(11, 'Cú mèo', [0, 4, 9, 15], [[0, 0, 'TREE', 3], [-1, 0, 'BUILDING', 2, SLOT]]),
  card(12, 'Dơi', [0, 5, 12], [[0, 0, 'TREE', 2], [-1, 0, 'BUILDING', 2, SLOT], [-1, 1, 'TREE', 2]]),
  card(13, 'Chim sẻ', [0, 8, 18], [[0, 0, 'FIELD', 1], [0, -1, 'TREE', 2, SLOT], [-1, 0, 'FIELD', 1], [-1, -1, 'FIELD', 1]]),
  card(14, 'Sóc', [0, 5, 11], [[0, 0, 'MOUNTAIN', 2], [-1, 0, 'TREE', 1, SLOT], [-1, 1, 'MOUNTAIN', 2]]),
  card(15, 'Quạ', [0, 5, 10, 17], [[0, 0, 'BUILDING', 2], [-1, 0, 'TREE', 1], [-2, 0, 'TREE', 1, SLOT]]),
  card(16, 'Bói cá', [0, 4, 9, 14], [[0, 0, 'WATER', 1], [-1, 0, 'TREE', 2, SLOT], [-1, 1, 'WATER', 1]]),
  card(17, 'Chim sâu', [0, 4, 8, 13], [[0, 0, 'BUILDING', 2], [-1, 0, 'TREE', 2, SLOT]]),
  card(18, 'Khỉ', [0, 3, 6, 10, 15], [[0, 0, 'TREE', 1], [-1, 0, 'TREE', 2, SLOT]]),
  card(19, 'Vẹt', [0, 4, 10, 16], [[0, 0, 'FIELD', 1], [-1, 0, 'TREE', 3, SLOT], [-1, 1, 'FIELD', 1]]),
  card(20, 'Diệc', [0, 5, 11, 18], [[0, 0, 'WATER', 1], [0, -1, 'TREE', 3, SLOT], [-1, -1, 'WATER', 1]]),
  card(21, 'Hải ly', [0, 4, 10, 16], [[0, 0, 'WATER', 1], [0, -1, 'MOUNTAIN', 1, SLOT], [-1, -1, 'WATER', 1]]),
  card(22, 'Gấu', [0, 3, 6, 10, 15], [[0, 0, 'TREE', 3], [-1, 0, 'MOUNTAIN', 1, SLOT]]),
  card(23, 'Dê núi', [0, 4, 9, 16], [[0, 0, 'FIELD', 1], [-1, 0, 'MOUNTAIN', 1], [-2, 0, 'MOUNTAIN', 1, SLOT]]),
  card(24, 'Hải cẩu', [0, 5, 11], [[0, 0, 'WATER', 1], [-1, 0, 'MOUNTAIN', 2, SLOT], [-1, 1, 'WATER', 1]]),
  card(25, 'Đại bàng', [0, 5, 11], [[0, 0, 'FIELD', 1], [-1, 0, 'MOUNTAIN', 3, SLOT]]),
  card(26, 'Sói', [0, 2, 5, 9, 14], [[0, 0, 'FIELD', 1], [-1, 0, 'MOUNTAIN', 1, SLOT]]),
  card(27, 'Gà', [0, 4, 9], [[0, 0, 'BUILDING', 2], [0, -1, 'FIELD', 1, SLOT], [-1, -1, 'BUILDING', 2]]),
  card(28, 'Ngựa', [0, 5, 12], [[0, 0, 'MOUNTAIN', 2], [-1, 0, 'FIELD', 1], [-2, 0, 'FIELD', 1, SLOT]]),
  card(29, 'Hươu', [0, 5, 10, 17], [[0, 0, 'TREE', 2], [0, -1, 'FIELD', 1, SLOT], [-1, -1, 'TREE', 2]]),
  card(30, 'Trâu', [0, 6, 12], [[0, 0, 'WATER', 1], [0, -1, 'FIELD', 1, SLOT], [-1, 0, 'WATER', 1], [-1, -1, 'WATER', 1]]),
  card(31, 'Thỏ', [0, 2, 5, 8, 12, 17], [[0, 0, 'TREE', 1], [-1, 0, 'FIELD', 1, SLOT]]),
  card(32, 'Lợn rừng', [0, 5, 11], [[0, 0, 'TREE', 2], [-1, 0, 'TREE', 2], [-2, 0, 'FIELD', 1, SLOT]]),
];
