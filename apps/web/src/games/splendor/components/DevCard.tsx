import {
  GEM_COLORS,
  type CardShortfall,
  type DevelopmentCard,
  type Tier,
} from '@bgp/game-splendor';
import type { CSSProperties, ReactNode } from 'react';
import { CARD_TINT, TIER_LABEL, TOKEN_LABEL, TOKEN_NAME } from '../layout';
import { GemToken } from './GemToken';

interface Selectable {
  selected?: boolean;
  /** When given, the card is a button; otherwise it is only shown. */
  onSelect?: () => void;
  disabled?: boolean;
}

/** "2 red, 1 blue": the gems a viewer still lacks for a card. */
export function describeMissing(shortfall: CardShortfall): string {
  return GEM_COLORS.filter((color) => shortfall.missing[color] > 0)
    .map((color) => `${shortfall.missing[color]} ${TOKEN_NAME[color]}`)
    .join(', ');
}

function describe(card: DevelopmentCard, shortfall?: CardShortfall): string {
  const cost = GEM_COLORS.filter((color) => card.cost[color] > 0)
    .map((color) => `${card.cost[color]} ${TOKEN_LABEL[color]}`)
    .join(', ');
  const points = `${card.points} ${card.points === 1 ? 'point' : 'points'}`;
  const reach = !shortfall
    ? ''
    : shortfall.short === 0
      ? '. You can afford this'
      : `. You are short of ${describeMissing(shortfall)}`;
  return `Tier ${TIER_LABEL[card.tier]} card, ${TOKEN_LABEL[card.bonus]} bonus, ${points}, costs ${cost}${reach}`;
}

function Frame({
  className,
  label,
  tint,
  selected = false,
  onSelect,
  disabled,
  children,
}: Selectable & { className: string; label: string; tint: string; children: ReactNode }) {
  const classes = `${className}${selected ? ' selected' : ''}`;
  const style = { '--splendor-tint': tint } as CSSProperties;
  if (!onSelect) {
    return (
      <div className={classes} style={style} role="img" aria-label={label}>
        {children}
      </div>
    );
  }
  return (
    <button
      type="button"
      className={classes}
      style={style}
      aria-label={label}
      aria-pressed={selected}
      disabled={disabled}
      onClick={onSelect}
    >
      {children}
    </button>
  );
}

export function DevCardView({
  card,
  shortfall,
  fresh = false,
  ...selectable
}: Selectable & {
  card: DevelopmentCard;
  /** How far the viewer is from affording the card, when they are seated. */
  shortfall?: CardShortfall;
  /** Just turned over: draws the eye once. */
  fresh?: boolean;
}) {
  const reach = !shortfall
    ? ''
    : shortfall.short === 0
      ? ' affordable'
      : shortfall.short <= 2
        ? ' near'
        : '';
  return (
    <Frame
      className={`splendor-card${reach}${fresh ? ' fresh' : ''}`}
      label={describe(card, shortfall)}
      tint={CARD_TINT[card.bonus]}
      {...selectable}
    >
      <span className="splendor-card-head" aria-hidden="true">
        <span className="splendor-card-points">{card.points > 0 ? card.points : ''}</span>
        <GemToken color={card.bonus} bonus small />
      </span>
      <span className="splendor-card-cost" aria-hidden="true">
        {GEM_COLORS.filter((color) => card.cost[color] > 0).map((color) => {
          const missing = shortfall?.missing[color];
          return (
            <span key={color} className="splendor-pip">
              <GemToken color={color} count={card.cost[color]} small />
              {missing !== undefined && (
                <span className={missing === 0 ? 'splendor-pip-mark met' : 'splendor-pip-mark'}>
                  {missing === 0 ? '✓' : `−${missing}`}
                </span>
              )}
            </span>
          );
        })}
      </span>
    </Frame>
  );
}

/** A purchased card at a glance: its colour, and its points if it has any. */
export function CardStrip({ card }: { card: DevelopmentCard }) {
  return (
    <span
      className="splendor-strip"
      style={{ '--splendor-tint': CARD_TINT[card.bonus] } as CSSProperties}
      title={describe(card)}
    >
      {card.points > 0 ? card.points : ''}
    </span>
  );
}

/** A face-down card: a deck, or a card someone reserved without showing it. */
export function CardBack({
  tier,
  count,
  ...selectable
}: Selectable & { tier: Tier; count?: number }) {
  const label =
    count === undefined
      ? `Hidden tier ${TIER_LABEL[tier]} card`
      : `Tier ${TIER_LABEL[tier]} deck, ${count} cards left`;
  return (
    <Frame
      className={`splendor-card back tier-${tier}`}
      label={label}
      tint="var(--muted)"
      {...selectable}
    >
      <span className="splendor-card-tier" aria-hidden="true">
        {TIER_LABEL[tier]}
      </span>
      {count !== undefined && (
        <span className="splendor-card-left" aria-hidden="true">
          {count}
        </span>
      )}
    </Frame>
  );
}
