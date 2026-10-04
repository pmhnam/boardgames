import type { GameDefinitionDto, RoomDto } from '@bgp/shared-types';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { getGameUi } from '../../games/registry';
import { useGameConfig } from '../../games/useGameConfig';
import { errorText } from '../../shared/i18n/errors';
import { useLocale, useT, type Translate } from '../../shared/i18n/useT';
import { joinRoom } from '../rooms/joinRoom';
import { GameIcon } from './GameIcon';
import { countBots, type ListedRoom } from './rooms';

/** The facts about a room that fit on one line: its code, who is seated, how it is set up. */
export function RoomFacts({ room, game }: { room: RoomDto; game: GameDefinitionDto | undefined }) {
  const t = useT();
  const locale = useLocale();
  const ui = getGameUi(room.gameType);
  // Only for a game with a room on show, and shared between its rooms by the query cache.
  const config = useGameConfig(room.gameType, ui?.describeSettings !== undefined);
  const summary =
    ui?.describeSettings && config.data
      ? ui.describeSettings(room.settings, config.data.config, room.members.length, locale)
      : null;
  const bots = countBots(room);

  return (
    <span className="room-row-meta">
      {room.code}
      {' · '}
      {game
        ? t('room.seats', { count: room.members.length, max: game.maxPlayers })
        : room.members.length}
      {bots > 0 && ` · ${t('room.bots', { count: bots })}`}
      {summary && ` · ${summary}`}
    </span>
  );
}

export function roomHostLine(t: Translate, room: RoomDto): string {
  const host = room.members.find((member) => member.userId === room.hostUserId);
  return t('room.hostedBy', { name: host?.displayName ?? t('room.unknownHost') });
}

/** Someone else's room, and the one thing the viewer can do with it. */
export function RoomRow({
  entry: { room, standing },
  game,
}: {
  entry: ListedRoom;
  game: GameDefinitionDto | undefined;
}) {
  const t = useT();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const join = useMutation({
    mutationFn: () => joinRoom(room.id),
    onSuccess: (joined) => navigate(`/rooms/${joined.id}`),
    // Full, or started: the list this row came from is out of date.
    onError: () => void queryClient.invalidateQueries({ queryKey: ['rooms'] }),
  });

  const gameName = game?.displayName ?? room.gameType;
  const hostLine = roomHostLine(t, room);
  // "Join" alone, twenty times down a list, tells a screen reader nothing.
  const actionLabel = (action: string) => `${action}: ${gameName}, ${hostLine}`;

  return (
    <li className="room-row">
      <GameIcon gameType={room.gameType} displayName={gameName} />
      <div className="room-row-main">
        <span className="room-row-title">
          <strong>{gameName}</strong>
          <span className="muted">{hostLine}</span>
        </span>
        <RoomFacts room={room} game={game} />
        {join.isError && (
          <span className="error" role="alert">
            {errorText(t, join.error)}
          </span>
        )}
      </div>
      <div className="room-row-action">
        {standing === 'joinable' && (
          <button
            type="button"
            disabled={join.isPending}
            aria-label={actionLabel(t('room.join'))}
            onClick={() => join.mutate()}
          >
            {join.isPending ? t('room.joining') : t('room.join')}
          </button>
        )}
        {standing === 'full' && <span className="badge">{t('room.full')}</span>}
        {(standing === 'watchable' || standing === 'playing') && (
          <span className="badge warning">{t('room.playing')}</span>
        )}
        {standing === 'watchable' && (
          <Link
            className="button secondary"
            to={`/matches/${room.currentMatchId}`}
            aria-label={actionLabel(t('room.watch'))}
          >
            {t('room.watch')}
          </Link>
        )}
      </div>
    </li>
  );
}
