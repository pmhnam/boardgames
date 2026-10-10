import type { PlayerView, TradeResponse } from '@bgp/game-catan';
import type { CSSProperties } from 'react';
import type { IconName } from '../art/icons';
import { useCatanText } from '../useCatanText';
import { Icon } from './Icon';

function Stat({
  icon,
  label,
  value,
  bonus,
}: {
  icon: IconName | 'hand';
  label: string;
  value: number;
  /** The award this count holds right now, e.g. Longest Route. */
  bonus?: string | false;
}) {
  const text = useCatanText();
  return (
    <div className={bonus ? 'held' : undefined} title={bonus ? text.holds(label, bonus) : label}>
      <dt>
        <Icon name={icon} />
        <span className="sr-only">{label}</span>
      </dt>
      <dd>
        {value}
        {bonus && (
          <span className="catan-bonus">
            +2<span className="sr-only"> {text.pointsFor(bonus)}</span>
          </span>
        )}
      </dd>
    </div>
  );
}

export function PlayerPanel({
  name,
  player,
  color,
  target,
  mine,
  active,
  winner,
  longestRoute,
  largestArmy,
  owes,
  response,
}: {
  name: string;
  player: PlayerView;
  color: string;
  /** Points needed to win. */
  target: number;
  mine: boolean;
  active: boolean;
  winner: boolean;
  longestRoute: boolean;
  largestArmy: boolean;
  /** Cards this player still has to discard to a 7. */
  owes: number;
  /** Their answer to the open trade offer, if they gave one. */
  response?: TradeResponse;
}) {
  const text = useCatanText();
  const classes = ['catan-player', mine && 'mine', active && 'active', winner && 'winner']
    .filter(Boolean)
    .join(' ');
  // Victory Point cards are hidden, so anyone else's score is only what the table shows.
  const points = player.points ?? player.publicPoints;
  const { piecesLeft } = player;
  const leftToBuild = text.leftToBuild(piecesLeft.roads, piecesLeft.settlements, piecesLeft.cities);

  return (
    <section className={classes} style={{ '--seat': color } as CSSProperties}>
      <h2 className="catan-player-name">
        <span className="catan-seat" aria-hidden="true" />
        <span className="catan-player-label">
          {name}
          {mine && <span className="muted"> {text.you}</span>}
        </span>
        {winner && <Icon name="trophy" className="catan-winner-mark" />}
        {active && <span className="catan-turn-mark">{text.turnMark}</span>}
        <span
          className="catan-score"
          title={player.points === null ? text.pointsOnTable : text.yourPoints}
        >
          <Icon name="star" />
          {points}
          <span className="catan-score-target"> / {target}</span>
          <span className="sr-only"> {text.points}</span>
        </span>
      </h2>
      <div className="catan-player-row">
        <dl className="catan-stats">
          <Stat icon="hand" label={text.stat.hand} value={player.resourceCount} />
          <Stat
            icon="card"
            label={text.stat.developmentCards}
            value={player.developmentCardCount}
          />
          <Stat
            icon="army"
            label={text.stat.knights}
            value={player.knightsPlayed}
            bonus={largestArmy && text.largestArmy}
          />
          <Stat
            icon="route"
            label={text.stat.route}
            value={player.routeLength}
            bonus={longestRoute && text.longestRoute}
          />
        </dl>
        <p className="catan-pieces" aria-label={leftToBuild} title={leftToBuild}>
          <span>
            <Icon name="road" />
            {piecesLeft.roads}
          </span>
          <span>
            <Icon name="settlement" />
            {piecesLeft.settlements}
          </span>
          <span>
            <Icon name="city" />
            {piecesLeft.cities}
          </span>
        </p>
      </div>
      {/* News about this player, pinned to the panel's corner so that nothing moves for it. */}
      {(owes > 0 || response) && (
        <p className="catan-flags">
          {owes > 0 && <span className="catan-badge warn">{text.discarding(owes)}</span>}
          {response && (
            <span className={response === 'accepted' ? 'catan-badge' : 'catan-badge quiet'}>
              {response === 'accepted' ? text.accepts : text.declines}
            </span>
          )}
        </p>
      )}
    </section>
  );
}
