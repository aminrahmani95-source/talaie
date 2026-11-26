import type { Project } from '../types';
import { formatJalali, localDateKey } from './jalali';
import { isStuckOpen } from './navCounts';
import { stuckIncidentsOf, STUCK_CATEGORY_LABELS } from './projectsReport';
import { getWarehouseStage, WAREHOUSE_STAGE_LABELS } from './warehouseStatus';
import { getCalendarDayDiff } from './multiDay';
import { isHandoverGatePassed } from './roleGuards';

/**
 * «قدم بعدی» هر پروژه از دید مدیر: یک جمله و یک اقدام.
 * پیشخوان، برگه‌ی مدیریت پروژه و گزارش‌ها همه از همین‌جا می‌خوانند تا یک پروژه همه‌جا یک پیام داشته باشد.
 */
export type NextStepAction = 'EDIT' | 'QC' | 'STUCK' | 'CERT' | 'NONE';
export type NextStepTone = 'danger' | 'warn' | 'info' | 'ok';

export interface NextStep {
  tone: NextStepTone;
  text: string;
  action: NextStepAction;
  actionLabel?: string;
}

/** آنچه هنوز بین پروژه و اعزام اکیپ مانده */
export function missingBeforeDispatch(p: Project): string[] {
  return [
    p.status === 'MEASUREMENT_PENDING' && !p.secondMeasurementDetails?.isReadinessApproved ? 'اندازه‌گیری دوم' : '',
    // همان قاعده‌ی میز انبار و سرور (پروژه‌ی قدیمی/مهاجرت‌شده گیت ندارد)
    !isHandoverGatePassed(p) ? 'ورود کالا به انبار' : '',
    !p.assignedTeamId ? 'اکیپ' : '',
    !p.scheduledDate ? 'تاریخ' : '',
  ].filter(Boolean);
}

/** مهلت 72 ساعته‌ی آخرین توقف باز */
export function stuckSla(p: Project, now = Date.now()): { hoursLeft: number; overdue: boolean; text: string } | null {
  const list = stuckIncidentsOf(p);
  const inc = list[list.length - 1];
  if (!inc || inc.resolutionStatus === 'RESOLVED') return null;
  const started = new Date(inc.stuckAt).getTime();
  if (isNaN(started)) return null;
  const max = inc.targetMaxHours || 72;
  const left = max - (now - started) / 3_600_000;
  const hours = Math.floor(Math.abs(left));
  return left > 0
    ? { hoursLeft: Math.floor(left), overdue: false, text: `${hours} ساعت تا مهلت` }
    : { hoursLeft: -hours, overdue: true, text: `${hours} ساعت از مهلت گذشته` };
}

/** چند روز است کار تمام شده و منتظر QC است */
export function qcWaitingDays(p: Project, todayKey = localDateKey()): number | null {
  if (p.status !== 'COMPLETED' || p.qcStatus !== 'PENDING' || !p.completedAt) return null;
  const d = new Date(p.completedAt);
  if (isNaN(d.getTime())) return null;
  return Math.max(0, getCalendarDayDiff(localDateKey(d), todayKey));
}

export function getNextStep(p: Project, todayKey = localDateKey()): NextStep {
  if (p.status === 'CANCELLED') return { tone: 'info', text: 'این پروژه لغو شده است.', action: 'NONE' };

  if (isStuckOpen(p)) {
    const list = stuckIncidentsOf(p);
    const inc = list[list.length - 1];
    const sla = stuckSla(p);
    const why = inc ? `${STUCK_CATEGORY_LABELS[inc.category] || 'توقف'}${inc.description ? `: ${inc.description}` : ''}` : 'علت ثبت نشده';
    return {
      tone: 'danger',
      text: `کار متوقف است (${why})${sla ? ` — ${sla.text}` : ''}.`,
      action: 'STUCK',
      actionLabel: 'رفع توقف',
    };
  }

  if (p.status === 'COMPLETED') {
    if (p.qcStatus === 'APPROVED') {
      return { tone: 'ok', text: 'کار تمام و تأیید QC شده است.', action: 'CERT', actionLabel: 'شناسنامه' };
    }
    if (p.qcStatus === 'REJECTED') {
      return { tone: 'warn', text: 'QC رد شده؛ منتظر اصلاح توسط اکیپ.', action: 'QC', actionLabel: 'جزئیات QC' };
    }
    const days = qcWaitingDays(p, todayKey);
    return {
      tone: 'warn',
      text: `کار تمام شده و منتظر بررسی QC است${days ? ` (${days} روز)` : ''}.`,
      action: 'QC',
      actionLabel: 'بررسی QC',
    };
  }

  if (p.status === 'EN_ROUTE' || p.status === 'IN_PROGRESS') {
    return { tone: 'info', text: p.status === 'EN_ROUTE' ? 'اکیپ در مسیر محل است.' : 'اکیپ سر کار است.', action: 'NONE' };
  }
  if (p.status === 'PAUSED') {
    return { tone: 'info', text: 'کار نیمه‌کاره است و روز بعد ادامه دارد.', action: 'NONE' };
  }

  const missing = missingBeforeDispatch(p);
  if (missing.length) {
    const onlyWarehouse = missing.length === 1 && missing[0] === 'ورود کالا به انبار';
    return {
      tone: onlyWarehouse ? 'warn' : 'danger',
      text: `قبل از اعزام مانده: ${missing.join('، ')}.`,
      action: onlyWarehouse ? 'NONE' : 'EDIT',
      actionLabel: onlyWarehouse ? undefined : 'تخصیص اکیپ و تاریخ',
    };
  }

  const stage = getWarehouseStage(p);
  const when = p.scheduledDate
    ? p.scheduledDate === todayKey
      ? 'امروز'
      : formatJalali(p.scheduledDate)
    : '';
  return {
    tone: 'ok',
    text: `آماده‌ی اعزام ${when}${stage !== 'NONE' ? ` · انبار: ${WAREHOUSE_STAGE_LABELS[stage]}` : ''}.`,
    action: 'NONE',
  };
}
