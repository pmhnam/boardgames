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

export function countBots(room: RoomDto): number {
  return room.members.filter((member) => member.botLevel !== null).length;
}
