import type { HarmoniesConfig, HarmoniesMap } from '@bgp/game-harmonies';
import type { Locale } from '../../shared/i18n/locales';
import { useLocale } from '../../shared/i18n/useT';
import type { RoomSettings, SettingsFormProps } from '../types';

interface Text {
  map: string;
  cells(count: number): string;
  waterRule: Record<HarmoniesMap['waterScoring'], string>;
}

const TEXT: Record<Locale, Text> = {
  vi: {
    map: 'Bản đồ',
    cells: (count) => `${count} ô`,
    waterRule: { river: 'tính điểm con sông dài nhất', islands: '5 điểm mỗi đảo' },
  },
  en: {
    map: 'Map',
    cells: (count) => `${count} cells`,
    waterRule: { river: 'longest river scores', islands: '5 points per island' },
  },
};

/** The map's name is the config's own, and is shown as published. */
function describeMap(map: HarmoniesMap, text: Text): string {
  return `${map.name} (${text.cells(map.boardCells.length)}, ${text.waterRule[map.waterScoring]})`;
}

function selectedMap(config: HarmoniesConfig, settings: RoomSettings): HarmoniesMap | undefined {
  return config.maps.find((map) => map.id === settings.mapId) ?? config.maps[0];
}

/** The host picks which side of the board the room plays on. */
export function HarmoniesSettingsForm({
  config,
  value,
  onChange,
}: SettingsFormProps<HarmoniesConfig>) {
  const text = TEXT[useLocale()];
  return (
    <label className="row wrap">
      <span>{text.map}</span>
      <select
        value={selectedMap(config, value)?.id ?? ''}
        onChange={(event) => onChange({ ...value, mapId: event.target.value })}
      >
        {config.maps.map((map) => (
          <option key={map.id} value={map.id}>
            {describeMap(map, text)}
          </option>
        ))}
      </select>
    </label>
  );
}

export function describeHarmoniesSettings(
  settings: RoomSettings,
  config: HarmoniesConfig,
  _playerCount: number | undefined,
  locale: Locale,
): string | null {
  const map = selectedMap(config, settings);
  return map ? describeMap(map, TEXT[locale]) : null;
}
