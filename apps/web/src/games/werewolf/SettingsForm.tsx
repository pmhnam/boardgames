import {
  MAX_PLAYERS,
  MIN_PLAYERS,
  SPECIAL_ROLE_IDS,
  checkComposition,
  fillSpecialRoles,
  resolveRoles,
  selectedRoles,
  type SpecialRoleCounts,
  type SpecialRoleId,
  type WerewolfConfig,
  type WerewolfSettings,
} from '@bgp/game-werewolf';
import type { RoomSettings, SettingsFormProps } from '../types';
import { COMPOSITION_ERROR, ROLE_HINT, ROLE_LABEL, describeCast } from './labels';

/** The room's settings as the engine would read them; anything missing takes its default. */
function readSettings(config: WerewolfConfig, value: RoomSettings): WerewolfSettings {
  const revealRoleOnDeath =
    typeof value.revealRoleOnDeath === 'boolean'
      ? value.revealRoleOnDeath
      : config.defaultRevealRoleOnDeath;
  if (value.preset !== 'custom' || typeof value.roles !== 'object' || value.roles === null) {
    return { preset: 'recommended', revealRoleOnDeath };
  }
  return {
    preset: 'custom',
    roles: fillSpecialRoles(value.roles as Partial<SpecialRoleCounts>),
    revealRoleOnDeath,
  };
}

function isSeated(playerCount: number | undefined): playerCount is number {
  return playerCount !== undefined && playerCount >= MIN_PLAYERS && playerCount <= MAX_PLAYERS;
}

/** The host picks who is in the village: the suggested cast for the table, or their own. */
export function WerewolfSettingsForm({
  config,
  value,
  onChange,
  playerCount,
}: SettingsFormProps<WerewolfConfig>) {
  const settings = readSettings(config, value);
  const custom = settings.preset === 'custom';
  // Before the table is big enough, plan for the smallest one that can play.
  const tableSize = isSeated(playerCount) ? playerCount : MIN_PLAYERS;
  const roles = selectedRoles(settings, tableSize, config);
  const cast = checkComposition(roles, tableSize, config);
  const suggested = selectedRoles({ ...settings, preset: 'recommended' }, tableSize, config);

  const setRoles = (next: SpecialRoleCounts) =>
    onChange({ preset: 'custom', roles: next, revealRoleOnDeath: settings.revealRoleOnDeath });
  // What the server would refuse outright (no wolf, over a limit) is never offered.
  const allowed = (role: SpecialRoleId, count: number) =>
    count >= 0 && checkComposition({ ...roles, [role]: count }, MAX_PLAYERS, config).ok;

  const reveal = (
    <label className="row">
      <input
        type="checkbox"
        checked={settings.revealRoleOnDeath}
        onChange={(event) => onChange({ ...value, revealRoleOnDeath: event.target.checked })}
      />
      <span>Lật vai khi chết</span>
    </label>
  );

  // In the lobby nobody is seated yet, so there is no table to fit a cast to.
  if (playerCount === undefined) {
    return (
      <div className="stack-small">
        <span className="muted">Bộ vai theo gợi ý; chủ phòng chỉnh được sau khi vào phòng.</span>
        {reveal}
      </div>
    );
  }

  return (
    <div className="stack-small werewolf-settings">
      <div className="row wrap">
        <strong>Bộ vai cho {playerCount} người</strong>
        <button
          type="button"
          className={custom ? 'secondary' : undefined}
          aria-pressed={!custom}
          onClick={() =>
            onChange({ preset: 'recommended', revealRoleOnDeath: settings.revealRoleOnDeath })
          }
        >
          Theo gợi ý
        </button>
        <button
          type="button"
          className={custom ? undefined : 'secondary'}
          aria-pressed={custom}
          onClick={() => setRoles(roles)}
        >
          Tự chọn
        </button>
      </div>

      {!isSeated(playerCount) && (
        <span className="muted">
          Cần {MIN_PLAYERS}–{MAX_PLAYERS} người để bắt đầu. Bộ vai dưới đây tính cho {tableSize}{' '}
          người.
        </span>
      )}

      {custom ? (
        <>
          <ul className="werewolf-roles">
            {SPECIAL_ROLE_IDS.filter((role) => config.roles[role].enabled).map((role) => (
              <li key={role}>
                <span className="stack-small">
                  <span>{ROLE_LABEL[role]}</span>
                  <span className="muted hint">{ROLE_HINT[role]}</span>
                </span>
                <span className="row">
                  <button
                    type="button"
                    className="secondary"
                    aria-label={`Bớt ${ROLE_LABEL[role]}`}
                    disabled={!allowed(role, roles[role] - 1)}
                    onClick={() => setRoles({ ...roles, [role]: roles[role] - 1 })}
                  >
                    −
                  </button>
                  <span className="num werewolf-count">{roles[role]}</span>
                  <button
                    type="button"
                    className="secondary"
                    aria-label={`Thêm ${ROLE_LABEL[role]}`}
                    disabled={!allowed(role, roles[role] + 1)}
                    onClick={() => setRoles({ ...roles, [role]: roles[role] + 1 })}
                  >
                    +
                  </button>
                </span>
              </li>
            ))}
            <li>
              <span>{ROLE_LABEL.villager}</span>
              <span className="muted">{cast.ok ? cast.roleCounts.villager : '—'} (tự động)</span>
            </li>
          </ul>
          {!cast.ok && <span className="error">{COMPOSITION_ERROR[cast.code]}</span>}
          <button type="button" className="link" onClick={() => setRoles(suggested)}>
            Dùng gợi ý cho {tableSize} người
          </button>
        </>
      ) : (
        <span>{cast.ok ? describeCast(cast.roleCounts) : COMPOSITION_ERROR[cast.code]}</span>
      )}

      {reveal}
    </div>
  );
}

export function describeWerewolfSettings(
  value: RoomSettings,
  config: WerewolfConfig,
  playerCount?: number,
): string | null {
  const settings = readSettings(config, value);
  if (!isSeated(playerCount)) {
    return settings.preset === 'custom' && settings.roles
      ? `Tự chọn: ${describeCast(settings.roles)}`
      : 'Bộ vai theo gợi ý';
  }
  const cast = resolveRoles(settings, playerCount, config);
  if (cast.ok) return describeCast(cast.roleCounts);
  return `${describeCast(settings.roles ?? {})} (chưa hợp với ${playerCount} người)`;
}
