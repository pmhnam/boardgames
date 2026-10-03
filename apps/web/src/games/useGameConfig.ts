import type { GameConfigDto } from '@bgp/shared-types';
import { useQuery } from '@tanstack/react-query';
import { api } from '../shared/api/http';

/** A game's current config. Only fetched for games whose UI has settings to show. */
export function useGameConfig(gameType: string, enabled: boolean) {
  return useQuery({
    queryKey: ['game-config', gameType],
    queryFn: () => api<GameConfigDto>('GET', `/games/${gameType}/config`),
    enabled,
  });
}
