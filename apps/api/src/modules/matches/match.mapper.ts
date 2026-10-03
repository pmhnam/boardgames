import type { MatchActionDto, MatchDto } from '@bgp/shared-types';
import type { MatchActionRecord, MatchPlayerRecord, MatchRecord } from './match.repository.js';

export function toMatchDto(match: MatchRecord, players: MatchPlayerRecord[]): MatchDto {
  return {
    id: match.id,
    roomId: match.roomId,
    gameType: match.gameType,
    engineVersion: match.engineVersion,
    configVersion: match.configVersion,
    status: match.status,
    version: match.stateVersion,
    players: players.map((player) => ({
      playerId: player.playerId,
      userId: player.userId,
      displayName: player.displayName,
      seat: player.seat,
    })),
    result: match.result ?? null,
    createdAt: match.createdAt.toISOString(),
    startedAt: match.startedAt?.toISOString() ?? null,
    finishedAt: match.finishedAt?.toISOString() ?? null,
  };
}

export function toMatchActionDto(action: MatchActionRecord): MatchActionDto {
  return {
    sequence: action.sequence,
    playerId: action.playerId,
    actionType: action.actionType,
    payload: action.payload,
    createdAt: action.createdAt.toISOString(),
  };
}
