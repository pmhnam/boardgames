import type { GameDefinitionDto } from '@bgp/shared-types';
import { useT } from '../../shared/i18n/useT';
import { RetryNotice } from './RetryNotice';
import { RoomRow } from './RoomRow';
import type { ListedRoom } from './rooms';

const PLACEHOLDER_ROWS = [0, 1, 2];

/** Other people's rooms, across every game: the ones with a free seat first. */
export function RoomList({
  rooms,
  gameByType,
  isPending,
  error,
  onRetry,
}: {
  rooms: ListedRoom[];
  gameByType: ReadonlyMap<string, GameDefinitionDto>;
  /** Nothing has loaded yet, which is not the same as there being no rooms. */
  isPending: boolean;
  error: unknown;
  onRetry(): void;
}) {
  const t = useT();

  return (
    <section aria-labelledby="open-rooms-title">
      <h2 id="open-rooms-title">
        {t('lobby.openRooms')}
        {rooms.length > 0 && <span className="chip">{rooms.length}</span>}
      </h2>
      {/* A refresh that failed leaves the last list up, under the notice. */}
      {error !== null && <RetryNotice error={error} onRetry={onRetry} />}
      {isPending ? (
        <ul className="room-rows" aria-busy="true">
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
      ) : rooms.length > 0 ? (
        <ul className="room-rows">
          {rooms.map((entry) => (
            <RoomRow key={entry.room.id} entry={entry} game={gameByType.get(entry.room.gameType)} />
          ))}
        </ul>
      ) : (
        error === null && <p className="lobby-empty">{t('lobby.noRooms')}</p>
      )}
    </section>
  );
}
