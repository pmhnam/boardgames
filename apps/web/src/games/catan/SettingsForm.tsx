import { BOARD_SETUPS, type BoardSetup, type CatanConfig } from '@bgp/game-catan';
import type { Locale } from '../../shared/i18n/locales';
import { useLocale } from '../../shared/i18n/useT';
import type { RoomSettings, SettingsFormProps } from '../types';

interface Text {
  board: string;
  setup: Record<BoardSetup, string>;
  target(points: number): string;
}

const TEXT: Record<Locale, Text> = {
  vi: {
    board: 'Bàn chơi',
    setup: {
      variable: 'Bàn ngẫu nhiên (đảo được xếp ngẫu nhiên)',
      fixed: 'Bàn cố định (ván đầu tiên, quân đã đặt sẵn)',
    },
    target: (points) => `thắng ở ${points} điểm`,
  },
  en: {
    board: 'Board',
    setup: {
      variable: 'Variable setup (island dealt at random)',
      fixed: 'Fixed setup (first game, pieces already placed)',
    },
    target: (points) => `first to ${points} points`,
  },
};

function selectedSetup(settings: RoomSettings): BoardSetup {
  return BOARD_SETUPS.find((setup) => setup === settings.boardSetup) ?? 'variable';
}

/** The host picks the variable setup or the rulebook's fixed one for a first game. */
export function CatanSettingsForm({ value, onChange }: SettingsFormProps<CatanConfig>) {
  const text = TEXT[useLocale()];
  return (
    <label className="row wrap">
      <span>{text.board}</span>
      <select
        value={selectedSetup(value)}
        onChange={(event) => onChange({ ...value, boardSetup: event.target.value })}
      >
        {BOARD_SETUPS.map((setup) => (
          <option key={setup} value={setup}>
            {text.setup[setup]}
          </option>
        ))}
      </select>
    </label>
  );
}

export function describeCatanSettings(
  settings: RoomSettings,
  config: CatanConfig,
  _playerCount: number | undefined,
  locale: Locale,
): string | null {
  const text = TEXT[locale];
  return `${text.setup[selectedSetup(settings)]} · ${text.target(config.victoryPointsToWin)}`;
}
