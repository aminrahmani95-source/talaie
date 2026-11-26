import { Project, WorkSession } from '../types';
import { toPersianDigits, localDateKey, gregorianToJalali, PERSIAN_MONTH_NAMES, PERSIAN_WEEK_DAYS } from './jalali';

/**
 * Checks if a project is configured as a multi-day installation.
 * A project is multi-day if it has an endDate and endDate > scheduledDate.
 */
export function isProjectMultiDay(
  project?: ScheduleLike | null
): boolean {
  if (!project || !project.endDate || !project.scheduledDate) return false;
  return project.endDate > project.scheduledDate;
}

/**
 * Calculates the difference in calendar days between two YYYY-MM-DD strings.
 */
export function getCalendarDayDiff(fromYmd: string, toYmd: string): number {
  if (!fromYmd || !toYmd) return 0;
  const d1 = new Date(fromYmd + 'T00:00:00Z');
  const d2 = new Date(toYmd + 'T00:00:00Z');
  const diffMs = d2.getTime() - d1.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Returns array of all YYYY-MM-DD date strings between scheduledDate and endDate (inclusive).
 */
export function getMultiDayDateRange(scheduledDate: string, endDate: string): string[] {
  if (!scheduledDate || !endDate || endDate < scheduledDate) return [scheduledDate].filter(Boolean);
  const result: string[] = [];
  const cur = new Date(scheduledDate + 'T00:00:00Z');
  const end = new Date(endDate + 'T00:00:00Z');

  while (cur <= end) {
    result.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return result;
}

/**
 * Returns total days count for a project (1 for single-day, >= 2 for multi-day).
 */
export function getMultiDayTotalDays(
  scheduledDateOrProject: string | ScheduleLike,
  endDate?: string
): number {
  if (typeof scheduledDateOrProject === 'object' && scheduledDateOrProject !== null) {
    return Math.max(1, getProjectScheduleDays(scheduledDateOrProject).length);
  }
  const scheduledDate = scheduledDateOrProject;
  if (!endDate || endDate <= scheduledDate) return 1;
  return Math.max(1, getCalendarDayDiff(scheduledDate, endDate) + 1);
}

// ---------------------------------------------------------------------------
// روزهای انتخابی (غیرپشت‌سرهم): مثلاً شنبه و چهارشنبه، بدون یکشنبه تا سه‌شنبه
// ---------------------------------------------------------------------------

/** پروژه با فیلد اختیاری روزهای انتخابی */
export type ScheduleLike = Pick<Project, 'scheduledDate' | 'endDate'> & { scheduledDays?: string[] | null };

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

/** فهرست مرتب و بدون تکرار از تاریخ‌های معتبر YYYY-MM-DD */
export function normalizeScheduleDays(days: unknown): string[] {
  if (!Array.isArray(days)) return [];
  return [...new Set(days.filter((d): d is string => typeof d === 'string' && DATE_KEY.test(d)))].sort();
}

/** آیا روزها پشت سر هم‌اند (هیچ روز تقویمی بینشان جا نیفتاده) */
export function isContiguousDays(days: string[]): boolean {
  for (let i = 1; i < days.length; i++) {
    if (getCalendarDayDiff(days[i - 1], days[i]) !== 1) return false;
  }
  return true;
}

/**
 * روزهای انتخابی پروژه فقط وقتی معتبرند که با تاریخ شروع و پایان بخوانند. اگر تاریخ پروژه
 * از راه دیگری عوض شود (درخواست تغییر برنامه، انتقال اکیپ)، روزهای قدیمی خودبه‌خود کنار
 * می‌روند و پروژه به بازه‌ی پشت سر هم برمی‌گردد؛ هیچ‌وقت روزی نشان داده نمی‌شود که بیرون از
 * تاریخ شروع و پایان ثبت‌شده باشد.
 */
function validCustomDays(project: ScheduleLike): string[] | null {
  if (!project.scheduledDate) return null;
  const custom = normalizeScheduleDays(project.scheduledDays);
  if (custom.length < 2) return null;
  const end = project.endDate && project.endDate > project.scheduledDate ? project.endDate : project.scheduledDate;
  if (custom[0] !== project.scheduledDate || custom[custom.length - 1] !== end) return null;
  return custom;
}

/** آیا پروژه روزهای انتخابی (با فاصله) دارد */
export function hasCustomScheduleDays(project?: ScheduleLike | null): boolean {
  if (!project) return false;
  const custom = validCustomDays(project);
  return Boolean(custom && !isContiguousDays(custom));
}

/** همه‌ی روزهای اجرای پروژه: روزهای انتخابی، یا بازه‌ی شروع تا پایان، یا فقط روز شروع */
export function getProjectScheduleDays(project?: ScheduleLike | null): string[] {
  if (!project?.scheduledDate) return [];
  const custom = validCustomDays(project);
  if (custom) return custom;
  if (isProjectMultiDay(project)) return getMultiDayDateRange(project.scheduledDate, project.endDate as string);
  return [project.scheduledDate];
}

/** «شنبه 8 آذر» برای یک تاریخ YYYY-MM-DD */
export function scheduleDayLabel(key: string): string {
  const d = new Date(`${key}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return key;
  const { jm, jd } = gregorianToJalali(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  return `${PERSIAN_WEEK_DAYS[d.getUTCDay()]} ${jd} ${PERSIAN_MONTH_NAMES[jm - 1]}`;
}

/** روز اجرای بعدی بعد از یک تاریخ (برای «ادامه در ...») */
export function nextScheduleDayAfter(project: ScheduleLike, dateKey: string): string | null {
  return getProjectScheduleDays(project).find((d) => d > dateKey) || null;
}

/**
 * Determines whether a project should appear on a given dateKey (YYYY-MM-DD).
 */
export function isProjectScheduledOnDate(project: ScheduleLike, dateKey: string): boolean {
  if (!project.scheduledDate || !dateKey) return false;
  const custom = validCustomDays(project);
  if (custom) return custom.includes(dateKey);
  if (isProjectMultiDay(project)) {
    return dateKey >= project.scheduledDate && dateKey <= (project.endDate as string);
  }
  return project.scheduledDate === dateKey;
}

export interface MultiDayProgress {
  currentDay: number;
  totalDays: number;
  badgeText: string;
}

/**
 * Computes the multi-day badge «روز 2 از 3» for a given view date or today.
 */
export function getMultiDayProgress(
  project: ScheduleLike,
  viewDateKey?: string
): MultiDayProgress | null {
  if (!isProjectMultiDay(project)) return null;

  const days = getProjectScheduleDays(project);
  const totalDays = Math.max(1, days.length);
  const refDate = viewDateKey || localDateKey();

  if (refDate > (project.endDate as string)) {
    return {
      currentDay: totalDays,
      totalDays,
      badgeText: 'پروژه پایان‌یافته',
    };
  }

  // روز چندم: تعداد روزهای اجرای تا امروز (روزهای بین روزهای انتخابی شمرده نمی‌شوند)
  const offset = days.filter((d) => d <= refDate).length;
  const currentDay = Math.min(Math.max(1, offset), totalDays);

  return {
    currentDay,
    totalDays,
    badgeText: `روز ${toPersianDigits(currentDay)} از ${toPersianDigits(totalDays)}`,
  };
}

export interface WorkSessionsSummary {
  totalSeconds: number;
  totalMinutes: number;
  totalHours: number;
  uniqueDaysCount: number;
  totalDays: number;
  formattedHours: string;
  formattedText: string;
  text: string;
}

/**
 * Calculates total on-site time across all work sessions, including any currently open session.
 */
export function calculateWorkSessionsSummary(
  sessions?: WorkSession[],
  fallbackStartedAt?: string,
  fallbackCompletedAt?: string
): WorkSessionsSummary | null {
  if (!sessions || sessions.length === 0) {
    if (!fallbackStartedAt) return null;
    const start = new Date(fallbackStartedAt).getTime();
    const end = fallbackCompletedAt ? new Date(fallbackCompletedAt).getTime() : Date.now();
    const diffSec = Math.max(0, Math.floor((end - start) / 1000));
    const hours = Math.floor(diffSec / 3600);
    const minutes = Math.floor((diffSec % 3600) / 60);
    const totalMinutes = Math.floor(diffSec / 60);
    const totalHours = Math.round((diffSec / 3600) * 10) / 10;
    const formattedHours = (Math.round((diffSec / 3600) * 10) / 10).toString();
    const durationStr = hours > 0
      ? `${toPersianDigits(hours)} ساعت و ${toPersianDigits(minutes)} دقیقه`
      : `${toPersianDigits(minutes)} دقیقه`;

    return {
      totalSeconds: diffSec,
      totalMinutes,
      totalHours,
      uniqueDaysCount: 1,
      totalDays: 1,
      formattedHours,
      formattedText: `${durationStr} (در ${toPersianDigits(1)} روز)`,
      text: `مجموع: ${toPersianDigits(formattedHours)} ساعت در 1 روز`,
    };
  }

  const now = Date.now();
  let totalSeconds = 0;
  const daysSet = new Set<string>();

  for (const s of sessions) {
    if (s.date) daysSet.add(s.date);
    const start = new Date(s.startedAt).getTime();
    if (isNaN(start)) continue;

    const end = s.endedAt ? new Date(s.endedAt).getTime() : now;
    if (isNaN(end)) continue;

    const elapsed = Math.max(0, Math.floor((end - start) / 1000));
    totalSeconds += elapsed;
  }

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const totalMinutes = Math.floor(totalSeconds / 60);
  const totalHours = Math.round((totalSeconds / 3600) * 10) / 10;
  const formattedHours = (Math.round((totalSeconds / 3600) * 10) / 10).toString();
  const uniqueDaysCount = Math.max(1, daysSet.size);

  const durationStr = hours > 0
    ? `${toPersianDigits(hours)} ساعت و ${toPersianDigits(minutes)} دقیقه`
    : `${toPersianDigits(minutes)} دقیقه`;

  return {
    totalSeconds,
    totalMinutes,
    totalHours,
    uniqueDaysCount,
    totalDays: uniqueDaysCount,
    formattedHours,
    formattedText: `${durationStr} (در ${toPersianDigits(uniqueDaysCount)} روز)`,
    text: `مجموع: ${toPersianDigits(formattedHours)} ساعت در ${toPersianDigits(uniqueDaysCount)} روز`,
  };
}
