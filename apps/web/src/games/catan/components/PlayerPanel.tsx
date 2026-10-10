import type { PlayerView, TradeResponse } from '@bgp/game-catan';
import type { CSSProperties } from 'react';
import type { IconName } from '../art/icons';
import { useHints, type Hint, type HintRules } from '../hints';
import { useCatanText } from '../useCatanText';
import { Icon } from './Icon';
import { HintText, Tip, useTips } from './Tip';

function Stat({
  icon,
  label,
  value,
  bonus,
  hint,
}: {
  icon: IconName | 'hand';
  label: string;
  value: number;
  /** The award this count holds right now, e.g. Longest Route. */
  bonus?: string | false;
  /** What the count is for. The icon alone does not say. */
  hint: Hint;
}) {
  const text = useCatanText();
  const tips = useTips();
  const title = bonus ? text.holds(label, bonus) : label;
  return (
    <div className={bonus ? 'held' : undefined} {...tips.anchor('stat')}>
      {tips.bubble('stat', <HintText hint={{ ...hint, title }} />)}
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
  rules,
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
  /** What the match plays by: the points needed to win, and what the hints quote. */
  rules: HintRules;
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
  const hints = useHints();
  const tips = useTips();
  const target = rules.victoryPointsToWin;
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
        <Tip hint={<HintText hint={hints.score(rules, player.points === null)} />}>
          <span className="catan-score">
            <Icon name="star" />
            {points}
            <span className="catan-score-target"> / {target}</span>
            <span className="sr-only"> {text.points}</span>
          </span>
        </Tip>
      </h2>
      <div className="catan-player-row">
        <dl className="catan-stats">
          <Stat
            icon="hand"
            label={text.stat.hand}
            value={player.resourceCount}
            hint={hints.stat.hand(rules)}
          />
          <Stat
            icon="card"
            label={text.stat.developmentCards}
            value={player.developmentCardCount}
            hint={hints.stat.developmentCards(rules)}
          />
          <Stat
            icon="army"
            label={text.stat.knights}
            value={player.knightsPlayed}
            bonus={largestArmy && text.largestArmy}
            hint={hints.stat.knights(rules)}
          />
          <Stat
            icon="route"
            label={text.stat.route}
            value={player.routeLength}
            bonus={longestRoute && text.longestRoute}
            hint={hints.stat.route(rules)}
          />
        </dl>
        <p className="catan-pieces" aria-label={leftToBuild} {...tips.anchor('pieces')}>
          {tips.bubble('pieces', <HintText hint={{ ...hints.pieces, title: leftToBuild }} />)}
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
