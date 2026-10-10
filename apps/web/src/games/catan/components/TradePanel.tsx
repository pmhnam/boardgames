import {
  RESOURCES,
  type CatanAction,
  type CatanView,
  type Resource,
  type ResourceCounts,
} from '@bgp/game-catan';
import { useState } from 'react';
import { useHints, type Hint } from '../hints';
import { useCatanText } from '../useCatanText';
import { Icon } from './Icon';
import { resourceStyle } from './ResourceChip';
import { NO_RESOURCES, ResourcePicker, compact, totalOf } from './ResourcePicker';
import { HintText, Tip } from './Tip';

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
  const text = useCatanText();
  const hints = useHints();
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

  const partnerTab = (kind: Partner, icon: 'swap' | 'handshake', label: string, hint: Hint) => (
    <Tip hint={<HintText hint={hint} />}>
      <button
        type="button"
        className={partner === kind ? 'catan-tab selected' : 'catan-tab'}
        aria-pressed={partner === kind}
        onClick={() => setPartner(kind)}
      >
        <Icon name={icon} />
        {label}
      </button>
    </Tip>
  );

  return (
    <section
      className={open ? 'card catan-trade open' : 'card catan-trade'}
      aria-label={text.trade}
    >
      <header className="catan-trade-head">
        <h2>{text.trade}</h2>
        <button
          type="button"
          className="secondary catan-sheet-close"
          aria-label={text.closeTrade}
          onClick={onClose}
        >
          ✕
        </button>
      </header>
      <div className="catan-tabs" role="group" aria-label={text.tradeWith}>
        {partnerTab('supply', 'swap', text.bankAndPorts, hints.bankTrade)}
        {partnerTab('players', 'handshake', text.players, hints.playerTrade)}
      </div>
      {!legal.canTrade && (
        <p className="muted hint">{turn.offer ? text.oneOfferAtATime : text.tradeOpensLater}</p>
      )}

      {partner === 'supply' ? (
        <div className="catan-trade-form">
          <div className="catan-trade-side">
            <span className="catan-trade-title">{text.youGive}</span>
            <div className="catan-options" role="radiogroup" aria-label={text.resourceToGive}>
              {RESOURCES.map((resource) => (
                <button
                  key={resource}
                  type="button"
                  role="radio"
                  aria-checked={give === resource}
                  aria-label={text.amount(seat.supplyRates[resource], resource)}
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
            <span className="catan-trade-title">{text.youGet}</span>
            <div className="catan-options" role="radiogroup" aria-label={text.resourceToGet}>
              {RESOURCES.map((resource) => (
                <button
                  key={resource}
                  type="button"
                  role="radio"
                  aria-checked={receive === resource}
                  aria-label={text.getOne(resource, supply[resource])}
                  className="catan-option"
                  style={resourceStyle(resource)}
                  disabled={!canTrade || resource === give || supply[resource] === 0}
                  onClick={() => setReceive(resource)}
                >
                  <Icon name={resource} />
                  <span className="catan-option-note">{text.leftInSupply(supply[resource])}</span>
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
              ? text.tradeFor(rate, give, receive)
              : text.pickGiveAndGet}
          </button>
        </div>
      ) : (
        <div className="catan-trade-form">
          <div className="catan-trade-side">
            <span className="catan-trade-title">{text.youGive}</span>
            <ResourcePicker
              label={text.cardsYouGive}
              value={giving}
              onChange={setOffered}
              max={(resource) => (asked[resource] > 0 ? 0 : hand[resource])}
              disabled={!canTrade}
            />
          </div>
          <div className="catan-trade-side">
            <span className="catan-trade-title">{text.youWant}</span>
            <ResourcePicker
              label={text.cardsYouWant}
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
            {text.offerToTable}
          </button>
        </div>
      )}
    </section>
  );
}
