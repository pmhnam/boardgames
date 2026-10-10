import {
  DEVELOPMENT_CARD_TYPES,
  RESOURCES,
  type CatanAction,
  type CatanView,
  type PlayableCardType,
  type Resource,
  type ResourceCounts,
} from '@bgp/game-catan';
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { playerName, type GameViewProps } from '../types';
import type { IconName } from './art/icons';
import { Board } from './components/Board';
import { CostsGuide } from './components/CostsGuide';
import { Dice } from './components/Dice';
import { DiscardPrompt } from './components/DiscardPrompt';
import { Icon } from './components/Icon';
import { OfferBanner } from './components/OfferBanner';
import { PlayerPanel } from './components/PlayerPanel';
import { ResourceCard, ResourceChip, resourceStyle } from './components/ResourceChip';
import { NO_RESOURCES } from './components/ResourcePicker';
import { TradePanel } from './components/TradePanel';
import { CARD_HINT, CARD_ICON, CARD_LABEL, RESOURCE_LABEL, playerColors } from './layout';
import { useHandChange } from './useHandChange';
import './catan.css';

/** What the player is about to place on the board. UI state only. */
type Tool = 'road' | 'settlement' | 'city';

/** A card that needs a choice before it can be played. UI state only. */
type CardPick = { type: 'invention'; picks: Resource[] } | { type: 'monopoly' } | null;

const TOOL_HINT: Record<Tool, string> = {
  road: 'Pick a highlighted edge for your road.',
  settlement: 'Pick a highlighted corner for your settlement.',
  city: 'Pick one of your settlements to make it a city.',
};

function describeCost(cost: Readonly<ResourceCounts>): string {
  return RESOURCES.filter((resource) => cost[resource] > 0)
    .map((resource) => `${cost[resource]} ${resource}`)
    .join(', ');
}

