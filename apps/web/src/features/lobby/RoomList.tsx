import type { GameDefinitionDto } from '@bgp/shared-types';
import { useT } from '../../shared/i18n/useT';
import { GameIcon } from './GameIcon';
import { RetryNotice } from './RetryNotice';
import { RoomRow } from './RoomRow';
import { countRoomsByGame, filterRooms, type ListedRoom } from './rooms';

const PLACEHOLDER_ROWS = [0, 1, 2];

/** Other people's rooms, across every game: the ones with a free seat first. */
export function RoomList({
  rooms,
  gameByType,
  filter,
  onFilter,
  isPending,
  error,
  onRetry,
}: {
  rooms: ListedRoom[];
  gameByType: ReadonlyMap<string, GameDefinitionDto>;
  /** The game the list is narrowed to, or null for every game. */
  filter: string | null;
  onFilter(gameType: string | null): void;
  /** Nothing has loaded yet, which is not the same as there being no rooms. */
  isPending: boolean;
  error: unknown;
  onRetry(): void;
}) {
  const t = useT();
  const counts = countRoomsByGame(rooms);
  const { active, shown } = filterRooms(rooms, filter);

  return (
    <section id="open-rooms" className="lobby-section" aria-labelledby="open-rooms-title">
      <h2 id="open-rooms-title">
        {t('lobby.openRooms')}
        {rooms.length > 0 && <span className="chip">{rooms.length}</span>}
      </h2>
      {/* A refresh that failed leaves the last list up, under the notice. */}
      {error !== null && <RetryNotice error={error} onRetry={onRetry} />}
      {/* Nothing to narrow down while every room is of the one game. */}
      {counts.size > 1 && (
        <div className="room-filter" role="group" aria-label={t('lobby.filter.label')}>
          <button
            type="button"
            className="filter-chip"
            aria-pressed={active === null}
            onClick={() => onFilter(null)}
          >
            {t('lobby.filter.all')}
            <span className="filter-chip-count">{rooms.length}</span>
          </button>
          {[...counts].map(([gameType, count]) => {
            const name = gameByType.get(gameType)?.displayName ?? gameType;
            return (
              <button
                key={gameType}
                type="button"
                className="filter-chip"
                aria-pressed={active === gameType}
                onClick={() => onFilter(gameType)}
              >
                <GameIcon gameType={gameType} displayName={name} size="small" />
                {name}
                <span className="filter-chip-count">{count}</span>
              </button>
            );
          })}
        </div>
      )}
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
      ) : shown.length > 0 ? (
        <ul className="room-rows">
          {shown.map((entry) => (
            <RoomRow key={entry.room.id} entry={entry} game={gameByType.get(entry.room.gameType)} />
          ))}
        </ul>
      ) : (
        error === null && (
          <p className="lobby-empty">
            <span className="lobby-empty-art" aria-hidden="true">
              🎲
            </span>
            {t('lobby.noRooms')}
          </p>
        )
      )}
    </section>
  );
}
