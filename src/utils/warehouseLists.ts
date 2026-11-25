import type { Project } from '../types';

/**
 * Jobs whose load the warehouse still has to pack: scheduled ones, plus multi-day
 * jobs in progress that continue today or later. Soonest first.
 * Shared by the warehouse desk list and the material-center badge so both show the same number.
 */
export function getUpcomingDispatchProjects(projects: Project[], todayKey: string, horizonDays?: number): Project[] {
  const lastKey = horizonDays ? addDaysToKey(todayKey, horizonDays - 1) : null;
  return projects
    .filter(
      (p) =>
        (p.status === 'SCHEDULED' && (!lastKey || !p.scheduledDate || String(p.scheduledDate) <= lastKey)) ||
        (p.status === 'IN_PROGRESS' && Boolean(p.endDate) && String(p.endDate) >= todayKey),
    )
    .sort((a, b) => String(a.scheduledDate || '').localeCompare(String(b.scheduledDate || '')));
}

/** بارگیری فقط برای امروز تا پس‌فردا معنی دارد؛ کارهای دورتر هنوز کالایشان آماده نیست */
export const DISPATCH_HORIZON_DAYS = 3;

export function addDaysToKey(dateKey: string, days: number): string {
  const d = new Date(dateKey + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * پروژه‌ای که انبار هنوز باید ورود کالایش را تأیید کند.
 * پروژه‌های قدیمی/مهاجرت‌شده (بدون گیت تحویل) و کارهایی که اکیپ سرشان رفته، شمرده نمی‌شوند؛
 * همان قاعده‌ی فرم مأموریت و قوانین سرور.
 */
export function needsWarehouseReceipt(p: Project): boolean {
  if (p.status !== 'MEASUREMENT_PENDING' && p.status !== 'SCHEDULED') return false;
  const h = p.technicalHandover;
  if (h?.warehouseConfirmation?.confirmed) return false;
  if (h?.isHistoricalMigration) return false;
  if (!h && p.status !== 'MEASUREMENT_PENDING') return false;
  return true;
}

/** «امروز / فردا / پس‌فردا / عقب‌افتاده» برای تاریخ نصب */
export function relativeDayLabel(dateKey: string | undefined, todayKey: string): { text: string; tone: 'late' | 'soon' | 'near' | 'later' | 'none' } {
  if (!dateKey) return { text: 'بدون تاریخ', tone: 'none' };
  if (dateKey < todayKey) return { text: 'تاریخ گذشته', tone: 'late' };
  if (dateKey === todayKey) return { text: 'امروز', tone: 'soon' };
  if (dateKey === addDaysToKey(todayKey, 1)) return { text: 'فردا', tone: 'soon' };
  if (dateKey === addDaysToKey(todayKey, 2)) return { text: 'پس‌فردا', tone: 'near' };
  if (dateKey <= addDaysToKey(todayKey, 6)) return { text: '', tone: 'near' };
  return { text: '', tone: 'later' };
}
