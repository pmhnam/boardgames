import type { ParseActionResult } from '@bgp/game-core';
import type { SplendorAction } from '../domain/actions.js';
import { isTier } from '../domain/cards.js';
import { DIFFERENT_GEMS_TAKEN } from '../domain/config.js';
import { TOKEN_COLORS, isGemColor, type TokenCounts } from '../domain/gems.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const fail = (message: string) => ({ ok: false as const, message });

/** Keeps the colours given a positive whole count; null if any count is not one. */
function parseTokens(value: unknown): Partial<TokenCounts> | null {
  if (!isRecord(value)) return null;
  const tokens: Partial<TokenCounts> = {};
  for (const color of TOKEN_COLORS) {
    const count = value[color] ?? 0;
    if (!Number.isInteger(count) || (count as number) < 0) return null;
    if ((count as number) > 0) tokens[color] = count as number;
  }
  return tokens;
}

/**
 * Shape check for untrusted input. Only known fields are copied into the result, so anything
 * else a client sends is dropped here.
 */
export function parseAction(raw: unknown): ParseActionResult<SplendorAction> {
  if (!isRecord(raw) || typeof raw.type !== 'string') {
    return fail('Action must be an object with a type.');
  }

  switch (raw.type) {
    case 'TAKE_GEMS': {
      const colors = raw.colors;
      if (
        !Array.isArray(colors) ||
        colors.length < 1 ||
        colors.length > DIFFERENT_GEMS_TAKEN ||
        !colors.every(isGemColor)
      ) {
        return fail(`TAKE_GEMS needs 1 to ${DIFFERENT_GEMS_TAKEN} gem colors.`);
      }
      return { ok: true, action: { type: 'TAKE_GEMS', colors: [...colors] } };
    }

    case 'RESERVE_CARD':
      if (typeof raw.cardId !== 'string') return fail('RESERVE_CARD needs a cardId.');
      return { ok: true, action: { type: 'RESERVE_CARD', cardId: raw.cardId } };

    case 'RESERVE_FROM_DECK':
      if (!isTier(raw.tier)) return fail('RESERVE_FROM_DECK needs a tier.');
      return { ok: true, action: { type: 'RESERVE_FROM_DECK', tier: raw.tier } };

    case 'BUY_CARD':
      if (typeof raw.cardId !== 'string') return fail('BUY_CARD needs a cardId.');
      return { ok: true, action: { type: 'BUY_CARD', cardId: raw.cardId } };

    case 'RETURN_GEMS': {
      const tokens = parseTokens(raw.tokens);
      if (!tokens) return fail('RETURN_GEMS needs a count of tokens per color.');
      return { ok: true, action: { type: 'RETURN_GEMS', tokens } };
    }

    case 'CHOOSE_NOBLE':
      if (typeof raw.nobleId !== 'string') return fail('CHOOSE_NOBLE needs a nobleId.');
      return { ok: true, action: { type: 'CHOOSE_NOBLE', nobleId: raw.nobleId } };

    case 'PASS':
      return { ok: true, action: { type: 'PASS' } };

    default:
      return fail(`Unknown action type: ${raw.type}`);
  }
}
