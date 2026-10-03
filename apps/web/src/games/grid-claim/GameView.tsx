import { BLOCKED, type GridClaimAction, type GridClaimView } from '@bgp/game-demo';
import { PlayerList } from '../../shared/components/PlayerList';
import { playerName, type GameViewProps } from '../types';

const PIECES = ['●', '▲'];

export function GridClaimGameView({
  message,
  players,
  sendAction,
  disabled,
}: GameViewProps<GridClaimView, GridClaimAction>) {
  const view = message.state;
  const legal = new Set(view.legalPositions.map((position) => `${position.row},${position.col}`));

  return (
    <div className="stack">
      <PlayerList
        players={view.playerIds.map((playerId, index) => ({
          id: playerId,
          name: `${PIECES[index] ?? '?'} ${playerName(players, playerId)}`,
          isYou: playerId === message.viewerPlayerId,
          isActive: view.phase === 'PLAYING' && view.turn.activePlayerId === playerId,
          detail: `${view.scores[playerId] ?? 0} / ${view.targetScore}`,
        }))}
      />
      <div
        className="grid-claim-board"
        style={{ gridTemplateColumns: `repeat(${view.size}, 3rem)` }}
      >
        {view.cells.map((cell, index) => {
          const row = Math.floor(index / view.size);
          const col = index % view.size;
          const isLegal = legal.has(`${row},${col}`);
          return (
            <button
              key={index}
              type="button"
              className={cell === BLOCKED ? 'cell blocked' : isLegal ? 'cell legal' : 'cell'}
              disabled={disabled || !isLegal}
              aria-label={`Row ${row + 1}, column ${col + 1}`}
              onClick={() => sendAction({ type: 'PLACE_PIECE', position: { row, col } })}
            >
              {cell !== null && cell !== BLOCKED ? PIECES[view.playerIds.indexOf(cell)] : ''}
            </button>
          );
        })}
      </div>
      <p className="muted">
        One point per piece, plus one per pair of your pieces side by side. You cannot place next to
        your opponent&apos;s last piece. First to {view.targetScore} wins.
      </p>
    </div>
  );
}
