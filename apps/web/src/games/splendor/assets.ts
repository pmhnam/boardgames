import type { Tier } from '@bgp/game-splendor';

const ASSET_BASE =
  import.meta.env.VITE_SPLENDOR_ASSET_BASE_URL || 'https://bgasset.openai.id.vn/splendor/base/v2';

export const assetUrl = (path: string) => `${ASSET_BASE.replace(/\/$/, '')}/${path}`;

export function cardBackImageUrl(tier: Tier): string {
  return assetUrl(`backs/level-${tier}-back.webp`);
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
