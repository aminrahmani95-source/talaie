// ==============================================================================
// گالری طلایی | منطق انتقال رسمی پروژه بین اکیپ‌ها و صورت‌جلسه تحویل (فاز P2.2)
// قوانین:
// 1. انتقال پروژه صرفاً در صلاحیت مدیر QC و مسئول هماهنگی و زمان‌بندی است.
// 2. سرپرست اکیپ اجازه انتقال پروژه را ندارد و صرفاً تحویل‌گیری را تایید می‌کند.
// 3. پروژه همواره دارای 1 رکورد پایدار است؛ هیچ پروژه تکراری ساخته نمی‌شود.
// 4. اقلام باقیمانده کار محاسبه و در صورت‌جلسه تحویل ثبت می‌گردد.
// ==============================================================================

import { normalizeScheduleDays } from './multiDay';
import { Project, User, InstallationTeam, TeamTransferRecord, HandoverInventoryItem } from '../types';
import { calculateActivityProgress } from './planProgress';

export interface CreateTeamTransferParams {
  project: Project;
  fromTeamId?: string;
  fromTeamName?: string;
  targetTeam: InstallationTeam;
  targetTeamMembers?: User[];
  targetSupervisor?: User;
  currentUser: User;
  reason: string;
  notes?: string;
  newScheduledDate?: string;
  newEndDate?: string;
  newDurationHours?: number;
}

/**
 * بررسی صلاحیت کاربر جهت انتقال رسمی پروژه به اکیپ دیگر
 * سرپرست یا تکنسین هرگز مجاز به تصمیم‌گیری برای انتقال پروژه نیستند.
 */
export function canTransferProjectTeam(user: User): boolean {
  if (!user || !user.active) return false;
  return user.role === 'QC_MANAGER' || user.role === 'SCHEDULING_COORDINATOR';
}

/**
 * دریافت تاریخچه انتقال‌های رسمی یک پروژه
 */
export function getProjectTransferHistory(project: Project): TeamTransferRecord[] {
  return project.teamTransfers || [];
}

/**
 * دریافت آخرین رکورد انتقال پروژه (در صورت وجود)
 */
export function getLatestTeamTransfer(project: Project): TeamTransferRecord | undefined {
  const list = project.teamTransfers || [];
  return list.length > 0 ? list[list.length - 1] : undefined;
}

/**
 * بررسی اینکه آیا انتقال تایید یا رفع انسداد شده است (توسط سرپرست اکیپ مقصد یا مدیر QC).
 * قوانین اعتبارسنجی:
 * 1. سازگاری با سوابق تاریخی: در سوابق گذشته یا تاییدهای رسمی سرپرست، اگر receivingLeadConfirmed === true باشد
 *    و ادعای همزمان پرچم جعلی override وجود نداشته باشد، معتبر تلقی می‌شود.
 * 2. رفع انسداد مدیریتی جدید (Manager Override): صرفاً زمانی معتبر است که تمام شرایط زیر برقرار باشد:
 *    - isManagerOverride دقیقا true باشد
 *    - managerOverrideByUserId شناسه غیرخالی و معتبر کاربر باشد
 *    - managerOverrideRole دقیقا برابر 'QC_MANAGER' باشد
 *    - managerOverrideAt یک برچسب زمانی معتبر و قابل پارس باشد
 *    - managerOverrideReason رشته متنی معتبر و دارای حداقل یک کاراکتر غیرفاصله‌ای باشد
 *    - receivingLeadConfirmed صریحاً false باشد (عدم ادعای همزمان تایید فیزیکی سرپرست)
 */
