import {
  GEM_COLORS,
  TOKEN_COLORS,
  TOKEN_LIMIT,
  countTokens,
  type CardShortfall,
  type PlayerView,
} from '@bgp/game-splendor';
import type { ReactNode } from 'react';
import { CardSlot } from './CardActions';
import { CardBack, CardStrip, DevCardView } from './DevCard';
import { GemToken } from './GemToken';
import { NobleTile } from './NobleTile';

export function PlayerPanel({
  name,
  player,
  targetScore,
  mine,
  active,
  winner,
  lastMove,
  shortfalls,
  selectedCardId,
  onSelectCard,
  cardActions,
}: {
  name: string;
  player: PlayerView;
  targetScore: number;
  mine: boolean;
  active: boolean;
  winner: boolean;
  /** What this player just did, if theirs was the latest move. */
  lastMove?: string;
  /** The viewer's distance from each of their own reserved cards. Only set on their panel. */
  shortfalls: Record<string, CardShortfall>;
  selectedCardId: string | null;
  onSelectCard?: (cardId: string) => void;
  /** The buttons for the selected reserved card. */
  cardActions?: ReactNode;
}) {
  const classes = ['card', 'splendor-player', mine && 'mine', active && 'active']
    .filter(Boolean)
    .join(' ');
  return (
    <section className={classes}>
      <h2 className="splendor-player-name">
        <span>
          {name}
          {mine && <span className="muted"> (you)</span>}
          {winner && ' 🏆'}
        </span>
        <span className="splendor-score">
          {player.points}
          <span className="muted"> / {targetScore}</span>
        </span>
      </h2>
      <progress
        className="splendor-progress"
        max={targetScore}
        value={Math.min(player.points, targetScore)}
        aria-label={`${name}: ${player.points} of ${targetScore} points`}
      />
      {lastMove && <p className="splendor-last muted">Just {lastMove}.</p>}

      <div className="splendor-columns" aria-label="Purchased cards by colour">
        {GEM_COLORS.map((color) => (
          <div key={color} className="splendor-column">
            <GemToken color={color} count={player.bonuses[color]} bonus />
            <span className="splendor-stack">
              {player.purchased
                .filter((card) => card.bonus === color)
                .map((card) => (
                  <CardStrip key={card.id} card={card} />
                ))}
            </span>
          </div>
        ))}
      </div>

      <div className="splendor-tokens">
        {TOKEN_COLORS.map((color) => (
          <GemToken key={color} color={color} count={player.tokens[color]} />
        ))}
        <span className="muted">
          {countTokens(player.tokens)}/{TOKEN_LIMIT}
          <span className="sr-only"> tokens</span>
        </span>
      </div>

      {player.nobles.length > 0 && (
        <div className="row wrap">
          {player.nobles.map((noble) => (
            <NobleTile key={noble.id} noble={noble} />
          ))}
        </div>
      )}

      {player.reserved.length > 0 && (
        <div className="stack-small">
          <span className="muted">Reserved</span>
          <div className="splendor-reserved">
            {player.reserved.map((entry, index) =>
              entry.hidden ? (
                <CardBack key={index} tier={entry.tier} />
              ) : (
                <CardSlot
                  key={entry.card.id}
                  open={mine && selectedCardId === entry.card.id}
                  card={
                    <DevCardView
                      card={entry.card}
                      shortfall={shortfalls[entry.card.id]}
                      selected={selectedCardId === entry.card.id}
                      onSelect={
                        mine && onSelectCard ? () => onSelectCard(entry.card.id) : undefined
                      }
                    />
                  }
                >
                  {cardActions}
                </CardSlot>
              ),
            )}
          </div>
        </div>
      )}

      {player.purchased.length > 0 && (
        <details className="splendor-purchased">
          <summary>{player.purchased.length} cards bought</summary>
          <div className="splendor-reserved">
            {player.purchased.map((card) => (
              <DevCardView key={card.id} card={card} />
            ))}
          </div>
        </details>
      )}
    </section>
  );
}
