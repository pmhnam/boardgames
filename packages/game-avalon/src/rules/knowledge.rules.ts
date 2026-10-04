import { alignmentOf, type Role } from '../domain/roles.js';
import type { AvalonState } from '../domain/state.js';
import { getRole } from './table.rules.js';

/** What a role is shown about another player before the first quest. Never the exact role. */
export type Sighting = 'EVIL' | 'MERLIN_OR_MORGANA';

export interface Knowledge {
  playerId: string;
  as: Sighting;
}

function sees(viewer: Role, other: Role): Sighting | null {
  switch (viewer) {
    case 'MERLIN':
      return alignmentOf(other) === 'EVIL' && other !== 'MORDRED' ? 'EVIL' : null;
    case 'PERCIVAL':
      return other === 'MERLIN' || other === 'MORGANA' ? 'MERLIN_OR_MORGANA' : null;
    case 'ASSASSIN':
    case 'MORGANA':
    case 'MORDRED':
    case 'MINION':
      return alignmentOf(other) === 'EVIL' && other !== 'OBERON' ? 'EVIL' : null;
    case 'OBERON':
    case 'LOYAL_SERVANT':
      return null;
  }
}

/** In seat order, so the order says nothing about who is who. */
export function getKnowledge(
  state: Pick<AvalonState, 'seatOrder' | 'roles'>,
  playerId: string,
): Knowledge[] {
  const role = getRole(state, playerId);
  return state.seatOrder.flatMap((otherId) => {
    const as = otherId === playerId ? null : sees(role, getRole(state, otherId));
    return as === null ? [] : [{ playerId: otherId, as }];
  });
}
