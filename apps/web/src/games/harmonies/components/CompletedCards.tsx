import type { PlayerCardView } from '@bgp/game-harmonies';
import { AnimalCardView } from './AnimalCardView';

/**
 * Cards with every animal placed. They still score, but there is nothing left to do with
 * them, so they fold away under the cards still in play.
 */
export function CompletedCards({ cards }: { cards: PlayerCardView[] }) {
  if (cards.length === 0) return null;
  return (
    <details className="harmonies-completed">
      <summary>
        {cards.length} completed {cards.length === 1 ? 'card' : 'cards'}
      </summary>
      <div className="harmonies-cards">
        {cards.map(({ card, cubesPlaced }) => (
          <AnimalCardView key={card.id} card={card} cubesPlaced={cubesPlaced} compact />
        ))}
      </div>
    </details>
  );
}
