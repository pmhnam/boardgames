import { GEM_COLORS, type GemColor, type LegalMoves, type TokenCounts } from '@bgp/game-splendor';
import { TOKEN_LABEL } from '../layout';
import { GemIcon } from './GemIcon';
import { GemToken, gemStyle } from './GemToken';

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
  const unpick = (index: number) => onPick(picked.filter((_, at) => at !== index));

  return (
    <div className="splendor-bank">
      <div className="splendor-bank-tokens">
        {GEM_COLORS.map((color) =>
          interactive ? (
            <button
              key={color}
              type="button"
              className="splendor-bank-token"
              style={gemStyle(color)}
              aria-label={`Take ${TOKEN_LABEL[color]}, ${bank[color]} in the bank`}
              disabled={!canPick(color)}
              onClick={() => onPick([...picked, color])}
            >
              <GemIcon color={color} />
              <span className="splendor-gem-count">{bank[color]}</span>
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
        <div className="splendor-taking">
          {picked.length === 0 ? (
            <span className="muted">
              Take 3 different gems, or 2 of one colour from a pile of 4 or more.
            </span>
          ) : (
            <>
              <span>Taking</span>
              {picked.map((color, index) => (
                <button
                  key={index}
                  type="button"
                  className="splendor-picked"
                  aria-label={`Put back ${TOKEN_LABEL[color]}`}
                  onClick={() => unpick(index)}
                >
                  <GemToken color={color} />
                </button>
              ))}
            </>
          )}
          <button type="button" disabled={!canTake} onClick={onTake}>
            Take
          </button>
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
