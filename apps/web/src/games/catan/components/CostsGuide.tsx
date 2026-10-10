import type { CatanView, Costs } from '@bgp/game-catan';
import type { IconName } from '../art/icons';
import { useCatanText } from '../useCatanText';
import { Icon } from './Icon';
import { ResourceList } from './ResourcePicker';

type Rules = Pick<
  CatanView,
  'costs' | 'victoryPointsToWin' | 'longestRouteMinimum' | 'largestArmyMinimum' | 'discardLimit'
>;

const ICONS: Array<[keyof Costs, IconName]> = [
  ['road', 'road'],
  ['settlement', 'settlement'],
  ['city', 'city'],
  ['developmentCard', 'card'],
];

/** What things cost and what they are worth, read from what the match plays by. */
export function CostsGuide({ view }: { view: Rules }) {
  const text = useCatanText();
  const { guide } = text;
  const items: Record<keyof Costs, [label: string, note: string]> = {
    road: [text.road, guide.road(view.longestRouteMinimum)],
    settlement: [text.settlement, guide.settlement],
    city: [text.city, guide.city],
    developmentCard: [guide.developmentCard, guide.card],
  };

  return (
    <details className="card catan-guide">
      <summary>{guide.title}</summary>
      <ul>
        {ICONS.map(([item, icon]) => (
          <li key={item}>
            <strong>
              <Icon name={icon} />
              {items[item][0]}
            </strong>
            <ResourceList counts={view.costs[item]} />
            <span className="muted">{items[item][1]}</span>
          </li>
        ))}
      </ul>
      <p className="muted hint">
        {guide.rules(view.victoryPointsToWin, view.largestArmyMinimum, view.discardLimit)}
      </p>
      <p className="muted hint catan-legend">
        <span>
          <Icon name="hand" /> {guide.legend.hand}
        </span>
        <span>
          <Icon name="card" /> {guide.legend.developmentCards}
        </span>
        <span>
          <Icon name="army" /> {guide.legend.knights}
        </span>
        <span>
          <Icon name="route" /> {guide.legend.route}
        </span>
      </p>
      {/* The icons' licence (CC BY 3.0) asks for this credit: see art/CREDITS.md. */}
      <p className="muted hint catan-credits">
        {guide.iconsBy}{' '}
        <a href="https://game-icons.net" target="_blank" rel="noreferrer">
          game-icons.net
        </a>
        , {guide.under}{' '}
        <a href="https://creativecommons.org/licenses/by/3.0/" target="_blank" rel="noreferrer">
          CC BY 3.0
        </a>
        .
      </p>
    </details>
  );
}
