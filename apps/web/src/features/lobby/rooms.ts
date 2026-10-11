import type { GameDefinitionDto, RoomDto } from '@bgp/shared-types';

/** What someone looking at the lobby can do with a room. */
export type RoomStanding = 'mine' | 'joinable' | 'watchable' | 'full' | 'playing';

type GameLimits = Pick<GameDefinitionDto, 'gameType' | 'maxPlayers' | 'supportsSpectators'>;

export function classifyRoom(
  room: RoomDto,
  game: GameLimits | undefined,
  userId: string | undefined,
): RoomStanding {
  if (room.members.some((member) => member.userId === userId)) return 'mine';
  if (room.status === 'open') {
    // A game we know nothing about: let the server say whether there is a seat.
    return game !== undefined && room.members.length >= game.maxPlayers ? 'full' : 'joinable';
  }
  return room.currentMatchId !== null && game?.supportsSpectators === true
    ? 'watchable'
    : 'playing';
}

export interface ListedRoom {
  room: RoomDto;
  standing: Exclude<RoomStanding, 'mine'>;
}

export interface LobbyRooms {
  /** Rooms the viewer has a seat in: a match under way first, then the newest. */
  mine: RoomDto[];
  /** Everyone else's: the ones with something to do first, then the newest. */
  others: ListedRoom[];
}

const STANDING_ORDER: Record<ListedRoom['standing'], number> = {
  joinable: 0,
  watchable: 1,
  full: 2,
  playing: 3,
};

const newestFirst = (a: RoomDto, b: RoomDto) => b.createdAt.localeCompare(a.createdAt);

export function partitionRooms(
  rooms: readonly RoomDto[],
  games: readonly GameLimits[],
  userId: string | undefined,
): LobbyRooms {
  const gameByType = new Map(games.map((game) => [game.gameType, game]));
  const mine: RoomDto[] = [];
  const others: ListedRoom[] = [];
  for (const room of rooms) {
    const standing = classifyRoom(room, gameByType.get(room.gameType), userId);
    if (standing === 'mine') mine.push(room);
    else others.push({ room, standing });
  }
  mine.sort(
    (a, b) =>
      Number(b.status === 'in_match') - Number(a.status === 'in_match') || newestFirst(a, b),
  );
  others.sort(
    (a, b) =>
      STANDING_ORDER[a.standing] - STANDING_ORDER[b.standing] || newestFirst(a.room, b.room),
  );
  return { mine, others };
}

/** The games with a room in the list, in the list's own order, and how many rooms each has. */
export function countRoomsByGame(rooms: readonly ListedRoom[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const { room } of rooms) counts.set(room.gameType, (counts.get(room.gameType) ?? 0) + 1);
  return counts;
}

/**
 * The list narrowed to one game. A game with no room left in the list narrows it to nothing,
 * so the choice is dropped and everything is shown again.
 */
export function filterRooms(
  rooms: readonly ListedRoom[],
  gameType: string | null,
): { active: string | null; shown: readonly ListedRoom[] } {
  if (gameType === null) return { active: null, shown: rooms };
  const shown = rooms.filter(({ room }) => room.gameType === gameType);
  return shown.length > 0 ? { active: gameType, shown } : { active: null, shown: rooms };
}

export function countBots(room: RoomDto): number {
  return room.members.filter((member) => member.botLevel !== null).length;
}
