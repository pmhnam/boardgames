import type { CardView } from '@bgp/game-bang';
import { Tip } from '../../shared/Tip';
import { useBangText } from '../useBangText';
import { CardBack, CardFace } from './CardFace';
import { PlayerSeat, type SeatTile } from './PlayerSeat';

/**
 * The table: everyone round it in seat order, with the deck and the discard pile in the
 * middle. Whoever sits next to whom here is next to them in the game, and the last seat is
 * beside the first, which is what distance is counted along. On a narrow screen the ring
 * becomes a list in the same order.
 */
export function Table({
  tiles,
  deckCount,
  discardCount,
  discardTop,
  news,
  onPick,
}: {
  tiles: SeatTile[];
  deckCount: number;
  discardCount: number;
  discardTop: CardView | null;
  /** The last thing that happened, in words. */
  news: string;
  onPick(playerId: string): void;
}) {
  const text = useBangText();
  return (
    <section className="bang-table" aria-label={text.table.label}>
      <div className="bang-ring" data-seats={tiles.length}>
        <div className="bang-centre">
          <div className="bang-piles">
            <Tip hint={text.table.deck(deckCount)}>
              <span className="bang-pile">
                <span className={deckCount > 1 ? 'bang-pile-cards stacked' : 'bang-pile-cards'}>
                  {deckCount > 0 ? <CardBack /> : <span className="bang-card empty" />}
                </span>
                <span className="bang-pile-count" aria-hidden="true">
                  {deckCount}
                </span>
                <span className="sr-only">{text.table.deck(deckCount)}</span>
              </span>
            </Tip>
            <span className="bang-pile">
              <span className={discardCount > 1 ? 'bang-pile-cards stacked' : 'bang-pile-cards'}>
                {discardTop ? (
                  // A new card on the pile is a new element, so it lands rather than swaps.
                  <span key={discardTop.id} className="bang-landing">
                    <CardFace card={discardTop} />
                  </span>
                ) : (
                  <Tip hint={text.table.discardEmpty}>
                    <span className="bang-card empty" />
                  </Tip>
                )}
              </span>
              <span className="bang-pile-count" aria-hidden="true">
                {discardCount}
              </span>
              <span className="sr-only">{text.table.discard(discardCount)}</span>
            </span>
          </div>
          <p className="bang-news" aria-live="polite">
            {news}
          </p>
        </div>

        <ul className="bang-seats">
          {tiles.map((tile) => (
            <PlayerSeat key={tile.player.playerId} tile={tile} onPick={onPick} />
          ))}
        </ul>
      </div>
    </section>
  );
}
