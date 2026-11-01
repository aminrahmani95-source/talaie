import { Project, ProjectStatus, QCStatus } from '../types';
import { formatJalali } from './jalali';

export function getStatusPersianLabel(status?: ProjectStatus | string | null): string {
  switch (status) {
    case 'MEASUREMENT_PENDING':
      return 'در انتظار اندازه‌گیری دوم';
    case 'SCHEDULED':
      return 'برنامه‌ریزی‌شده';
    case 'EN_ROUTE':
      return 'در مسیر';
    case 'IN_PROGRESS':
      return 'در حال نصب';
    case 'PAUSED':
      return 'نیمه‌کاره — ادامه روز بعد';
    case 'STUCK':
      return 'متوقف / استاک';
    case 'COMPLETED':
      return 'اتمام نصب';
    case 'CANCELLED':
      return 'لغو شده';
    default:
      return status || 'نامشخص';
  }
}

export function getQcStatusPersianLabel(qcStatus?: QCStatus | string | null): string {
  switch (qcStatus) {
    case 'NOT_STARTED':
      return 'شروع نشده';
    case 'PENDING':
      return 'در انتظار بررسی QC';
    case 'APPROVED':
      return 'تایید نهایی QC';
    case 'REJECTED':
      return 'رد شده / نیاز به اصلاح';
    default:
      return qcStatus || 'نامشخص';
  }
}

/**
 * Generates human-readable Persian diff strings from old and new project snapshots.
 */
