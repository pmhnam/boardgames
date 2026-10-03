import { GameRuleError, type CreateInitialStateInput } from '@bgp/game-core';
import { createEmptyBoard } from '../domain/board.js';
import {
  CARD_RIVER_SIZE,
  CENTRAL_SPACE_COUNT,
  HARMONIES_ENGINE_VERSION,
  MAX_PLAYERS,
  MIN_PLAYERS,
  TOKENS_PER_SPACE,
} from '../domain/config.js';
import type { HarmoniesConfig } from '../domain/game-config.js';
import type { HarmoniesState } from '../domain/state.js';
import { randomizeSetup } from '../random/setup-randomizer.js';

export function createInitialState(
  input: CreateInitialStateInput<HarmoniesConfig>,
): HarmoniesState {
  if (input.players.length < MIN_PLAYERS || input.players.length > MAX_PLAYERS) {
    throw new GameRuleError(
      'INVALID_PLAYER_COUNT',
      `Harmonies needs ${MIN_PLAYERS} to ${MAX_PLAYERS} players.`,
    );
  }

  const seated = [...input.players]
    .sort((a, b) => a.seat - b.seat)
    .map((player) => player.playerId);
  const setup = randomizeSetup({
    seed: input.seed,
    playerCount: seated.length,
    config: input.config,
  });
  const turnOrder = [
    ...seated.slice(setup.startingPlayerIndex),
    ...seated.slice(0, setup.startingPlayerIndex),
  ];
  const firstPlayerId = turnOrder[0];
  if (firstPlayerId === undefined) throw new Error('No players');

  const pouch = [...setup.pouch];
  const centralSpaces = Array.from({ length: CENTRAL_SPACE_COUNT }, () =>
    pouch.splice(-TOKENS_PER_SPACE).reverse(),
  );
  const cardDeck = [...setup.cardDeck];
  const cardRiver = cardDeck.splice(-CARD_RIVER_SIZE).reverse();

  return {
    id: input.gameId,
    engineVersion: HARMONIES_ENGINE_VERSION,
    phase: 'PLAYING',
    config: input.config,
    turnOrder,
    turn: {
      number: 1,
      activePlayerId: firstPlayerId,
      tokensTaken: false,
      hand: [],
      cardTaken: false,
    },
    pouch,
    centralSpaces,
    cardDeck,
    cardRiver,
    boards: Object.fromEntries(turnOrder.map((playerId) => [playerId, createEmptyBoard()])),
    finalRound: false,
    winnerPlayerIds: [],
  };
}
