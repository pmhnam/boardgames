import {
  DEVELOPMENT_CARD_TYPES,
  RESOURCES,
  type CatanAction,
  type CatanView,
  type PlayableCardType,
  type Resource,
} from '@bgp/game-catan';
import { useEffect, useMemo, useState } from 'react';
import { playerName, type GameViewProps } from '../types';
import { Board } from './components/Board';
import { CostsGuide } from './components/CostsGuide';
import { DiscardPrompt } from './components/DiscardPrompt';
import { PlayerPanel } from './components/PlayerPanel';
import { ResourceChip } from './components/ResourceChip';
import { NO_RESOURCES } from './components/ResourcePicker';
import { TradePanel } from './components/TradePanel';
import { CARD_HINT, CARD_LABEL, RESOURCE_LABEL, playerColors } from './layout';

/** What the player is about to place on the board. UI state only. */
type Tool = 'road' | 'settlement' | 'city';

/** A card that needs a choice before it can be played. UI state only. */
type CardPick = { type: 'invention'; picks: Resource[] } | { type: 'monopoly' } | null;

const TOOL_HINT: Record<Tool, string> = {
  road: 'Pick a highlighted edge for your road.',
  settlement: 'Pick a highlighted corner for your settlement.',
  city: 'Pick one of your settlements to make it a city.',
};

