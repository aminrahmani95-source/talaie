import { Project, ProjectStatus, Ticket, User } from '../types';
import { PermanentError } from './offlineQueue';

export const ALLOWED_TECHNICIAN_PATCH_KEYS = new Set([
  'status',
  'startedAt',
  'completedAt',
  'reworkStartedAt',
  'completionNotes',
  'beforePhotos',
  'afterPhotos',
  'completionPhotos',
  'handoverChecklist',
  'handoverChecklistNotes',
  'customerSignature',
  'customerSatisfaction',
  'customerSurvey',
  'stuckIncidents',
  'updatedAt',
  'qcStatus',
  'workSessions',
  'dailyLogs',
]);

export function isValidStatusTransition(from: ProjectStatus, to: ProjectStatus): boolean {
  if (from === 'SCHEDULED' && to === 'EN_ROUTE') return true;
  if (from === 'EN_ROUTE' && to === 'IN_PROGRESS') return true;
  if (from === 'IN_PROGRESS' && to === 'COMPLETED') return true;
  if ((from === 'EN_ROUTE' || from === 'IN_PROGRESS') && to === 'STUCK') return true;
  // Multi-day PAUSED transitions
  if (from === 'IN_PROGRESS' && to === 'PAUSED') return true;
  if (from === 'PAUSED' && to === 'EN_ROUTE') return true;
  if (from === 'PAUSED' && to === 'IN_PROGRESS') return true;
  if (from === 'PAUSED' && to === 'STUCK') return true;
  return false;
}

