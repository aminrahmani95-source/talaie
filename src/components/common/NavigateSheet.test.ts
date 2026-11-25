import { describe, it, expect } from 'vitest';
import { normalizeLocationLink } from './NavigateSheet';

describe('normalizeLocationLink', () => {
  it('keeps full links, fixes bare domains, maps coordinates', () => {
    expect(normalizeLocationLink('https://nshn.ir/abc')).toBe('https://nshn.ir/abc');
    expect(normalizeLocationLink('nshn.ir/abc')).toBe('https://nshn.ir/abc');
    expect(normalizeLocationLink('۳۵.۷۵, ۵۱.۴۱')).toBe('https://www.google.com/maps/search/?api=1&query=35.75,51.41');
    expect(normalizeLocationLink('تهران خیابان ولیعصر')).toBeNull();
    expect(normalizeLocationLink('')).toBeNull();
  });
});
