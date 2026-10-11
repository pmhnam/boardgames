import { describe, expect, it } from 'vitest';
import {
  TERRAIN_KINDS,
  classifyStack,
  isTerrain,
  stackAt,
  terrainKindOf,
  type PlayerBoard,
} from '../src/domain/board.js';
import { getAnimalSlot, getHabitatShape } from '../src/domain/cards.js';
import {
  HEX_ROTATIONS,
  hexKey,
  hexKeyAt,
  hexNeighbours,
  knownHex,
  neighbourKeys,
  parseHexKey,
} from '../src/domain/hex.js';
import { TOKEN_COLORS, type TokenColor } from '../src/domain/tokens.js';
import { getCubeTargets } from '../src/rules/habitat.rules.js';
import { getLegalTokenCells, validateTokenPlacement } from '../src/rules/token-placement.rules.js';
import { boardWith, cards, config, setupB } from './fixtures/states.js';

// The rules are asked the same small questions millions of times while a bot thinks, so some
// of them have a quicker way to the same answer. These hold the quick way to the plain one.

/** Every stack of up to three tokens, legal or not. */
const STACKS: TokenColor[][] = [[]];
for (let height = 1; height <= 3; height++) {
  for (const below of STACKS.filter((stack) => stack.length === height - 1)) {
    for (const color of TOKEN_COLORS) STACKS.push([...below, color]);
  }
}

describe('cell keys', () => {
  it('gives a cell the same key however it is asked for, on the table of keys and off it', () => {
    for (let q = -30; q <= 30; q++) {
      for (let r = -30; r <= 30; r++) {
        expect(hexKeyAt(q, r)).toBe(`${q},${r}`);
        expect(hexKey({ q, r })).toBe(`${q},${r}`);
      }
    }
  });

  it('reads a key back into its cell', () => {
    for (const key of ['0,0', '4,-2', '-3,7', '40,-40']) {
      expect(parseHexKey(key)).toEqual(knownHex(key));
      expect(hexKey(knownHex(key))).toBe(key);
    }
  });

  it('remembers a cell read from its key, and keeps it from being changed', () => {
    expect(knownHex('2,1')).toBe(knownHex('2,1'));
    expect(Object.isFrozen(knownHex('2,1'))).toBe(true);
    // The plain reading is a cell of the caller's own.
    expect(parseHexKey('2,1')).not.toBe(parseHexKey('2,1'));
  });

  it('names the six cells around a cell in the order the directions go', () => {
    for (const key of ['0,0', '2,-1', '-5,3', '30,30']) {
      expect(neighbourKeys(key)).toEqual(hexNeighbours(parseHexKey(key)).map(hexKey));
    }
  });
});

describe('what a stack counts as', () => {
  it('says the kind of a stack as its full classification does', () => {
    for (const stack of STACKS) {
      expect(terrainKindOf(stack)).toBe(classifyStack(stack)?.kind ?? null);
    }
  });

  it('says whether a stack is a terrain of a height as its full classification does', () => {
    for (const stack of STACKS) {
      const terrain = classifyStack(stack);
      for (const kind of TERRAIN_KINDS) {
        for (let height = 0; height <= 4; height++) {
          expect(isTerrain(stack, kind, height)).toBe(
            terrain !== null && terrain.kind === kind && terrain.height === height,
          );
        }
      }
    }
  });

  it('finds nothing on an empty cell, and nothing can be added to that nothing', () => {
    const empty = stackAt(boardWith({}), { q: 0, r: 0 });
    expect(empty).toEqual([]);
    expect(() => empty.push('water')).toThrow();
  });
});

describe('the shape of a habitat', () => {
  it('lays out every card in the six rotations of its cells around the animal', () => {
    for (const card of cards) {
      const slot = getAnimalSlot(card);
      const others = card.habitat.cells.filter((cell) => !cell.animalSlot);
      const shape = getHabitatShape(card);
      expect(shape.slot).toBe(slot);
      expect(shape.others).toEqual(others);
      expect(shape.rotations).toEqual(
        HEX_ROTATIONS.map((rotate) =>
          others.map((part) => rotate({ q: part.q - slot.q, r: part.r - slot.r })),
        ),
      );
      // Worked out once for a card.
      expect(getHabitatShape(card)).toBe(shape);
    }
  });

  it('hands out cells for an animal that are the caller’s own', () => {
    // animal-05: the animal goes on water with a height-1 tree next to it.
    const card = cards.find((candidate) => candidate.id === 'animal-05');
    if (!card) throw new Error('fixture card missing');
    const board = boardWith({ '2,1': ['water'], '3,1': ['leaf'] } as PlayerBoard['stacks']);
    const targets = getCubeTargets(board, card);
    expect(targets).toEqual([{ q: 2, r: 1 }]);
    expect(targets.every((cell) => !Object.isFrozen(cell))).toBe(true);
  });
});

describe('where a token may go', () => {
  const stacks = {
    '0,0': ['water'],
    '1,0': ['field'],
    '2,0': ['mountain'],
    '2,1': ['mountain', 'mountain', 'mountain'],
    '3,0': ['trunk'],
    '3,1': ['trunk', 'trunk'],
    '4,-1': ['trunk', 'leaf'],
    '4,0': ['building'],
    '1,1': ['mountain', 'building'],
  } as PlayerBoard['stacks'];
  const board = boardWith(stacks, { cubes: ['2,0', '3,0'] });

  it('lists exactly the cells of the map that pass the placement rule', () => {
    for (const setup of [config, setupB]) {
      for (const color of TOKEN_COLORS) {
        expect(getLegalTokenCells(setup, board, color)).toEqual(
          setup.boardCells.filter(
            (cell) => validateTokenPlacement(setup, board, color, cell).valid,
          ),
        );
      }
    }
  });
});
