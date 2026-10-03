import type { GameUiDefinition } from './types';
import { GridClaimGameView } from './grid-claim/GameView';
import { HarmoniesGameView } from './harmonies/GameView';
import { HarmoniesSettingsForm, describeHarmoniesSettings } from './harmonies/SettingsForm';
import { SplendorGameView } from './splendor/GameView';
import { SplendorSettingsForm, describeSplendorSettings } from './splendor/SettingsForm';

/** The one place the web app learns which games it can render. Add new game UIs here. */
const definitions: GameUiDefinition[] = [
  {
    gameType: 'harmonies',
    component: HarmoniesGameView,
    SettingsForm: HarmoniesSettingsForm,
    describeSettings: describeHarmoniesSettings,
  },
  {
    gameType: 'splendor',
    component: SplendorGameView,
    SettingsForm: SplendorSettingsForm,
    describeSettings: describeSplendorSettings,
  },
  { gameType: 'grid-claim', component: GridClaimGameView },
];

const gameUiRegistry = new Map(definitions.map((definition) => [definition.gameType, definition]));

export function getGameUi(gameType: string): GameUiDefinition | undefined {
  return gameUiRegistry.get(gameType);
}
