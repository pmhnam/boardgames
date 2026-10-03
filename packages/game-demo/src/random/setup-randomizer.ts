import { createSeededRandom } from '@bgp/game-core';

export interface RandomSetup {
  blockedIndexes: number[];
  startingPlayerId: string;
}

export function randomizeSetup(input: {
  seed: string;
  cellCount: number;
  blockedCount: number;
  playerIds: readonly string[];
}): RandomSetup {
  const random = createSeededRandom(input.seed);
  const allIndexes = Array.from({ length: input.cellCount }, (_, index) => index);
  const blockedIndexes = random.shuffle(allIndexes).slice(0, input.blockedCount);
  const startingPlayerId = random.pick(input.playerIds);
  return { blockedIndexes, startingPlayerId };
}
