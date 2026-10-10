import type { CatanView, Costs } from '@bgp/game-catan';
import type { IconName } from '../art/icons';
import { Icon } from './Icon';
import { ResourceList } from './ResourcePicker';

type Rules = Pick<
  CatanView,
  'costs' | 'victoryPointsToWin' | 'longestRouteMinimum' | 'largestArmyMinimum' | 'discardLimit'
>;

const ITEMS: Array<[keyof Costs, IconName, string, (view: Rules) => string]> = [
  [
    'road',
    'road',
    'Road',
    (view) => `Longest Route, ${view.longestRouteMinimum} or more in a row, is worth 2 points.`,
  ],
  [
    'settlement',
    'settlement',
    'Settlement',
    () => '1 point. Collects 1 card from each hex around it.',
  ],
  ['city', 'city', 'City', () => '2 points. Replaces a settlement and collects 2 cards.'],
  [
    'developmentCard',
    'card',
    'Development card',
    () => 'A knight, a Victory Point or a one-off effect.',
  ],
];

/** What things cost and what they are worth, read from what the match plays by. */
export function CostsGuide({ view }: { view: Rules }) {
  return (
    <details className="card catan-guide">
      <summary>Building costs and points</summary>
      <ul>
        {ITEMS.map(([item, icon, label, note]) => (
          <li key={item}>
            <strong>
              <Icon name={icon} />
              {label}
            </strong>
            <ResourceList counts={view.costs[item]} />
            <span className="muted">{note(view)}</span>
          </li>
        ))}
      </ul>
      <p className="muted hint">
        The first player to reach {view.victoryPointsToWin} points on their own turn wins. Largest
        Army, {view.largestArmyMinimum} or more knights played, is worth 2 points. On a 7 nothing is
        produced, every hand of more than {view.discardLimit} cards loses half, and the robber
        moves.
      </p>
      <p className="muted hint catan-legend">
        <span>
          <Icon name="hand" /> cards in hand
        </span>
        <span>
          <Icon name="card" /> development cards
        </span>
        <span>
          <Icon name="army" /> knights played
        </span>
        <span>
          <Icon name="route" /> longest route
        </span>
      </p>
      {/* The icons' licence (CC BY 3.0) asks for this credit: see art/CREDITS.md. */}
      <p className="muted hint catan-credits">
        Icons by Lorc, Delapouite, Faithtoken and Skoll from{' '}
        <a href="https://game-icons.net" target="_blank" rel="noreferrer">
          game-icons.net
        </a>
        , under{' '}
        <a href="https://creativecommons.org/licenses/by/3.0/" target="_blank" rel="noreferrer">
          CC BY 3.0
        </a>
        .
      </p>
    </details>
  );
}
