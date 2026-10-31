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
  'customerSignature',
  'customerSatisfaction',
  'customerSurvey',
  'stuckIncidents',
  'updatedAt',
  'qcStatus',
]);

export function isValidStatusTransition(from: ProjectStatus, to: ProjectStatus): boolean {
  if (from === 'SCHEDULED' && to === 'EN_ROUTE') return true;
  if (from === 'EN_ROUTE' && to === 'IN_PROGRESS') return true;
  if (from === 'IN_PROGRESS' && to === 'COMPLETED') return true;
  if ((from === 'EN_ROUTE' || from === 'IN_PROGRESS') && to === 'STUCK') return true;
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
