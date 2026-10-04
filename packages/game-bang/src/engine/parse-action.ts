import type { ParseActionResult } from '@bgp/game-core';
import type { BangAction } from '../domain/actions.js';

/** More cards than any one action could name. */
const MAX_CARD_IDS = 40;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const fail = (message: string) => ({ ok: false as const, message });

function isOptionalId(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function parseIds(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length > MAX_CARD_IDS) return null;
  return value.every((id) => typeof id === 'string') ? [...(value as string[])] : null;
}

/**
 * Shape check for untrusted input. Only known fields are copied into the result, so anything
 * else a client sends is dropped here.
 */
export function parseAction(raw: unknown): ParseActionResult<BangAction> {
  if (!isRecord(raw) || typeof raw.type !== 'string') {
    return fail('Action must be an object with a type.');
  }

  switch (raw.type) {
    case 'PLAY_CARD': {
      const targetId = raw.targetId ?? null;
      const targetCardId = raw.targetCardId ?? null;
      if (
        typeof raw.cardId !== 'string' ||
        !isOptionalId(targetId) ||
        !isOptionalId(targetCardId)
      ) {
        return fail('PLAY_CARD needs a cardId, and a targetId and targetCardId or null.');
      }
      return {
        ok: true,
        action: { type: 'PLAY_CARD', cardId: raw.cardId, targetId, targetCardId },
      };
    }

    case 'END_TURN': {
      const discardIds = parseIds(raw.discardIds ?? []);
      if (!discardIds) return fail('END_TURN needs a list of discardIds.');
      return { ok: true, action: { type: 'END_TURN', discardIds } };
    }

    case 'RESPOND': {
      const cardId = raw.cardId ?? null;
      if (!isOptionalId(cardId)) return fail('RESPOND needs a cardId or null.');
      return { ok: true, action: { type: 'RESPOND', cardId } };
    }

    case 'PICK_CARDS':
    case 'DISCARD_TO_HEAL': {
      const cardIds = parseIds(raw.cardIds);
      if (!cardIds) return fail(`${raw.type} needs a list of cardIds.`);
      return { ok: true, action: { type: raw.type, cardIds } };
    }

    case 'DRAW': {
      const targetId = raw.targetId ?? null;
      const source = raw.source;
      if (
        (source !== 'deck' && source !== 'discard' && source !== 'player') ||
        !isOptionalId(targetId)
      ) {
        return fail("DRAW needs a source of 'deck', 'discard' or 'player'.");
      }
      return { ok: true, action: { type: 'DRAW', source, targetId } };
    }

    default:
      return fail(`Unknown action type: ${raw.type}`);
  }
}
