import type { GameModule } from '@bgp/game-core';
import { GridClaimGame } from '@bgp/game-demo';
import { HarmoniesGame } from '@bgp/game-harmonies';
import { SplendorGame } from '@bgp/game-splendor';

/** The one place the API learns which games exist. Add new game packages here. */
export const registeredGames: GameModule[] = [HarmoniesGame, SplendorGame, GridClaimGame];
