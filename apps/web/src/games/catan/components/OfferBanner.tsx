import type { CatanAction, CatanView } from '@bgp/game-catan';
import { Icon } from './Icon';
import { ResourceList } from './ResourcePicker';

/** The trade on offer, with what the viewer may do about it: answer it, or close their own. */
export function OfferBanner({
  view,
  me,
  nameOf,
  disabled,
  sendAction,
}: {
  view: Pick<CatanView, 'legal' | 'turn' | 'turnOrder'>;
  /** The viewer's seat, or null when they are only watching. */
  me: string | null;
  nameOf(playerId: string): string;
  disabled: boolean;
  sendAction(action: CatanAction): void;
}) {
  const { legal, turn } = view;
  const { offer } = turn;
  if (!offer) return null;
  const proposing = turn.activePlayerId === me;
  const waitingOn = view.turnOrder.filter(
    (playerId) => playerId !== turn.activePlayerId && offer.responses[playerId] === undefined,
  );

  return (
    <div className="catan-offer">
      <p className="catan-offer-terms">
        <Icon name="handshake" />
        <strong>{proposing ? 'You offer' : `${nameOf(turn.activePlayerId)} offers`}</strong>
        <ResourceList counts={offer.give} />
        <span>for</span>
        <ResourceList counts={offer.receive} />
      </p>
      {proposing ? (
        <div className="catan-prompt-body">
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
        <div className="catan-prompt-body">
          <button
            type="button"
            disabled={disabled || !legal.canAccept}
            onClick={() => sendAction({ type: 'RESPOND_TRADE', offerId: offer.id, accept: true })}
          >
            Accept
          </button>
          <button
            type="button"
            className="secondary"
            disabled={disabled}
            onClick={() => sendAction({ type: 'RESPOND_TRADE', offerId: offer.id, accept: false })}
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
  );
}
