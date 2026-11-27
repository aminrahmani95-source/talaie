import { COORDINATOR_SCOPE_MESSAGE, COORDINATOR_TEAM_REQUIRED_MESSAGE } from './coordinatorScope';
import { CREW_LEAD_ONLY_MESSAGE, isProjectSupervisor } from './crew';
import { Project, ProjectStatus, Ticket, User, QCDefect } from '../types';
import { PermanentError } from './offlineQueue';
import { getEffectiveProjectPlan, getEffectivePlannedQuantity } from './planProgress';
import { getLatestTeamTransfer, isTransferResolved } from './teamTransfer';
import { hasUnresolvedCriticalDefects } from './qcWorkflow';

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
  'siteReadiness',
  'planAmendments',
  'isExceptionalCompletion',
  'exceptionalCompletionDetails',
  'qcDefects',
  'customerAcceptance',
  'handoverSigneeType',
  'representativeName',
  'representativeRole',
  'representativePhone',
  'unavailabilityReason',
  'unavailabilityPhotos',
  'interTeamHandover',
  'customerDisclaimerAgreed',
  'preInstallPhotosConfirmed',
  'secondMeasurementDetails',
  'warehousePrep',
]);

export function isHandoverGatePassed(project: Partial<Project>, patch?: Record<string, any>): boolean {
  // پرچم مهاجرت تاریخی تنها از خود پروژه ذخیره‌شده معتبر است و هرگز از patch پذیرفته نمی‌شود
  if (project.technicalHandover?.isHistoricalMigration) {
    return true;
  }

  // پروژه‌های فعال تاریخی که قبل از اعمال گیت تعریف شده‌اند
  if (!project.technicalHandover && !patch?.technicalHandover && project.status && project.status !== 'MEASUREMENT_PENDING') {
    return true;
  }

  const mergedHandover = {
    ...(project.technicalHandover || {}),
    ...(patch?.technicalHandover || {}),
  };

  const whConfirmed = Boolean(mergedHandover.warehouseConfirmation?.confirmed);

  return whConfirmed;
}

export function canAccessProject(user: User, project: Project, userTeamId?: string): boolean {
  if (!user.active) return false;
  if (
    user.role === 'CEO' ||
    user.role === 'QC_MANAGER' ||
    user.role === 'SCHEDULING_COORDINATOR' ||
    user.role === 'WAREHOUSE' ||
    user.role === 'MEASUREMENT_LEAD' ||
    user.role === 'SALES_REP'
  ) {
    return true;
  }
  if (project.leadTechnicianId === user.id) return true;
  if ((project.assignedTechnicianIds || []).includes(user.id)) return true;
  if (userTeamId && project.assignedTeamId && userTeamId === project.assignedTeamId) return true;
  return false;
}

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

/**
 * گارد اختصاصی و فوق امنیتی برای تایید تحویل پروژه انتقالی (فاز P2.2 Hardening).
 * مسیرهای مجاز منحصراً دو مورد است:
 * مسیر 1: تایید دریافت توسط سرپرست رسمی و قطعی اکیپ مقصد (Strict Receiving Lead)
 *    - الزامات: user.id === project.leadTechnicianId و user.role === 'LEAD_TECHNICIAN' و actualTeamId === latestTransfer.toTeamId
 *    - فیلدهای تایید: receivingLeadConfirmed: true، receivingLeadConfirmedAt، receivingLeadConfirmedBy
 * مسیر 2: رفع انسداد مدیریتی توسط مدیر ارشد QC (Manager Override)
 *    - الزامات: user.role === 'QC_MANAGER' و ثبت فیلدهای متمایز لاگ ممیزی
 *    - الزامات فیلدها: isManagerOverride: true، managerOverrideReason (اجباری)، managerOverrideAt، managerOverrideByUserId، managerOverrideRole: 'QC_MANAGER'
 *    - صریحاً: receivingLeadConfirmed نباید true باشد تا تایید فیزیکی سرپرست جعل نگردد.
 * سایر موارد:
 *    - سوابق قبلی انتقال و اقلام صورت‌جلسه (handoverInventory) 100٪ تغییرناپذیرند.
 *    - تایید مجدد انتقال حل‌شده (چه تایید قبلی سرپرست و چه رفع انسداد مدیر) با خطا رد می‌شود.
 */