export function isTransferResolved(transfer: TeamTransferRecord | undefined): boolean {
  if (!transfer) return true;

  // 1. سازگاری کامل با رکوردهای تاریخی و تایید رسمی سرپرست اکیپ مقصد
  if (transfer.receivingLeadConfirmed === true) {
    // ادعای همزمان پرچم override و تایید فیزیکی سرپرست دستکاری‌شده است و معتبر نیست
    if (transfer.isManagerOverride === true) {
      return false;
    }
    return true;
  }

  // 2. اعتبارسنجی دقیق متادیتای ممیزی در صورت رفع انسداد مدیریتی
  if (transfer.isManagerOverride === true) {
    // الف) شناسه کاربر مدیر ثبت‌کننده
    if (
      typeof transfer.managerOverrideByUserId !== 'string' ||
      !transfer.managerOverrideByUserId.trim()
    ) {
      return false;
    }

    // ب) نقش مدیر ثبت‌کننده باید دقیقاً QC_MANAGER باشد
    if (transfer.managerOverrideRole !== 'QC_MANAGER') {
      return false;
    }

    // ج) تاریخ ثبت باید یک برچسب زمانی معتبر و قابل پارس باشد
    if (
      typeof transfer.managerOverrideAt !== 'string' ||
      !transfer.managerOverrideAt.trim() ||
      isNaN(Date.parse(transfer.managerOverrideAt))
    ) {
      return false;
    }

    // د) دلیل مستند مدیریتی باید رشته متنی غیرخالی باشد
    if (
      typeof transfer.managerOverrideReason !== 'string' ||
      !transfer.managerOverrideReason.trim()
    ) {
      return false;
    }

    // ه) وضعیت تایید فیزیکی سرپرست اکیپ باید صریحاً false باشد
    if (transfer.receivingLeadConfirmed !== false) {
      return false;
    }

    return true;
  }

  return false;
}

/**
 * بررسی اینکه آیا پروژه دارای انتقال رسمی تاییدنشده و در انتظار است یا خیر
 */
export function hasPendingTransfer(project: Project): boolean {
  const latest = getLatestTeamTransfer(project);
  if (!latest) return false;
  return !isTransferResolved(latest);
}

/**
 * بررسی اینکه آیا پروژه به اکیپ فعلی منتقل شده و در انتظار تایید تحویل توسط سرپرست رسمی اکیپ جدید است.
 * الزامات اکید:
 * 1. user.id === project.leadTechnicianId
 * 2. user.role === 'LEAD_TECHNICIAN'
 * 3. اکیپ منتسب کاربر باید دقیقاً با latestTransfer.toTeamId مطابقت داشته باشد
 */
export function isPendingTransferAcknowledgment(
  project: Project,
  user: User,
  userTeamId?: string
): boolean {
  const latest = getLatestTeamTransfer(project);
  if (!latest) return false;
  if (isTransferResolved(latest)) return false;

  const actualTeamId = userTeamId || user.teamId;
  const isStrictLead =
    user.id === project.leadTechnicianId &&
    user.role === 'LEAD_TECHNICIAN' &&
    Boolean(actualTeamId && actualTeamId === latest.toTeamId);

  return isStrictLead;
}

/**
 * تولید پچ انتقال رسمی پروژه به اکیپ جدید با ثبت صورت‌جلسه اقلام باقیمانده
 */
