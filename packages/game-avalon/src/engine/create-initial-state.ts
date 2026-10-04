import { GameRuleError, type CreateInitialStateInput } from '@bgp/game-core';
import { AVALON_ENGINE_VERSION, type PlayerCount } from '../domain/config.js';
import {
  getRolesInPlay,
  validateSetup,
  type AvalonConfig,
  type AvalonSettings,
} from '../domain/game-config.js';
import type { Role } from '../domain/roles.js';
import type { AvalonState } from '../domain/state.js';
import { randomizeSetup } from '../random/setup-randomizer.js';

export function createInitialState(
  input: CreateInitialStateInput<AvalonConfig, AvalonSettings>,
): AvalonState {
  const setup = validateSetup(input.players.length, input.settings, input.config);
  if (!setup.valid) throw new GameRuleError(setup.code, setup.message);
  // Checked just above: the table is one of the sizes the config has a setup for.
  const playerCount = input.players.length as PlayerCount;
  const rolesInPlay = getRolesInPlay(playerCount, input.settings.roles, input.config);
  if (!rolesInPlay) throw new Error('No roles to deal');

  const table = input.config.setupByPlayerCount[playerCount];
  const seatOrder = [...input.players]
    .sort((a, b) => a.seat - b.seat)
    .map((player) => player.playerId);
  const dealt = randomizeSetup({ seed: input.seed, roles: rolesInPlay });

  const roles: Record<string, Role> = {};
  seatOrder.forEach((playerId, seat) => {
    const role = dealt.roles[seat];
    if (role === undefined) throw new Error('Fewer roles than players');
    roles[playerId] = role;
  });

  // The Lady starts with the last player to become leader: the one seated before the first.
  const ladyHolderId = seatOrder[(dealt.firstLeaderIndex + playerCount - 1) % playerCount];
  if (ladyHolderId === undefined) throw new Error('No players');
  const ladyAfterQuests = input.settings.ladyOfTheLake ? [...input.config.ladyAfterQuests] : [];

  return {
    id: input.gameId,
    engineVersion: AVALON_ENGINE_VERSION,
    phase: 'TEAM_PROPOSAL',
    rules: {
      teamSizes: [...table.teamSizes],
      failsRequired: [...table.failsRequired],
      maxRejections: input.config.maxRejections,
      ladyAfterQuests,
    },
    seatOrder,
    firstLeaderIndex: dealt.firstLeaderIndex,
    roles,
    proposals: [],
    quests: [],
    current: { team: null, votes: {}, cards: {} },
    lady: ladyAfterQuests.length > 0 ? { holderId: ladyHolderId, inspections: [] } : null,
    assassinTargetId: null,
  };
}
