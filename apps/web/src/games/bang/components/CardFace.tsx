import { getWeaponRangeOf, isBlue, type CardView } from '@bgp/game-bang';
import { Tip } from '../../shared/Tip';
import { isRedSuit, rankLabel, SUIT_SYMBOL } from '../pips';
import { useBangText } from '../useBangText';
import { Icon } from './Icon';

function Pip({ card }: { card: Pick<CardView, 'suit' | 'rank'> }) {
  return (
    <span className={isRedSuit(card.suit) ? 'bang-pip red' : 'bang-pip'}>
      {rankLabel(card.rank)}
      <span>{SUIT_SYMBOL[card.suit]}</span>
    </span>
  );
}

/**
 * One playing card, face up: its suit and rank in the corner as on the real card, what it is
 * in the middle, and a border that tells a card played and gone (brown) from one that stays on
 * the table (blue). It is a button when it can be picked, and explains itself either way.
 */
export function CardFace({
  card,
  mini = false,
  selected = false,
  dimmed = false,
  lit = false,
  onPick,
}: {
  card: CardView;
  /** As it lies in front of a player: the picture and the corner only. */
  mini?: boolean;
  selected?: boolean;
  /** Shown, but not something to play right now. */
  dimmed?: boolean;
  /** One of the cards the viewer is being asked to choose from. */
  lit?: boolean;
  onPick?: () => void;
}) {
  const text = useBangText();
  const name = text.card[card.kind];
  const range = getWeaponRangeOf(card.kind);
  const blue = isBlue(card.kind);
  const className = [
    'bang-card',
    blue ? 'blue' : 'brown',
    mini ? 'mini' : '',
    dimmed ? 'dimmed' : '',
    lit ? 'lit' : '',
    selected ? 'selected' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const body = (
    <>
      <Pip card={card} />
      {range !== undefined && (
        <span className="bang-card-range">
          <Icon name="range" />
          {range}
        </span>
      )}
      <span className="bang-card-art">
        <Icon name={card.kind} />
      </span>
      <span className={mini ? 'sr-only' : 'bang-card-name'}>{name}</span>
    </>
  );
  const hint = (
    <>
      <strong>
        {name} <Pip card={card} />
      </strong>
      <span>{text.cardHint[card.kind]}</span>
      <span className="muted">
        {range !== undefined
          ? text.cardColor.weapon(range)
          : blue
            ? text.cardColor.blue
            : text.cardColor.brown}
      </span>
      {dimmed && <span className="muted">{text.hand.unplayable}</span>}
    </>
  );

  return (
    <Tip hint={hint}>
      {onPick ? (
        <button type="button" className={className} aria-pressed={selected} onClick={onPick}>
          {body}
        </button>
      ) : (
        <span className={className}>{body}</span>
      )}
    </Tip>
  );
}

/** A card seen from behind: someone else's hand, or the deck. */
export function CardBack({ mini = false }: { mini?: boolean }) {
  return (
    <span className={mini ? 'bang-card back mini' : 'bang-card back'} aria-hidden="true">
      <Icon name="hat" />
    </span>
  );
}
