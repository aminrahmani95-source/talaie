import { describe, it, expect } from 'vitest';
import { gregorianToJalali, jalaliToGregorian, formatJalali } from '../jalali';

describe('Jalali date conversion', () => {
  it('matches Intl.DateTimeFormat (en-u-ca-persian) for every day from 2019-01-01 to 2035-12-31 with zero mismatches', () => {
    const formatter = new Intl.DateTimeFormat('en-u-ca-persian', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      timeZone: 'UTC',
    });

    const start = new Date('2019-01-01T12:00:00Z');
    const end = new Date('2035-12-31T12:00:00Z');

    let totalDays = 0;
    let mismatches = 0;

    for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
      totalDays++;
      const gy = d.getUTCFullYear();
      const gm = d.getUTCMonth() + 1;
      const gd = d.getUTCDate();

      const { jy, jm, jd } = gregorianToJalali(gy, gm, gd);

      const parts = formatter.formatToParts(d);
      const pYear = parseInt(parts.find((p) => p.type === 'year')!.value, 10);
      const pMonth = parseInt(parts.find((p) => p.type === 'month')!.value, 10);
      const pDay = parseInt(parts.find((p) => p.type === 'day')!.value, 10);

      if (jy !== pYear || jm !== pMonth || jd !== pDay) {
        mismatches++;
      }

      // Test round-trip conversion
      const gBack = jalaliToGregorian(jy, jm, jd);
      expect(gBack.gy).toBe(gy);
      expect(gBack.gm).toBe(gm);
      expect(gBack.gd).toBe(gd);
    }

    expect(totalDays).toBeGreaterThan(6000);
    expect(mismatches).toBe(0);
  });

  it('correctly handles specific leap year boundaries (e.g. 2028-03-20 -> 1407/01/01)', () => {
    const res = gregorianToJalali(2028, 3, 20);
    expect(res).toEqual({ jy: 1407, jm: 1, jd: 1 });
  });

  it('formats dates into Jalali correctly with formatJalali helper', () => {
    expect(formatJalali('2026-10-31')).toBe('1405/08/09');
    expect(formatJalali('2028-03-20')).toBe('1407/01/01');
    expect(formatJalali('1405/08/09')).toBe('1405/08/09');
    expect(formatJalali('1405-08-09')).toBe('1405/08/09');
    expect(formatJalali(null)).toBe('—');
    expect(formatJalali('')).toBe('—');
    expect(formatJalali(undefined, 'ثبت نشده')).toBe('ثبت نشده');
  });
});
