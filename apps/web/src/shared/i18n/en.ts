import type { Messages } from './vi';

export const en: Messages = {
  'app.name': 'Board Game Platform',

  'nav.label': 'Main',
  'nav.history': 'My matches',
  'nav.signOut': 'Sign out',
  'nav.language': 'Language',
  'connection.online': 'Online',
  'connection.reconnecting': 'Reconnecting…',

  'login.title': 'Play as guest',
  'login.intro':
    'Play board games with friends or against the computer, right in the browser. All you need is a name.',
  'login.displayName': 'Display name',
  'login.submit': 'Continue',

  'join.joining': 'Joining room {code}…',
  'join.backToLobby': 'Back to lobby',

  'lobby.title': 'Games and rooms',
  'lobby.loadingGames': 'Loading games…',
  'lobby.noRooms': 'No rooms yet.',

  'players.range': '{min}–{max} players',
  'players.exact': '{count} players',

  'room.hostedBy': '{name}’s room',
  'room.unknownHost': 'Unknown',
  'room.seats': '{count}/{max} players',
  'room.private': 'Private',
  'room.playing': 'Playing',
  'room.full': 'Full',
  'room.open': 'Open',
  'room.join': 'Join',
  'room.watch': 'Watch',

  'create.submit': 'Create room',
  'create.private': 'Private (invite link only)',

  'joinCode.title': 'Join with a code',
  'joinCode.label': 'Room code',
  'joinCode.submit': 'Join',

  'error.unknown': 'Something went wrong.',
  'error.network': 'Could not reach the server. Check your connection and try again.',
  'error.unauthorized': 'Your session has expired. Sign in again.',
  'error.rateLimited': 'Too many requests. Wait a moment and try again.',
  'error.internal': 'The server ran into a problem. Try again later.',
  'error.roomNotFound': 'That room could not be found.',
  'error.roomFull': 'That room is full.',
  'error.roomNotOpen': 'That room is no longer taking players.',
  'error.invalidRoomSettings': 'Those room settings are not valid.',
};
