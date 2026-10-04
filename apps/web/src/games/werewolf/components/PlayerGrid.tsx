import type { PlayerView, RoleId } from '@bgp/game-werewolf';
import type { ReactNode } from 'react';
import { ROLE_LABEL } from '../labels';

export interface PlayerTile {
  player: PlayerView;
  name: string;
  isYou: boolean;
  /** The role to print, already filtered for what may be on screen right now. */
  role: RoleId | null;
  /** Small notes under the name: done talking, has voted, your lover... */
  marks: ReactNode[];
  selectable: boolean;
  selected: boolean;
}

/** Everyone at the table. The ones the viewer may choose right now are buttons. */
export function PlayerGrid({
  tiles,
  onPick,
}: {
  tiles: PlayerTile[];
  onPick(playerId: string): void;
}) {
  return (
    <ul className="werewolf-grid">
      {tiles.map(({ player, name, isYou, role, marks, selectable, selected }) => {
        const body = (
          <>
            <span className="werewolf-name">
              {name}
              {isYou && <span className="muted"> (bạn)</span>}
            </span>
            <span className="muted hint">
              {player.alive ? (role ? ROLE_LABEL[role] : 'Còn sống') : 'Đã chết'}
              {!player.alive && role && ` · ${ROLE_LABEL[role]}`}
            </span>
            {marks.length > 0 && <span className="hint werewolf-marks">{marks}</span>}
          </>
        );
        const className = [
          'werewolf-tile',
          player.alive ? '' : 'dead',
          isYou ? 'mine' : '',
          selected ? 'selected' : '',
        ]
          .filter(Boolean)
          .join(' ');
        return (
          <li key={player.playerId}>
            {selectable ? (
              <button
                type="button"
                className={className}
                aria-pressed={selected}
                onClick={() => onPick(player.playerId)}
              >
                {body}
              </button>
            ) : (
              <div className={className}>{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