export function CatanGameView({
  message,
  players,
  sendAction,
  disabled,
}: GameViewProps<CatanView, CatanAction>) {
  const view = message.state;
  const me = message.viewerPlayerId;
  const { legal, turn } = view;
  const playing = view.phase === 'PLAYING';
  const seat = me === null ? undefined : view.players[me];
  const hand = seat?.resources ?? NO_RESOURCES;
  // Whose turn it is, rather than who may click: it does not flicker while an action is sent.
  const mine = playing && turn.activePlayerId === me;
  const canAct = !disabled && playing && seat !== undefined;
  const nameOf = (playerId: string) => playerName(players, playerId);
  const colors = useMemo(() => playerColors(view.turnOrder), [view.turnOrder]);

  const [tool, setTool] = useState<Tool | null>(null);
  const [robberHex, setRobberHex] = useState<string | null>(null);
  const [cardPick, setCardPick] = useState<CardPick>(null);

  const toolTargets: Record<Tool, string[]> = {
    road: legal.roadEdges,
    settlement: legal.settlementVertices,
    city: legal.cityVertices,
  };
  const toolStillUsable = tool !== null && toolTargets[tool].length > 0;

  // A choice only makes sense for the state it was made in. A tool is kept while there is
  // still somewhere to use it, so several roads can be built without picking it again.
  useEffect(() => {
    setRobberHex(null);
    setCardPick(null);
    if (!toolStillUsable) setTool(null);
  }, [message.version]);

  const opening = turn.step === 'SETUP_SETTLEMENT' || turn.step === 'SETUP_ROAD';
  const robbing = Object.keys(legal.robberTargets).length > 0;
  const placingFreeRoads = turn.freeRoads > 0 && legal.roadEdges.length > 0;
  // The steps where the board is the only thing to click, with no tool to pick first.
  const forced = opening || robbing || placingFreeRoads;

  let vertexTargets: string[] = [];
  let edgeTargets: string[] = [];
  let hexTargets: string[] = [];
  if (canAct) {
    if (turn.step === 'SETUP_SETTLEMENT') vertexTargets = legal.settlementVertices;
    else if (turn.step === 'SETUP_ROAD' || placingFreeRoads) edgeTargets = legal.roadEdges;
    else if (robbing) hexTargets = robberHex === null ? Object.keys(legal.robberTargets) : [];
    else if (tool === 'road') edgeTargets = legal.roadEdges;
    else if (tool === 'settlement') vertexTargets = legal.settlementVertices;
    else if (tool === 'city') vertexTargets = legal.cityVertices;
  }

  const onVertex = (vertex: string) => {
    if (turn.step === 'SETUP_SETTLEMENT') sendAction({ type: 'PLACE_SETUP_SETTLEMENT', vertex });
    else if (tool === 'city') sendAction({ type: 'BUILD_CITY', vertex });
    else sendAction({ type: 'BUILD_SETTLEMENT', vertex });
  };
  const onEdge = (edge: string) =>
    sendAction(
      turn.step === 'SETUP_ROAD'
        ? { type: 'PLACE_SETUP_ROAD', edge }
        : { type: 'BUILD_ROAD', edge },
    );
  const onHex = (hex: string) => {
    const victims = legal.robberTargets[hex] ?? [];
    if (victims.length > 1) setRobberHex(hex);
    else sendAction({ type: 'MOVE_ROBBER', hex, victimId: victims[0] });
  };

  const playCard = (type: PlayableCardType) => {
    if (type === 'knight') sendAction({ type: 'PLAY_KNIGHT' });
    else if (type === 'roadBuilding') sendAction({ type: 'PLAY_ROAD_BUILDING' });
    else if (type === 'invention') setCardPick({ type: 'invention', picks: [] });
    else setCardPick({ type: 'monopoly' });
  };
  const pickResource = (resource: Resource) => {
    if (cardPick?.type === 'monopoly') {
      sendAction({ type: 'PLAY_MONOPOLY', resource });
    } else if (cardPick?.type === 'invention') {
      const picks = [...cardPick.picks, resource];
      if (picks.length < 2) setCardPick({ type: 'invention', picks });
      else sendAction({ type: 'PLAY_INVENTION', resources: picks });
    }
  };

  const activeName = nameOf(turn.activePlayerId);
  const discarding = Object.keys(turn.pendingDiscards);
  const status = (() => {
    if (!playing) return 'Game over.';
    if (legal.mustDiscard > 0) return `A 7 was rolled. Discard ${legal.mustDiscard} of your cards.`;
    if (turn.step === 'DISCARD') {
      return `A 7 was rolled. Waiting for ${discarding.map(nameOf).join(', ')} to discard.`;
    }
    if (legal.canRespond) return `${activeName} offers you a trade. Answer it under Trade.`;
    if (!mine) {
      if (turn.offer) return `${activeName} has a trade on offer.`;
      if (turn.step === 'SETUP_SETTLEMENT') return `${activeName} is placing a settlement.`;
      if (turn.step === 'SETUP_ROAD') return `${activeName} is placing a road.`;
      if (turn.step === 'ROBBER') return `${activeName} is moving the robber.`;
      if (turn.step === 'ROLL') return `${activeName} is about to roll.`;
      return `${activeName} is building and trading.`;
    }
    if (turn.offer) return 'Your offer is on the table. Close it or withdraw it under Trade.';
    if (turn.step === 'SETUP_SETTLEMENT') return 'Place a settlement on a highlighted corner.';
    if (turn.step === 'SETUP_ROAD') return 'Place a road from that settlement.';
    if (turn.step === 'ROBBER') {
      return robberHex ? 'Choose who to rob.' : 'Move the robber to a highlighted hex.';
    }
    if (turn.freeRoads > 0) {
      return `Place ${turn.freeRoads} free ${turn.freeRoads === 1 ? 'road' : 'roads'}.`;
    }
    if (cardPick?.type === 'monopoly') return 'Monopoly: name the resource to collect.';
    if (cardPick?.type === 'invention') {
      return `Invention: take ${2 - cardPick.picks.length} from the supply.`;
    }
    if (turn.step === 'ROLL') {
      return legal.playableCards.length > 0
        ? 'Roll the dice, or play a development card first.'
        : 'Roll the dice.';
    }
    return tool ? TOOL_HINT[tool] : 'Build, trade, play a card, or end your turn.';
  })();

  const heldCards = DEVELOPMENT_CARD_TYPES.map((type) => ({
    type,
    cards: seat?.developmentCards?.filter((card) => card.type === type) ?? [],
  })).filter((group) => group.cards.length > 0);

  const toolButton = (kind: Tool, label: string) => (
    <button
      type="button"
      className={tool === kind ? 'catan-tool selected' : 'catan-tool secondary'}
      disabled={!canAct || forced || toolTargets[kind].length === 0}
      aria-pressed={tool === kind}
      onClick={() => setTool(tool === kind ? null : kind)}
    >
      {label}
    </button>
  );

  // Always there and always the same height: whatever needs a choice right now goes here.
  const prompt = (() => {
    if (seat && legal.mustDiscard > 0) {
      return (
        <DiscardPrompt
          hand={hand}
          owed={legal.mustDiscard}
          disabled={disabled}
          onDiscard={(resources) => sendAction({ type: 'DISCARD', resources })}
        />
      );
    }
    if (robberHex !== null) {
      return (
        <div className="catan-prompt-body">
          {(legal.robberTargets[robberHex] ?? []).map((victimId) => (
            <button
              key={victimId}
              type="button"
              disabled={!canAct}
              onClick={() => sendAction({ type: 'MOVE_ROBBER', hex: robberHex, victimId })}
            >
              Rob {nameOf(victimId)}
            </button>
          ))}
          <button type="button" className="secondary" onClick={() => setRobberHex(null)}>
            Another hex
          </button>
        </div>
      );
    }
    if (cardPick !== null) {
      const taken = (resource: Resource) =>
        cardPick.type === 'invention'
          ? cardPick.picks.filter((pick) => pick === resource).length
          : 0;
      return (
        <div className="catan-prompt-body">
          {RESOURCES.map((resource) => (
            <button
              key={resource}
              type="button"
              className="secondary catan-pick"
              disabled={
                !canAct ||
                (cardPick.type === 'invention' && view.supply[resource] <= taken(resource))
              }
              onClick={() => pickResource(resource)}
            >
              <ResourceChip resource={resource} />
              {RESOURCE_LABEL[resource]}
            </button>
          ))}
          <button type="button" className="secondary" onClick={() => setCardPick(null)}>
            Cancel
          </button>
        </div>
      );
    }
    return null;
  })();

  return (
    <div className="stack catan">
      <header className="catan-banner">
        <p className="catan-turn">
          {!playing ? 'Game over' : mine ? 'Your turn' : `${activeName}’s turn`}
        </p>
        <p className="muted">
          Turn {turn.number} · first to {view.victoryPointsToWin} points ·{' '}
          {view.developmentDeckCount} development cards left
        </p>
      </header>

      <div className="catan-table">
        <div className="catan-main">
          <section className={mine ? 'card catan-island active' : 'card catan-island'}>
            <div className="catan-status">
              <p className="catan-step" aria-live="polite">
                {status}
              </p>
              <span
                className="catan-dice"
                aria-label={
                  turn.roll ? `Rolled ${turn.roll[0]} and ${turn.roll[1]}` : 'Not rolled yet'
                }
              >
                <span className="catan-die">{turn.roll?.[0] ?? '–'}</span>
                <span className="catan-die">{turn.roll?.[1] ?? '–'}</span>
              </span>
            </div>
            {seat && me !== null && (
              <div className="catan-hand">
                <div className="catan-chips">
                  {RESOURCES.map((resource) => (
                    <ResourceChip
                      key={resource}
                      resource={resource}
                      count={hand[resource]}
                      dim={hand[resource] === 0}
                    />
                  ))}
                </div>
                {heldCards.length > 0 && (
                  <ul className="catan-cards">
                    {heldCards.map(({ type, cards }) => {
                      const playable =
                        type !== 'victoryPoint' && legal.playableCards.includes(type);
                      return (
                        <li key={type} title={CARD_HINT[type]}>
                          <span>
                            {CARD_LABEL[type]}
                            {cards.length > 1 && ` ×${cards.length}`}
                            {cards.every((card) => card.fresh) && (
                              <span className="muted"> (bought this turn)</span>
                            )}
                          </span>
                          {type !== 'victoryPoint' && (
                            <button
                              type="button"
                              className="secondary"
                              disabled={!canAct || !playable || forced}
                              onClick={() => playCard(type)}
                            >
                              Play
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
                <div className="catan-prompt">{prompt}</div>
                <div className="catan-actions">
                  <button
                    type="button"
                    disabled={!canAct || !legal.canRoll}
                    onClick={() => sendAction({ type: 'ROLL_DICE' })}
                  >
                    Roll dice
                  </button>
                  {toolButton('road', 'Road')}
                  {toolButton('settlement', 'Settlement')}
                  {toolButton('city', 'City')}
                  <button
                    type="button"
                    className="secondary"
                    disabled={!canAct || !legal.canBuyDevelopmentCard}
                    onClick={() => sendAction({ type: 'BUY_DEVELOPMENT_CARD' })}
                  >
                    Buy development card
                  </button>
                  <button
                    type="button"
                    disabled={!canAct || !legal.canEndTurn}
                    onClick={() => sendAction({ type: 'END_TURN' })}
                  >
                    End turn
                  </button>
                </div>
              </div>
            )}
            <Board
              view={view}
              colors={colors}
              nameOf={nameOf}
              vertexTargets={vertexTargets}
              edgeTargets={edgeTargets}
              hexTargets={hexTargets}
              selectedHex={robberHex}
              onVertex={onVertex}
              onEdge={onEdge}
              onHex={onHex}
            />
          </section>

          {playing && (
            <TradePanel
              view={view}
              me={me}
              nameOf={nameOf}
              disabled={disabled}
              sendAction={sendAction}
            />
          )}
        </div>

        <div className="catan-side">
          {view.turnOrder.map((playerId) => {
            const player = view.players[playerId];
            if (!player) return null;
            return (
              <PlayerPanel
                key={playerId}
                name={nameOf(playerId)}
                player={player}
                color={colors[playerId] ?? 'transparent'}
                target={view.victoryPointsToWin}
                mine={playerId === me}
                active={playing && turn.activePlayerId === playerId}
                winner={view.winnerPlayerIds.includes(playerId)}
                longestRoute={view.longestRoutePlayerId === playerId}
                largestArmy={view.largestArmyPlayerId === playerId}
                owes={turn.pendingDiscards[playerId] ?? 0}
                response={turn.offer?.responses[playerId]}
              />
            );
          })}
          <section className="card">
            <h2>Supply</h2>
            <div className="catan-chips">
              {RESOURCES.map((resource) => (
                <ResourceChip
                  key={resource}
                  resource={resource}
                  count={view.supply[resource]}
                  dim={view.supply[resource] === 0}
                />
              ))}
            </div>
          </section>
        </div>
      </div>

      <CostsGuide view={view} />
    </div>
  );
}
