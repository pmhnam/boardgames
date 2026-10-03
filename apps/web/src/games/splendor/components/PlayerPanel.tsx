import {
  GEM_COLORS,
  TOKEN_COLORS,
  TOKEN_LIMIT,
  countTokens,
  type PlayerView,
} from '@bgp/game-splendor';
import { CardBack, DevCardView } from './DevCard';
import { GemToken } from './GemToken';
import { NobleTile } from './NobleTile';

export function PlayerPanel({
  name,
  player,
  mine,
  active,
  winner,
  buyable,
  selectedCardId,
  onSelectCard,
}: {
  name: string;
  player: PlayerView;
  mine: boolean;
  active: boolean;
  winner: boolean;
  /** Reserved cards the viewer can pay for right now. Only ever set on their own panel. */
  buyable: string[];
  selectedCardId: string | null;
  onSelectCard?: (cardId: string) => void;
}) {
  const classes = ['card', 'splendor-player', mine && 'mine', active && 'active']
    .filter(Boolean)
    .join(' ');
  return (
    <section className={classes}>
      <h2>
        {name}
        {mine && <span className="muted"> (you)</span>}
        {winner && ' 🏆'}
        <span className="muted">
          {' '}
          · {player.points} pts · {player.purchased.length} cards
        </span>
      </h2>

      <dl className="splendor-holdings">
        <dt>Bonuses</dt>
        <dd>
          {GEM_COLORS.map((color) => (
            <GemToken key={color} color={color} count={player.bonuses[color]} bonus />
          ))}
        </dd>
        <dt>
          Tokens{' '}
          <span className="muted">
            {countTokens(player.tokens)}/{TOKEN_LIMIT}
          </span>
        </dt>
        <dd>
          {TOKEN_COLORS.map((color) => (
            <GemToken key={color} color={color} count={player.tokens[color]} />
          ))}
        </dd>
      </dl>

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
          <div className="row wrap">
            {player.reserved.map((entry, index) =>
              entry.hidden ? (
                <CardBack key={index} tier={entry.tier} />
              ) : (
                <DevCardView
                  key={entry.card.id}
                  card={entry.card}
                  affordable={buyable.includes(entry.card.id)}
                  note={buyable.includes(entry.card.id) ? 'You can afford this' : undefined}
                  selected={selectedCardId === entry.card.id}
                  onSelect={mine && onSelectCard ? () => onSelectCard(entry.card.id) : undefined}
                />
              ),
            )}
          </div>
        </div>
      )}
    </section>
  );
}
