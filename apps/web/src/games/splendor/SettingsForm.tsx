import type { SplendorConfig } from '@bgp/game-splendor';
import type { Locale } from '../../shared/i18n/locales';
import { useLocale } from '../../shared/i18n/useT';
import type { RoomSettings, SettingsFormProps } from '../types';

interface Text {
  playTo: string;
  points(target: number): string;
  firstTo(target: number): string;
}

const TEXT: Record<Locale, Text> = {
  vi: {
    playTo: 'Chơi đến',
    points: (target) => `${target} điểm`,
    firstTo: (target) => `Thắng ở ${target} điểm`,
  },
  en: {
    playTo: 'Play to',
    points: (target) => `${target} points`,
    firstTo: (target) => `First to ${target} points`,
  },
};

function selectedTarget(config: SplendorConfig, settings: RoomSettings): number {
  const chosen = settings.targetScore;
  return typeof chosen === 'number' && config.targetScoreOptions.includes(chosen)
    ? chosen
    : config.defaultTargetScore;
}

/** The host picks how many prestige points end the game. */
export function SplendorSettingsForm({
  config,
  value,
  onChange,
}: SettingsFormProps<SplendorConfig>) {
  const text = TEXT[useLocale()];
  return (
    <label className="row wrap">
      <span>{text.playTo}</span>
      <select
        value={selectedTarget(config, value)}
        onChange={(event) => onChange({ ...value, targetScore: Number(event.target.value) })}
      >
        {config.targetScoreOptions.map((target) => (
          <option key={target} value={target}>
            {text.points(target)}
          </option>
        ))}
      </select>
    </label>
  );
}

export function describeSplendorSettings(
  settings: RoomSettings,
  config: SplendorConfig,
  _playerCount: number | undefined,
  locale: Locale,
): string | null {
  return TEXT[locale].firstTo(selectedTarget(config, settings));
}