/** A price as one dot per card, hollow for each card the hand is short of. */
function CostPips({
  cost,
  hand,
}: {
  cost: Readonly<ResourceCounts>;
  hand: Readonly<ResourceCounts>;
}) {
  return (
    <span className="catan-cost" aria-hidden="true">
      {RESOURCES.flatMap((resource) =>
        Array.from({ length: cost[resource] }, (_, index) => (
          <span
            key={`${resource}-${index}`}
            className={index < hand[resource] ? 'catan-cost-pip' : 'catan-cost-pip missing'}
            style={resourceStyle(resource)}
          />
        )),
      )}
    </span>
  );
}

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
  /** The trade sheet of a narrow screen. A wide one shows the trade panel all the time. */
  const [tradeOpen, setTradeOpen] = useState(false);
  const handChange = useHandChange(hand, message.version);

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
    if (!legal.canTrade) setTradeOpen(false);
  }, [message.version]);

  useEffect(() => {
    if (!tradeOpen) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setTradeOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [tradeOpen]);

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
    if (!playing) {
      return view.winnerPlayerIds.length > 0
        ? `${view.winnerPlayerIds.map(nameOf).join(' & ')} won the game.`
        : 'Game over.';
    }
    if (legal.mustDiscard > 0) return `A 7 was rolled. Discard ${legal.mustDiscard} of your cards.`;
    if (turn.step === 'DISCARD') {
      return `A 7 was rolled. Waiting for ${discarding.map(nameOf).join(', ')} to discard.`;
    }
    if (legal.canRespond) return `${activeName} offers you a trade. Accept or decline it.`;
    if (!mine) {
      if (turn.offer) return `${activeName} has a trade on offer.`;
      if (turn.step === 'SETUP_SETTLEMENT') return `${activeName} is placing a settlement.`;
      if (turn.step === 'SETUP_ROAD') return `${activeName} is placing a road.`;
      if (turn.step === 'ROBBER') return `${activeName} is moving the robber.`;
      if (turn.step === 'ROLL') return `${activeName} is about to roll.`;
      return `${activeName} is building and trading.`;
    }
    if (turn.offer) return 'Your offer is on the table. Close it with a player, or withdraw it.';
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

  const toolButton = (kind: Tool, icon: IconName, label: string) => (
    <button
      type="button"
      className={tool === kind ? 'catan-build selected' : 'catan-build secondary'}
      disabled={!canAct || forced || toolTargets[kind].length === 0}
      aria-pressed={tool === kind}
      aria-label={`${label}: costs ${describeCost(view.costs[kind])}`}
      title={`Costs ${describeCost(view.costs[kind])}`}
      onClick={() => setTool(tool === kind ? null : kind)}
    >
      <Icon name={icon} />
      <span>{label}</span>
      <CostPips cost={view.costs[kind]} hand={hand} />
    </button>
  );

  // Whatever needs a choice right now. It sits at the head of the viewer's hand, where it is
  // always in sight; someone only watching sees it over the foot of the board.
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
    // Only while the choice is still open: the hex outlives it by a moment once it is sent.
    const victims = robberHex === null ? undefined : legal.robberTargets[robberHex];
    if (robberHex !== null && victims) {
      return (
        <div className="catan-prompt-body">
          {victims.map((victimId) => (
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
    if (turn.offer) {
      return (
        <OfferBanner
          view={view}
          me={me}
          nameOf={nameOf}
          disabled={disabled}
          sendAction={sendAction}
        />
      );
    }
    return null;
  })();

  return (
    <div className="catan">
      <div className="catan-table">
        <header
          className={mine ? 'catan-status mine' : 'catan-status'}
          style={{ '--seat': colors[turn.activePlayerId] } as CSSProperties}
        >
          <div className="catan-status-text">
            <p className="catan-turn">
              {playing && <span className="catan-seat" aria-hidden="true" />}
              {!playing ? 'Game over' : mine ? 'Your turn' : `${activeName}’s turn`}
              <span className="catan-turn-number">Turn {turn.number}</span>
            </p>
            <p className="catan-step" aria-live="polite">
              {status}
            </p>
          </div>
          <Dice roll={turn.roll} turn={turn.number} />
        </header>

        <div className="catan-side">
          <div className="catan-players">
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
          </div>
          {playing && (
            <TradePanel
              view={view}
              me={me}
              disabled={disabled}
              sendAction={sendAction}
              open={tradeOpen}
              onClose={() => setTradeOpen(false)}
            />
          )}
          <section className="card catan-bank">
            <h2>Bank</h2>
            <div className="catan-chips">
              {RESOURCES.map((resource) => (
                <ResourceChip
                  key={resource}
                  resource={resource}
                  count={view.supply[resource]}
                  dim={view.supply[resource] === 0}
                />
              ))}
              <span
                className={
                  view.developmentDeckCount === 0 ? 'catan-chip deck dim' : 'catan-chip deck'
                }
                title={`${view.developmentDeckCount} development cards left`}
              >
                <Icon name="card" />
                <span className="catan-chip-count">{view.developmentDeckCount}</span>
                <span className="sr-only">development cards left</span>
              </span>
            </div>
            <p className="muted hint">First to {view.victoryPointsToWin} points wins.</p>
          </section>
        </div>

        <div className="catan-stage">
          <Board
            view={view}
            colors={colors}
            nameOf={nameOf}
            rolled={turn.roll ? turn.roll[0] + turn.roll[1] : null}
            accent={me === null ? undefined : colors[me]}
            vertexTargets={vertexTargets}
            edgeTargets={edgeTargets}
            hexTargets={hexTargets}
            selectedHex={robberHex}
            onVertex={onVertex}
            onEdge={onEdge}
            onHex={onHex}
          />
          {prompt && !seat && <div className="catan-prompt">{prompt}</div>}
        </div>

        {seat && me !== null && (
          <section className="card catan-dock" aria-label="Your hand and what you can do">
            {prompt && <div className="catan-prompt">{prompt}</div>}
            <div className="catan-hand">
              <div className="catan-hand-cards">
                {RESOURCES.map((resource) => (
                  <ResourceCard
                    key={resource}
                    resource={resource}
                    count={hand[resource]}
                    change={handChange?.counts[resource]}
                    changeKey={handChange?.key}
                  />
                ))}
              </div>
              {heldCards.length > 0 && (
                <ul className="catan-cards">
                  {heldCards.map(({ type, cards }) => {
                    const playable = type !== 'victoryPoint' && legal.playableCards.includes(type);
                    return (
                      <li key={type} title={CARD_HINT[type]}>
                        <Icon name={CARD_ICON[type]} />
                        <span>
                          {CARD_LABEL[type]}
                          {cards.length > 1 && ` ×${cards.length}`}
                        </span>
                        {cards.every((card) => card.fresh) && (
                          <span
                            className="catan-card-fresh"
                            title="Bought this turn: it can be played from your next turn."
                          >
                            new
                          </span>
                        )}
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
            </div>
            <div className="catan-actions">
              <button
                type="button"
                className="catan-action roll"
                disabled={!canAct || !legal.canRoll}
                onClick={() => sendAction({ type: 'ROLL_DICE' })}
              >
                <Icon name="dice" />
                Roll dice
              </button>
              <div className="catan-builds" role="group" aria-label="Build">
                {toolButton('road', 'road', 'Road')}
                {toolButton('settlement', 'settlement', 'Settlement')}
                {toolButton('city', 'city', 'City')}
                <button
                  type="button"
                  className="catan-build secondary"
                  disabled={!canAct || !legal.canBuyDevelopmentCard}
                  aria-label={`Buy a development card: costs ${describeCost(view.costs.developmentCard)}`}
                  title={`Costs ${describeCost(view.costs.developmentCard)}`}
                  onClick={() => sendAction({ type: 'BUY_DEVELOPMENT_CARD' })}
                >
                  <Icon name="card" />
                  <span>Dev card</span>
                  <CostPips cost={view.costs.developmentCard} hand={hand} />
                </button>
              </div>
              {playing && (
                <button
                  type="button"
                  className="secondary catan-action trade"
                  aria-expanded={tradeOpen}
                  onClick={() => setTradeOpen(true)}
                >
                  <Icon name="swap" />
                  Trade
                </button>
              )}
              <button
                type="button"
                className="catan-action end"
                disabled={!canAct || !legal.canEndTurn}
                onClick={() => sendAction({ type: 'END_TURN' })}
              >
                End turn
              </button>
            </div>
          </section>
        )}
      </div>

      <CostsGuide view={view} />
      {tradeOpen && <div className="catan-backdrop" onClick={() => setTradeOpen(false)} />}
    </div>
  );
}
