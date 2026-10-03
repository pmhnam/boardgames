import type { Noble } from './cards.js';

const NOBLE_POINTS = 3;

/** id, name, then the bonuses required in white, blue, green, red, black. */
type NobleSpec = [string, string, number, number, number, number, number];

/** The 10 noble tiles of the base game. */
// prettier-ignore
const SPECS: readonly NobleSpec[] = [
  ['noble-catherine-de-medici',  "Catherine de' Medici",     0, 3, 3, 3, 0],
  ['noble-elisabeth-of-austria', 'Elisabeth of Austria',     3, 3, 0, 0, 3],
  ['noble-isabella-of-castile',  'Isabella I of Castile',    4, 0, 0, 0, 4],
  ['noble-machiavelli',          'Niccolò Machiavelli',      4, 4, 0, 0, 0],
  ['noble-suleiman',             'Suleiman the Magnificent', 0, 4, 4, 0, 0],
  ['noble-anne-of-brittany',     'Anne of Brittany',         3, 3, 3, 0, 0],
  ['noble-charles-v',            'Charles V',                3, 0, 0, 3, 3],
  ['noble-francis-i',            'Francis I of France',      0, 0, 3, 3, 3],
  ['noble-henry-viii',           'Henry VIII',               0, 0, 0, 4, 4],
  ['noble-mary-stuart',          'Mary Stuart',              0, 0, 4, 4, 0],
];

export const DEFAULT_NOBLES: readonly Noble[] = SPECS.map(
  ([id, name, white, blue, green, red, black]) => ({
    id,
    name,
    points: NOBLE_POINTS,
    requirement: { white, blue, green, red, black },
  }),
);
