import { GameRuleError, type CreateInitialStateInput } from '@bgp/game-core';
import { WEREWOLF_ENGINE_VERSION } from '../domain/config.js';
import { resolveRoles, type WerewolfConfig, type WerewolfSettings } from '../domain/game-config.js';
import type { PlayerState, WerewolfState } from '../domain/state.js';
import { dealRoles } from '../random/deal-roles.js';
import { startNight } from '../rules/flow.rules.js';

export function createInitialState(
  input: CreateInitialStateInput<WerewolfConfig, WerewolfSettings>,
): WerewolfState {
  const cast = resolveRoles(input.settings, input.players.length, input.config);
  if (!cast.ok) throw new GameRuleError(cast.code, cast.message);

  const seatOrder = [...input.players]
    .sort((a, b) => a.seat - b.seat)
    .map((player) => player.playerId);
  const dealt = dealRoles({ seed: input.seed, seatOrder, roleCounts: cast.roleCounts });

  const players: Record<string, PlayerState> = {};
  for (const playerId of seatOrder) {
    const role = dealt[playerId] ?? 'villager';
    players[playerId] = {
      role,
      alive: true,
      canVote: true,
      roleRevealed: false,
      extraLives: role === 'elder' ? input.config.rules.elderExtraLives : 0,
      healUsed: false,
      poisonUsed: false,
      lastProtectedId: null,
      inspections: [],
    };
  }

  return startNight({
    id: input.gameId,
    engineVersion: WEREWOLF_ENGINE_VERSION,
    setup: {
      rules: { ...input.config.rules },
      revealRoleOnDeath: input.settings.revealRoleOnDeath,
      roleCounts: cast.roleCounts,
    },
    seatOrder,
    players,
    lovers: null,
    powersLost: false,
    round: 1,
    phase: 'NIGHT',
    night: null,
    day: null,
    pendingHunters: [],
    afterShots: null,
    log: [],
    winner: null,
    winnerPlayerIds: [],
  });
}