export function validateProjectPatchRoleGuards(
  user: User,
  project: Project,
  patch: Record<string, any>
): void {
  // مدیر QC هیچ محدودیتی در فیلدها یا مسیر انتقال وضعیت ندارد
  if (user.role === 'QC_MANAGER') {
    return;
  }

  // ۱. بررسی تخصیص پروژه به کاربر
  const isAssigned =
    project.leadTechnicianId === user.id ||
    (project.assignedTechnicianIds || []).includes(user.id);

  if (!isAssigned) {
    throw new PermanentError('دسترسی غیرمجاز: شما مسئول یا تکنسین تخصیص‌یافته به این پروژه نیستید.');
  }

  // ۲. بررسی کلیدهای مجاز برای تکنسین
  for (const key of Object.keys(patch)) {
    if (!ALLOWED_TECHNICIAN_PATCH_KEYS.has(key)) {
      throw new PermanentError(`دسترسی غیرمجاز: تکنسین اجازه تغییر فیلد «${key}» را ندارد.`);
    }
  }

  // ۳. بررسی وضعیت QC: فقط PENDING و فقط همراه با status = COMPLETED
  if (patch.qcStatus !== undefined) {
    if (patch.qcStatus !== 'PENDING') {
      throw new PermanentError('دسترسی غیرمجاز: تکنسین فقط می‌تواند وضعیت QC را روی PENDING تنظیم کند.');
    }
    const finalStatus = patch.status || project.status;
    if (finalStatus !== 'COMPLETED') {
      throw new PermanentError(
        'دسترسی غیرمجاز: تنظیم وضعیت QC روی PENDING فقط همراه با اتمام کار (COMPLETED) مجاز است.'
      );
    }
  }

  // ۴. بررسی مسیرهای مجاز انتقال وضعیت
  if (patch.status && patch.status !== project.status) {
    if (!isValidStatusTransition(project.status, patch.status)) {
      throw new PermanentError(
        `انتقال وضعیت از «${project.status}» به «${patch.status}» برای تکنسین مجاز نیست.`
      );
    }
  }

  // ۵. بررسی تغییرات stuckIncidents: تکنسین فقط می‌تواند دقیقاً یک رویداد جدید با resolutionStatus = 'OPEN' الصاق کند
  if (patch.stuckIncidents !== undefined) {
    if (!Array.isArray(patch.stuckIncidents)) {
      throw new PermanentError('دسترسی غیرمجاز: تکنسین فقط میتواند گزارش استاک جدید ثبت کند.');
    }

    const currentIncidents = Array.isArray(project.stuckIncidents)
      ? project.stuckIncidents
      : project.stuckIncident
      ? [project.stuckIncident]
      : [];

    const newIncidents = patch.stuckIncidents;
    if (newIncidents.length !== currentIncidents.length + 1) {
      throw new PermanentError('دسترسی غیرمجاز: تکنسین فقط میتواند گزارش استاک جدید ثبت کند.');
    }

    for (let i = 0; i < currentIncidents.length; i++) {
      if (JSON.stringify(currentIncidents[i]) !== JSON.stringify(newIncidents[i])) {
        throw new PermanentError('دسترسی غیرمجاز: تکنسین فقط میتواند گزارش استاک جدید ثبت کند.');
      }
    }

    const newlyAppended = newIncidents[newIncidents.length - 1];
    if (!newlyAppended || newlyAppended.resolutionStatus !== 'OPEN') {
      throw new PermanentError('دسترسی غیرمجاز: تکنسین فقط میتواند گزارش استاک جدید ثبت کند.');
    }
  }

  // ۶. بررسی dailyLogs: فقط الحاق مجاز است (append-only) و توسط کاربر جاری
  if (patch.dailyLogs !== undefined) {
    if (!Array.isArray(patch.dailyLogs)) {
      throw new PermanentError('دسترسی غیرمجاز: لاگ روزانه باید آرایه باشد.');
    }
    const currentLogs = Array.isArray(project.dailyLogs) ? project.dailyLogs : [];
    const newLogs = patch.dailyLogs;

    if (newLogs.length !== currentLogs.length + 1) {
      throw new PermanentError('دسترسی غیرمجاز: تکنسین فقط می‌تواند لاگ روزانه جدید الصاق کند.');
    }

    for (let i = 0; i < currentLogs.length; i++) {
      if (JSON.stringify(currentLogs[i]) !== JSON.stringify(newLogs[i])) {
        throw new PermanentError('دسترسی غیرمجاز: ویرایش لاگ‌های روزانه قبلی مجاز نیست.');
      }
    }

    const lastLog = newLogs[newLogs.length - 1];
    if (!lastLog || lastLog.byUserId !== user.id) {
      throw new PermanentError('دسترسی غیرمجاز: ثبت لاگ روزانه فقط با هویت خودتان مجاز است.');
    }
  }

  // ۷. بررسی workSessions: الحاق جلسه جدید یا بستن جلسه جاری باز متعلق به خود کاربر
  if (patch.workSessions !== undefined) {
    if (!Array.isArray(patch.workSessions)) {
      throw new PermanentError('دسترسی غیرمجاز: جلسات کاری باید آرایه باشد.');
    }
    const currentSessions = Array.isArray(project.workSessions) ? project.workSessions : [];
    const newSessions = patch.workSessions;

    if (newSessions.length === currentSessions.length && currentSessions.length > 0) {
      // بستن آخرین جلسه باز
      for (let i = 0; i < currentSessions.length - 1; i++) {
        if (JSON.stringify(currentSessions[i]) !== JSON.stringify(newSessions[i])) {
          throw new PermanentError('دسترسی غیرمجاز: جلسات کاری قبلی قابل ویرایش نیستند.');
        }
      }

      const lastCurrent = currentSessions[currentSessions.length - 1];
      const lastNew = newSessions[newSessions.length - 1];

      if (lastCurrent.byUserId !== user.id) {
        throw new PermanentError('دسترسی غیرمجاز: شما فقط مجاز به بستن جلسه کاری خودتان هستید.');
      }
      if (lastCurrent.endedAt) {
        throw new PermanentError('دسترسی غیرمجاز: این جلسه کاری قبلاً بسته شده است.');
      }
      if (!lastNew.endedAt) {
        throw new PermanentError('دسترسی غیرمجاز: زمان پایان کار جلسه تنظیم نشده است.');
      }

      // سایر فیلدهای جلسه نباید تغییر کرده باشند
      const { endedAt: _e1, ...currRest } = lastCurrent;
      const { endedAt: _e2, ...newRest } = lastNew;
      if (JSON.stringify(currRest) !== JSON.stringify(newRest)) {
        throw new PermanentError('دسترسی غیرمجاز: تغییر سایر مشخصات جلسه کاری مجاز نیست.');
      }
    } else if (newSessions.length === currentSessions.length + 1) {
      // الحاق یک جلسه کاری جدید
      for (let i = 0; i < currentSessions.length; i++) {
        if (JSON.stringify(currentSessions[i]) !== JSON.stringify(newSessions[i])) {
          throw new PermanentError('دسترسی غیرمجاز: جلسات کاری قبلی قابل تغییر نیستند.');
        }
      }

      const newlyAppendedSession = newSessions[newSessions.length - 1];
      if (!newlyAppendedSession || newlyAppendedSession.byUserId !== user.id) {
        throw new PermanentError('دسترسی غیرمجاز: باز کردن جلسه فقط با هویت خودتان مجاز است.');
      }
    } else {
      throw new PermanentError('دسترسی غیرمجاز: تعداد یا ترتیب جلسات کاری نامعتبر است.');
    }
  }
}

export function validateEvaluationRoleGuards(user: User): void {
  if (user.role !== 'QC_MANAGER') {
    throw new PermanentError('دسترسی غیرمجاز: تنها مدیر ارشد QC می‌تواند ارزیابی پرسنل را ثبت کند.');
  }
}

export function validateTicketRoleGuards(
  user: User,
  project: Project | undefined,
  ticket: Partial<Ticket>
): void {
  if (user.role === 'QC_MANAGER') {
    return;
  }

  // ۱. بررسی تخصیص پروژه به کاربر
  if (project) {
    const isAssigned =
      project.leadTechnicianId === user.id ||
      (project.assignedTechnicianIds || []).includes(user.id);
    if (!isAssigned) {
      throw new PermanentError(
        'دسترسی غیرمجاز: شما تنها مجاز به ثبت تیکت روی پروژه‌های تخصیص‌یافته به خودتان هستید.'
      );
    }
  }

  // ۲. تکنسین اجازه حل کردن تیکت را ندارد
  if (ticket.status === 'RESOLVED') {
    throw new PermanentError(
      'دسترسی غیرمجاز: تنها مدیر ارشد QC می‌تواند وضعیت تیکت را به حل‌شده (RESOLVED) تغییر دهد.'
    );
  }
}
