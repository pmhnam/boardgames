import { GameRuleError, type CreateInitialStateInput } from '@bgp/game-core';
import { getNoble } from '../domain/cards.js';
import {
  MARKET_SIZE,
  MAX_PLAYERS,
  MIN_PLAYERS,
  SPLENDOR_ENGINE_VERSION,
  type PlayerCount,
} from '../domain/config.js';
import type { SplendorConfig, SplendorSettings } from '../domain/game-config.js';
import { GEM_COLORS, emptyTokens } from '../domain/gems.js';
import type { PlayerState, SplendorState } from '../domain/state.js';
import { randomizeSetup } from '../random/setup-randomizer.js';

function isPlayerCount(count: number): count is PlayerCount {
  return count >= MIN_PLAYERS && count <= MAX_PLAYERS;
}

export function createInitialState(
  input: CreateInitialStateInput<SplendorConfig, SplendorSettings>,
): SplendorState {
  const playerCount = input.players.length;
  if (!isPlayerCount(playerCount)) {
    throw new GameRuleError(
      'INVALID_PLAYER_COUNT',
      `Splendor needs ${MIN_PLAYERS} to ${MAX_PLAYERS} players.`,
    );
  }

  const table = input.config.setupByPlayerCount[playerCount];
  const seated = [...input.players]
    .sort((a, b) => a.seat - b.seat)
    .map((player) => player.playerId);
  const setup = randomizeSetup({
    seed: input.seed,
    playerCount,
    cards: input.config.cards,
    nobles: input.config.nobles,
    nobleCount: table.nobles,
  });
  const turnOrder = [
    ...seated.slice(setup.startingPlayerIndex),
    ...seated.slice(0, setup.startingPlayerIndex),
  ];
  const firstPlayerId = turnOrder[0];
  if (firstPlayerId === undefined) throw new Error('No players');

  const decks = { 1: [...setup.decks[1]], 2: [...setup.decks[2]], 3: [...setup.decks[3]] };
  const deal = (deck: string[]) => Array.from({ length: MARKET_SIZE }, () => deck.pop() ?? null);
  const market = { 1: deal(decks[1]), 2: deal(decks[2]), 3: deal(decks[3]) };

  const bank = emptyTokens();
  for (const color of GEM_COLORS) bank[color] = table.gemsPerColor;
  bank.gold = input.config.goldCount;

  const newPlayer = (): PlayerState => ({
    tokens: emptyTokens(),
    purchased: [],
    reserved: [],
    nobles: [],
  });

  return {
    id: input.gameId,
    engineVersion: SPLENDOR_ENGINE_VERSION,
    phase: 'PLAYING',
    config: {
      targetScore: input.settings.targetScore,
      cards: input.config.cards,
      nobles: setup.nobleIds.map((nobleId) => getNoble(input.config.nobles, nobleId)),
    },
    turnOrder,
    turn: { number: 1, activePlayerId: firstPlayerId, step: 'ACTION' },
    bank,
    decks,
    market,
    nobles: [...setup.nobleIds],
    players: Object.fromEntries(turnOrder.map((playerId) => [playerId, newPlayer()])),
    passStreak: 0,
    finalRound: false,
    winnerPlayerIds: [],
  };
}
