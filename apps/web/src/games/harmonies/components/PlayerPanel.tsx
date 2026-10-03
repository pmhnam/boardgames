import type { Hex, PlayerBoardView } from '@bgp/game-harmonies';
import { AnimalCardView } from './AnimalCardView';
import { CompletedCards } from './CompletedCards';
import { HexBoard } from './HexBoard';

/** Another player's board and cards: there to be read, never to be acted on. */
export function PlayerPanel({
  name,
  cells,
  board,
  points,
  active,
  winner,
}: {
  name: string;
  cells: Hex[];
  board: PlayerBoardView;
  points: number;
  active: boolean;
  winner: boolean;
}) {
  const inProgress = board.cards.filter((entry) => !entry.complete);
  return (
    <section className={active ? 'card harmonies-player active' : 'card harmonies-player'}>
      <h2 className="harmonies-player-name">
        <span>
          {name}
          {winner && ' 🏆'}
        </span>
        <span className="harmonies-score">
          {points} <span className="muted">pts</span>
        </span>
      </h2>
      <HexBoard cells={cells} board={board} label={`${name}'s board`} />
      {inProgress.length > 0 && (
        <div className="harmonies-cards">
          {inProgress.map(({ card, cubesPlaced }) => (
            <AnimalCardView key={card.id} card={card} cubesPlaced={cubesPlaced} compact />
          ))}
        </div>
      )}
      <CompletedCards cards={board.cards.filter((entry) => entry.complete)} />
    </section>
  );
}
