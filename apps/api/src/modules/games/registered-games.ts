import type { GameModule } from '@bgp/game-core';
import { AvalonGame } from '@bgp/game-avalon';
import { CatanGame } from '@bgp/game-catan';
import { BangGame } from '@bgp/game-bang';
import { GridClaimGame } from '@bgp/game-demo';
import { HarmoniesGame } from '@bgp/game-harmonies';
import { SplendorGame } from '@bgp/game-splendor';
import { WerewolfGame } from '@bgp/game-werewolf';

/** The one place the API learns which games exist. Add new game packages here. */
export const registeredGames: GameModule[] = [
  HarmoniesGame,
  SplendorGame,
  WerewolfGame,
  AvalonGame,
  CatanGame,
  BangGame,
  GridClaimGame,
];
