import type { GameDefinitionDto, MatchDto } from '@bgp/shared-types';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { playerName } from '../../games/types';
import { api } from '../../shared/api/http';
import { errorText } from '../../shared/i18n/errors';
import { useLocale, useT } from '../../shared/i18n/useT';
import type { MessageKey } from '../../shared/i18n/vi';
import { useDocumentTitle } from '../../shared/useDocumentTitle';
import { useAuthStore } from '../auth/auth.store';
import { GameIcon } from '../lobby/GameIcon';
import { matchStanding, otherPlayerNames, type Standing } from './history';
// The rows are the lobby's own.
import '../lobby/lobby.css';
import './match.css';

const STANDING: Record<Standing, { label: MessageKey; badge: string }> = {
  playing: { label: 'room.playing', badge: 'badge warning' },
  abandoned: { label: 'history.abandoned', badge: 'badge' },
  won: { label: 'history.won', badge: 'badge success' },
  lost: { label: 'history.lost', badge: 'badge danger' },
  finished: { label: 'history.finished', badge: 'badge' },
};

const PLACEHOLDER_ROWS = [0, 1, 2, 3];

export function MatchHistoryPage() {
  const t = useT();
  const locale = useLocale();
  const userId = useAuthStore((state) => state.session?.user.id);
  const matches = useQuery({
    queryKey: ['matches', userId],
    queryFn: () => api<MatchDto[]>('GET', `/users/${userId}/matches`),
    enabled: userId !== undefined,
  });
  // For the games' names. Shared with the lobby, so usually already loaded.
  const games = useQuery({
    queryKey: ['games'],
    queryFn: () => api<GameDefinitionDto[]>('GET', '/games'),
  });
  const gameName = (gameType: string) =>
    games.data?.find((game) => game.gameType === gameType)?.displayName ?? gameType;
  const when = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' });
  useDocumentTitle(t('nav.history'));

  return (
    <div className="stack history">
      <h1>{t('nav.history')}</h1>
      {matches.isError ? (
        <p className="error" role="alert">
          {errorText(t, matches.error)}
        </p>
      ) : matches.data === undefined ? (
        <ul className="room-rows" aria-busy="true">
          <li className="sr-only" role="status">
            {t('common.loading')}
          </li>
          {PLACEHOLDER_ROWS.map((row) => (
            <li key={row} className="room-row" aria-hidden="true">
              <span className="game-icon skeleton" />
              <div className="room-row-main">
                <span className="skeleton skeleton-line" />
                <span className="skeleton skeleton-line short" />
              </div>
            </li>
          ))}
        </ul>
      ) : matches.data.length === 0 ? (
        <div className="history-empty">
          <p className="muted">{t('history.empty')}</p>
          <Link className="button" to="/">
            {t('history.toLobby')}
          </Link>
        </div>
      ) : (
        <ul className="room-rows">
          {matches.data.map((match) => {
            const standing = matchStanding(match, userId);
            const others = otherPlayerNames(match, userId);
            const winners = match.result?.winnerPlayerIds ?? [];
            const name = gameName(match.gameType);
            return (
              <li key={match.id} className="room-row">
                <GameIcon gameType={match.gameType} displayName={name} />
                <div className="room-row-main">
                  <span className="room-row-title">
                    <strong>{name}</strong>
                    <span className={STANDING[standing].badge}>{t(STANDING[standing].label)}</span>
                  </span>
                  <span className="room-row-meta">
                    {when.format(new Date(match.createdAt))}
                    {others.length > 0 && ` · ${t('history.with', { names: others.join(', ') })}`}
                    {/* Who beat them. A winner already knows, and so does anyone with one opponent. */}
                    {standing === 'lost' &&
                      others.length > 1 &&
                      ` · ${t('history.wonBy', {
                        names: winners.map((id) => playerName(match.players, id)).join(' & '),
                      })}`}
                  </span>
                </div>
                <div className="room-row-action">
                  {match.status === 'playing' ? (
                    <Link
                      className="button"
                      to={`/matches/${match.id}`}
                      aria-label={`${t('continue.resume')}: ${name}`}
                    >
                      {t('continue.resume')}
                    </Link>
                  ) : (
                    <Link
                      className="button secondary"
                      to={`/matches/${match.id}/replay`}
                      aria-label={`${t('history.replay')}: ${name}, ${when.format(new Date(match.createdAt))}`}
                    >
                      {t('history.replay')}
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
