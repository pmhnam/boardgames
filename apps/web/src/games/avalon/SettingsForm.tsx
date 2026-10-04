import {
  MIN_PLAYERS,
  minPlayersFor,
  type AvalonConfig,
  type AvalonSettings,
  type OptionalRole,
} from '@bgp/game-avalon';
import type { Locale } from '../../shared/i18n/locales';
import { useLocale } from '../../shared/i18n/useT';
import type { RoomSettings, SettingsFormProps } from '../types';
import { ROLE_EFFECT, ROLE_LABEL } from './layout';

interface Text {
  legend: string;
  /** What each optional role adds. Role names are the game's own, the same in every language. */
  effect: Partial<Record<OptionalRole, string>>;
  ladyEffect: string;
  noExtraRoles: string;
  tooManyRoles: string;
  needsPlayers(count: number): string;
  note(problem: string): string;
}

const TEXT: Record<Locale, Text> = {
  vi: {
    legend: 'Vai thêm ngoài Merlin và Assassin',
    effect: {
      PERCIVAL: 'phe thiện, biết Merlin là ai',
      MORGANA: 'phe ác, Percival thấy như Merlin',
      MORDRED: 'phe ác, Merlin không nhìn ra',
      OBERON: 'phe ác, không biết và không được phe ác biết',
    },
    ladyEffect: 'người giữ được biết phe của một người chơi',
    noExtraRoles: 'Không thêm vai',
    tooManyRoles: 'quá nhiều vai, không bàn nào đủ chỗ',
    needsPlayers: (count) => `cần từ ${count} người`,
    note: (problem) => `Lựa chọn này ${problem}.`,
  },
  en: {
    legend: 'Roles besides Merlin and the Assassin',
    effect: ROLE_EFFECT,
    ladyEffect: 'her holder learns one player’s side',
    noExtraRoles: 'No extra roles',
    tooManyRoles: 'too many roles for any table',
    needsPlayers: (count) => `needs ${count}+ players`,
    note: (problem) => `This choice ${problem}.`,
  },
};

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
  text: Text,
): string | null {
  const needed = minPlayersFor(roles, config);
  if (needed === null) return text.tooManyRoles;
  return needed > Math.max(playerCount, MIN_PLAYERS) ? text.needsPlayers(needed) : null;
}

/** The host picks which roles join Merlin and the Assassin. */
export function AvalonSettingsForm({
  config,
  value,
  onChange,
  playerCount,
}: SettingsFormProps<AvalonConfig>) {
  const text = TEXT[useLocale()];
  const { roles, ladyOfTheLake } = selected(config, value);
  const table = describeTable(config, roles, playerCount, text);
  const toggle = (role: OptionalRole) =>
    onChange({
      ...value,
      roles: roles.includes(role) ? roles.filter((other) => other !== role) : [...roles, role],
    });

  return (
    <fieldset className="avalon-settings">
      <legend>{text.legend}</legend>
      {config.optionalRoles.map((role) => (
        <label key={role} className="row">
          <input type="checkbox" checked={roles.includes(role)} onChange={() => toggle(role)} />
          <span>
            {ROLE_LABEL[role]} <span className="muted">({text.effect[role]})</span>
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
            Lady of the Lake <span className="muted">({text.ladyEffect})</span>
          </span>
        </label>
      )}
      {table && <p className="avalon-settings-note">{text.note(table)}</p>}
    </fieldset>
  );
}

export function describeAvalonSettings(
  settings: RoomSettings,
  config: AvalonConfig,
  playerCount: number | undefined,
  locale: Locale,
): string | null {
  const text = TEXT[locale];
  const { roles, ladyOfTheLake } = selected(config, settings);
  return [
    roles.length > 0 ? roles.map((role) => ROLE_LABEL[role]).join(', ') : text.noExtraRoles,
    ladyOfTheLake ? 'Lady of the Lake' : null,
    describeTable(config, roles, playerCount, text),
  ]
    .filter(Boolean)
    .join(' · ');
}
