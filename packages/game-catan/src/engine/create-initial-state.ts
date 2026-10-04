import { GameRuleError, type CreateInitialStateInput } from '@bgp/game-core';
import { CATAN_ENGINE_VERSION, MAX_PLAYERS, MIN_PLAYERS } from '../domain/config.js';
import type { Tile } from '../domain/default-board.js';
import { resolveSetup, type CatanConfig, type CatanSettings } from '../domain/game-config.js';
import { hexCorner, hexKey, hexSideEdge } from '../domain/hex.js';
import { RESOURCES, addResources, emptyResources } from '../domain/resources.js';
import type { Building, CatanState, PlayerState } from '../domain/state.js';
import { randomizeSetup } from '../random/setup-randomizer.js';
import { getOpeningYield } from '../rules/production.rules.js';

export function createInitialState(
  input: CreateInitialStateInput<CatanConfig, CatanSettings>,
): CatanState {
  const playerCount = input.players.length;
  if (playerCount < MIN_PLAYERS || playerCount > MAX_PLAYERS) {
    throw new GameRuleError(
      'INVALID_PLAYER_COUNT',
      `CATAN needs ${MIN_PLAYERS} to ${MAX_PLAYERS} players.`,
    );
  }

  const { config } = input;
  const seated = [...input.players]
    .sort((a, b) => a.seat - b.seat)
    .map((player) => player.playerId);
  const setup = randomizeSetup({
    seed: input.seed,
    playerCount,
    config,
    boardSetup: input.settings.boardSetup,
  });
  const turnOrder = [
    ...seated.slice(setup.startingPlayerIndex),
    ...seated.slice(0, setup.startingPlayerIndex),
  ];
  const firstPlayerId = turnOrder[0];
  if (firstPlayerId === undefined) throw new Error('No players');

  const tiles: Record<string, Tile> = {};
  config.hexes.forEach((hex, index) => {
    const tile = setup.tiles[index];
    if (!tile) throw new Error(`No tile for hex ${hexKey(hex)}`);
    tiles[hexKey(hex)] = tile;
  });
  // The robber starts on the desert.
  const desert = config.hexes.find((hex) => tiles[hexKey(hex)]?.terrain === 'desert');
  if (!desert) throw new Error('The board has no desert');

  const supply = emptyResources();
  for (const resource of RESOURCES) supply[resource] = config.resourcesPerType;

  const newPlayer = (): PlayerState => ({
    resources: emptyResources(),
    developmentCards: [],
    knightsPlayed: 0,
  });

  const opening: CatanState = {
    id: input.gameId,
    engineVersion: CATAN_ENGINE_VERSION,
    phase: 'PLAYING',
    config: resolveSetup(config, setup.ports),
    turnOrder,
    turn: {
      number: 1,
      activePlayerId: firstPlayerId,
      step: 'SETUP_SETTLEMENT',
      roll: null,
      developmentCardPlayed: false,
      freeRoads: 0,
      pendingDiscards: {},
      setupVertex: null,
      offer: null,
    },
    tiles,
    robber: hexKey(desert),
    buildings: {},
    roads: {},
    supply,
    developmentDeck: [...setup.developmentDeck],
    players: Object.fromEntries(turnOrder.map((playerId) => [playerId, newPlayer()])),
    longestRoutePlayerId: null,
    largestArmyPlayerId: null,
    offersMade: 0,
    random: { seed: input.seed, draws: 0 },
    winnerPlayerIds: [],
  };
  if (input.settings.boardSetup !== 'fixed') return opening;

  // The fixed setup has no opening: every seat's pieces are already on the board, the second
  // settlements have collected their cards, and the first player starts by rolling.
  const buildings: Record<string, Building> = {};
  const roads: Record<string, string> = {};
  const players = { ...opening.players };
  let remaining = supply;
  seated.forEach((playerId, seat) => {
    const pieces = config.fixedSetup.seats[seat];
    if (!pieces) throw new Error(`The fixed setup has no pieces for seat ${seat + 1}`);
    for (const placement of [pieces.first, pieces.second]) {
      buildings[hexCorner(placement.settlement, placement.settlement.corner)] = {
        playerId,
        kind: 'settlement',
      };
      roads[hexSideEdge(placement.road, placement.road.side)] = playerId;
    }
    const second = hexCorner(pieces.second.settlement, pieces.second.settlement.corner);
    const collected = getOpeningYield({ ...opening, supply: remaining }, second);
    remaining = addResources(remaining, collected, -1);
    players[playerId] = { ...newPlayer(), resources: collected };
  });

  return {
    ...opening,
    turn: { ...opening.turn, step: 'ROLL' },
    buildings,
    roads,
    supply: remaining,
    players,
  };
}
