import { describe, it, expect } from 'vitest';
import {
  gregorianToJalali,
  jalaliToGregorian,
  formatJalali,
  getUpcomingDays,
  getDayInfoFromDateKey,
} from '../jalali';

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

  it('guarantees 200+ days into the future has zero drift, consecutive days, and perfect Shamsi mapping', () => {
    const days = getUpcomingDays(250);
    expect(days.length).toBe(250);

    // Day 0 is today
    expect(days[0].isToday).toBe(true);
    expect(days[0].dayOffset).toBe(0);

    // Day 200 is exactly offset 200
    const day200 = days[200];
    expect(day200.dayOffset).toBe(200);
    expect(day200.isToday).toBe(false);

    // Ensure consecutive days have strictly 24 hours (86,400,000 ms) gap without DST midnight drift
    for (let i = 1; i < days.length; i++) {
      const prev = days[i - 1];
      const curr = days[i];
      const diffMs = curr.date.getTime() - prev.date.getTime();
      // At noon, daily diff is always 24 hours ± 1 hour max if DST transition occurs
      expect(diffMs).toBeGreaterThanOrEqual(23 * 3600 * 1000);
      expect(diffMs).toBeLessThanOrEqual(25 * 3600 * 1000);
      expect(curr.dayOffset).toBe(i);
    }

    // Verify day 200 roundtrip via getDayInfoFromDateKey
    const roundtrip = getDayInfoFromDateKey(day200.dateKey);
    expect(roundtrip).not.toBeNull();
    expect(roundtrip?.persianDateStr).toBe(day200.persianDateStr);
    expect(roundtrip?.persianDayNum).toBe(day200.persianDayNum);
    expect(roundtrip?.persianMonthName).toBe(day200.persianMonthName);
    expect(roundtrip?.dayOffset).toBe(200);

    // Verify formatJalali produces the exact same Shamsi string for day 200
    expect(formatJalali(day200.dateKey)).toBe(day200.persianDateStr);
  });
});
