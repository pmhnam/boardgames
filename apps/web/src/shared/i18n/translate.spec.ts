import { describe, expect, it } from 'vitest';
import { interpolate, pickLocale } from './translate';

describe('interpolate', () => {
  it('returns a template with no placeholders unchanged', () => {
    expect(interpolate('Tạo phòng')).toBe('Tạo phòng');
    expect(interpolate('Tạo phòng', { name: 'An' })).toBe('Tạo phòng');
  });

  it('fills each placeholder, wherever and however often it appears', () => {
    expect(interpolate('{count}/{max} người', { count: 2, max: 4 })).toBe('2/4 người');
    expect(interpolate('{name} và {name}', { name: 'An' })).toBe('An và An');
  });

  it('leaves a placeholder it was given no value for', () => {
    expect(interpolate('Phòng của {name}', {})).toBe('Phòng của {name}');
  });

  it('writes a zero rather than treating it as missing', () => {
    expect(interpolate('{count} phòng', { count: 0 })).toBe('0 phòng');
  });
});

describe('pickLocale', () => {
  const supported = ['vi', 'en'] as const;

  it('takes the first preferred language that is supported, ignoring the region', () => {
    expect(pickLocale(supported, ['fr-FR', 'en-US', 'vi'])).toBe('en');
    expect(pickLocale(supported, ['VI-vn'])).toBe('vi');
  });

  it('falls back to the first supported language', () => {
    expect(pickLocale(supported, ['fr', 'de'])).toBe('vi');
    expect(pickLocale(supported, [])).toBe('vi');
  });
});
