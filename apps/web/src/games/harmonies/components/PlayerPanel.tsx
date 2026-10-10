import type { Hex, PlayerBoardView } from '@bgp/game-harmonies';
import { useHarmoniesText } from '../useHarmoniesText';
import { AnimalCardView } from './AnimalCardView';
import { CompletedCards } from './CompletedCards';
import { HexBoard } from './HexBoard';
import { Icon } from './Icon';

/** Another player's board and cards: there to be read, never to be acted on. */
export function PlayerPanel({
  name,
  cells,
  board,
  turnNumber,
  points,
  active,
  winner,
}: {
  name: string;
  cells: Hex[];
  board: PlayerBoardView;
  turnNumber: number;
  points: number;
  active: boolean;
  winner: boolean;
}) {
  const text = useHarmoniesText();
  const inProgress = board.cards.filter((entry) => !entry.complete);
  return (
    <section className={active ? 'card harmonies-player active' : 'card harmonies-player'}>
      <h2 className="harmonies-player-name">
        <span>
          {name}
          {winner && <Icon name="trophy" className="harmonies-trophy" />}
        </span>
        <span className="harmonies-score">
          {points} <span className="muted">{text.points}</span>
        </span>
      </h2>
      <HexBoard cells={cells} board={board} turnNumber={turnNumber} label={text.boardOf(name)} />
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
