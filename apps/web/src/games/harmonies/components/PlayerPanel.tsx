import type { Hex, PlayerBoardView } from '@bgp/game-harmonies';
import { AnimalCardView } from './AnimalCardView';
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
      {board.cards.length > 0 && (
        <div className="harmonies-cards">
          {board.cards.map(({ card, cubesPlaced, complete }) => (
            <AnimalCardView
              key={card.id}
              card={card}
              cubesPlaced={cubesPlaced}
              compact
              action={complete ? <span className="muted">Complete</span> : undefined}
            />
          ))}
        </div>
      )}
    </section>
  );
}