export function createTeamTransferPayload(params: CreateTeamTransferParams): {
  patch: Partial<Project>;
  transferRecord: TeamTransferRecord;
} {
  const {
    project,
    fromTeamId = project.assignedTeamId || 'UNASSIGNED',
    fromTeamName = project.assignedTeamName || 'بدون اکیپ',
    targetTeam,
    targetTeamMembers = [],
    targetSupervisor,
    currentUser,
    reason,
    notes,
    newScheduledDate,
    newEndDate,
    newDurationHours,
  } = params;

  if (!canTransferProjectTeam(currentUser)) {
    throw new Error('دسترسی غیرمجاز: انتقال رسمی پروژه به اکیپ دیگر منحصراً در صلاحیت مدیر QC یا هماهنگ‌کننده زمان‌بندی است.');
  }

  if (!targetTeam || !targetTeam.id) {
    throw new Error('اکیپ مقصد نامعتبر است.');
  }

  if (targetTeam.id === project.assignedTeamId) {
    throw new Error('اکیپ مقصد نمی‌تواند همان اکیپ منتسب جاری پروژه باشد.');
  }

  if (!reason || !reason.trim()) {
    throw new Error('ثبت دلیل مستند برای انتقال رسمی پروژه به اکیپ دیگر الزامی است.');
  }

  // 1. محاسبه اقلام باقیمانده کار جهت درج در صورت‌جلسه تحویل به اکیپ جدید
  const progressList = calculateActivityProgress(project);
  const handoverInventory: HandoverInventoryItem[] = progressList.map((item) => ({
    activityId: item.activityId,
    activityTitle: item.title,
    remainingQuantity: Math.max(0, item.remainingQuantity),
    unit: item.unit,
  }));

  // 2. استخراج شناسه سرپرست و اعضای اکیپ جدید
  const supervisorId = targetSupervisor?.id || targetTeam.supervisorId || undefined;
  const assignedTechnicianIds = targetTeamMembers.length > 0
    ? targetTeamMembers.map((m) => m.id)
    : supervisorId
    ? [supervisorId]
    : [];

  // در صورتی که سرپرست در لیست تکنسین‌ها نباشد اضافه می‌شود
  if (supervisorId && !assignedTechnicianIds.includes(supervisorId)) {
    assignedTechnicianIds.unshift(supervisorId);
  }

  const transferId = 'trf-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
  const nowIso = new Date().toISOString();

  // 3. ایجاد رکورد رسمی صورت‌جلسه انتقال
  const transferRecord: TeamTransferRecord = {
    id: transferId,
    fromTeamId,
    fromTeamName,
    toTeamId: targetTeam.id,
    toTeamName: targetTeam.name,
    transferredAt: nowIso,
    transferredByUserId: currentUser.id,
    transferredByUserName: currentUser.name,
    reason: reason.trim(),
    notes: notes?.trim() || undefined,
    transferredWorkloadHours: newDurationHours ?? project.requiredDurationHours,
    handoverInventory,
    receivingLeadConfirmed: false,
  };

  const existingTransfers = project.teamTransfers || [];

  // 4. تولید پچ جامع پروژه با حفظ رکورد یکتای پروژه
  const patch: Partial<Project> = {
    assignedTeamId: targetTeam.id,
    assignedTeamName: targetTeam.name,
    leadTechnicianId: supervisorId,
    assignedTechnicianIds,
    teamTransfers: [...existingTransfers, transferRecord],
    updatedAt: nowIso,
  };

  // در صورت توقف قبلی (STUCK یا PAUSED)، انتقال اکیپ وضعیت را برای اکیپ جدید زمان‌بندی می‌کند
  if (project.status === 'STUCK' || project.status === 'PAUSED') {
    patch.status = 'SCHEDULED';
  }

  if (newScheduledDate) {
    patch.scheduledDate = newScheduledDate;
  }
  if (newEndDate !== undefined) {
    patch.endDate = newEndDate || undefined;
  }
  if (newDurationHours !== undefined) {
    patch.requiredDurationHours = newDurationHours;
  }
  // روزهای انتخابی (غیرپشت‌سرهم) فقط تا وقتی معتبرند که با تاریخ شروع و پایان جدید بخوانند
  if ((newScheduledDate || newEndDate !== undefined) && project.scheduledDays?.length) {
    const start = patch.scheduledDate || project.scheduledDate;
    const end = (newEndDate !== undefined ? newEndDate : project.endDate) || start;
    const kept = normalizeScheduleDays(project.scheduledDays).filter((d) => d >= start && d <= end);
    patch.scheduledDays = kept.length >= 2 && kept[0] === start && kept[kept.length - 1] === end ? kept : null;
  }

  return { patch, transferRecord };
}

/**
 * تایید دریافت فیزیکی و تحویل کار سر پروژه توسط سرپرست رسمی اکیپ مقصد (Strict Receiving Lead)
 */
