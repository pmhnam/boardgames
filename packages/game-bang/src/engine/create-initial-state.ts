import { GameRuleError, type CreateInitialStateInput } from '@bgp/game-core';
import type { Card } from '../domain/cards.js';
import { BANG_ENGINE_VERSION, MAX_PLAYERS, MIN_PLAYERS } from '../domain/config.js';
import { BangRuleCodes } from '../domain/errors.js';
import { getRoleCounts, type BangConfig, type BangSettings } from '../domain/game-config.js';
import type { BangState, PlayerState } from '../domain/state.js';
import { dealSetup } from '../random/setup-randomizer.js';
import { beginTurn, settle } from '../rules/flow.rules.js';

export function createInitialState(
  input: CreateInitialStateInput<BangConfig, BangSettings>,
): BangState {
  const { config } = input;
  const roleCounts = getRoleCounts(config, input.players.length);
  if (!roleCounts) {
    throw new GameRuleError(
      BangRuleCodes.InvalidPlayerCount,
      `BANG! needs ${MIN_PLAYERS} to ${MAX_PLAYERS} players.`,
    );
  }

  const seatOrder = [...input.players]
    .sort((a, b) => a.seat - b.seat)
    .map((player) => player.playerId);
  const cards: Record<string, Card> = {};
  config.cards.forEach((card, index) => {
    cards[`c${index}`] = { kind: card.kind, suit: card.suit, rank: card.rank };
  });
  const dealt = dealSetup({ seed: input.seed, config, roleCounts, cardIds: Object.keys(cards) });

  const deck = dealt.deck;
  const players: Record<string, PlayerState> = {};
  let sheriffId = seatOrder[0] ?? '';
  seatOrder.forEach((playerId, index) => {
    const role = dealt.roles[index] ?? 'outlaw';
    const character = dealt.characters[index] ?? 'bartCassidy';
    const maxLife =
      config.characters[character].life + (role === 'sheriff' ? config.rules.sheriffBonusLife : 0);
    if (role === 'sheriff') sheriffId = playerId;
    players[playerId] = {
      role,
      character,
      alive: true,
      life: maxLife,
      maxLife,
      // The opening hand is as large as the life it starts with.
      hand: deck.splice(-maxLife),
      inPlay: [],
    };
  });

  const state: BangState = {
    id: input.gameId,
    engineVersion: BANG_ENGINE_VERSION,
    phase: 'PLAYING',
    setup: { rules: { ...config.rules }, roleCounts },
    cards,
    seed: input.seed,
    rngCounter: 0,
    seatOrder,
    players,
    deck,
    discard: [],
    turn: { number: 0, playerId: sheriffId, step: 'DYNAMITE', bangsPlayed: 0 },
    pending: [],
    log: [],
    logSeq: 0,
    winner: null,
    winnerPlayerIds: [],
  };
  // The sheriff plays first.
  beginTurn(state, sheriffId);
  settle(state);
  return state;
}
