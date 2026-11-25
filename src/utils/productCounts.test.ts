import { describe, it, expect } from 'vitest';
import { capacityUnits, formatProductCounts, bookingProductCounts } from './productCounts';

describe('productCounts', () => {
  it('rail counts as half a lath, rounded up', () => {
    expect(capacityUnits({ shade: 8, rail: 2, curtain: 3 })).toBe(12);
    expect(capacityUnits({ shade: 0, rail: 1, curtain: 0 })).toBe(1);
    expect(capacityUnits({ shade: 10, rail: 3, curtain: 0 })).toBe(12);
    expect(capacityUnits({ shade: 0, rail: 0, curtain: 0 })).toBe(0);
  });
  it('formats only non-zero products', () => {
    expect(formatProductCounts({ shade: 8, rail: 0, curtain: 3 })).toBe('8 شید • 3 پرده');
  });
  it('old bookings without breakdown count as shade', () => {
    expect(bookingProductCounts({ lathsCount: 16 } as never)).toEqual({ shade: 16, rail: 0, curtain: 0 });
  });
});
