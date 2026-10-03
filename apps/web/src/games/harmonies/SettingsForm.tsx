import type { HarmoniesConfig, HarmoniesMap } from '@bgp/game-harmonies';
import type { RoomSettings, SettingsFormProps } from '../types';

const WATER_RULE: Record<HarmoniesMap['waterScoring'], string> = {
  river: 'longest river scores',
  islands: '5 points per island',
};

function describeMap(map: HarmoniesMap): string {
  return `${map.name} (${map.boardCells.length} cells, ${WATER_RULE[map.waterScoring]})`;
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
  return (
    <label className="row wrap">
      <span>Map</span>
      <select
        value={selectedMap(config, value)?.id ?? ''}
        onChange={(event) => onChange({ ...value, mapId: event.target.value })}
      >
        {config.maps.map((map) => (
          <option key={map.id} value={map.id}>
            {describeMap(map)}
          </option>
        ))}
      </select>
    </label>
  );
}

export function describeHarmoniesSettings(
  settings: RoomSettings,
  config: HarmoniesConfig,
): string | null {
  const map = selectedMap(config, settings);
  return map ? describeMap(map) : null;
}
