import type { GameDefinitionDto } from '@bgp/shared-types';
import { getGameUi } from '../../games/registry';
import { useLocale, useT } from '../../shared/i18n/useT';
import { gameHueStyle, gameInitial } from './GameIcon';

/** One game on offer: what it is, who it is for, and the way into a room of it. */
export function GameCard({
  game,
  joinableRooms,
  onCreate,
}: {
  game: GameDefinitionDto;
  /** Rooms of this game with a free seat right now. */
  joinableRooms: number;
  onCreate(): void;
}) {
  const t = useT();
  const locale = useLocale();
  const card = getGameUi(game.gameType)?.card;

  return (
    <li className={card ? 'game-card tinted' : 'game-card'} style={gameHueStyle(card?.hue)}>
      <div className="game-card-art" aria-hidden="true">
        {card?.icon ?? gameInitial(game.displayName)}
      </div>
      <div className="game-card-body">
        <h3>{game.displayName}</h3>
        {card && <p className="game-card-tagline">{card.tagline[locale]}</p>}
        <ul className="game-card-facts">
          <li className="chip">
            {game.minPlayers === game.maxPlayers
              ? t('players.exact', { count: game.minPlayers })
              : t('players.range', { min: game.minPlayers, max: game.maxPlayers })}
          </li>
          {game.supportsBots && <li className="chip">{t('card.bots')}</li>}
          {joinableRooms > 0 && (
            <li className="badge success">{t('card.joinable', { count: joinableRooms })}</li>
          )}
        </ul>
        <button
          type="button"
          aria-label={`${t('create.submit')}: ${game.displayName}`}
          onClick={onCreate}
        >
          {t('create.submit')}
        </button>
      </div>
    </li>
  );
}
