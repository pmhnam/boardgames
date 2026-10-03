import type { ParseActionResult } from '@bgp/game-core';
import type { GridClaimAction } from '../domain/actions.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Shape check for untrusted input. Only known fields are copied, so anything extra a client
 * sends (scores, next player, ...) is dropped here.
 */
export function parseAction(raw: unknown): ParseActionResult<GridClaimAction> {
  if (!isRecord(raw) || typeof raw.type !== 'string') {
    return { ok: false, message: 'Action must be an object with a type.' };
  }

  switch (raw.type) {
    case 'PLACE_PIECE': {
      const position = raw.position;
      if (
        !isRecord(position) ||
        !Number.isInteger(position.row) ||
        !Number.isInteger(position.col)
      ) {
        return { ok: false, message: 'PLACE_PIECE needs an integer position { row, col }.' };
      }
      return {
        ok: true,
        action: {
          type: 'PLACE_PIECE',
          position: { row: position.row as number, col: position.col as number },
        },
      };
    }
    default:
      return { ok: false, message: `Unknown action type: ${raw.type}` };
  }
}
