import type { Tier, TokenColor } from '@bgp/game-splendor';

export const TOKEN_FILL: Record<TokenColor, string> = {
  white: '#f2f2ec',
  blue: '#2f6fde',
  green: '#2e9e5b',
  red: '#d6453d',
  black: '#303034',
  gold: '#e3b62e',
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

export const TOKEN_LABEL: Record<TokenColor, string> = {
  white: 'Diamond (white)',
  blue: 'Sapphire (blue)',
  green: 'Emerald (green)',
  red: 'Ruby (red)',
  black: 'Onyx (black)',
  gold: 'Gold',
};

export const TIER_LABEL: Record<Tier, string> = { 1: 'I', 2: 'II', 3: 'III' };
