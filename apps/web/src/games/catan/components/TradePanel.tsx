import {
  RESOURCES,
  type CatanAction,
  type CatanView,
  type Resource,
  type ResourceCounts,
} from '@bgp/game-catan';
import { useState } from 'react';
import { RESOURCE_LABEL } from '../layout';
import { Icon } from './Icon';
import { resourceStyle } from './ResourceChip';
import { NO_RESOURCES, ResourcePicker, compact, totalOf } from './ResourcePicker';

/** The most of one resource an offer may ask for: more than anyone is likely to hold. */
const MAX_ASK = 9;

/** Who the trade is with. UI state only. */
type Partner = 'supply' | 'players';

/**
 * Where the viewer puts a trade together. On a wide screen it is always beside the table; on
 * a narrow one it is a sheet over it, shown while `open`.
 */
export function TradePanel({
  view,
  me,
  disabled,
  sendAction,
  open,
  onClose,
}: {
  view: CatanView;
  /** The viewer's seat, or null when they are only watching. */
  me: string | null;
  disabled: boolean;
  sendAction(action: CatanAction): void;
  open: boolean;
  onClose(): void;
}) {
  const { legal, turn, supply } = view;
  const seat = me === null ? undefined : view.players[me];
  const hand = seat?.resources ?? NO_RESOURCES;

  const [partner, setPartner] = useState<Partner>('supply');
  const [give, setGive] = useState<Resource | null>(null);
  const [receive, setReceive] = useState<Resource | null>(null);
  const [offered, setOffered] = useState<ResourceCounts>(NO_RESOURCES);
  const [asked, setAsked] = useState<ResourceCounts>(NO_RESOURCES);

  // Someone only watching has nothing to trade; an offer on the table is shown by the board.
  if (!seat) return null;

  // Never more than is held, whatever happened to the hand since it was picked.
  const giving = Object.fromEntries(
    RESOURCES.map((resource) => [resource, Math.min(offered[resource], hand[resource])]),
  ) as ResourceCounts;
  const canTrade = !disabled && legal.canTrade;
  const rate = give === null ? 0 : seat.supplyRates[give];
  const canSupplyTrade =
    canTrade &&
    give !== null &&
    receive !== null &&
    give !== receive &&
    hand[give] >= rate &&
    supply[receive] > 0;
  const canOffer = canTrade && totalOf(giving) > 0 && totalOf(asked) > 0;

  const partnerTab = (kind: Partner, icon: 'swap' | 'handshake', label: string) => (
    <button
      type="button"
      className={partner === kind ? 'catan-tab selected' : 'catan-tab'}
      aria-pressed={partner === kind}
      onClick={() => setPartner(kind)}
    >
      <Icon name={icon} />
      {label}
    </button>
  );

  return (
    <section className={open ? 'card catan-trade open' : 'card catan-trade'} aria-label="Trade">
      <header className="catan-trade-head">
        <h2>Trade</h2>
        <button
          type="button"
          className="secondary catan-sheet-close"
          aria-label="Close trade"
          onClick={onClose}
        >
          ✕
        </button>
      </header>
      <div className="catan-tabs" role="group" aria-label="Who to trade with">
        {partnerTab('supply', 'swap', 'Bank & ports')}
        {partnerTab('players', 'handshake', 'Players')}
      </div>
      {!legal.canTrade && (
        <p className="muted hint">
          {turn.offer
            ? 'One offer at a time: this one has to be closed first.'
            : 'Trading opens on your own turn, once the dice are rolled.'}
        </p>
      )}

      {partner === 'supply' ? (
        <div className="catan-trade-form">
          <div className="catan-trade-side">
            <span className="catan-trade-title">You give</span>
            <div className="catan-options" role="radiogroup" aria-label="Resource to give">
              {RESOURCES.map((resource) => (
                <button
                  key={resource}
                  type="button"
                  role="radio"
                  aria-checked={give === resource}
                  aria-label={`${seat.supplyRates[resource]} ${RESOURCE_LABEL[resource].toLowerCase()}`}
                  className="catan-option"
                  style={resourceStyle(resource)}
                  disabled={!canTrade || hand[resource] < seat.supplyRates[resource]}
                  onClick={() => setGive(resource)}
                >
                  <Icon name={resource} />
                  <span className="catan-option-note">{seat.supplyRates[resource]} : 1</span>
                </button>
              ))}
            </div>
          </div>
          <div className="catan-trade-side">
            <span className="catan-trade-title">You get</span>
            <div className="catan-options" role="radiogroup" aria-label="Resource to get">
              {RESOURCES.map((resource) => (
                <button
                  key={resource}
                  type="button"
                  role="radio"
                  aria-checked={receive === resource}
                  aria-label={`1 ${RESOURCE_LABEL[resource].toLowerCase()}, ${supply[resource]} left in the supply`}
                  className="catan-option"
                  style={resourceStyle(resource)}
                  disabled={!canTrade || resource === give || supply[resource] === 0}
                  onClick={() => setReceive(resource)}
                >
                  <Icon name={resource} />
                  <span className="catan-option-note">{supply[resource]} left</span>
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            disabled={!canSupplyTrade}
            onClick={() => {
              if (give !== null && receive !== null) {
                sendAction({ type: 'SUPPLY_TRADE', give, receive });
              }
            }}
          >
            {give !== null && receive !== null && give !== receive
              ? `Trade ${rate} ${RESOURCE_LABEL[give].toLowerCase()} for 1 ${RESOURCE_LABEL[receive].toLowerCase()}`
              : 'Pick what to give and get'}
          </button>
        </div>
      ) : (
        <div className="catan-trade-form">
          <div className="catan-trade-side">
            <span className="catan-trade-title">You give</span>
            <ResourcePicker
              label="Cards you give"
              value={giving}
              onChange={setOffered}
              max={(resource) => (asked[resource] > 0 ? 0 : hand[resource])}
              disabled={!canTrade}
            />
          </div>
          <div className="catan-trade-side">
            <span className="catan-trade-title">You want</span>
            <ResourcePicker
              label="Cards you want"
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
            Offer to the table
          </button>
        </div>
      )}
    </section>
  );
}
