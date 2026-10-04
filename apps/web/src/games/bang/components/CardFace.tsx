import { isBlue, type CardView } from '@bgp/game-bang';
import { CARD_HINT, CARD_LABEL, isRedSuit, pipLabel } from '../labels';

/**
 * One playing card, drawn with text alone. It is a button when it can be picked, and says
 * what it does on hover either way.
 */
export function CardFace({
  card,
  selected = false,
  dimmed = false,
  small = false,
  onPick,
}: {
  card: CardView;
  selected?: boolean;
  /** Shown, but not something to play right now. */
  dimmed?: boolean;
  small?: boolean;
  onPick?: () => void;
}) {
  const className = [
    'bang-card',
    isBlue(card.kind) ? 'blue' : 'brown',
    small ? 'small' : '',
    dimmed ? 'dimmed' : '',
    selected ? 'selected' : '',
  ]
    .filter(Boolean)
    .join(' ');
  const body = (
    <>
      <span className={`bang-pip ${isRedSuit(card.suit) ? 'red' : ''}`}>{pipLabel(card)}</span>
      <span className="bang-card-name">{CARD_LABEL[card.kind]}</span>
    </>
  );

  return onPick ? (
    <button
      type="button"
      className={className}
      title={CARD_HINT[card.kind]}
      aria-pressed={selected}
      onClick={onPick}
    >
      {body}
    </button>
  ) : (
    <span className={className} title={CARD_HINT[card.kind]}>
      {body}
    </span>
  );
}
