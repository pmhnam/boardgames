import type { ParseActionResult } from '@bgp/game-core';
import type { WerewolfAction } from '../domain/actions.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const fail = (message: string) => ({ ok: false as const, message });

function isOptionalId(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

/**
 * Shape check for untrusted input. Only known fields are copied into the result, so anything
 * else a client sends is dropped here.
 */
export function parseAction(raw: unknown): ParseActionResult<WerewolfAction> {
  if (!isRecord(raw) || typeof raw.type !== 'string') {
    return fail('Action must be an object with a type.');
  }

  switch (raw.type) {
    case 'CUPID_LINK':
      if (typeof raw.firstId !== 'string' || typeof raw.secondId !== 'string') {
        return fail('CUPID_LINK needs a firstId and a secondId.');
      }
      return {
        ok: true,
        action: { type: 'CUPID_LINK', firstId: raw.firstId, secondId: raw.secondId },
      };

    case 'WOLF_VOTE':
    case 'SEER_INSPECT':
    case 'GUARD_PROTECT':
      if (typeof raw.targetId !== 'string') return fail(`${raw.type} needs a targetId.`);
      return { ok: true, action: { type: raw.type, targetId: raw.targetId } };

    case 'WITCH_DECIDE': {
      const poisonTargetId = raw.poisonTargetId ?? null;
      if (typeof raw.heal !== 'boolean' || !isOptionalId(poisonTargetId)) {
        return fail('WITCH_DECIDE needs heal, and a poisonTargetId or null.');
      }
      return { ok: true, action: { type: 'WITCH_DECIDE', heal: raw.heal, poisonTargetId } };
    }

    case 'CAST_VOTE':
    case 'HUNTER_SHOOT': {
      const targetId = raw.targetId ?? null;
      if (!isOptionalId(targetId)) return fail(`${raw.type} needs a targetId or null.`);
      return { ok: true, action: { type: raw.type, targetId } };
    }

    case 'SLEEP':
    case 'READY_TO_VOTE':
      return { ok: true, action: { type: raw.type } };

    default:
      return fail(`Unknown action type: ${raw.type}`);
  }
}