export function validateTeamTransferAcknowledgmentPatch(
  user: User,
  project: Project,
  patchTeamTransfers: any,
  userTeamId?: string
): void {
  if (!Array.isArray(patchTeamTransfers)) {
    throw new PermanentError('دسترسی غیرمجاز: فیلد teamTransfers باید آرایه معتبر باشد.');
  }

  const existingTransfers = project.teamTransfers || [];
  if (existingTransfers.length === 0) {
    throw new PermanentError('این پروژه سابقه‌ای از انتقال اکیپ ندارد.');
  }

  const latestTransfer = existingTransfers[existingTransfers.length - 1];
  if (latestTransfer.receivingLeadConfirmed) {
    throw new PermanentError('این انتقال قبلاً توسط سرپرست اکیپ تایید شده است.');
  }
  if (isTransferResolved(latestTransfer)) {
    throw new PermanentError('این انتقال قبلاً توسط مدیر ارشد QC رفع انسداد شده است.');
  }

  // طول آرایه انتقال‌ها نباید تغییر کند (حذف، الصاق یا جابه‌جایی ممنوع است)
  if (patchTeamTransfers.length !== existingTransfers.length) {
    throw new PermanentError('دسترسی غیرمجاز: تغییر تعداد یا حذف و اضافه رکوردهای انتقال مجاز نیست.');
  }

  // سوابق قبلی انتقال باید 100٪ بدون کوچک‌ترین تغییری حفظ شده باشند
  for (let i = 0; i < existingTransfers.length - 1; i++) {
    if (JSON.stringify(patchTeamTransfers[i]) !== JSON.stringify(existingTransfers[i])) {
      throw new PermanentError('دسترسی غیرمجاز: سوابق قبلی انتقال غیرقابل تغییر هستند.');
    }
  }

  // آخرین رکورد (انتقال جاری): تمام فیلدهای اصلی باید دست‌نخورده باقی بمانند
  const patchLatest = patchTeamTransfers[patchTeamTransfers.length - 1];
  if (!patchLatest || typeof patchLatest !== 'object') {
    throw new PermanentError('دسترسی غیرمجاز: ساختار رکورد تایید انتقال نامعتبر است.');
  }

  if (
    patchLatest.id !== latestTransfer.id ||
    patchLatest.fromTeamId !== latestTransfer.fromTeamId ||
    patchLatest.fromTeamName !== latestTransfer.fromTeamName ||
    patchLatest.toTeamId !== latestTransfer.toTeamId ||
    patchLatest.toTeamName !== latestTransfer.toTeamName ||
    patchLatest.transferredAt !== latestTransfer.transferredAt ||
    patchLatest.transferredByUserId !== latestTransfer.transferredByUserId ||
    patchLatest.transferredByUserName !== latestTransfer.transferredByUserName ||
    patchLatest.reason !== latestTransfer.reason ||
    patchLatest.notes !== latestTransfer.notes ||
    patchLatest.transferredWorkloadHours !== latestTransfer.transferredWorkloadHours ||
    JSON.stringify(patchLatest.handoverInventory) !== JSON.stringify(latestTransfer.handoverInventory)
  ) {
    throw new PermanentError(
      'دسترسی غیرمجاز: دستکاری مشخصات، دلیل یا اقلام صورت‌جلسه انتقال مجاز نیست.'
    );
  }

  const isOverrideAttempt = patchLatest.isManagerOverride === true;

  if (isOverrideAttempt) {
    // مسیر 2: رفع انسداد مدیریتی مدیر QC
    if (user.role !== 'QC_MANAGER') {
      throw new PermanentError('دسترسی غیرمجاز: رفع انسداد مدیریتی انتقال منحصراً در صلاحیت مدیر ارشد QC است.');
    }

    if (patchLatest.receivingLeadConfirmed !== false) {
      throw new PermanentError(
        'دسترسی غیرمجاز: رفع انسداد مدیریتی نباید به‌عنوان تایید دریافت فیزیکی سرپرست اکیپ ثبت شود. (وضعیت تایید فیزیکی باید صریحاً false باشد).'
      );
    }

    if (patchLatest.managerOverrideRole !== 'QC_MANAGER') {
      throw new PermanentError('دسترسی غیرمجاز: رول ثبت‌کننده رفع انسداد مدیریتی باید QC_MANAGER باشد.');
    }

    if (
      !patchLatest.managerOverrideByUserId ||
      typeof patchLatest.managerOverrideByUserId !== 'string' ||
      !patchLatest.managerOverrideByUserId.trim() ||
      patchLatest.managerOverrideByUserId !== user.id
    ) {
      throw new PermanentError('دسترسی غیرمجاز: شناسه مدیر ثبت‌کننده رفع انسداد باید با هویت جاری تطابق داشته باشد.');
    }

    if (
      !patchLatest.managerOverrideReason ||
      typeof patchLatest.managerOverrideReason !== 'string' ||
      !patchLatest.managerOverrideReason.trim()
    ) {
      throw new PermanentError('دسترسی غیرمجاز: ثبت دلیل مستند برای رفع انسداد مدیریتی انتقال الزامی است.');
    }

    if (
      !patchLatest.managerOverrideAt ||
      typeof patchLatest.managerOverrideAt !== 'string' ||
      !patchLatest.managerOverrideAt.trim() ||
      isNaN(Date.parse(patchLatest.managerOverrideAt))
    ) {
      throw new PermanentError('دسترسی غیرمجاز: زمان ثبت رفع انسداد مدیریتی الزامی و باید برچسب زمانی معتبر باشد.');
    }
  } else if (patchLatest.receivingLeadConfirmed === true) {
    if (patchLatest.isManagerOverride === true) {
      throw new PermanentError(
        'دسترسی غیرمجاز: تایید دریافت فیزیکی سرپرست اکیپ نمی‌تواند همزمان ادعای رفع انسداد مدیریتی داشته باشد.'
      );
    }
    // مسیر 1: تایید دریافت توسط سرپرست رسمی اکیپ مقصد
    const actualTeamId = userTeamId || user.teamId;
    const isStrictLead =
      user.id === project.leadTechnicianId &&
      user.role === 'LEAD_TECHNICIAN' &&
      Boolean(actualTeamId && actualTeamId === latestTransfer.toTeamId);

    if (!isStrictLead) {
      throw new PermanentError(
        'دسترسی غیرمجاز: صرفاً سرپرست اکیپ مقصد مجاز به تایید تحویل‌گیری پروژه است. این اقدام نیازمند تطابق هویت با سرپرست منتسب پروژه، رول LEAD_TECHNICIAN و عضویت در اکیپ مقصد است.'
      );
    }

    // ممانعت از تایید توسط اکیپ مبدا
    if (latestTransfer.fromTeamId && (latestTransfer.fromTeamId === actualTeamId || latestTransfer.fromTeamId === user.id)) {
      throw new PermanentError('دسترسی غیرمجاز: اکیپ مبدا اجازه تایید تحویل خروجی خود را ندارد.');
    }

    if (!patchLatest.receivingLeadConfirmedAt || typeof patchLatest.receivingLeadConfirmedAt !== 'string') {
      throw new PermanentError('دسترسی غیرمجاز: زمان تایید دریافت الزامی است.');
    }
    if (!patchLatest.receivingLeadConfirmedBy || typeof patchLatest.receivingLeadConfirmedBy !== 'string') {
      throw new PermanentError('دسترسی غیرمجاز: نام تاییدکننده الزامی است.');
    }
  } else {
    throw new PermanentError('دسترسی غیرمجاز: پچ ارسالی فاقد تایید معتبر سرپرست یا رفع انسداد مدیر است.');
  }
}

