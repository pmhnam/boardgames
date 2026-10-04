import type { CatanView, Costs } from '@bgp/game-catan';
import { ResourceList } from './ResourcePicker';

type Rules = Pick<
  CatanView,
  'costs' | 'victoryPointsToWin' | 'longestRoadMinimum' | 'largestArmyMinimum' | 'discardLimit'
>;

const ITEMS: Array<[keyof Costs, string, (view: Rules) => string]> = [
  [
    'road',
    'Road',
    (view) => `Longest Road, ${view.longestRoadMinimum} or more in a row, is worth 2 points.`,
  ],
  ['settlement', 'Settlement', () => '1 point. Collects 1 card from each hex around it.'],
  ['city', 'City', () => '2 points. Replaces a settlement and collects 2 cards.'],
  ['developmentCard', 'Development card', () => 'A knight, a Victory Point or a one-off effect.'],
];

/** What things cost and what they are worth, read from what the match plays by. */
export function CostsGuide({ view }: { view: Rules }) {
  return (
    <details className="card catan-guide">
      <summary>Building costs and points</summary>
      <ul>
        {ITEMS.map(([item, label, note]) => (
          <li key={item}>
            <strong>{label}</strong>
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
    </details>
  );
}
