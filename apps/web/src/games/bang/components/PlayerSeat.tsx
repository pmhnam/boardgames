import type { PlayerView } from '@bgp/game-bang';
import { memo, type CSSProperties } from 'react';
import { Tip } from '../../shared/Tip';
import type { SeatEffect } from '../effects';
import { fanSize, type SeatSpot } from '../layout';
import { CHARACTER_NAME, type BangText } from '../text';
import { useBangText } from '../useBangText';
import { CardBack, CardFace } from './CardFace';
import { Icon } from './Icon';

export interface SeatTile {
  player: PlayerView;
  name: string;
  isYou: boolean;
  /** Whose turn it is, who the table is waiting on, who it comes to next, who won. */
  turn: boolean;
  asked: boolean;
  queued: boolean;
  winner: boolean;
  /** One of the players the viewer may choose right now. */
  selectable: boolean;
  selected: boolean;
  /** The viewer is choosing a player, and this is not one of them. */
  faded: boolean;
  /** What just happened to this player, for a moment. */
  effect: SeatEffect | undefined;
  spot: SeatSpot;
}

function Life({ player }: { player: PlayerView }) {
  const text = useBangText();
  const label = text.seat.life(player.life, player.maxLife);
  return (
    <Tip hint={label}>
      <span className="bang-life" role="img" aria-label={label}>
        {Array.from({ length: player.maxLife }, (_, index) => (
          <Icon key={index} name="bullet" className={index < player.life ? undefined : 'spent'} />
        ))}
      </span>
    </Tip>
  );
}

function effectLabel(effect: SeatEffect, text: BangText): string {
  switch (effect.kind) {
    case 'answer':
      return text.seat.answered;
    case 'hit':
      return text.seat.hit(effect.amount);
    case 'blast':
      return `${text.seat.blast} ${text.seat.hit(effect.amount)}`;
    case 'death':
      return text.seat.dead;
  }
}

const TILE_PARTS = [
  'player',
  'name',
  'isYou',
  'turn',
  'asked',
  'queued',
  'winner',
  'selectable',
  'selected',
  'faded',
  'effect',
  'spot',
] as const satisfies ReadonlyArray<keyof SeatTile>;

/**
 * One player at the table, as a poster: who they are, the life they have left as bullets, the
 * cards they hold seen from behind, and what lies in front of them. It is a button while the
 * viewer may choose this player. A move changes a seat or two, so a seat is drawn again only
 * when something about it did.
 */
export const PlayerSeat = memo(function PlayerSeat({
  tile,
  onPick,
}: {
  tile: SeatTile;
  onPick(playerId: string): void;
}) {
  const text = useBangText();
  const { player, name, effect } = tile;
  const role = player.role;
  const fan = fanSize(player.handCount);

  const marks: Array<{ key: string; label: string }> = [];
  if (tile.winner) marks.push({ key: 'winner', label: text.seat.winner });
  if (tile.turn) marks.push({ key: 'turn', label: text.seat.turn });
  if (tile.asked) marks.push({ key: 'asked', label: text.seat.asked });
  if (tile.queued) marks.push({ key: 'queued', label: text.seat.queued });

  const body = (
    <>
      <span className="bang-seat-head">
        <Tip
          hint={
            <>
              <strong>{CHARACTER_NAME[player.character]}</strong>
              <span>{text.characterHint[player.character]}</span>
            </>
          }
        >
          <span className="bang-portrait">
            <Icon name={player.alive ? player.character : 'grave'} />
          </span>
        </Tip>
        <span className="bang-seat-names">
          <span className="bang-name">
            {name}
            {tile.isYou && <span className="bang-you"> ({text.seat.you})</span>}
          </span>
          <span className="bang-character">
            {player.alive ? CHARACTER_NAME[player.character] : text.seat.eliminated}
          </span>
        </span>
        <Tip
          hint={
            role ? (
              <>
                <strong>{text.role[role]}</strong>
                <span>{text.roleGoal[role]}</span>
              </>
            ) : (
              <>
                <strong>{text.hiddenRole}</strong>
                <span>{text.hiddenRoleHint}</span>
              </>
            )
          }
        >
          <span className={role ? `bang-role ${role}` : 'bang-role hidden'}>
            {role ? <Icon name={role} /> : <span aria-hidden="true">?</span>}
            <span className="sr-only">{role ? text.role[role] : text.hiddenRole}</span>
          </span>
        </Tip>
      </span>

      {player.alive && (
        <span className="bang-seat-stats">
          <Life player={player} />
          <Tip hint={text.seat.hand(player.handCount)}>
            <span className="bang-stat">
              <span className="bang-fan" aria-hidden="true">
                {Array.from({ length: fan }, (_, index) => (
                  <CardBack key={index} mini />
                ))}
              </span>
              <span aria-hidden="true">{player.handCount}</span>
              <span className="sr-only">{text.seat.hand(player.handCount)}</span>
            </span>
          </Tip>
          <Tip hint={text.seat.range(player.range)}>
            <span className="bang-stat">
              <Icon name="range" />
              <span aria-hidden="true">{player.range}</span>
              <span className="sr-only">{text.seat.range(player.range)}</span>
            </span>
          </Tip>
          {player.distance !== null && (
            <Tip hint={text.seat.distance(player.distance)}>
              <span className="bang-stat">
                <Icon name="distance" />
                <span aria-hidden="true">{player.distance}</span>
                <span className="sr-only">{text.seat.distance(player.distance)}</span>
              </span>
            </Tip>
          )}
        </span>
      )}

      {player.inPlay.length > 0 && (
        <span className="bang-in-play" role="group" aria-label={text.seat.inPlay}>
          {player.inPlay.map((card) => (
            <CardFace key={card.id} card={card} mini />
          ))}
        </span>
      )}
    </>
  );

  const className = [
    'bang-seat',
    player.alive ? '' : 'dead',
    tile.isYou ? 'mine' : '',
    tile.turn ? 'turn' : '',
    tile.asked ? 'asked' : '',
    tile.winner ? 'winner' : '',
    tile.selectable ? 'selectable' : '',
    tile.selected ? 'selected' : '',
    tile.faded ? 'faded' : '',
    effect ? `fx-${effect.kind}` : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <li
      className={className}
      style={{ '--x': `${tile.spot.x}%`, '--y': `${tile.spot.y}%` } as CSSProperties}
    >
      {marks.length > 0 && (
        <span className="bang-marks">
          {marks.map((mark) => (
            <span key={mark.key} className={`bang-mark ${mark.key}`}>
              {mark.key === 'winner' && <Icon name="trophy" />}
              {mark.label}
            </span>
          ))}
        </span>
      )}
      {tile.selectable ? (
        <button
          type="button"
          className="bang-seat-body"
          aria-pressed={tile.selected}
          onClick={() => onPick(player.playerId)}
        >
          {body}
        </button>
      ) : (
        <div className="bang-seat-body">{body}</div>
      )}
      {effect && (
        <span key={effect.id} className={`bang-fx ${effect.kind}`} role="status">
          <Icon
            name={effect.kind === 'death' ? 'skull' : effect.kind === 'answer' ? 'missed' : 'blast'}
          />
          <span>{effectLabel(effect, text)}</span>
        </span>
      )}
    </li>
  );
}, sameSeat);

function sameSeat(
  before: { tile: SeatTile; onPick(playerId: string): void },
  after: { tile: SeatTile; onPick(playerId: string): void },
): boolean {
  return (
    before.onPick === after.onPick &&
    TILE_PARTS.every((part) => before.tile[part] === after.tile[part])
  );
}
