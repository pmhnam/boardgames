import { GEM_COLORS, type GemColor, type LegalMoves, type TokenCounts } from '@bgp/game-splendor';
import { memo, useState } from 'react';
import { TOKEN_LABEL } from '../layout';
import { GemIcon } from './GemIcon';
import { gemStyle } from './GemToken';

const NOTHING_PICKED: GemColor[] = [];

/**
 * The supply, and the gems the player is about to take from it. The engine says which colours
 * and how many; this only keeps the pick in one of the two shapes it accepts: different
 * colours, or one colour twice.
 */
export const Bank = memo(function Bank({
  bank,
  legal,
  interactive,
  myMove,
  isMyTurn,
  busy,
  version,
  onTake,
  onPass,
}: {
  bank: TokenCounts;
  legal: LegalMoves;
  /** False for spectators, replays and finished games: the bank is then only shown. */
  interactive: boolean;
  /** The viewer is the one to move. What the bank says goes by this. */
  myMove: boolean;
  /** A click would be taken right now: false while an action is in flight, or when offline. */
  isMyTurn: boolean;
  /** The button whose action is in flight. */
  busy?: 'take' | 'pass';
  /** The state the bank is drawn from: a pick is dropped when it moves on. */
  version: number;
  onTake(colors: GemColor[]): void;
  onPass(): void;
}) {
  // A pick only makes sense for the state it was made in.
  const [draft, setDraft] = useState({ version, picked: NOTHING_PICKED });
  const picked = draft.version === version ? draft.picked : NOTHING_PICKED;
  const onPick = (next: GemColor[]) => setDraft({ version, picked: next });
  const isDouble = picked.length === 2 && picked[0] === picked[1];
  /** Whether one more gem of the colour fits the pick, whoever's turn it is. */
  const fits = (color: GemColor) => {
    if (isDouble) return false;
    if (picked.length === 1 && picked[0] === color) return legal.doubleColors.includes(color);
    if (picked.includes(color)) return false;
    return picked.length < legal.takeCount && legal.gemColors.includes(color);
  };
  const canPick = (color: GemColor) => isMyTurn && fits(color);
  // Told apart from `disabled`, which is also set while an action is in flight: a token that
  // only waits for the server's answer does not dim.
  const unavailable = (color: GemColor) => !myMove || (!fits(color) && !picked.includes(color));
  const canTake = isMyTurn && picked.length > 0 && (isDouble || picked.length === legal.takeCount);
  const selectColor = (color: GemColor) =>
    onPick(canPick(color) ? [...picked, color] : picked.filter((selected) => selected !== color));

  return (
    <div className="splendor-bank">
      <div className="splendor-bank-tokens">
        {GEM_COLORS.map((color) =>
          interactive ? (
            <button
              key={color}
              type="button"
              className={`splendor-bank-token${picked.includes(color) ? ' selected' : ''}${unavailable(color) ? ' unavailable' : ''}`}
              style={gemStyle(color)}
              aria-label={`Take ${TOKEN_LABEL[color]}, ${bank[color]} in the bank`}
              aria-pressed={picked.includes(color)}
              disabled={!isMyTurn || (!canPick(color) && !picked.includes(color))}
              onClick={() => selectColor(color)}
            >
              <GemIcon color={color} />
              <span className="splendor-gem-count">{bank[color]}</span>
              {picked.includes(color) && (
                <span className="splendor-bank-selection" aria-hidden="true">
                  ✓ {picked.filter((selected) => selected === color).length}
                </span>
              )}
            </button>
          ) : (
            <span key={color} className="splendor-bank-token" style={gemStyle(color)}>
              <GemIcon color={color} />
              <span className="splendor-gem-count">{bank[color]}</span>
              <span className="sr-only"> {TOKEN_LABEL[color]} in the bank</span>
            </span>
          ),
        )}
        <span
          className="splendor-bank-token gold"
          style={gemStyle('gold')}
          title="Gold comes with a reserved card and pays for any colour"
        >
          <GemIcon color="gold" />
          <span className="splendor-gem-count">{bank.gold}</span>
          <span className="sr-only"> Gold in the bank</span>
        </span>
      </div>

      {interactive && (
        <div className="splendor-taking" role="group" aria-label="Take selected gems">
          <span className="splendor-pick-status" role="status">
            {!myMove
              ? 'Not your turn'
              : picked.length === 0
                ? 'Select gems'
                : `Selected ${picked.length}/${isDouble ? 2 : legal.takeCount}`}
          </span>
          <div className="splendor-bank-actions">
            <button
              type="button"
              disabled={!canTake}
              aria-busy={busy === 'take' || undefined}
              onClick={() => onTake(picked)}
            >
              {picked.length > 0 ? `Take ${picked.length}` : 'Take'}
            </button>
            {picked.length > 0 && (
              <button
                type="button"
                className="secondary"
                aria-label="Clear selected gems"
                title="Clear selection"
                onClick={() => onPick([])}
              >
                ×
              </button>
            )}
          </div>
          {myMove && legal.canPass && (
            <button
              type="button"
              disabled={!isMyTurn}
              aria-busy={busy === 'pass' || undefined}
              onClick={onPass}
            >
              Pass (no move left)
            </button>
          )}
        </div>
      )}
    </div>
  );
});
