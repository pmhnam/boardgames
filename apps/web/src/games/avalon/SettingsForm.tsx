import {
  MIN_PLAYERS,
  minPlayersFor,
  type AvalonConfig,
  type AvalonSettings,
  type OptionalRole,
} from '@bgp/game-avalon';
import type { RoomSettings, SettingsFormProps } from '../types';
import { ROLE_EFFECT, ROLE_LABEL } from './layout';

function selected(config: AvalonConfig, settings: RoomSettings): AvalonSettings {
  const chosen = Array.isArray(settings.roles) ? settings.roles : [];
  return {
    roles: config.optionalRoles.filter((role) => chosen.includes(role)),
    ladyOfTheLake: settings.ladyOfTheLake === true,
  };
}

/**
 * Roles take seats, so some choices only fit a larger table. Null when the choice fits the
 * players seated, or any table while nobody is seated yet.
 */
function describeTable(
  config: AvalonConfig,
  roles: OptionalRole[],
  playerCount = MIN_PLAYERS,
): string | null {
  const needed = minPlayersFor(roles, config);
  if (needed === null) return 'too many roles for any table';
  return needed > Math.max(playerCount, MIN_PLAYERS) ? `needs ${needed}+ players` : null;
}

/** The host picks which roles join Merlin and the Assassin. */
export function AvalonSettingsForm({
  config,
  value,
  onChange,
  playerCount,
}: SettingsFormProps<AvalonConfig>) {
  const { roles, ladyOfTheLake } = selected(config, value);
  const table = describeTable(config, roles, playerCount);
  const toggle = (role: OptionalRole) =>
    onChange({
      ...value,
      roles: roles.includes(role) ? roles.filter((other) => other !== role) : [...roles, role],
    });

  return (
    <fieldset className="avalon-settings">
      <legend>Roles besides Merlin and the Assassin</legend>
      {config.optionalRoles.map((role) => (
        <label key={role} className="row">
          <input type="checkbox" checked={roles.includes(role)} onChange={() => toggle(role)} />
          <span>
            {ROLE_LABEL[role]} <span className="muted">({ROLE_EFFECT[role]})</span>
          </span>
        </label>
      ))}
      {config.ladyAfterQuests.length > 0 && (
        <label className="row">
          <input
            type="checkbox"
            checked={ladyOfTheLake}
            onChange={() => onChange({ ...value, ladyOfTheLake: !ladyOfTheLake })}
          />
          <span>
            Lady of the Lake <span className="muted">(her holder learns one player’s side)</span>
          </span>
        </label>
      )}
      {table && <p className="avalon-settings-note">This choice {table}.</p>}
    </fieldset>
  );
}

export function describeAvalonSettings(
  settings: RoomSettings,
  config: AvalonConfig,
  playerCount?: number,
): string | null {
  const { roles, ladyOfTheLake } = selected(config, settings);
  return [
    roles.length > 0 ? roles.map((role) => ROLE_LABEL[role]).join(', ') : 'No extra roles',
    ladyOfTheLake ? 'Lady of the Lake' : null,
    describeTable(config, roles, playerCount),
  ]
    .filter(Boolean)
    .join(' · ');
}
