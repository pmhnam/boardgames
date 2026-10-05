import { GEM_COLORS, type GemColor, type LegalMoves, type TokenCounts } from '@bgp/game-splendor';
import { TOKEN_LABEL } from '../layout';
import { GemIcon } from './GemIcon';
import { gemStyle } from './GemToken';

/**
 * The supply, and the gems the player is about to take from it. The engine says which colours
 * and how many; this only keeps the pick in one of the two shapes it accepts: different
 * colours, or one colour twice.
 */
export function Bank({
  bank,
  legal,
  interactive,
  isMyTurn,
  picked,
  onPick,
  onTake,
  onPass,
}: {
  bank: TokenCounts;
  legal: LegalMoves;
  /** False for spectators, replays and finished games: the bank is then only shown. */
  interactive: boolean;
  isMyTurn: boolean;
  picked: GemColor[];
  onPick(picked: GemColor[]): void;
  onTake(): void;
  onPass(): void;
}) {
  const isDouble = picked.length === 2 && picked[0] === picked[1];
  const canPick = (color: GemColor) => {
    if (!isMyTurn || isDouble) return false;
    if (picked.length === 1 && picked[0] === color) return legal.doubleColors.includes(color);
    if (picked.includes(color)) return false;
    return picked.length < legal.takeCount && legal.gemColors.includes(color);
  };
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
              className={`splendor-bank-token${picked.includes(color) ? ' selected' : ''}`}
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
            {!isMyTurn
              ? 'Not your turn'
              : picked.length === 0
                ? 'Select gems'
                : `Selected ${picked.length}/${isDouble ? 2 : legal.takeCount}`}
          </span>
          <div className="splendor-bank-actions">
            <button type="button" disabled={!canTake} onClick={onTake}>
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
          {isMyTurn && legal.canPass && (
            <button type="button" onClick={onPass}>
              Pass (no move left)
            </button>
          )}
        </div>
      )}
    </div>
  );
}
