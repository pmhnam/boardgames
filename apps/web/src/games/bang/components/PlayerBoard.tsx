import type { PlayerView } from '@bgp/game-bang';
import type { ReactNode } from 'react';
import { CHARACTER_HINT, CHARACTER_LABEL, ROLE_LABEL } from '../labels';
import { CardFace } from './CardFace';

export interface PlayerTile {
  player: PlayerView;
  name: string;
  isYou: boolean;
  /** Small notes under the name: whose turn it is, who is being asked, who won. */
  marks: ReactNode[];
  selectable: boolean;
  selected: boolean;
}

function Life({ player }: { player: PlayerView }) {
  const lost = Math.max(0, player.maxLife - player.life);
  return (
    <span className="bang-life" aria-label={`Máu ${player.life}/${player.maxLife}`}>
      <span aria-hidden="true">
        {'♥'.repeat(Math.max(0, player.life))}
        <span className="lost">{'♥'.repeat(lost)}</span>
      </span>
    </span>
  );
}

/**
 * Everyone at the table, in seat order: the seats next to each other in the list are the ones
 * next to each other at the table, and the last sits beside the first. The players the viewer
 * may choose right now are buttons.
 */
export function PlayerBoard({
  tiles,
  onPick,
}: {
  tiles: PlayerTile[];
  onPick(playerId: string): void;
}) {
  return (
    <ul className="bang-seats">
      {tiles.map(({ player, name, isYou, marks, selectable, selected }) => {
        const head = (
          <>
            <span className="bang-name">
              {name}
              {isYou && <span className="muted"> (bạn)</span>}
            </span>
            <span className="hint">
              <span title={CHARACTER_HINT[player.character]}>
                {CHARACTER_LABEL[player.character]}
              </span>
              <span className={player.role === 'sheriff' ? 'bang-star' : 'muted'}>
                {' · '}
                {player.role ? ROLE_LABEL[player.role] : 'Vai ẩn'}
              </span>
            </span>
            {player.alive ? (
              <span className="hint bang-stats">
                <Life player={player} />
                <span>Tay: {player.handCount}</span>
                <span>Tầm bắn: {player.range}</span>
                {player.distance !== null && <span>Cách bạn: {player.distance}</span>}
              </span>
            ) : (
              <span className="hint muted">Đã bị loại</span>
            )}
            {marks.length > 0 && <span className="hint bang-marks">{marks}</span>}
          </>
        );
        const className = [
          'bang-seat',
          player.alive ? '' : 'dead',
          isYou ? 'mine' : '',
          selected ? 'selected' : '',
        ]
          .filter(Boolean)
          .join(' ');
        return (
          <li key={player.playerId} className={className}>
            {selectable ? (
              <button
                type="button"
                className="bang-seat-head"
                aria-pressed={selected}
                onClick={() => onPick(player.playerId)}
              >
                {head}
              </button>
            ) : (
              <div className="bang-seat-head">{head}</div>
            )}
            {player.inPlay.length > 0 && (
              <div className="bang-in-play" aria-label="Bài trên bàn">
                {player.inPlay.map((card) => (
                  <CardFace key={card.id} card={card} small />
                ))}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
