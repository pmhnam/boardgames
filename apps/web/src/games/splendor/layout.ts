import type { Tier, TokenColor } from '@bgp/game-splendor';

export const TOKEN_FILL: Record<TokenColor, string> = {
  white: '#f4f3ec',
  blue: '#2f6fde',
  green: '#27a05a',
  red: '#d9423a',
  // Charcoal rather than true black, so it stands out on a dark page.
  black: '#4a4e5a',
  gold: '#e6b422',
};

/** Text that stays readable on top of each fill. */
export const TOKEN_INK: Record<TokenColor, string> = {
  white: '#1c1d1f',
  blue: '#ffffff',
  green: '#ffffff',
  red: '#ffffff',
  black: '#ffffff',
  gold: '#1c1d1f',
};

/** What a card of each bonus colour is washed with: white and black need a visible stand-in. */
export const CARD_TINT: Record<TokenColor, string> = {
  ...TOKEN_FILL,
  white: '#c9c7b8',
  black: '#6b7080',
};

export const TOKEN_LABEL: Record<TokenColor, string> = {
  white: 'Diamond (white)',
  blue: 'Sapphire (blue)',
  green: 'Emerald (green)',
  red: 'Ruby (red)',
  black: 'Onyx (black)',
  gold: 'Gold',
};

export const TOKEN_NAME: Record<TokenColor, string> = {
  white: 'white',
  blue: 'blue',
  green: 'green',
  red: 'red',
  black: 'black',
  gold: 'gold',
};

export const TIER_LABEL: Record<Tier, string> = { 1: 'I', 2: 'II', 3: 'III' };
