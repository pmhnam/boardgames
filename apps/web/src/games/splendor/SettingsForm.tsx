import type { SplendorConfig } from '@bgp/game-splendor';
import type { RoomSettings, SettingsFormProps } from '../types';

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
  return (
    <label className="row wrap">
      <span>Play to</span>
      <select
        value={selectedTarget(config, value)}
        onChange={(event) => onChange({ ...value, targetScore: Number(event.target.value) })}
      >
        {config.targetScoreOptions.map((target) => (
          <option key={target} value={target}>
            {target} points
          </option>
        ))}
      </select>
    </label>
  );
}

export function describeSplendorSettings(
  settings: RoomSettings,
  config: SplendorConfig,
): string | null {
  return `First to ${selectedTarget(config, settings)} points`;
}
