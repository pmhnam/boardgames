import { useCatanText } from '../useCatanText';

/** Which of the nine places on a die's face carry a pip, for each value. */
const PIPS: Record<number, readonly number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

function Die({ value }: { value: number | null }) {
  const pips = value === null ? [] : (PIPS[value] ?? []);
  return (
    <span className={value === null ? 'catan-die idle' : 'catan-die'} aria-hidden="true">
      {Array.from({ length: 9 }, (_, place) => (
        <span key={place} className={pips.includes(place) ? 'catan-die-pip on' : 'catan-die-pip'} />
      ))}
    </span>
  );
}

/** The two dice of this turn, and what they add up to. Blank until they are rolled. */
export function Dice({ roll, turn }: { roll: [number, number] | null; turn: number }) {
  const text = useCatanText();
  const total = roll ? roll[0] + roll[1] : null;
  return (
    <span
      // A fresh pair each time they land, so they tumble again.
      key={roll ? `${turn}:${roll[0]}:${roll[1]}` : 'idle'}
      className={roll ? 'catan-dice rolled' : 'catan-dice'}
      role="img"
      aria-label={roll ? text.rolled(roll[0], roll[1]) : text.notRolled}
    >
      <Die value={roll?.[0] ?? null} />
      <Die value={roll?.[1] ?? null} />
      <span className={total === 7 ? 'catan-dice-total seven' : 'catan-dice-total'}>
        {total ?? '–'}
      </span>
    </span>
  );
}
