import type { GameUiDefinition } from './types';
import { AvalonGameView } from './avalon/GameView';
import { AvalonSettingsForm, describeAvalonSettings } from './avalon/SettingsForm';
import { CatanGameView } from './catan/GameView';
import { CatanSettingsForm, describeCatanSettings } from './catan/SettingsForm';
import { GridClaimGameView } from './grid-claim/GameView';
import { HarmoniesGameView } from './harmonies/GameView';
import { HarmoniesSettingsForm, describeHarmoniesSettings } from './harmonies/SettingsForm';
import { SplendorGameView } from './splendor/GameView';
import { SplendorSettingsForm, describeSplendorSettings } from './splendor/SettingsForm';
import { WerewolfGameView } from './werewolf/GameView';
import { WerewolfSettingsForm, describeWerewolfSettings } from './werewolf/SettingsForm';

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
  {
    gameType: 'werewolf',
    component: WerewolfGameView,
    SettingsForm: WerewolfSettingsForm,
    describeSettings: describeWerewolfSettings,
    // Nights and votes are everyone acting at once.
    resendOnConflict: true,
  },
  {
    gameType: 'avalon',
    component: AvalonGameView,
    SettingsForm: AvalonSettingsForm,
    describeSettings: describeAvalonSettings,
    // Everyone votes on a team, and plays quest cards, at once.
    resendOnConflict: true,
  },
  {
    gameType: 'catan',
    component: CatanGameView,
    SettingsForm: CatanSettingsForm,
    describeSettings: describeCatanSettings,
  },
  { gameType: 'grid-claim', component: GridClaimGameView },
];

const gameUiRegistry = new Map(definitions.map((definition) => [definition.gameType, definition]));

export function getGameUi(gameType: string): GameUiDefinition | undefined {
  return gameUiRegistry.get(gameType);
}
