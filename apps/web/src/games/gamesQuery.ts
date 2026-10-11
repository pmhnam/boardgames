import type { GameDefinitionDto } from '@bgp/shared-types';
import { queryOptions } from '@tanstack/react-query';
import { api } from '../shared/api/http';

/** The list of games changes with a deploy or a published config: no need to ask on every page. */
const GAMES_STALE_MS = 5 * 60_000;

/** One definition for every page that needs the games, so they share a single fetch. */
export const gamesQuery = queryOptions({
  queryKey: ['games'],
  queryFn: () => api<GameDefinitionDto[]>('GET', '/games'),
  staleTime: GAMES_STALE_MS,
});
