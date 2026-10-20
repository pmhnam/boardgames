import type { PlayerView } from '@bgp/game-splendor';
import { useEffect, useId, useRef } from 'react';

export interface Winner {
  playerId: string;
  name: string;
  player: PlayerView;
}

/** Shown once the game is over: every player who shares the win, side by side. */
export function WinnerDialog({
  winners,
  viewerId,
  onClose,
}: {
  winners: Winner[];
  viewerId: string | null;
  onClose(): void;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    // StrictMode runs this twice, and showModal() throws on a dialog that is already open.
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const close = () => dialogRef.current?.close();
  const won = winners.some((winner) => winner.playerId === viewerId);

  return (
    <dialog
      ref={dialogRef}
      className="confirm-dialog splendor-winners"
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div className="confirm-dialog-body">
        <h2 id={titleId}>
          {won ? '🎉 Bạn thắng!' : winners.length > 1 ? '🏆 Đồng chiến thắng' : '🏆 Người thắng'}
        </h2>
        <ul className="splendor-winner-list">
          {winners.map(({ playerId, name, player }) => (
            <li key={playerId}>
              <strong>
                {name}
                {playerId === viewerId && ' (bạn)'}
              </strong>
              <span className="muted">
                {player.points} điểm · {player.purchased.length} thẻ
              </span>
            </li>
          ))}
        </ul>
        <div className="confirm-dialog-actions">
          <button type="button" autoFocus onClick={close}>
            Đóng
          </button>
        </div>
      </div>
    </dialog>
  );
}
