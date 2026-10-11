import { lazy } from 'react';
import type { GameUiDefinition } from './types';
import { AvalonSettingsForm, describeAvalonSettings } from './avalon/SettingsForm';
import { awaitsAvalonViewer } from './avalon/turn';
import { CatanSettingsForm, describeCatanSettings } from './catan/SettingsForm';
import { awaitsCatanViewer } from './catan/turn';
import { awaitsBangViewer } from './bang/turn';
import { awaitsGridClaimViewer } from './grid-claim/turn';
import { HarmoniesSettingsForm, describeHarmoniesSettings } from './harmonies/SettingsForm';
import { awaitsHarmoniesViewer } from './harmonies/turn';
import { warmSplendorArt } from './splendor/assets';
import { SplendorSettingsForm, describeSplendorSettings } from './splendor/SettingsForm';
import { awaitsSplendorViewer } from './splendor/turn';
import { WerewolfSettingsForm, describeWerewolfSettings } from './werewolf/SettingsForm';
import { awaitsWerewolfViewer } from './werewolf/turn';

type GameView = GameUiDefinition['component'];

/**
 * A game's table is fetched when a match of it is on its way, not with the lobby: nobody
 * opening one game should wait for the other six.
 */
function onDemand(load: () => Promise<GameView>): Pick<GameUiDefinition, 'component' | 'preload'> {
  return {
    component: lazy(async () => ({ default: await load() })),
    preload: () => void load(),
  };
}

const splendorView = onDemand(() =>
  import('./splendor/GameView').then((module) => module.SplendorGameView),
);

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
    ...onDemand(() => import('./harmonies/GameView').then((module) => module.HarmoniesGameView)),
    awaitsViewer: awaitsHarmoniesViewer,
    supportsAutoplay: true,
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
    component: splendorView.component,
    preload: () => {
      splendorView.preload?.();
      warmSplendorArt();
    },
    awaitsViewer: awaitsSplendorViewer,
    supportsAutoplay: true,
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
    ...onDemand(() => import('./werewolf/GameView').then((module) => module.WerewolfGameView)),
    awaitsViewer: awaitsWerewolfViewer,
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
    ...onDemand(() => import('./avalon/GameView').then((module) => module.AvalonGameView)),
    awaitsViewer: awaitsAvalonViewer,
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
    ...onDemand(() => import('./catan/GameView').then((module) => module.CatanGameView)),
    awaitsViewer: awaitsCatanViewer,
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
    ...onDemand(() => import('./bang/GameView').then((module) => module.BangGameView)),
    awaitsViewer: awaitsBangViewer,
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
    ...onDemand(() => import('./grid-claim/GameView').then((module) => module.GridClaimGameView)),
    awaitsViewer: awaitsGridClaimViewer,
  },
];

const gameUiRegistry = new Map(definitions.map((definition) => [definition.gameType, definition]));

export function getGameUi(gameType: string): GameUiDefinition | undefined {
  return gameUiRegistry.get(gameType);
}
