import type { PlayerView, TradeResponse } from '@bgp/game-catan';

export function PlayerPanel({
  name,
  player,
  color,
  target,
  mine,
  active,
  winner,
  longestRoad,
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
  longestRoad: boolean;
  largestArmy: boolean;
  /** Cards this player still has to discard to a 7. */
  owes: number;
  /** Their answer to the open trade offer, if they gave one. */
  response?: TradeResponse;
}) {
  const classes = ['card', 'catan-player', mine && 'mine', active && 'active']
    .filter(Boolean)
    .join(' ');
  // Victory Point cards are hidden, so anyone else's score is only what the table shows.
  const points = player.points ?? player.publicPoints;
  const { piecesLeft } = player;

  return (
    <section className={classes}>
      <h2 className="catan-player-name">
        <span>
          <span className="catan-swatch" style={{ background: color }} aria-hidden="true" />
          {name}
          {mine && <span className="muted"> (you)</span>}
          {winner && ' 🏆'}
        </span>
        <span className="catan-score" title={player.points === null ? 'Points on the table' : ''}>
          {points}
          <span className="muted"> / {target}</span>
        </span>
      </h2>
      <progress
        className="catan-progress"
        max={target}
        value={Math.min(points, target)}
        aria-label={`${name}: ${points} of ${target} points`}
      />
      <dl className="catan-stats">
        <div>
          <dt>Cards</dt>
          <dd>{player.resourceCount}</dd>
        </div>
        <div>
          <dt>Dev. cards</dt>
          <dd>{player.developmentCardCount}</dd>
        </div>
        <div>
          <dt>Knights</dt>
          <dd>{player.knightsPlayed}</dd>
        </div>
        <div>
          <dt>Road</dt>
          <dd>{player.roadLength}</dd>
        </div>
      </dl>
      <p className="catan-badges">
        {longestRoad && <span className="catan-badge">Longest Road +2</span>}
        {largestArmy && <span className="catan-badge">Largest Army +2</span>}
        {owes > 0 && <span className="catan-badge warn">Discarding {owes}</span>}
        {response && (
          <span className={response === 'accepted' ? 'catan-badge' : 'catan-badge quiet'}>
            {response === 'accepted' ? 'Accepts the trade' : 'Declines the trade'}
          </span>
        )}
      </p>
      <p className="catan-pieces muted">
        Left to build: {piecesLeft.roads} roads · {piecesLeft.settlements} settlements ·{' '}
        {piecesLeft.cities} cities
      </p>
    </section>
  );
}
