import type { PlayerView, RoleId } from '@bgp/game-werewolf';
import { memo } from 'react';
import { ROLE_LABEL } from '../labels';

export interface PlayerTile {
  player: PlayerView;
  name: string;
  isYou: boolean;
  /** The role to print, already filtered for what may be on screen right now. */
  role: RoleId | null;
  /** Small notes under the name: done talking, has voted, your lover... */
  marks: string[];
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
      {tiles.map((tile) => (
        <Tile key={tile.player.playerId} {...tile} onPick={onPick} />
      ))}
    </ul>
  );
}

type TileProps = PlayerTile & { onPick(playerId: string): void };

/** The notes are a list made afresh each time; it is what they say that counts. */
function sameTile(before: TileProps, after: TileProps): boolean {
  return (
    before.player === after.player &&
    before.name === after.name &&
    before.isYou === after.isYou &&
    before.role === after.role &&
    before.selectable === after.selectable &&
    before.selected === after.selected &&
    before.onPick === after.onPick &&
    before.marks.length === after.marks.length &&
    before.marks.every((mark, index) => mark === after.marks[index])
  );
}

/**
 * One seat. Votes come in from the whole table at once, each a new state: only the seat whose
 * note changed is drawn again.
 */
const Tile = memo(function Tile({
  player,
  name,
  isYou,
  role,
  marks,
  selectable,
  selected,
  onPick,
}: TileProps) {
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
      {marks.length > 0 && (
        <span className="hint werewolf-marks">
          {marks.map((mark) => (
            <span key={mark}>{mark}</span>
          ))}
        </span>
      )}
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
    <li>
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
}, sameTile);
