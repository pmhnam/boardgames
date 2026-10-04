import type { ParseActionResult } from '@bgp/game-core';
import type { AvalonAction } from '../domain/actions.js';
import { MAX_PLAYERS } from '../domain/config.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCount(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0;
}

const fail = (message: string) => ({ ok: false as const, message });

/**
 * Shape check for untrusted input. Only known fields are copied into the result, so anything
 * else a client sends is dropped here.
 */
export function parseAction(raw: unknown): ParseActionResult<AvalonAction> {
  if (!isRecord(raw) || typeof raw.type !== 'string') {
    return fail('Action must be an object with a type.');
  }

  switch (raw.type) {
    case 'PROPOSE_TEAM': {
      const team = raw.team;
      if (
        !Array.isArray(team) ||
        team.length > MAX_PLAYERS ||
        !team.every((id): id is string => typeof id === 'string')
      ) {
        return fail('PROPOSE_TEAM needs a team of player ids.');
      }
      return { ok: true, action: { type: 'PROPOSE_TEAM', team: [...team] } };
    }

    case 'VOTE':
      if (!isCount(raw.proposal) || typeof raw.approve !== 'boolean') {
        return fail('VOTE needs a proposal number and approve set to true or false.');
      }
      return { ok: true, action: { type: 'VOTE', proposal: raw.proposal, approve: raw.approve } };

    case 'PLAY_QUEST_CARD':
      if (!isCount(raw.quest) || typeof raw.success !== 'boolean') {
        return fail('PLAY_QUEST_CARD needs a quest number and success set to true or false.');
      }
      return {
        ok: true,
        action: { type: 'PLAY_QUEST_CARD', quest: raw.quest, success: raw.success },
      };

    case 'USE_LADY':
      if (typeof raw.targetId !== 'string') return fail('USE_LADY needs a targetId.');
      return { ok: true, action: { type: 'USE_LADY', targetId: raw.targetId } };

    case 'ASSASSINATE':
      if (typeof raw.targetId !== 'string') return fail('ASSASSINATE needs a targetId.');
      return { ok: true, action: { type: 'ASSASSINATE', targetId: raw.targetId } };

    default:
      return fail(`Unknown action type: ${raw.type}`);
  }
}
