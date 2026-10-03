import { GEM_COLORS, type DevelopmentCard, type Tier } from '@bgp/game-splendor';
import type { CSSProperties, ReactNode } from 'react';
import { TIER_LABEL, TOKEN_FILL, TOKEN_LABEL } from '../layout';
import { GemToken } from './GemToken';

interface Selectable {
  selected?: boolean;
  /** When given, the card is a button; otherwise it is only shown. */
  onSelect?: () => void;
  disabled?: boolean;
  /** Extra words for assistive tech, e.g. "you can afford this". */
  note?: string;
}

function describe(card: DevelopmentCard): string {
  const cost = GEM_COLORS.filter((color) => card.cost[color] > 0)
    .map((color) => `${card.cost[color]} ${TOKEN_LABEL[color]}`)
    .join(', ');
  return `Tier ${TIER_LABEL[card.tier]} card, ${TOKEN_LABEL[card.bonus]} bonus, ${card.points} ${card.points === 1 ? 'point' : 'points'}, costs ${cost}`;
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
  affordable = false,
  note,
  ...selectable
}: Selectable & { card: DevelopmentCard; affordable?: boolean }) {
  return (
    <Frame
      className={affordable ? 'splendor-card affordable' : 'splendor-card'}
      label={[describe(card), note].filter(Boolean).join('. ')}
      tint={TOKEN_FILL[card.bonus]}
      {...selectable}
    >
      <span className="splendor-card-head" aria-hidden="true">
        <span className="splendor-card-points">{card.points > 0 ? card.points : ''}</span>
        <GemToken color={card.bonus} bonus small />
      </span>
      <span className="splendor-card-cost" aria-hidden="true">
        {GEM_COLORS.filter((color) => card.cost[color] > 0).map((color) => (
          <GemToken key={color} color={color} count={card.cost[color]} small />
        ))}
      </span>
    </Frame>
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
    <Frame className="splendor-card back" label={label} tint="var(--muted)" {...selectable}>
      <span className="splendor-card-tier" aria-hidden="true">
        {TIER_LABEL[tier]}
      </span>
      {count !== undefined && (
        <span className="muted" aria-hidden="true">
          {count} left
        </span>
      )}
    </Frame>
  );
}
