/*
 * What a player's avatar is drawn from. Nothing is stored: the same person gets the same
 * colour and letters on every screen because both are worked out from what is already known.
 */

/** A hue (0–359) that stays the same for the same id. */
export function avatarHue(id: string): number {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) >>> 0;
  }
  return hash % 360;
}

/** The first letters of the first and last words of a name, or of its only word. */
export function avatarInitials(displayName: string): string {
  const words = displayName.trim().split(/\s+/).filter(Boolean);
  const first = words[0];
  if (first === undefined) return '?';
  const last = words.length > 1 ? words[words.length - 1] : undefined;
  // By code point, so a letter outside the basic plane is not cut in half.
  const letter = (word: string) => Array.from(word)[0] ?? '';
  return (letter(first) + (last ? letter(last) : '')).toUpperCase();
}
