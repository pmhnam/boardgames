import {
  DEFAULT_SPLENDOR_CONFIG,
  GEM_COLORS,
  type DevelopmentCard,
  type Noble,
  type Tier,
} from '@bgp/game-splendor';

const ASSET_BASE =
  import.meta.env.VITE_SPLENDOR_ASSET_BASE_URL ||
  'https://pub-de586e6b073f4c52aa30d3b10be6b9ed.r2.dev/splendor/base/v1';

const url = (path: string) => `${ASSET_BASE.replace(/\/$/, '')}/${path}`;

/** Each row follows the source sheet left to right. Matched by printed bonus, points and cost. */
const CARD_ROWS: Record<Tier, readonly (readonly string[])[]> = {
  1: [
    [
      'red-01',
      'red-08',
      'white-03',
      'white-07',
      'white-05',
      'green-08',
      'green-03',
      'blue-03',
      'black-01',
      'black-08',
    ],
    [
      'white-08',
      'white-04',
      'blue-02',
      'blue-04',
      'blue-07',
      'black-06',
      'black-02',
      'black-03',
      'red-02',
      'green-06',
    ],
    [
      'green-05',
      'green-01',
      'white-02',
      'red-07',
      'blue-08',
      'blue-05',
      'green-07',
      'green-04',
      'green-02',
      'blue-06',
    ],
    [
      'blue-01',
      'white-01',
      'white-06',
      'red-05',
      'red-03',
      'red-06',
      'black-04',
      'black-07',
      'black-05',
      'red-04',
    ],
  ],
  2: [
    [
      'red-04',
      'blue-06',
      'green-06',
      'white-06',
      'black-02',
      'green-05',
      'black-04',
      'red-01',
      'black-03',
      'green-01',
    ],
    [
      'white-05',
      'red-06',
      'white-03',
      'red-05',
      'white-01',
      'green-03',
      'blue-03',
      'black-06',
      'green-04',
      'blue-02',
    ],
    [
      'black-05',
      'blue-04',
      'blue-01',
      'white-04',
      'white-02',
      'red-03',
      'black-01',
      'red-02',
      'blue-05',
      'green-02',
    ],
  ],
  3: [
    [
      'black-02',
      'red-04',
      'green-02',
      'white-03',
      'black-01',
      'black-03',
      'white-02',
      'green-03',
      'blue-04',
      'red-03',
    ],
    [
      'red-02',
      'black-04',
      'green-04',
      'green-01',
      'blue-03',
      'white-04',
      'blue-02',
      'red-01',
      'white-01',
      'blue-01',
    ],
  ],
};

export const CARD_IMAGE_PATHS = Object.fromEntries(
  Object.entries(CARD_ROWS).flatMap(([tier, rows]) =>
    rows.flatMap((row, rowIndex) =>
      row.map((card, columnIndex) => [
        `${card.split('-')[0]}-L${tier}-${card.split('-')[1]}`,
        `development/level-${tier}/L${tier}-R${String(rowIndex + 1).padStart(2, '0')}-C${String(columnIndex + 1).padStart(2, '0')}.png`,
      ]),
    ),
  ),
) as Record<string, string>;

/** Noble sheet order differs from both the JSON numbering and the engine's noble order. */
export const NOBLE_IMAGE_PATHS: Record<string, string> = {
  'noble-catherine-de-medici': 'nobles/NOBLE-01.png',
  'noble-henry-viii': 'nobles/NOBLE-02.png',
  'noble-machiavelli': 'nobles/NOBLE-03.png',
  'noble-charles-v': 'nobles/NOBLE-04.png',
  'noble-elisabeth-of-austria': 'nobles/NOBLE-05.png',
  'noble-isabella-of-castile': 'nobles/NOBLE-06.png',
  'noble-suleiman': 'nobles/NOBLE-07.png',
  'noble-anne-of-brittany': 'nobles/NOBLE-08.png',
  'noble-francis-i': 'nobles/NOBLE-09.png',
  'noble-mary-stuart': 'nobles/NOBLE-10.png',
};

const defaultCards = new Map(DEFAULT_SPLENDOR_CONFIG.cards.map((card) => [card.id, card]));
const defaultNobles = new Map(DEFAULT_SPLENDOR_CONFIG.nobles.map((noble) => [noble.id, noble]));

export function cardImageUrl(card: DevelopmentCard): string | undefined {
  const standard = defaultCards.get(card.id);
  const path = CARD_IMAGE_PATHS[card.id];
  if (
    !standard ||
    !path ||
    card.tier !== standard.tier ||
    card.bonus !== standard.bonus ||
    card.points !== standard.points ||
    GEM_COLORS.some((color) => card.cost[color] !== standard.cost[color])
  )
    return undefined;
  return url(path);
}

export function nobleImageUrl(noble: Noble): string | undefined {
  const standard = defaultNobles.get(noble.id);
  const path = NOBLE_IMAGE_PATHS[noble.id];
  if (
    !standard ||
    !path ||
    noble.points !== standard.points ||
    GEM_COLORS.some((color) => noble.requirement[color] !== standard.requirement[color])
  )
    return undefined;
  return url(path);
}

export function cardBackImageUrl(tier: Tier): string {
  return url(`backs/level-${tier}-back.png`);
}
