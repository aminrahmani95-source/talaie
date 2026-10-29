// Standalone Persian (Jalali) date helpers without external dependencies

export interface JalaliDate {
  jy: number; // Jalali Year (مثلاً 1405)
  jm: number; // Jalali Month (1-12)
  jd: number; // Jalali Day (1-31)
}

// Convert Gregorian to Jalali
export function gregorianToJalali(gy: number, gm: number, gd: number): JalaliDate {
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let jy = (gy <= 1600) ? 0 : 979;
  gy -= (gy <= 1600) ? 621 : 1600;
  const gy2 = (gm > 2) ? (gy + 1) : gy;
  let days = (365 * gy) + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400) - 80 + gd + g_d_m[gm - 1];
  jy += 33 * Math.floor(days / 12053);
  days %= 12053;
  jy += 4 * Math.floor(days / 1461);
  days %= 1461;
  jy += Math.floor((days - 1) / 365);
  if (days > 0) {
    days = (days - 1) % 365;
  }
  let jm: number;
  let jd: number;
  if (days < 186) {
    jm = 1 + Math.floor(days / 31);
    jd = 1 + (days % 31);
  } else {
    jm = 7 + Math.floor((days - 186) / 30);
    jd = 1 + ((days - 186) % 30);
  }
  return { jy, jm, jd };
}

// Convert Jalali to Gregorian
export function jalaliToGregorian(jy: number, jm: number, jd: number): { gy: number; gm: number; gd: number } {
  let gy = (jy <= 979) ? 621 : 1600;
  jy -= (jy <= 979) ? 0 : 979;
  let days = (365 * jy) + Math.floor(jy / 33) * 8 + Math.floor(((jy % 33) + 3) / 4) + 78 + jd + ((jm < 7) ? (jm - 1) * 31 : ((jm - 7) * 30) + 186);
  gy += 400 * Math.floor(days / 146097);
  days %= 146097;
  if (days > 36524) {
    gy += 100 * Math.floor(--days / 36524);
    days %= 36524;
    if (days >= 365) days++;
  }
  gy += 4 * Math.floor(days / 1461);
  days %= 1461;
  gy += Math.floor((days - 1) / 365);
  if (days > 0) days = (days - 1) % 365;
  let gd = days + 1;
  const sal_a = [0, 31, ((gy % 4 === 0 && gy % 100 !== 0) || (gy % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let gm: number;
  for (gm = 0; gm < 13; gm++) {
    const v = sal_a[gm];
    if (gd <= v) break;
    gd -= v;
  }
  return { gy, gm, gd };
}

export const PERSIAN_MONTH_NAMES = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'
];

export const PERSIAN_WEEK_DAYS = [
  'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه', 'شنبه'
];

// Helper to format ISO date string "YYYY-MM-DD"
export function formatToPersianDateString(date: Date = new Date()): string {
  const gy = date.getFullYear();
  const gm = date.getMonth() + 1;
  const gd = date.getDate();
  const { jy, jm, jd } = gregorianToJalali(gy, gm, gd);
  return `${jy}/${String(jm).padStart(2, '0')}/${String(jd).padStart(2, '0')}`;
}

export function getTodayPersianString(): string {
  return formatToPersianDateString(new Date());
}

export function getPersianDayName(date: Date): string {
  return PERSIAN_WEEK_DAYS[date.getDay()];
}

export interface DayInfo {
  date: Date;
  dateKey: string; // ISO date YYYY-MM-DD
  persianDateStr: string; // مثلاً 1405/07/28
  persianDayName: string; // مثلاً شنبه
  persianDayNum: number;  // 28
  persianMonthName: string; // مهر
  isToday: boolean;
  dayOffset: number; // 0 for today, 1 for tomorrow, etc.
}

export function getUpcomingDays(count = 30): DayInfo[] {
  const days: DayInfo[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < count; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);

    const gy = d.getFullYear();
    const gm = d.getMonth() + 1;
    const gd = d.getDate();
    const { jy, jm, jd } = gregorianToJalali(gy, gm, gd);

    const dateKey = `${gy}-${String(gm).padStart(2, '0')}-${String(gd).padStart(2, '0')}`;

    days.push({
      date: d,
      dateKey,
      persianDateStr: `${jy}/${String(jm).padStart(2, '0')}/${String(jd).padStart(2, '0')}`,
      persianDayName: PERSIAN_WEEK_DAYS[d.getDay()],
      persianDayNum: jd,
      persianMonthName: PERSIAN_MONTH_NAMES[jm - 1],
      isToday: i === 0,
      dayOffset: i,
    });
  }

  return days;
}

// Standard English numbers formatting throughout the project
export function toPersianDigits(n: number | string): string {
  if (n === null || n === undefined) return '';
  const farsiDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return n
    .toString()
    .replace(/[۰-۹]/g, (d) => farsiDigits.indexOf(d).toString())
    .replace(/[٠-٩]/g, (d) => arabicDigits.indexOf(d).toString());
}

export const toEnglishDigits = toPersianDigits;

// Calculate duration between two ISO date strings in human readable Persian
export function formatDuration(startedAt?: string, completedAt?: string): string {
  if (!startedAt) return '';
  const start = new Date(startedAt).getTime();
  const end = completedAt ? new Date(completedAt).getTime() : Date.now();
  if (isNaN(start) || isNaN(end) || end < start) return '';

  const totalMinutes = Math.floor((end - start) / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${toPersianDigits(Math.max(1, minutes))} دقیقه`;
  }
  if (minutes === 0) {
    return `${toPersianDigits(hours)} ساعت`;
  }
  return `${toPersianDigits(hours)} ساعت و ${toPersianDigits(minutes)} دقیقه`;
}

// Format time only (e.g. 09:30 -> ۰۹:۳۰) from ISO timestamp
export function formatTimeOnly(isoOrDate?: string | Date): string {
  if (!isoOrDate) return '';
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  if (isNaN(d.getTime())) return '';
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return toPersianDigits(`${h}:${m}`);
}
