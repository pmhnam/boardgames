import type { ReactNode } from 'react';
import { useT } from '../i18n/useT';

export interface PlayerListItem {
  id: string;
  name: string;
  isYou?: boolean;
  isActive?: boolean;
  detail?: ReactNode;
}

export function PlayerList({ players }: { players: PlayerListItem[] }) {
  const t = useT();
  return (
    <ul className="player-list">
      {players.map((player) => (
        <li key={player.id} className={player.isActive ? 'active' : undefined}>
          <span>
            {player.name}
            {player.isYou && <span className="muted"> ({t('common.you')})</span>}
          </span>
          <span>{player.detail}</span>
        </li>
      ))}
    </ul>
  );
}
