import type { ReactNode } from 'react';

export interface PlayerListItem {
  id: string;
  name: string;
  isYou?: boolean;
  isActive?: boolean;
  detail?: ReactNode;
}

export function PlayerList({ players }: { players: PlayerListItem[] }) {
  return (
    <ul className="player-list">
      {players.map((player) => (
        <li key={player.id} className={player.isActive ? 'active' : undefined}>
          <span>
            {player.name}
            {player.isYou && <span className="muted"> (you)</span>}
          </span>
          <span>{player.detail}</span>
        </li>
      ))}
    </ul>
  );
}
