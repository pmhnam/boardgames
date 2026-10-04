import type { GameUiDefinition } from './types';
import { AvalonGameView } from './avalon/GameView';
import { AvalonSettingsForm, describeAvalonSettings } from './avalon/SettingsForm';
import { CatanGameView } from './catan/GameView';
import { CatanSettingsForm, describeCatanSettings } from './catan/SettingsForm';
import { BangGameView } from './bang/GameView';
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
    card: {
      icon: '🌿',
      hue: 140,
      tagline: {
        vi: 'Xếp cảnh quan, tạo nơi ở cho muông thú.',
        en: 'Build landscapes and give animals a home.',
      },
    },
    component: HarmoniesGameView,
    SettingsForm: HarmoniesSettingsForm,
    describeSettings: describeHarmoniesSettings,
  },
  {
    gameType: 'splendor',
    card: {
      icon: '💎',
      hue: 265,
      tagline: {
        vi: 'Gom đá quý, mua thẻ, chiêu mộ quý tộc.',
        en: 'Collect gems, buy cards, court the nobles.',
      },
    },
    component: SplendorGameView,
    SettingsForm: SplendorSettingsForm,
    describeSettings: describeSplendorSettings,
  },
  {
    gameType: 'werewolf',
    card: {
      icon: '🐺',
      hue: 225,
      tagline: {
        vi: 'Dân làng tìm sói trước khi bị cắn hết.',
        en: 'Villagers hunt the wolves before the wolves get them.',
      },
    },
    component: WerewolfGameView,
    SettingsForm: WerewolfSettingsForm,
    describeSettings: describeWerewolfSettings,
    // Nights and votes are everyone acting at once.
    resendOnConflict: true,
  },
  {
    gameType: 'avalon',
    card: {
      icon: '🗡️',
      hue: 45,
      tagline: {
        vi: 'Phe thiện làm nhiệm vụ, phe ác ngầm phá hoại.',
        en: 'The loyal run quests while hidden traitors sabotage them.',
      },
    },
    component: AvalonGameView,
    SettingsForm: AvalonSettingsForm,
    describeSettings: describeAvalonSettings,
    // Everyone votes on a team, and plays quest cards, at once.
    resendOnConflict: true,
  },
  {
    gameType: 'catan',
    card: {
      icon: '🌾',
      hue: 28,
      tagline: {
        vi: 'Thu tài nguyên, xây đường và thành, giao thương.',
        en: 'Gather resources, build roads and cities, and trade.',
      },
    },
    component: CatanGameView,
    SettingsForm: CatanSettingsForm,
    describeSettings: describeCatanSettings,
    // Hands are discarded to a 7, and a trade offer is answered, by several players at once.
    resendOnConflict: true,
  },
  {
    gameType: 'bang',
    card: {
      icon: '🤠',
      hue: 8,
      tagline: {
        vi: 'Đấu súng miền Tây: ai là phó cảnh sát, ai ngoài vòng pháp luật?',
        en: 'A Wild West shootout: who is a deputy, and who an outlaw?',
      },
    },
    component: BangGameView,
  },
  {
    gameType: 'grid-claim',
    card: {
      icon: '🔲',
      hue: 200,
      tagline: {
        vi: 'Game mẫu nhỏ để thử nền tảng.',
        en: 'A tiny sample game for trying the platform.',
      },
      demo: true,
    },
    component: GridClaimGameView,
  },
];

const gameUiRegistry = new Map(definitions.map((definition) => [definition.gameType, definition]));

export function getGameUi(gameType: string): GameUiDefinition | undefined {
  return gameUiRegistry.get(gameType);
}
