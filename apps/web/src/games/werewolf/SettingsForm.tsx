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
import type { Locale } from '../../shared/i18n/locales';
import { useLocale } from '../../shared/i18n/useT';
import type { RoomSettings, SettingsFormProps } from '../types';
import { COMPOSITION_ERROR, ROLE_HINT, ROLE_LABEL, describeCast } from './labels';

/** The form's own words. Role names and hints are the game's, and stay as `labels.ts` has them. */
interface Text {
  revealOnDeath: string;
  lobbyNote: string;
  castFor(players: number): string;
  suggested: string;
  custom: string;
  needsPlayers(min: number, max: number, planned: number): string;
  fewer(role: string): string;
  more(role: string): string;
  automatic: string;
  useSuggestion(players: number): string;
  summarySuggested: string;
  summaryCustom(cast: string): string;
  summaryMisfit(cast: string, players: number): string;
}

const TEXT: Record<Locale, Text> = {
  vi: {
    revealOnDeath: 'Lật vai khi chết',
    lobbyNote: 'Bộ vai theo gợi ý; chủ phòng chỉnh được sau khi vào phòng.',
    castFor: (players) => `Bộ vai cho ${players} người`,
    suggested: 'Theo gợi ý',
    custom: 'Tự chọn',
    needsPlayers: (min, max, planned) =>
      `Cần ${min}–${max} người để bắt đầu. Bộ vai dưới đây tính cho ${planned} người.`,
    fewer: (role) => `Bớt ${role}`,
    more: (role) => `Thêm ${role}`,
    automatic: 'tự động',
    useSuggestion: (players) => `Dùng gợi ý cho ${players} người`,
    summarySuggested: 'Bộ vai theo gợi ý',
    summaryCustom: (cast) => `Tự chọn: ${cast}`,
    summaryMisfit: (cast, players) => `${cast} (chưa hợp với ${players} người)`,
  },
  en: {
    revealOnDeath: 'Reveal roles on death',
    lobbyNote: 'Suggested cast; the host can change it once in the room.',
    castFor: (players) => `Cast for ${players} players`,
    suggested: 'Suggested',
    custom: 'Custom',
    needsPlayers: (min, max, planned) =>
      `Needs ${min}–${max} players to start. The cast below is for ${planned}.`,
    fewer: (role) => `Fewer: ${role}`,
    more: (role) => `More: ${role}`,
    automatic: 'automatic',
    useSuggestion: (players) => `Use the suggestion for ${players} players`,
    summarySuggested: 'Suggested cast',
    summaryCustom: (cast) => `Custom: ${cast}`,
    summaryMisfit: (cast, players) => `${cast} (does not fit ${players} players)`,
  },
};

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
  const text = TEXT[useLocale()];
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
      <span>{text.revealOnDeath}</span>
    </label>
  );

  // In the lobby nobody is seated yet, so there is no table to fit a cast to.
  if (playerCount === undefined) {
    return (
      <div className="stack-small">
        <span className="muted">{text.lobbyNote}</span>
        {reveal}
      </div>
    );
  }

  return (
    <div className="stack-small werewolf-settings">
      <div className="row wrap">
        <strong>{text.castFor(playerCount)}</strong>
        <button
          type="button"
          className={custom ? 'secondary' : undefined}
          aria-pressed={!custom}
          onClick={() =>
            onChange({ preset: 'recommended', revealRoleOnDeath: settings.revealRoleOnDeath })
          }
        >
          {text.suggested}
        </button>
        <button
          type="button"
          className={custom ? undefined : 'secondary'}
          aria-pressed={custom}
          onClick={() => setRoles(roles)}
        >
          {text.custom}
        </button>
      </div>

      {!isSeated(playerCount) && (
        <span className="muted">{text.needsPlayers(MIN_PLAYERS, MAX_PLAYERS, tableSize)}</span>
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
                    aria-label={text.fewer(ROLE_LABEL[role])}
                    disabled={!allowed(role, roles[role] - 1)}
                    onClick={() => setRoles({ ...roles, [role]: roles[role] - 1 })}
                  >
                    −
                  </button>
                  <span className="num werewolf-count">{roles[role]}</span>
                  <button
                    type="button"
                    className="secondary"
                    aria-label={text.more(ROLE_LABEL[role])}
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
              <span className="muted">
                {cast.ok ? cast.roleCounts.villager : '—'} ({text.automatic})
              </span>
            </li>
          </ul>
          {!cast.ok && <span className="error">{COMPOSITION_ERROR[cast.code]}</span>}
          <button type="button" className="link" onClick={() => setRoles(suggested)}>
            {text.useSuggestion(tableSize)}
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
  playerCount: number | undefined,
  locale: Locale,
): string | null {
  const text = TEXT[locale];
  const settings = readSettings(config, value);
  if (!isSeated(playerCount)) {
    return settings.preset === 'custom' && settings.roles
      ? text.summaryCustom(describeCast(settings.roles))
      : text.summarySuggested;
  }
  const cast = resolveRoles(settings, playerCount, config);
  if (cast.ok) return describeCast(cast.roleCounts);
  return text.summaryMisfit(describeCast(settings.roles ?? {}), playerCount);
}
