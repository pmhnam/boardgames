import type { ParseActionResult } from '@bgp/game-core';
import type { HarmoniesAction } from '../domain/actions.js';
import type { Hex } from '../domain/hex.js';
import { isTokenColor } from '../domain/tokens.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseHex(value: unknown): Hex | null {
  if (!isRecord(value) || !Number.isInteger(value.q) || !Number.isInteger(value.r)) return null;
  return { q: value.q as number, r: value.r as number };
}

const fail = (message: string) => ({ ok: false as const, message });

/**
 * Shape check for untrusted input. Only known fields are copied into the result, so anything
 * else a client sends is dropped here.
 */
export function parseAction(raw: unknown): ParseActionResult<HarmoniesAction> {
  if (!isRecord(raw) || typeof raw.type !== 'string') {
    return fail('Action must be an object with a type.');
  }

  switch (raw.type) {
    case 'TAKE_TOKENS':
      if (!Number.isInteger(raw.spaceIndex))
        return fail('TAKE_TOKENS needs an integer spaceIndex.');
      return { ok: true, action: { type: 'TAKE_TOKENS', spaceIndex: raw.spaceIndex as number } };

    case 'PLACE_TOKEN': {
      const cell = parseHex(raw.cell);
      if (!isTokenColor(raw.color) || !cell) {
        return fail('PLACE_TOKEN needs a token color and a cell { q, r }.');
      }
      return { ok: true, action: { type: 'PLACE_TOKEN', color: raw.color, cell } };
    }

    case 'TAKE_CARD':
      if (typeof raw.cardId !== 'string') return fail('TAKE_CARD needs a cardId.');
      return { ok: true, action: { type: 'TAKE_CARD', cardId: raw.cardId } };

    case 'PLACE_CUBE': {
      const cell = parseHex(raw.cell);
      if (typeof raw.cardId !== 'string' || !cell) {
        return fail('PLACE_CUBE needs a cardId and a cell { q, r }.');
      }
      return { ok: true, action: { type: 'PLACE_CUBE', cardId: raw.cardId, cell } };
    }

    case 'END_TURN':
      return { ok: true, action: { type: 'END_TURN' } };

    default:
      return fail(`Unknown action type: ${raw.type}`);
  }
}
