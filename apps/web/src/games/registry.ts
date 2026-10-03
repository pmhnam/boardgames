import type { GameUiDefinition } from './types';
import { GridClaimGameView } from './grid-claim/GameView';
import { HarmoniesGameView } from './harmonies/GameView';

/** The one place the web app learns which games it can render. Add new game UIs here. */
const definitions: GameUiDefinition[] = [
  { gameType: 'harmonies', component: HarmoniesGameView },
  { gameType: 'grid-claim', component: GridClaimGameView },
];

const gameUiRegistry = new Map(definitions.map((definition) => [definition.gameType, definition]));

export function getGameUi(gameType: string): GameUiDefinition | undefined {
  return gameUiRegistry.get(gameType);
}
