import { Project, ProjectStatus } from '../types';
import { getStatusPersianLabel } from './auditDiff';

export interface RevertStepResult {
  nextStatus: ProjectStatus;
  description: string;
  /** Extra fields that must change together with the status (e.g. clear qcStatus). */
  extraPatch: Record<string, unknown>;
}

function latestIncident(project: Project) {
  const list = Array.isArray(project.stuckIncidents) ? project.stuckIncidents : [];
  return list.length > 0 ? list[list.length - 1] : project.stuckIncident;
}

/**
 * Determines the previous status in the workflow for manager quick revert.
 * COMPLETED → IN_PROGRESS → EN_ROUTE → SCHEDULED → MEASUREMENT_PENDING
 * PAUSED → IN_PROGRESS
 * STUCK → the incident's previousStatus (or IN_PROGRESS)
 */
export function getRevertOneStep(project: Project): RevertStepResult {
  const current = project.status;
  const qcBack = { qcStatus: 'NOT_STARTED' };

  if (current === 'COMPLETED') {
    // بازگشت از اتمام کار: از صف QC خارج شود و تایید/رد قبلی اعتبار نداشته باشد
    return {
      nextStatus: 'IN_PROGRESS',
      description: 'برگرداندن از «اتمام کار» به «در حال نصب» (از صف QC خارج می‌شود)',
      extraPatch: { ...qcBack, completedAt: null },
    };
  }
  if (current === 'PAUSED') {
    return { nextStatus: 'IN_PROGRESS', description: 'برگرداندن از «نیمه‌کاره» به «در حال نصب»', extraPatch: {} };
  }
  if (current === 'IN_PROGRESS') {
    return { nextStatus: 'EN_ROUTE', description: 'برگرداندن به مرحله «در مسیر»', extraPatch: {} };
  }
  if (current === 'EN_ROUTE') {
    return { nextStatus: 'SCHEDULED', description: 'برگرداندن به مرحله «برنامه‌ریزی‌شده»', extraPatch: {} };
  }
  if (current === 'STUCK') {
    const prev = (latestIncident(project)?.previousStatus as ProjectStatus) || 'IN_PROGRESS';
    const safePrev: ProjectStatus = prev === 'STUCK' ? 'IN_PROGRESS' : prev;
    return {
      nextStatus: safePrev,
      description: `خروج از توقف و بازگشت به «${getStatusPersianLabel(safePrev)}»`,
      extraPatch: {},
    };
  }
  if (current === 'SCHEDULED') {
    return {
      nextStatus: 'MEASUREMENT_PENDING',
      description: 'برگرداندن به مرحله «در انتظار اندازه‌گیری دوم»',
      extraPatch: {},
    };
  }
  return { nextStatus: 'SCHEDULED', description: 'بازگشت به مرحله «برنامه‌ریزی‌شده»', extraPatch: {} };
}

/** Whether the quick «یک مرحله به عقب» action makes sense for this status. */
export function canRevertOneStep(project: Project): boolean {
  return project.status !== 'MEASUREMENT_PENDING' && project.status !== 'CANCELLED';
}

export type ResetMode = 'KEEP_DOCS' | 'CLEAR_ALL';

/**
 * Generates the patch for a full reset to SCHEDULED status.
 * Option 1 ('KEEP_DOCS'): retains reports, checklist, photos and logs.
 * Option 2 ('CLEAR_ALL'): wipes photos, checklist, signature, times and sessions.
 */
export function getFullResetPatch(
  project: Project,
  mode: ResetMode,
  auditReason: string
): Partial<Project> & { _auditReason: string } {
  const basePatch: Partial<Project> & { _auditReason: string } = {
    status: 'SCHEDULED',
    qcStatus: 'NOT_STARTED',
    _auditReason: auditReason || (mode === 'CLEAR_ALL' ? 'بازنشانی کامل با پاک‌سازی مدارک' : 'بازنشانی کامل با حفظ مدارک'),
    updatedAt: new Date().toISOString(),
  };

  if (mode === 'CLEAR_ALL') {
    // null (نه undefined) — undefined در JSON حذف می‌شود و روی سرور پاک نمی‌شد
    return {
      ...basePatch,
      startedAt: null,
      completedAt: null,
      reworkStartedAt: null,
      completionNotes: null,
      beforePhotos: [],
      afterPhotos: [],
      completionPhotos: [],
      handoverChecklist: {
        floorProtectiveClothUsed: false,
        cradleBracketsSecured: false,
        remoteTested: false,
        leveled: false,
        ironedPleated: false,
        cleaned: false,
      },
      handoverChecklistNotes: null,
      customerSignature: null,
      customerSatisfaction: null,
      customerSurvey: null,
      workSessions: [],
      dailyLogs: [],
      qcScore: null,
      qcNotes: null,
      qcReviewedAt: null,
      qcReviewedBy: null,
    } as unknown as Partial<Project> & { _auditReason: string };
  }

  return basePatch;
}

/**
 * Validates whether the typed project code matches the project code exactly
 * to unlock the permanent delete button.
 */
export function isDeleteCodeConfirmed(typedCode: string, exactProjectCode: string): boolean {
  if (!typedCode || !exactProjectCode) return false;
  return typedCode.trim().toUpperCase() === exactProjectCode.trim().toUpperCase();
}
