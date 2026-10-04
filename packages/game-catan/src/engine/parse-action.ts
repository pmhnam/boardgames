import type { ParseActionResult } from '@bgp/game-core';
import type { CatanAction } from '../domain/actions.js';
import { INVENTION_CARDS } from '../domain/config.js';
import { RESOURCES, isResource, type ResourceCounts } from '../domain/resources.js';

/** Board ids are short; anything longer is not one. */
const MAX_ID_LENGTH = 40;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_ID_LENGTH;
}

const fail = (message: string) => ({ ok: false as const, message });

/** Keeps the resources given a positive whole count; null if any count is not one. */
function parseResources(value: unknown): Partial<ResourceCounts> | null {
  if (!isRecord(value)) return null;
  const counts: Partial<ResourceCounts> = {};
  for (const resource of RESOURCES) {
    const count = value[resource] ?? 0;
    if (!Number.isInteger(count) || (count as number) < 0) return null;
    if ((count as number) > 0) counts[resource] = count as number;
  }
  return counts;
}

/**
 * Shape check for untrusted input. Only known fields are copied into the result, so anything
 * else a client sends is dropped here.
 */
export function parseAction(raw: unknown): ParseActionResult<CatanAction> {
  if (!isRecord(raw) || typeof raw.type !== 'string') {
    return fail('Action must be an object with a type.');
  }

  switch (raw.type) {
    case 'PLACE_SETUP_SETTLEMENT':
    case 'BUILD_SETTLEMENT':
    case 'BUILD_CITY':
      if (!isId(raw.vertex)) return fail(`${raw.type} needs a vertex.`);
      return { ok: true, action: { type: raw.type, vertex: raw.vertex } };

    case 'PLACE_SETUP_ROAD':
    case 'BUILD_ROAD':
      if (!isId(raw.edge)) return fail(`${raw.type} needs an edge.`);
      return { ok: true, action: { type: raw.type, edge: raw.edge } };

    case 'ROLL_DICE':
    case 'BUY_DEVELOPMENT_CARD':
    case 'PLAY_KNIGHT':
    case 'PLAY_ROAD_BUILDING':
    case 'CANCEL_TRADE':
    case 'END_TURN':
      return { ok: true, action: { type: raw.type } };

    case 'DISCARD': {
      const resources = parseResources(raw.resources);
      if (!resources) return fail('DISCARD needs a count of cards per resource.');
      return { ok: true, action: { type: 'DISCARD', resources } };
    }

    case 'MOVE_ROBBER': {
      if (!isId(raw.hex)) return fail('MOVE_ROBBER needs a hex.');
      if (raw.victimId === undefined || raw.victimId === null) {
        return { ok: true, action: { type: 'MOVE_ROBBER', hex: raw.hex } };
      }
      if (!isId(raw.victimId)) return fail('MOVE_ROBBER victimId must be a player id.');
      return { ok: true, action: { type: 'MOVE_ROBBER', hex: raw.hex, victimId: raw.victimId } };
    }

    case 'PLAY_INVENTION': {
      const picks = raw.resources;
      if (!Array.isArray(picks) || picks.length !== INVENTION_CARDS || !picks.every(isResource)) {
        return fail(`PLAY_INVENTION needs ${INVENTION_CARDS} resources.`);
      }
      return { ok: true, action: { type: 'PLAY_INVENTION', resources: [...picks] } };
    }

    case 'PLAY_MONOPOLY':
      if (!isResource(raw.resource)) return fail('PLAY_MONOPOLY needs a resource.');
      return { ok: true, action: { type: 'PLAY_MONOPOLY', resource: raw.resource } };

    case 'SUPPLY_TRADE':
      if (!isResource(raw.give) || !isResource(raw.receive)) {
        return fail('SUPPLY_TRADE needs a resource to give and one to receive.');
      }
      return { ok: true, action: { type: 'SUPPLY_TRADE', give: raw.give, receive: raw.receive } };

    case 'PROPOSE_TRADE': {
      const give = parseResources(raw.give);
      const receive = parseResources(raw.receive);
      if (!give || !receive) return fail('PROPOSE_TRADE needs counts to give and to receive.');
      return { ok: true, action: { type: 'PROPOSE_TRADE', give, receive } };
    }

    case 'RESPOND_TRADE':
      if (typeof raw.accept !== 'boolean')
        return fail('RESPOND_TRADE needs accept: true or false.');
      return { ok: true, action: { type: 'RESPOND_TRADE', accept: raw.accept } };

    case 'CONFIRM_TRADE':
      if (!isId(raw.playerId)) return fail('CONFIRM_TRADE needs a playerId.');
      return { ok: true, action: { type: 'CONFIRM_TRADE', playerId: raw.playerId } };

    default:
      return fail(`Unknown action type: ${raw.type}`);
  }
}
