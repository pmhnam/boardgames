import type { Tier } from '@bgp/game-splendor';

const ASSET_BASE =
  import.meta.env.VITE_SPLENDOR_ASSET_BASE_URL ||
  'https://pub-de586e6b073f4c52aa30d3b10be6b9ed.r2.dev/splendor/base/v1';

export const assetUrl = (path: string) => `${ASSET_BASE.replace(/\/$/, '')}/${path}`;

export function cardBackImageUrl(tier: Tier): string {
  return assetUrl(`backs/level-${tier}-back.png`);
}

const TIERS: Tier[] = [1, 2, 3];
let warmed = false;

/**
 * Opens the connection to the artwork's host and fetches the three deck backs, which every
 * table shows. Called while the match is still on its way, so the cards can follow at once.
 */
export function warmSplendorArt(): void {
  if (warmed || typeof document === 'undefined') return;
  warmed = true;
  const { origin } = new URL(assetUrl(''), document.baseURI);
  if (origin !== location.origin) {
    const link = document.createElement('link');
    link.rel = 'preconnect';
    link.href = origin;
    document.head.append(link);
  }
  for (const tier of TIERS) new Image().src = cardBackImageUrl(tier);
}
