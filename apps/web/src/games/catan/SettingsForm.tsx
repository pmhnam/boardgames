import {
  BASE_MAX_PLAYERS,
  BOARD_SETUPS,
  validateSetup,
  type BoardSetup,
  type CatanConfig,
} from '@bgp/game-catan';
import type { Locale } from '../../shared/i18n/locales';
import { useLocale } from '../../shared/i18n/useT';
import type { RoomSettings, SettingsFormProps } from '../types';

interface Text {
  board: string;
  setup: Record<BoardSetup, string>;
  /** Why the chosen setup cannot be played by the players now seated. */
  fixedTooLarge(most: number): string;
  target(points: number): string;
}

const TEXT: Record<Locale, Text> = {
  vi: {
    board: 'Bàn chơi',
    setup: {
      variable: 'Bàn ngẫu nhiên (đảo được xếp ngẫu nhiên)',
      fixed: 'Bàn cố định (ván đầu tiên, quân đã đặt sẵn)',
    },
    fixedTooLarge: (most) =>
      `Bàn cố định chỉ có quân cho tối đa ${most} người. Hãy chọn bàn ngẫu nhiên để chơi 5–6 người.`,
    target: (points) => `thắng ở ${points} điểm`,
  },
  en: {
    board: 'Board',
    setup: {
      variable: 'Variable setup (island dealt at random)',
      fixed: 'Fixed setup (first game, pieces already placed)',
    },
    fixedTooLarge: (most) =>
      `The fixed setup has pieces for up to ${most} players. Choose the variable setup to play with 5–6.`,
    target: (points) => `first to ${points} points`,
  },
};

function selectedSetup(settings: RoomSettings): BoardSetup {
  return BOARD_SETUPS.find((setup) => setup === settings.boardSetup) ?? 'variable';
}

/** The engine's own check, so the form and the server give the same answer. */
function fitsTable(settings: RoomSettings, playerCount: number | undefined): boolean {
  if (playerCount === undefined) return true;
  return validateSetup({ boardSetup: selectedSetup(settings) }, playerCount).valid;
}

/** The host picks the variable setup or the rulebook's fixed one for a first game. */
export function CatanSettingsForm({
  value,
  onChange,
  playerCount,
}: SettingsFormProps<CatanConfig>) {
  const text = TEXT[useLocale()];
  return (
    <div className="stack-small">
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
      {!fitsTable(value, playerCount) && (
        <span className="muted">{text.fixedTooLarge(BASE_MAX_PLAYERS)}</span>
      )}
    </div>
  );
}

export function describeCatanSettings(
  settings: RoomSettings,
  config: CatanConfig,
  playerCount: number | undefined,
  locale: Locale,
): string | null {
  const text = TEXT[locale];
  const summary = `${text.setup[selectedSetup(settings)]} · ${text.target(config.victoryPointsToWin)}`;
  return fitsTable(settings, playerCount)
    ? summary
    : `${summary} · ${text.fixedTooLarge(BASE_MAX_PLAYERS)}`;
}
