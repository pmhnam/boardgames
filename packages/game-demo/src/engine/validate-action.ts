import type { GameActionContext, GameValidationResult } from '@bgp/game-core';
import type { GridClaimAction } from '../domain/actions.js';
import type { GridClaimState } from '../domain/state.js';
import { validatePlacement } from '../rules/placement.rules.js';
import { validateCanAct } from '../rules/turn.rules.js';

export function validateAction(
  state: GridClaimState,
  action: GridClaimAction,
  context: GameActionContext,
): GameValidationResult {
  const canAct = validateCanAct(state, context.actorPlayerId);
  if (!canAct.valid) return canAct;

  switch (action.type) {
    case 'PLACE_PIECE':
      return validatePlacement(state, context.actorPlayerId, action.position);
  }
}