export function validateProjectPatchRoleGuards(
  user: User,
  project: Project,
  patch: Record<string, any>,
  userTeamId?: string,
  /** اکیپ‌های هماهنگ‌کننده (برای بقیه‌ی نقش‌ها خالی) — utils/coordinatorScope */
  scope?: { coordinatorTeamIds?: Set<string> | null }
): void {
  // هماهنگ‌کننده‌ی جدا فقط پروژه‌های اکیپ‌های خودش را تغییر می‌دهد و فقط به همان اکیپ‌ها می‌سپارد
  if (user.role === 'SCHEDULING_COORDINATOR' && scope?.coordinatorTeamIds) {
    const ids = scope.coordinatorTeamIds;
    if (!project.assignedTeamId || !ids.has(project.assignedTeamId)) {
      throw new PermanentError(COORDINATOR_SCOPE_MESSAGE);
    }
    if (patch.assignedTeamId !== undefined && (!patch.assignedTeamId || !ids.has(patch.assignedTeamId))) {
      throw new PermanentError(COORDINATOR_TEAM_REQUIRED_MESSAGE);
    }
  }
  // تأیید و رد QC: مدیر QC، و هماهنگ‌کننده برای پروژه‌های اکیپ‌های خودش (محدوده در بالا بررسی شد)
  const canReviewQc = user.role === 'QC_MANAGER' || user.role === 'SCHEDULING_COORDINATOR';

  // ممانعت از جعل یا دستکاری پرچم مهاجرت تاریخی
  if (patch.technicalHandover && 'isHistoricalMigration' in patch.technicalHandover) {
    throw new PermanentError('دسترسی غیرمجاز: امکان تغییر یا انتساب دستی پرچم سوابق تاریخی وجود ندارد.');
  }

  // 0. بررسی گیت تحویل رسمی واحد فنی (اعزام اکیپ و شروع کار در کارگاه منوط به تایید ورود کالا به انبار است)
  const isDispatching =
    Boolean(patch.status && ['EN_ROUTE', 'IN_PROGRESS'].includes(patch.status));

  if (isDispatching && !isHandoverGatePassed(project, patch)) {
    throw new PermanentError('دسترسی غیرمجاز: پروژه تا زمان ثبت و تأیید پیش‌نیاز تحویل و ورود کالا به انبار، قابل اعزام اکیپ و شروع کار نیست.');
  }

  // 0.1. گیت اجرایی انتقال اکیپ: تا زمان تایید تحویل توسط سرپرست اکیپ جدید یا رفع انسداد مدیر QC، شروع یا ادامه کار ممنوع است
  if (patch.status && ['EN_ROUTE', 'IN_PROGRESS'].includes(patch.status)) {
    const latestTransfer = getLatestTeamTransfer(project);
    if (latestTransfer && !isTransferResolved(latestTransfer)) {
      throw new PermanentError(
        'پروژه به اکیپ جدید منتقل شده و در انتظار تایید رسمی تحویل اقلام سر کارگاه است. تا پیش از ثبت تایید توسط سرپرست اکیپ، شروع یا ادامه کار مجاز نیست.'
      );
    }
  }

  // 0.2. گارد اختصاصی تایید تحویل انتقال اکیپ (Phase P2.2)
  if (patch.teamTransfers !== undefined) {
    validateTeamTransferAcknowledgmentPatch(user, project, patch.teamTransfers, userTeamId);
  }

  // 1. گارد امنیتی طرح اولیه نصب: طرح اولیه پس از قفل شدن یا زمان‌بندی تغییرناپذیر است (حتی برای مدیر QC)
  if (patch.originalPlan !== undefined) {
    const isLocked =
      Boolean(project.originalPlan?.lockedAt) ||
      project.status !== 'MEASUREMENT_PENDING';

    if (isLocked) {
      throw new PermanentError(
        'دسترسی غیرمجاز: طرح اولیه نصب (Original Plan) پس از قفل شدن یا زمان‌بندی تغییرناپذیر است. برای هرگونه اصلاح در مقادیر، باید از فرآیند رسمی بازنگری طرح (Plan Amendment) استفاده شود.'
      );
    }

    if (user.role !== 'QC_MANAGER') {
      throw new PermanentError('دسترسی غیرمجاز: تعریف طرح اولیه فقط در صلاحیت مدیر QC است.');
    }
  }

  // 2. گارد امنیتی بازنگری‌های طرح (planAmendments):
  if (patch.planAmendments !== undefined) {
    if (!Array.isArray(patch.planAmendments)) {
      throw new PermanentError('دسترسی غیرمجاز: لیست بازنگری‌های طرح باید آرایه معتبر باشد.');
    }

    const existingAmendments = Array.isArray(project.planAmendments) ? project.planAmendments : [];
    const patchAmendments = patch.planAmendments;

    // الف) صیانت از تاریخچه: هیچ اصلاحیه نهایی‌شده‌ای (APPROVED یا REJECTED) قابل حذف نیست (حتی توسط مدیر QC)
    for (const oldAmend of existingAmendments) {
      const match = patchAmendments.find((a) => a.id === oldAmend.id);

      if (!match && (oldAmend.status === 'APPROVED' || oldAmend.status === 'REJECTED')) {
        throw new PermanentError('دسترسی غیرمجاز: حذف سوابق اصلاحیه‌های نهایی‌شده طرح امکان‌پذیر نیست.');
      }

      // ب) صیانت از تغییرناپذیری مقادیر اصلاحیه‌های تاییدشده قبلی (برای همه کاربران از جمله مدیر QC)
      if (match && oldAmend.status === 'APPROVED') {
        if (match.status !== 'APPROVED') {
          throw new PermanentError('دسترسی غیرمجاز: وضعیت اصلاحیه تاییدشده قابل بازگشت نیست.');
        }
        if (
          match.activityId !== oldAmend.activityId ||
          Number(match.previousQuantity) !== Number(oldAmend.previousQuantity) ||
          Number(match.newQuantity) !== Number(oldAmend.newQuantity) ||
          match.reason !== oldAmend.reason ||
          match.requestedByUserId !== oldAmend.requestedByUserId ||
          match.requestedAt !== oldAmend.requestedAt ||
          match.reviewedByUserId !== oldAmend.reviewedByUserId ||
          match.reviewedAt !== oldAmend.reviewedAt
        ) {
          throw new PermanentError(
            'دسترسی غیرمجاز: اصلاحیه تاییدشده قبلی غیرقابل تغییر است. برای هرگونه تغییر در مقادیر، اصلاحیه جدید ثبت کنید.'
          );
        }
      }

      // ج) اصلاحیه ردشده قابل بازگشت نیست
      if (match && oldAmend.status === 'REJECTED' && match.status !== 'REJECTED') {
        throw new PermanentError(
          'دسترسی غیرمجاز: اصلاحیه ردشده قابل بازگشت یا تغییر وضعیت نیست. برای بازنگری باید اصلاحیه جدید ثبت شود.'
        );
      }
    }

    // د) بررسی تایید اصلاحیه جدید:
    // 1. فقط مدیر QC مجاز به تایید بازنگری است (تغییر وضعیت به APPROVED)
    // 2. اعتبارسنجی همزمانی: previousQuantity اصلاحیه در حال تایید باید دقیقاً با سقف موثر مصوب جاری تطبیق داشته باشد
    const existingApprovedIds = new Set(
      existingAmendments.filter((a) => a.status === 'APPROVED').map((a) => a.id)
    );

    for (const amend of patchAmendments) {
      if (amend.status === 'APPROVED' && !existingApprovedIds.has(amend.id)) {
        if (user.role !== 'QC_MANAGER') {
          throw new PermanentError(
            'دسترسی غیرمجاز: تایید بازنگری و تغییر سقف برنامه فقط در صلاحیت مدیر QC است.'
          );
        }

        const activities = getEffectiveProjectPlan(project as Project);
        const act = activities.find((a) => a.id === amend.activityId);
        if (act) {
          const { effectivePlannedQuantity } = getEffectivePlannedQuantity(act, existingAmendments);
          if (Number(amend.previousQuantity) !== Number(effectivePlannedQuantity)) {
            throw new PermanentError(
              `خطای همزمانی اصلاحیه: مقدار قبلی (${amend.previousQuantity} لت) با آخرین سقف مصوب جاری (${effectivePlannedQuantity} لت) مطابقت ندارد. این درخواست بر مبنای مقادیر منقضی‌شده ثبت گردیده است.`
            );
          }
        }
      }
    }
  }

  // 3. گارد کنترل کیفی نهایی و مدیریت عدم‌انطباق‌ها (Phase P3)
  // 3.1. تایید نهایی QC منحصراً در صلاحیت مدیر ارشد QC است و وجود هرگونه نقص بحرانی حل‌نشده مانع صدور تایید می‌شود
  if (patch.qcStatus === 'APPROVED') {
    if (user.role === 'TECHNICIAN' || user.role === 'LEAD_TECHNICIAN') {
      throw new PermanentError('دسترسی غیرمجاز: تکنسین فقط می‌تواند وضعیت QC را روی PENDING تنظیم کند.');
    }
    if (!canReviewQc) {
      throw new PermanentError('دسترسی غیرمجاز: تأیید نهایی کنترل کیفی (QC) فقط در صلاحیت مدیر QC است.');
    }
    if (hasUnresolvedCriticalDefects(project, patch.qcDefects)) {
      throw new PermanentError(
        'دسترسی غیرمجاز: پروژه دارای عدم‌انطباق یا نقص بحرانی (CRITICAL) حل‌نشده است. تا زمان رفع کامل نقص و تایید اصلاح، صدور تایید نهایی QC امکان‌پذیر نیست.'
      );
    }
  }

  // 3.2. صیانت از سوابق بازرسی‌های کنترل کیفیت (qcInspections)
  if (patch.qcInspections !== undefined) {
    if (!canReviewQc) {
      throw new PermanentError('دسترسی غیرمجاز: ثبت رسمی برگه بازرسی کنترل کیفی منحصراً در صلاحیت مدیر ارشد QC است.');
    }
    if (!Array.isArray(patch.qcInspections)) {
      throw new PermanentError('دسترسی غیرمجاز: سوابق بازرسی‌های QC باید به صورت آرایه معتبر باشد.');
    }
    const existingInspections = project.qcInspections || [];
    if (patch.qcInspections.length < existingInspections.length) {
      throw new PermanentError('دسترسی غیرمجاز: حذف سوابق بازرسی‌های قبلی QC امکان‌پذیر نیست.');
    }
    for (let i = 0; i < existingInspections.length; i++) {
      if (patch.qcInspections[i].id !== existingInspections[i].id) {
        throw new PermanentError('دسترسی غیرمجاز: سوابق بازرسی‌های قبلی QC غیرقابل تغییر و دستکاری هستند.');
      }
    }
  }

  // 3.3. گارد چرخه عمر عیوب و عدم‌انطباق‌ها (qcDefects)
  if (patch.qcDefects !== undefined) {
    if (!Array.isArray(patch.qcDefects)) {
      throw new PermanentError('دسترسی غیرمجاز: لیست عیوب کیفی باید آرایه معتبر باشد.');
    }
    const existingDefects = project.qcDefects || [];

    if (!canReviewQc) {
      // تکنسین‌ها و سایر نقش‌ها نمی‌توانند عیوب را حذف کنند
      if (patch.qcDefects.length < existingDefects.length) {
        throw new PermanentError('دسترسی غیرمجاز: حذف عیوب کیفی ثبت‌شده مجاز نیست.');
      }
      // تکنسین‌ها نمی‌توانند عیب جدید ثبت کنند (عیب‌گذاری رسمی منحصراً وظیفه QC است)
      if (patch.qcDefects.length > existingDefects.length) {
        throw new PermanentError('دسترسی غیرمجاز: ثبت رسمی نقص کیفی منحصراً در صلاحیت مدیر ارشد QC است.');
      }
      // تکنسین‌ها نمی‌توانند وضعیت را به VERIFIED تغییر دهند
      for (const d of patch.qcDefects as QCDefect[]) {
        const oldDefect = existingDefects.find((item) => item.id === d.id);
        if (d.status === 'VERIFIED' && oldDefect?.status !== 'VERIFIED') {
          throw new PermanentError('دسترسی غیرمجاز: تایید راستی‌آزمایی رفع نقص منحصراً در صلاحیت مدیر ارشد QC است.');
        }
      }
    }
  }

  // مدیر QC هیچ محدودیتی در فیلدها یا مسیر انتقال وضعیت ندارد
  if (user.role === 'QC_MANAGER') {
    return;
  }

  // نقش مسئول هماهنگی و زمان‌بندی (SCHEDULING_COORDINATOR)
  if (user.role === 'SCHEDULING_COORDINATOR') {
    // محدوده (اکیپ‌های خودش) در ابتدای همین تابع بررسی شد؛ QC و امتیاز پروژه‌های خودش با خودش است
    return;
  }

  // نقش مسئول اندازه‌گیری دوم (MEASUREMENT_LEAD)
  if (user.role === 'MEASUREMENT_LEAD') {
    const allowedLeadKeys = new Set(['secondMeasurementDetails', 'siteReadiness', 'notes', 'updatedAt']);
    for (const key of Object.keys(patch)) {
      if (!allowedLeadKeys.has(key)) {
        throw new PermanentError(`دسترسی غیرمجاز: مسئول اندازه‌گیری دوم اجازه تغییر فیلد «${key}» را ندارد.`);
      }
    }
    return;
  }

  // نقش انباردار و پیگیری تامین (WAREHOUSE)
  if (user.role === 'WAREHOUSE') {
    const allowedWarehouseKeys = new Set(['warehousePrep', 'technicalHandover', 'updatedAt']);
    for (const key of Object.keys(patch)) {
      if (!allowedWarehouseKeys.has(key)) {
        throw new PermanentError(`دسترسی غیرمجاز: مسئول انبار اجازه تغییر فیلد «${key}» را ندارد.`);
      }
    }
    return;
  }

  // 1. بررسی تخصیص پروژه به کاربر یا اکیپ او
  const isDirectlyAssigned =
    project.leadTechnicianId === user.id ||
    (project.assignedTechnicianIds || []).includes(user.id);
  const isTeamAssigned =
    Boolean(userTeamId && project.assignedTeamId && userTeamId === project.assignedTeamId);

  if (!isDirectlyAssigned && !isTeamAssigned) {
    throw new PermanentError('دسترسی غیرمجاز: شما مسئول یا تکنسین تخصیص‌یافته به این پروژه نیستید.');
  }

  // 1.1. مراحل کار فقط با سرپرست همین پروژه است؛ تکنسین‌ها فقط تیکت و درخواست متریال دارند
  // (که در جدول‌های جدا ثبت می‌شوند و پروژه را تغییر نمی‌دهند). سرور هم همین را اجرا می‌کند (مایگریشن ۰۲۷).
  if ((user.role === 'TECHNICIAN' || user.role === 'LEAD_TECHNICIAN') && !isProjectSupervisor(user, project)) {
    throw new PermanentError(CREW_LEAD_ONLY_MESSAGE);
  }

  // 2. بررسی کلیدهای مجاز برای تکنسین
  for (const key of Object.keys(patch)) {
    if (key === 'teamTransfers') {
      // این کلید قبلاً به طور سخت‌گیرانه در validateTeamTransferAcknowledgmentPatch اعتبارسنجی شده است
      continue;
    }
    if (!ALLOWED_TECHNICIAN_PATCH_KEYS.has(key)) {
      throw new PermanentError(`دسترسی غیرمجاز: تکنسین اجازه تغییر فیلد «${key}» را ندارد.`);
    }
  }

  // 3. بررسی وضعیت QC: فقط PENDING و فقط همراه با status = COMPLETED
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

  // 4. بررسی مسیرهای مجاز انتقال وضعیت
  if (patch.status && patch.status !== project.status) {
    if (!isValidStatusTransition(project.status, patch.status)) {
      throw new PermanentError(
        `انتقال وضعیت از «${project.status}» به «${patch.status}» برای تکنسین مجاز نیست.`
      );
    }
  }

  // 5. بررسی تغییرات stuckIncidents: تکنسین فقط می‌تواند دقیقاً یک رویداد جدید با resolutionStatus = 'OPEN' الصاق کند
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

  // 6. بررسی dailyLogs: فقط الحاق مجاز است (append-only) و توسط کاربر جاری
  if (patch.dailyLogs !== undefined) {
    if (!Array.isArray(patch.dailyLogs)) {
      throw new PermanentError('دسترسی غیرمجاز: لاگ روزانه باید آرایه باشد.');
    }
    const currentLogs = Array.isArray(project.dailyLogs) ? project.dailyLogs : [];
    const newLogs = patch.dailyLogs;

    const logsUnchanged = JSON.stringify(newLogs) === JSON.stringify(currentLogs);
    if (!logsUnchanged && newLogs.length !== currentLogs.length + 1) {
      throw new PermanentError('دسترسی غیرمجاز: تکنسین فقط می‌تواند لاگ روزانه جدید الصاق کند.');
    }

    if (!logsUnchanged) {
      for (let i = 0; i < currentLogs.length; i++) {
        if (JSON.stringify(currentLogs[i]) !== JSON.stringify(newLogs[i])) {
          throw new PermanentError('دسترسی غیرمجاز: ویرایش لاگ‌های روزانه قبلی مجاز نیست.');
        }
      }

      const lastLog = newLogs[newLogs.length - 1];
      if (!lastLog || lastLog.byUserId !== user.id) {
        throw new PermanentError('دسترسی غیرمجاز: ثبت لاگ روزانه فقط با هویت خودتان مجاز است.');
      }

      if (lastLog.supervisorConfirmed === true) {
        const isCallerLead =
          user.role === 'LEAD_TECHNICIAN' ||
          project.leadTechnicianId === user.id;

        if (!isCallerLead) {
          throw new PermanentError(
            'دسترسی غیرمجاز: تایید گزارش روزانه منحصراً در صلاحیت سرپرست اکیپ یا مدیر QC است.'
          );
        }
      }
    }
  }

  // 7. بررسی workSessions: الحاق جلسه جدید (با هویت خود کاربر) یا بستن جلسه‌ی باز آخر
  if (patch.workSessions !== undefined) {
    if (!Array.isArray(patch.workSessions)) {
      throw new PermanentError('دسترسی غیرمجاز: جلسات کاری باید آرایه باشد.');
    }
    const currentSessions = Array.isArray(project.workSessions) ? project.workSessions : [];
    const newSessions = patch.workSessions;

    if (JSON.stringify(newSessions) === JSON.stringify(currentSessions)) {
      // بدون تغییر
    } else if (newSessions.length === currentSessions.length && currentSessions.length > 0) {
      // بستن آخرین جلسه باز
      for (let i = 0; i < currentSessions.length - 1; i++) {
        if (JSON.stringify(currentSessions[i]) !== JSON.stringify(newSessions[i])) {
          throw new PermanentError('دسترسی غیرمجاز: جلسات کاری قبلی قابل ویرایش نیستند.');
        }
      }

      const lastCurrent = currentSessions[currentSessions.length - 1];
      const lastNew = newSessions[newSessions.length - 1];

      // هر عضو تخصیص‌یافته‌ی اکیپ می‌تواند جلسه‌ی باز را ببندد (مثلاً سرپرست جلسه‌ی کمک‌نصاب را)
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
  ticket: Partial<Ticket>,
  userTeamId?: string,
  scope?: { coordinatorTeamIds?: Set<string> | null }
): void {
  if (user.role === 'QC_MANAGER') {
    return;
  }

  // مسئول انبار مجاز به تغییر و تعیین وضعیت تیکت‌های فوری و قطعات است
  if (user.role === 'WAREHOUSE') {
    return;
  }

  // هماهنگ‌کننده تیکت‌های پروژه‌های اکیپ‌های خودش را کامل رسیدگی می‌کند (تا حل‌شده)
  if (user.role === 'SCHEDULING_COORDINATOR') {
    if (scope?.coordinatorTeamIds && (!project?.assignedTeamId || !scope.coordinatorTeamIds.has(project.assignedTeamId))) {
      throw new PermanentError(COORDINATOR_SCOPE_MESSAGE);
    }
    return;
  }

  // 1. بررسی تخصیص پروژه به کاربر یا اکیپ او
  if (project) {
    const isAssigned =
      project.leadTechnicianId === user.id ||
      (project.assignedTechnicianIds || []).includes(user.id) ||
      Boolean(userTeamId && project.assignedTeamId && userTeamId === project.assignedTeamId);
    if (!isAssigned) {
      throw new PermanentError(
        'دسترسی غیرمجاز: شما تنها مجاز به ثبت تیکت روی پروژه‌های تخصیص‌یافته به خودتان هستید.'
      );
    }
  }

  // 2. تکنسین اجازه حل کردن تیکت را ندارد
  if (ticket.status === 'RESOLVED') {
    throw new PermanentError(
      'دسترسی غیرمجاز: تنها مدیر ارشد QC می‌تواند وضعیت تیکت را به حل‌شده (RESOLVED) تغییر دهد.'
    );
  }
}

/**
 * گارد امنیتی حذف پروژه: منحصراً در اختیار مدیرعامل (CEO)
 */
export function validateProjectDeleteRoleGuards(user: User): void {
  if (!user || (user.role !== 'CEO' && user.role !== 'QC_MANAGER') || !user.active) {
    throw new PermanentError('دسترسی غیرمجاز: منحصراً مدیریت (مدیرعامل یا مدیر اپ و QC) مجاز به حذف کامل پروژه است.');
  }
}

/**
 * گارد امنیتی مشاهده شناسنامه رسمی و داشبورد جامع مدیر کل: منحصراً در اختیار مدیرعامل (CEO)
 */
export function validateCeoRegistryAccess(user: User): boolean {
  return Boolean(user && user.role === 'CEO' && user.active);
}

