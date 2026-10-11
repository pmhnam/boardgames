import { describe, expect, it } from 'vitest';
import { avatarHue, avatarInitials } from './avatar-traits';

describe('avatarHue', () => {
  it('gives the same id the same hue every time', () => {
    expect(avatarHue('user-1')).toBe(avatarHue('user-1'));
  });

  it('stays within the colour wheel', () => {
    for (const id of ['', 'a', 'user-1', '7f1c2c0e-93a4-4d6b-8a55-0f6f3f4d2b11']) {
      const hue = avatarHue(id);
      expect(hue).toBeGreaterThanOrEqual(0);
      expect(hue).toBeLessThan(360);
      expect(Number.isInteger(hue)).toBe(true);
    }
  });

  it('tells different ids apart', () => {
    expect(avatarHue('user-1')).not.toBe(avatarHue('user-2'));
  });
});

describe('avatarInitials', () => {
  it('takes the first letter of a single word', () => {
    expect(avatarInitials('otis')).toBe('O');
  });

  it('takes the first letters of the first and last words', () => {
    expect(avatarInitials('Nguyễn Văn An')).toBe('NA');
    expect(avatarInitials('  ánh   dương ')).toBe('ÁD');
  });

  it('keeps a letter outside the basic plane whole', () => {
    expect(avatarInitials('🦊 fox')).toBe('🦊F');
  });

  it('has something to show for an empty name', () => {
    expect(avatarInitials('   ')).toBe('?');
  });
});
