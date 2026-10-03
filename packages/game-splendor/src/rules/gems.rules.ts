import type { GameValidationResult } from '@bgp/game-core';
import { DIFFERENT_GEMS_TAKEN, DOUBLE_TAKE_MIN_PILE, TOKEN_LIMIT } from '../domain/config.js';
import { SplendorRuleCodes } from '../domain/errors.js';
import {
  GEM_COLORS,
  TOKEN_COLORS,
  countTokens,
  type GemColor,
  type TokenCounts,
} from '../domain/gems.js';

/** The colours the bank still has a gem of. */
export function getAvailableGemColors(bank: Readonly<TokenCounts>): GemColor[] {
  return GEM_COLORS.filter((color) => bank[color] > 0);
}

/** The colours whose pile is big enough to take two from. */
export function getDoubleColors(bank: Readonly<TokenCounts>): GemColor[] {
  return GEM_COLORS.filter((color) => bank[color] >= DOUBLE_TAKE_MIN_PILE);
}

/** How many different colours a player must take: three, or as many as the bank has left. */
export function getTakeCount(bank: Readonly<TokenCounts>): number {
  return Math.min(DIFFERENT_GEMS_TAKEN, getAvailableGemColors(bank).length);
}

export function validateTakeGems(
  bank: Readonly<TokenCounts>,
  colors: readonly GemColor[],
): GameValidationResult {
  const [first, second] = colors;
  if (colors.length === 2 && first !== undefined && first === second) {
    if (bank[first] < DOUBLE_TAKE_MIN_PILE) {
      return {
        valid: false,
        code: SplendorRuleCodes.DoubleNeedsFour,
        message: `Two gems of one colour need a pile of at least ${DOUBLE_TAKE_MIN_PILE}.`,
      };
    }
    return { valid: true };
  }

  if (new Set(colors).size !== colors.length) {
    return {
      valid: false,
      code: SplendorRuleCodes.InvalidGemSelection,
      message: 'Take gems of different colours, or exactly two of one colour.',
    };
  }
  if (colors.some((color) => bank[color] === 0)) {
    return {
      valid: false,
      code: SplendorRuleCodes.GemsNotAvailable,
      message: 'The bank has none of that colour left.',
    };
  }
  const takeCount = getTakeCount(bank);
  if (colors.length !== takeCount) {
    return {
      valid: false,
      code: SplendorRuleCodes.InvalidGemSelection,
      message: `Take ${takeCount} gems of different colours.`,
    };
  }
  return { valid: true };
}

/** How many tokens a player holds over the limit. */
export function getExcessTokens(tokens: Readonly<TokenCounts>): number {
  return Math.max(0, countTokens(tokens) - TOKEN_LIMIT);
}

/** A return must bring the player down to the limit exactly, with tokens they hold. */
export function validateReturnGems(
  tokens: Readonly<TokenCounts>,
  returned: Readonly<Partial<TokenCounts>>,
): GameValidationResult {
  const excess = getExcessTokens(tokens);
  if (TOKEN_COLORS.some((color) => (returned[color] ?? 0) > tokens[color])) {
    return {
      valid: false,
      code: SplendorRuleCodes.InvalidReturn,
      message: 'You cannot return tokens you do not hold.',
    };
  }
  if (countTokens(returned) !== excess) {
    return {
      valid: false,
      code: SplendorRuleCodes.InvalidReturn,
      message: `Return exactly ${excess} tokens.`,
    };
  }
  return { valid: true };
}
