import { Project, WorkSession } from '../types';
import { toPersianDigits, localDateKey } from './jalali';

/**
 * Checks if a project is configured as a multi-day installation.
 * A project is multi-day if it has an endDate and endDate > scheduledDate.
 */
export function isProjectMultiDay(
  project?: Pick<Project, 'scheduledDate' | 'endDate'> | null
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
 * Returns total days count for a project (1 for single-day, >= 2 for multi-day).
 */
export function getMultiDayTotalDays(
  scheduledDateOrProject: string | Pick<Project, 'scheduledDate' | 'endDate'>,
  endDate?: string
): number {
  if (typeof scheduledDateOrProject === 'object' && scheduledDateOrProject !== null) {
    return getMultiDayTotalDays(scheduledDateOrProject.scheduledDate, scheduledDateOrProject.endDate);
  }
  const scheduledDate = scheduledDateOrProject;
  if (!endDate || endDate <= scheduledDate) return 1;
  return Math.max(1, getCalendarDayDiff(scheduledDate, endDate) + 1);
}

/**
 * Determines whether a project should appear on a given dateKey (YYYY-MM-DD).
 */
export function isProjectScheduledOnDate(
  project: Pick<Project, 'scheduledDate' | 'endDate'>,
  dateKey: string
): boolean {
  if (!project.scheduledDate || !dateKey) return false;
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
 * Computes the multi-day badge «روز ۲ از ۳» for a given view date or today.
 */
export function getMultiDayProgress(
  project: Pick<Project, 'scheduledDate' | 'endDate'>,
  viewDateKey?: string
): MultiDayProgress | null {
  if (!isProjectMultiDay(project)) return null;

  const totalDays = getMultiDayTotalDays(project.scheduledDate, project.endDate);
  const refDate = viewDateKey || localDateKey();

  if (refDate > (project.endDate as string)) {
    return {
      currentDay: totalDays,
      totalDays,
      badgeText: 'پروژه پایان‌یافته',
    };
  }

  const offset = getCalendarDayDiff(project.scheduledDate, refDate) + 1;
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
      text: `مجموع: ${toPersianDigits(formattedHours)} ساعت در ۱ روز`,
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