export function formatAuditDiff(
  oldData?: Partial<Project> | null,
  newData?: Partial<Project> | null,
  action?: string
): string[] {
  if (action === 'DELETE') {
    return ['حذف کامل پروژه از سیستم'];
  }
  if (action === 'INSERT') {
    return ['ایجاد و ثبت اولیه پروژه'];
  }
  if (!oldData && !newData) {
    return ['عملیات بدون تغییر'];
  }
  if (!oldData && newData) {
    return ['ایجاد و ثبت اولیه پروژه'];
  }
  if (oldData && !newData) {
    return ['حذف پروژه'];
  }

  const oldP = oldData as Partial<Project>;
  const newP = newData as Partial<Project>;
  const changes: string[] = [];

  if (oldP.status !== newP.status && newP.status) {
    changes.push(
      `تغییر وضعیت از «${getStatusPersianLabel(oldP.status)}» به «${getStatusPersianLabel(newP.status)}»`
    );
  }

  if (oldP.qcStatus !== newP.qcStatus && newP.qcStatus) {
    changes.push(
      `تغییر وضعیت کنترل کیفی از «${getQcStatusPersianLabel(oldP.qcStatus)}» به «${getQcStatusPersianLabel(newP.qcStatus)}»`
    );
  }

  if (oldP.scheduledDate !== newP.scheduledDate && newP.scheduledDate) {
    changes.push(
      `تغییر تاریخ اجرا از ${formatJalali(oldP.scheduledDate)} به ${formatJalali(newP.scheduledDate)}`
    );
  }

  if ((oldP.endDate || null) !== (newP.endDate || null)) {
    if (newP.endDate) {
      changes.push(`تنظیم تاریخ پایان پروژه به ${formatJalali(newP.endDate)}`);
    } else {
      changes.push('حذف تاریخ پایان (تبدیل به پروژه یک‌روزه)');
    }
  }

  if (oldP.scheduledTime !== newP.scheduledTime && newP.scheduledTime) {
    changes.push(`تغییر ساعت اجرا به ${newP.scheduledTime}`);
  }

  if (oldP.leadTechnicianId !== newP.leadTechnicianId) {
    changes.push('تغییر سرپرست تیم نصب');
  }

  if (
    JSON.stringify(oldP.assignedTechnicianIds || []) !==
    JSON.stringify(newP.assignedTechnicianIds || [])
  ) {
    changes.push('به‌روزرسانی تکنسین‌های تخصیص‌یافته');
  }

  if (oldP.customerName !== newP.customerName && newP.customerName) {
    changes.push(`تغییر نام مشتری به «${newP.customerName}»`);
  }

  if (oldP.customerPhone !== newP.customerPhone && newP.customerPhone) {
    changes.push(`تغییر شماره تماس مشتری به ${newP.customerPhone}`);
  }

  if (oldP.address !== newP.address && newP.address) {
    changes.push('به‌روزرسانی آدرس محل نصب');
  }

  if (
    oldP.shadePanels !== newP.shadePanels ||
    oldP.curtainPanels !== newP.curtainPanels
  ) {
    changes.push(
      `تغییر لت‌ها: ${newP.shadePanels ?? oldP.shadePanels ?? 0} شید، ${newP.curtainPanels ?? oldP.curtainPanels ?? 0} پرده`
    );
  }

  if (oldP.qcScore !== newP.qcScore && newP.qcScore) {
    changes.push(`ثبت امتیاز کیفی ${newP.qcScore} از 5`);
  }

  if (oldP.qcNotes !== newP.qcNotes && newP.qcNotes) {
    changes.push(`ثبت بازخورد QC: «${newP.qcNotes}»`);
  }

  if ((oldP.customerSignature || null) !== (newP.customerSignature || null)) {
    if (newP.customerSignature) {
      changes.push('ثبت امضای دیجیتال مشتری');
    } else {
      changes.push('پاک‌سازی امضای مشتری');
    }
  }

  if (oldP.completionNotes !== newP.completionNotes && newP.completionNotes) {
    changes.push('ویرایش یادداشت اتمام کار');
  }

  const beforeDiff = (newP.beforePhotos?.length || 0) - (oldP.beforePhotos?.length || 0);
  if (beforeDiff > 0) changes.push(`${beforeDiff} عکس قبل اضافه شد`);
  else if (beforeDiff < 0) changes.push(`${Math.abs(beforeDiff)} عکس قبل حذف شد`);

  const afterDiff = (newP.afterPhotos?.length || 0) - (oldP.afterPhotos?.length || 0);
  if (afterDiff > 0) changes.push(`${afterDiff} عکس بعد اضافه شد`);
  else if (afterDiff < 0) changes.push(`${Math.abs(afterDiff)} عکس بعد حذف شد`);

  const compDiff = (newP.completionPhotos?.length || 0) - (oldP.completionPhotos?.length || 0);
  if (compDiff > 0) changes.push(`${compDiff} عکس اتمام کار اضافه شد`);
  else if (compDiff < 0) changes.push(`${Math.abs(compDiff)} عکس اتمام کار حذف شد`);

  const propDiff = (newP.proposalImages?.length || 0) - (oldP.proposalImages?.length || 0);
  if (propDiff > 0) changes.push(`${propDiff} تصویر پروپوزال اضافه شد`);
  else if (propDiff < 0) changes.push(`${Math.abs(propDiff)} تصویر پروپوزال حذف شد`);

  if (
    (oldP.dailyLogs?.length || 0) !== (newP.dailyLogs?.length || 0)
  ) {
    const diff = (newP.dailyLogs?.length || 0) - (oldP.dailyLogs?.length || 0);
    changes.push(diff > 0 ? `${diff} گزارش روزانه اضافه شد` : 'به‌روزرسانی گزارش‌های روزانه کار');
  }

  const oldSess = oldP.workSessions || [];
  const newSess = newP.workSessions || [];
  if (newSess.length > oldSess.length) {
    const last = newSess[newSess.length - 1];
    changes.push(`شروع روز کاری${last?.byUserName ? ` توسط ${last.byUserName}` : ''}`);
  } else if (newSess.length < oldSess.length) {
    changes.push(newSess.length === 0 ? 'پاک‌سازی زمان‌های کار' : 'حذف جلسه‌ی کار');
  } else if (
    newSess.length > 0 &&
    !oldSess[oldSess.length - 1]?.endedAt &&
    newSess[newSess.length - 1]?.endedAt
  ) {
    changes.push('پایان روز کاری');
  }

  if (
    (oldP.stuckIncidents?.length || 0) !== (newP.stuckIncidents?.length || 0)
  ) {
    changes.push('ثبت یا تغییر وضعیت توقف پروژه (استاک)');
  }

  if (
    (oldP.evaluations?.length || 0) !== (newP.evaluations?.length || 0)
  ) {
    const diff = (newP.evaluations?.length || 0) - (oldP.evaluations?.length || 0);
    changes.push(diff > 0 ? `${diff} ارزیابی پرسنل اضافه شد` : 'به‌روزرسانی ارزیابی‌های پرسنل');
  }

  if (changes.length === 0) {
    changes.push('به‌روزرسانی مشخصات و مدارک پروژه');
  }

  return changes;
}
