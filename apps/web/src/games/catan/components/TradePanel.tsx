import {
  RESOURCES,
  type CatanAction,
  type CatanView,
  type Resource,
  type ResourceCounts,
} from '@bgp/game-catan';
import { useState } from 'react';
import { RESOURCE_LABEL } from '../layout';
import { NO_RESOURCES, ResourceList, ResourcePicker, compact, totalOf } from './ResourcePicker';

/** The most of one resource an offer may ask for: more than anyone is likely to hold. */
const MAX_ASK = 9;

export function TradePanel({
  view,
  me,
  nameOf,
  disabled,
  sendAction,
}: {
  view: CatanView;
  /** The viewer's seat, or null when they are only watching. */
  me: string | null;
  nameOf(playerId: string): string;
  disabled: boolean;
  sendAction(action: CatanAction): void;
}) {
  const { legal, turn, supply } = view;
  const { offer } = turn;
  const seat = me === null ? undefined : view.players[me];
  const hand = seat?.resources ?? NO_RESOURCES;
  const proposing = turn.activePlayerId === me;

  const [give, setGive] = useState<Resource>('brick');
  const [receive, setReceive] = useState<Resource>('wood');
  const [offered, setOffered] = useState<ResourceCounts>(NO_RESOURCES);
  const [asked, setAsked] = useState<ResourceCounts>(NO_RESOURCES);

  // Never more than is held, whatever happened to the hand since it was picked.
  const giving = Object.fromEntries(
    RESOURCES.map((resource) => [resource, Math.min(offered[resource], hand[resource])]),
  ) as ResourceCounts;
  const rate = seat?.supplyRates[give] ?? 0;
  const canTrade = !disabled && legal.canTrade;
  const canSupplyTrade = canTrade && give !== receive && hand[give] >= rate && supply[receive] > 0;
  const canOffer = canTrade && totalOf(giving) > 0 && totalOf(asked) > 0;

  const waitingOn = view.turnOrder.filter(
    (playerId) => playerId !== turn.activePlayerId && offer?.responses[playerId] === undefined,
  );

  return (
    <section className="card catan-trade">
      <h2>Trade</h2>

      {offer && (
        <div className="catan-offer">
          <p>
            <strong>{proposing ? 'You offer' : `${nameOf(turn.activePlayerId)} offers`}</strong>{' '}
            <ResourceList counts={offer.give} /> for <ResourceList counts={offer.receive} />
          </p>
          {proposing ? (
            <div className="row wrap">
              {legal.accepters.map((playerId) => (
                <button
                  key={playerId}
                  type="button"
                  disabled={disabled}
                  onClick={() => sendAction({ type: 'CONFIRM_TRADE', playerId })}
                >
                  Trade with {nameOf(playerId)}
                </button>
              ))}
              <button
                type="button"
                className="secondary"
                disabled={disabled || !legal.canCancelTrade}
                onClick={() => sendAction({ type: 'CANCEL_TRADE' })}
              >
                Withdraw offer
              </button>
              <span className="muted">
                {waitingOn.length > 0
                  ? `Waiting for ${waitingOn.map(nameOf).join(', ')}.`
                  : legal.accepters.length === 0
                    ? 'Everyone declined.'
                    : 'Everyone has answered.'}
              </span>
            </div>
          ) : legal.canRespond ? (
            <div className="row wrap">
              <button
                type="button"
                disabled={disabled || !legal.canAccept}
                onClick={() => sendAction({ type: 'RESPOND_TRADE', accept: true })}
              >
                Accept
              </button>
              <button
                type="button"
                className="secondary"
                disabled={disabled}
                onClick={() => sendAction({ type: 'RESPOND_TRADE', accept: false })}
              >
                Decline
              </button>
              {!legal.canAccept && <span className="muted">You do not hold those cards.</span>}
            </div>
          ) : (
            me !== null &&
            offer.responses[me] && (
              <p className="muted">
                You {offer.responses[me] === 'accepted' ? 'accepted' : 'declined'}. It is up to{' '}
                {nameOf(turn.activePlayerId)} now.
              </p>
            )
          )}
        </div>
      )}

      {seat ? (
        <>
          <div className="catan-trade-form">
            <span className="catan-trade-title">With the supply</span>
            <label>
              <span className="sr-only">Give</span>
              <select value={give} onChange={(event) => setGive(event.target.value as Resource)}>
                {RESOURCES.map((resource) => (
                  <option key={resource} value={resource}>
                    {seat.supplyRates[resource]} {RESOURCE_LABEL[resource].toLowerCase()}
                  </option>
                ))}
              </select>
            </label>
            <span>for 1</span>
            <label>
              <span className="sr-only">Receive</span>
              <select
                value={receive}
                onChange={(event) => setReceive(event.target.value as Resource)}
              >
                {RESOURCES.map((resource) => (
                  <option key={resource} value={resource}>
                    {RESOURCE_LABEL[resource].toLowerCase()}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={!canSupplyTrade}
              onClick={() => sendAction({ type: 'SUPPLY_TRADE', give, receive })}
            >
              Trade
            </button>
          </div>

          <div className="catan-trade-form">
            <span className="catan-trade-title">With the other players</span>
            <div className="catan-trade-side">
              <span>You give</span>
              <ResourcePicker
                label="Cards you give"
                value={giving}
                onChange={setOffered}
                max={(resource) => (asked[resource] > 0 ? 0 : hand[resource])}
                disabled={!canTrade}
              />
            </div>
            <div className="catan-trade-side">
              <span>You get</span>
              <ResourcePicker
                label="Cards you get"
                value={asked}
                onChange={setAsked}
                max={(resource) => (giving[resource] > 0 ? 0 : MAX_ASK)}
                disabled={!canTrade}
              />
            </div>
            <button
              type="button"
              disabled={!canOffer}
              onClick={() =>
                sendAction({
                  type: 'PROPOSE_TRADE',
                  give: compact(giving),
                  receive: compact(asked),
                })
              }
            >
              Offer
            </button>
          </div>
        </>
      ) : (
        !offer && <p className="muted hint">No trade is on offer.</p>
      )}
    </section>
  );
}