export function createConfirmTransferReceiptPayload(
  project: Project,
  user: User,
  userTeamId?: string
): Partial<Project> {
  const transfers = project.teamTransfers || [];
  if (transfers.length === 0) {
    throw new Error('این پروژه سابقه‌ای از انتقال اکیپ ندارد.');
  }

  const latest = transfers[transfers.length - 1];
  if (latest.receivingLeadConfirmed) {
    throw new Error('این انتقال قبلاً توسط سرپرست اکیپ تایید شده است.');
  }
  if (isTransferResolved(latest)) {
    throw new Error('این انتقال قبلاً توسط مدیر ارشد QC رفع انسداد شده است.');
  }

  const actualTeamId = userTeamId || user.teamId;
  const isStrictLead =
    user.id === project.leadTechnicianId &&
    user.role === 'LEAD_TECHNICIAN' &&
    Boolean(actualTeamId && actualTeamId === latest.toTeamId);

  if (!isStrictLead) {
    throw new Error(
      'دسترسی غیرمجاز: صرفاً سرپرست اکیپ مقصد مجاز به تایید تحویل‌گیری پروژه است. این اقدام نیازمند تطابق هویت با سرپرست منتسب پروژه، رول LEAD_TECHNICIAN و عضویت در اکیپ مقصد است.'
    );
  }

  const nowIso = new Date().toISOString();

  const updatedLatest: TeamTransferRecord = {
    ...latest,
    receivingLeadConfirmed: true,
    receivingLeadConfirmedAt: nowIso,
    receivingLeadConfirmedBy: user.name,
    isManagerOverride: false,
  };

  const updatedTransfers = [...transfers.slice(0, transfers.length - 1), updatedLatest];

  return {
    teamTransfers: updatedTransfers,
    updatedAt: nowIso,
  };
}

export interface CreateManagerOverrideParams {
  project: Project;
  user: User;
  reason: string;
}

/**
 * رفع انسداد استثنایی انتقال توسط مدیر ارشد QC با ثبت لاگ ممیزی متمایز (Manager Override)
 */
export function createManagerOverrideTransferPayload(
  params: CreateManagerOverrideParams
): Partial<Project> {
  const { project, user, reason } = params;

  if (!user || user.role !== 'QC_MANAGER') {
    throw new Error('دسترسی غیرمجاز: رفع انسداد مدیریتی انتقال منحصراً در صلاحیت مدیر ارشد QC است.');
  }

  if (!reason || !reason.trim()) {
    throw new Error('ثبت دلیل مستند برای رفع انسداد مدیریتی انتقال الزامی است.');
  }

  const transfers = project.teamTransfers || [];
  if (transfers.length === 0) {
    throw new Error('این پروژه سابقه‌ای از انتقال اکیپ ندارد.');
  }

  const latest = transfers[transfers.length - 1];
  if (latest.receivingLeadConfirmed) {
    throw new Error('این انتقال قبلاً توسط سرپرست اکیپ تایید شده است.');
  }
  if (isTransferResolved(latest)) {
    throw new Error('این انتقال قبلاً توسط مدیر ارشد QC رفع انسداد شده است.');
  }

  const nowIso = new Date().toISOString();

  const updatedLatest: TeamTransferRecord = {
    ...latest,
    receivingLeadConfirmed: false, // صریحاً false ثبت می‌شود تا هرگز تایید فیزیکی سرپرست تلقی نگردد
    isManagerOverride: true,
    managerOverrideAt: nowIso,
    managerOverrideByUserId: user.id,
    managerOverrideByUserName: user.name,
    managerOverrideRole: 'QC_MANAGER',
    managerOverrideReason: reason.trim(),
  };

  const updatedTransfers = [...transfers.slice(0, transfers.length - 1), updatedLatest];

  return {
    teamTransfers: updatedTransfers,
    updatedAt: nowIso,
  };
}
