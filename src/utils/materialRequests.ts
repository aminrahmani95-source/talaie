// ==============================================================================
// گالری طلایی | منطق دامنه و فرآیند تامین و پیگیری کسری متریال (فاز P2.3)
// تفکیک قطعی از تیکت‌های کیفی و پشتیبانی از ارسال مرحله‌ای (Partial Dispatch)
// ==============================================================================

import {
  User,
  Project,
  MaterialRequest,
  MaterialRequestItem,
  MaterialDispatchRecord,
  MaterialDispatchItem,
  MaterialCategory,
  MaterialRequestReason,
  MaterialRequestStatus,
  MaterialUrgency,
} from '../types';
import { formatJalaliDateTime, toPersianDigits } from './jalali';
import { getDisplayName } from './technicianName';

export const MATERIAL_CATEGORY_LABELS: Record<MaterialCategory, string> = {
  FABRIC: 'پارچه و تور',
  HARDWARE: 'یراق‌آلات و پایه‌ها',
  PROFILE_TRACK: 'ریل و پروفیل',
  MOTOR: 'موتور و ملحقات برقی',
  ACCESSORY: 'ملحقات و اکسسوری',
  OTHER: 'سایر اقلام مصرفی',
};

export const MATERIAL_REASON_LABELS: Record<MaterialRequestReason, string> = {
  SHORTAGE: 'کسری اولیه متراژ یا تعداد',
  DEFECT_DAMAGE: 'آسیب‌دیدگی یا نقص قطعه سر کارگاه',
  INCORRECT_SPEC: 'مغایرت با ابعاد یا مشخصات فنی',
  ADDITIONAL_CLIENT_REQUEST: 'درخواست اضافه توسط کارفرما',
};

export const MATERIAL_STATUS_LABELS: Record<MaterialRequestStatus, string> = {
  SUBMITTED: 'ثبت شده — در انتظار بررسی',
  IN_PROCUREMENT: 'در حال تامین در انبار/کارگاه',
  PARTIALLY_DISPATCHED: 'ارسال جزئی (بخشی از اقلام)',
  DISPATCHED: 'ارسال کامل تمام اقلام',
  DELIVERED_CONFIRMED: 'تحویل قطعی سر کارگاه',
  REJECTED: 'رد شده توسط دفتر',
  CANCELLED: 'لغو شده',
};

export const MATERIAL_STATUS_COLORS: Record<MaterialRequestStatus, { bg: string; text: string; border: string }> = {
  SUBMITTED: {
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    text: 'text-amber-700 dark:text-amber-400',
    border: 'border-amber-200 dark:border-amber-800/50',
  },
  IN_PROCUREMENT: {
    bg: 'bg-blue-50 dark:bg-blue-950/40',
    text: 'text-blue-700 dark:text-blue-400',
    border: 'border-blue-200 dark:border-blue-800/50',
  },
  PARTIALLY_DISPATCHED: {
    bg: 'bg-indigo-50 dark:bg-indigo-950/40',
    text: 'text-indigo-700 dark:text-indigo-400',
    border: 'border-indigo-200 dark:border-indigo-800/50',
  },
  DISPATCHED: {
    bg: 'bg-purple-50 dark:bg-purple-950/40',
    text: 'text-purple-700 dark:text-purple-400',
    border: 'border-purple-200 dark:border-purple-800/50',
  },
  DELIVERED_CONFIRMED: {
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    text: 'text-emerald-700 dark:text-emerald-400',
    border: 'border-emerald-200 dark:border-emerald-800/50',
  },
  REJECTED: {
    bg: 'bg-rose-50 dark:bg-rose-950/40',
    text: 'text-rose-700 dark:text-rose-400',
    border: 'border-rose-200 dark:border-rose-800/50',
  },
  CANCELLED: {
    bg: 'bg-stone-100 dark:bg-stone-800/40',
    text: 'text-stone-500 dark:text-stone-400',
    border: 'border-stone-300 dark:border-stone-700',
  },
};

export const MATERIAL_URGENCY_LABELS: Record<MaterialUrgency, { label: string; badgeClass: string }> = {
  NORMAL: {
    label: 'عادی',
    badgeClass: 'bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300',
  },
  URGENT: {
    label: 'فوری',
    badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 font-bold',
  },
  CRITICAL_BLOCKING: {
    label: 'بحرانی (متوقف‌کننده کار)',
    badgeClass: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300 font-black animate-pulse',
  },
};

// پیشنهادات سریع اقلام پرمصرف جهت حداقل نیاز به تایپ تکنسین سر کارگاه
export const COMMON_MATERIAL_SUGGESTIONS: Array<{ title: string; category: MaterialCategory; unit: string }> = [
  { title: 'پایه سقفی شید رول', category: 'HARDWARE', unit: 'عدد' },
  { title: 'پایه دیواری تقویت‌شده (L)', category: 'HARDWARE', unit: 'عدد' },
  { title: 'براکت دوبل شید و تور', category: 'HARDWARE', unit: 'عدد' },
  { title: 'گیربکس دستی شید با زنجیر', category: 'HARDWARE', unit: 'عدد' },
  { title: 'زنجیر فلزی استیل یدک', category: 'HARDWARE', unit: 'متر' },
  { title: 'موتور ۳۵ سامفی برقی', category: 'MOTOR', unit: 'دستگاه' },
  { title: 'موتور ۴۵ کرکره / شید سنگین', category: 'MOTOR', unit: 'دستگاه' },
  { title: 'ریموت تک‌کاناله سامفی', category: 'MOTOR', unit: 'دستگاه' },
  { title: 'ریموت ۵ کاناله سامفی', category: 'MOTOR', unit: 'دستگاه' },
  { title: 'ریل آلومینیومی باریک', category: 'PROFILE_TRACK', unit: 'شاخه' },
  { title: 'ریل گریبر گری استاندارد', category: 'PROFILE_TRACK', unit: 'شاخه' },
  { title: 'نوار سربی پرده (وزنه پایین)', category: 'ACCESSORY', unit: 'متر' },
  { title: 'پیچ و رولپلاک پروانه‌ای کناف', category: 'HARDWARE', unit: 'بسته' },
  { title: 'پارچه شید بلک‌اوت (اضافه عرض)', category: 'FABRIC', unit: 'متر' },
];

export interface ItemBalanceResult {
  itemId: string;
  title: string;
  category: MaterialCategory;
  unit: string;
  requestedQty: number;
  totalDispatchedQty: number;
  totalReceivedQty: number;
  pendingReceiptQty: number;
  remainingToDispatch: number;
  remainingToReceive: number;
  isFullyDispatched: boolean;
  isFullyReceived: boolean;
}

/**
 * محاسبه دقیق ترازنامه اقلام درخواستی: مقدار درخواستی، ارسال‌شده، دریافت‌شده و مانده کسری
 */
export function calculateItemBalances(request: MaterialRequest): ItemBalanceResult[] {
  const dispatches = request.dispatches || [];

  return request.items.map((item) => {
    let totalDispatched = 0;
    let totalReceived = 0;

    for (const d of dispatches) {
      const match = d.items?.find((di) => di.itemId === item.id);
      if (match && typeof match.dispatchedQty === 'number' && match.dispatchedQty > 0) {
        totalDispatched += match.dispatchedQty;
        if (d.receivedAtSiteConfirmed) {
          totalReceived += match.dispatchedQty;
        }
      }
    }

    const pendingReceipt = Math.max(0, totalDispatched - totalReceived);
    const remainingToDispatch = Math.max(0, item.requestedQty - totalDispatched);
    const remainingToReceive = Math.max(0, item.requestedQty - totalReceived);

    return {
      itemId: item.id,
      title: item.title,
      category: item.category,
      unit: item.unit,
      requestedQty: item.requestedQty,
      totalDispatchedQty: totalDispatched,
      totalReceivedQty: totalReceived,
      pendingReceiptQty: pendingReceipt,
      remainingToDispatch,
      remainingToReceive,
      isFullyDispatched: totalDispatched >= item.requestedQty,
      isFullyReceived: totalReceived >= item.requestedQty,
    };
  });
}

/**
 * خلاصه وضعیت یک درخواست متریال
 */
export function getMaterialRequestSummary(request: MaterialRequest) {
  const balances = calculateItemBalances(request);
  const totalItems = balances.length;
  const fullyDispatchedCount = balances.filter((b) => b.isFullyDispatched).length;
  const fullyReceivedCount = balances.filter((b) => b.isFullyReceived).length;

  const isAllDispatched = totalItems > 0 && fullyDispatchedCount === totalItems;
  const isAllReceived = totalItems > 0 && fullyReceivedCount === totalItems;

  const pendingDispatches = (request.dispatches || []).filter(
    (d) => !d.receivedAtSiteConfirmed
  );

  return {
    totalItems,
    fullyDispatchedCount,
    fullyReceivedCount,
    isAllDispatched,
    isAllReceived,
    hasPendingReceipt: pendingDispatches.length > 0,
    pendingDispatches,
    balances,
  };
}

/**
 * مجوز ثبت درخواست متریال (تکنسین و سرپرست منتسب به پروژه یا مدیران فنی)
 */
export function canCreateMaterialRequest(user: User, project?: Project | null): boolean {
  if (!user || !user.active) return false;
  if (user.role === 'QC_MANAGER' || user.role === 'SCHEDULING_COORDINATOR') {
    return true;
  }
  if (user.role === 'LEAD_TECHNICIAN' || user.role === 'TECHNICIAN') {
    if (!project) return false;
    if (project.leadTechnicianId === user.id) return true;
    if (project.assignedTechnicianIds?.includes(user.id)) return true;
    if (project.assignedTeamId && user.teamId && user.teamId === project.assignedTeamId) return true;
    return false;
  }
  return false;
}

/**
 * مجوز مدیریت تامین و ارسال متریال (مدیر QC، هماهنگ‌کننده و مسئول انبار مجاز هستند)
 */
export function canManageMaterialProcurement(user: User): boolean {
  if (!user || !user.active) return false;
  return (
    user.role === 'QC_MANAGER' ||
    user.role === 'SCHEDULING_COORDINATOR' ||
    user.role === 'WAREHOUSE'
  );
}

export interface ConfirmReceiptOptions {
  isManagementOverride?: boolean;
  overrideReason?: string;
}

/**
 * مجوز تایید دریافت اقلام در محل کارگاه
 * اصل امنیتی Fail-Closed: تایید تحویل فیزیکی اقلام منحصراً متعلق به تکنسین‌های حاضر در کارگاه است.
 * مدیران تنها در صورت تعیین صریح isManagementOverride و ذکر دلیل معتبر (حداقل ۵ کاراکتر) مجاز به تایید هستند.
 */
export function canConfirmMaterialReceipt(
  user: User,
  project?: Project | null,
  options?: ConfirmReceiptOptions
): boolean {
  if (!user || !user.active) return false;

  // Management override: allowed for QC_MANAGER or SCHEDULING_COORDINATOR with explicit justification
  if (user.role === 'QC_MANAGER' || user.role === 'SCHEDULING_COORDINATOR') {
    if (options?.isManagementOverride) {
      const reason = options.overrideReason?.trim();
      return Boolean(reason && reason.length >= 5);
    }
  }

  // Without explicit management override, field receipt requires project assignment
  if (!project) return false;

  if (project.leadTechnicianId === user.id) return true;
  if (project.assignedTechnicianIds?.includes(user.id)) return true;
  if (project.assignedTeamId && user.teamId && user.teamId === project.assignedTeamId) return true;

  return false;
}

export interface CreateMaterialRequestInput {
  project: Project;
  user: User;
  category: MaterialCategory;
  reason: MaterialRequestReason;
  urgency: MaterialUrgency;
  items: Array<{
    title: string;
    category?: MaterialCategory;
    requestedQty: number;
    unit: string;
    notes?: string;
  }>;
  notes?: string;
}

/**
 * ایجاد پیلود استاندارد درخواست کسری متریال با اعتبارسنجی کامل
 */
export function createMaterialRequestPayload(input: CreateMaterialRequestInput): MaterialRequest {
  const { project, user, category, reason, urgency, items, notes } = input;

  if (!canCreateMaterialRequest(user, project)) {
    throw new Error('کاربر مجاز به ثبت درخواست متریال برای این پروژه نمی‌باشد.');
  }

  if (!items || items.length === 0) {
    throw new Error('حداقل یک قلم متریال درخواستی باید ثبت گردد.');
  }

  const validatedItems: MaterialRequestItem[] = items.map((it, idx) => {
    const title = it.title.trim();
    if (!title) {
      throw new Error(`عنوان ردیف ${idx + 1} نمی‌تواند خالی باشد.`);
    }
    const qty = Number(it.requestedQty);
    if (isNaN(qty) || qty <= 0) {
      throw new Error(`مقدار درخواستی برای «${title}» باید عددی مثبت و بزرگتر از صفر باشد.`);
    }
    const unit = (it.unit || 'عدد').trim();

    return {
      id: `mat-item-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
      title,
      category: it.category || category,
      requestedQty: qty,
      unit,
      notes: it.notes?.trim() || undefined,
    };
  });

  const now = new Date().toISOString();
  const reqId = `mat-req-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const userName = getDisplayName(user.name);

  return {
    id: reqId,
    projectId: project.id,
    projectCode: project.code,
    projectTitle: project.title,
    customerName: project.customerName,
    customerAddress: project.address,
    customerPhone: project.customerPhone,
    requestedByUserId: user.id,
    requestedByUserName: userName,
    assignedTeamId: project.assignedTeamId || user.teamId || undefined,
    assignedTeamName: project.assignedTeamName || undefined,
    requestedAt: now,
    category,
    reason,
    urgency,
    notes: notes?.trim() || undefined,
    items: validatedItems,
    dispatches: [],
    status: 'SUBMITTED',
    history: [
      {
        id: `mat-act-${Date.now()}-init`,
        timestamp: now,
        action: 'SUBMITTED',
        byUserId: user.id,
        byUserName: userName,
        note: `ثبت درخواست ${urgency === 'CRITICAL_BLOCKING' ? 'بحرانی' : 'متریال'} شامل ${toPersianDigits(validatedItems.length)} قلم کالا`,
      },
    ],
    createdAt: now,
    updatedAt: now,
  };
}

export interface DispatchInput {
  courierInfo: string;
  trackingCode?: string;
  notes?: string;
  items: Array<{
    itemId: string;
    dispatchedQty: number;
    serialOrBatch?: string;
  }>;
}

/**
 * ایجاد رکورد ارسال (کامل یا جزئی) متریال با اعتبارسنجی مقادیر و پیشگیری از بیش‌ارسال (Over-dispatch)
 */
export function createDispatchPayload(
  request: MaterialRequest,
  input: DispatchInput,
  user: User
): MaterialRequest {
  if (!canManageMaterialProcurement(user)) {
    throw new Error('فقط مدیر QC و هماهنگ‌کننده نصب مجاز به ثبت ارسال متریال هستند.');
  }

  if (request.status === 'DELIVERED_CONFIRMED' || request.status === 'CANCELLED' || request.status === 'REJECTED') {
    throw new Error(`امکان ارسال محموله برای درخواست با وضعیت «${MATERIAL_STATUS_LABELS[request.status] || request.status}» وجود ندارد.`);
  }

  const courierInfo = input.courierInfo.trim();
  if (!courierInfo) {
    throw new Error('اطلاعات پیک، راننده یا روش ارسال الزامی است.');
  }

  if (!input.items || input.items.length === 0) {
    throw new Error('حداقل یک قلم کالا برای ارسال باید انتخاب شود.');
  }

  const balances = calculateItemBalances(request);
  const dispatchItems: MaterialDispatchItem[] = [];

  for (const di of input.items) {
    const targetItem = request.items.find((i) => i.id === di.itemId);
    if (!targetItem) {
      throw new Error(`قلم کالا با شناسه «${di.itemId}» در این درخواست یافت نشد.`);
    }

    const balance = balances.find((b) => b.itemId === di.itemId);
    if (!balance) {
      throw new Error(`اطلاعات تراز قلم «${targetItem.title}» یافت نشد.`);
    }

    const qty = Number(di.dispatchedQty);
    if (isNaN(qty) || qty <= 0) {
      throw new Error(`مقدار ارسالی برای «${targetItem.title}» باید عددی مثبت و بزرگتر از صفر باشد.`);
    }

    if (qty > balance.remainingToDispatch) {
      throw new Error(
        `مقدار ارسالی برای «${targetItem.title}» (${toPersianDigits(qty)}) نمی‌تواند بیشتر از مانده تامین (${toPersianDigits(balance.remainingToDispatch)} ${targetItem.unit}) باشد.`
      );
    }

    dispatchItems.push({
      itemId: targetItem.id,
      title: targetItem.title,
      dispatchedQty: qty,
      unit: targetItem.unit,
      serialOrBatch: di.serialOrBatch?.trim() || undefined,
    });
  }

  if (dispatchItems.length === 0) {
    throw new Error('هیچ مقداری برای ارسال اقلام وارد نشده است.');
  }

  const now = new Date().toISOString();
  const dispatchId = `disp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const userName = getDisplayName(user.name);

  const newDispatch: MaterialDispatchRecord = {
    id: dispatchId,
    dispatchedAt: now,
    dispatchedByUserId: user.id,
    dispatchedByUserName: userName,
    courierInfo,
    trackingCode: input.trackingCode?.trim() || undefined,
    notes: input.notes?.trim() || undefined,
    items: dispatchItems,
    receivedAtSiteConfirmed: false,
  };

  const updatedDispatches = [...(request.dispatches || []), newDispatch];

  // محاسبه وضعیت جدید
  const tempRequest: MaterialRequest = {
    ...request,
    dispatches: updatedDispatches,
  };
  const summary = getMaterialRequestSummary(tempRequest);

  const newStatus: MaterialRequestStatus = summary.isAllDispatched
    ? 'DISPATCHED'
    : 'PARTIALLY_DISPATCHED';

  const historyLog = {
    id: `mat-act-${Date.now()}-disp`,
    timestamp: now,
    action: newStatus,
    byUserId: user.id,
    byUserName: userName,
    note: `ارسال محموله با پیک «${courierInfo}» شامل ${toPersianDigits(dispatchItems.length)} ردیف کالا`,
  };

  return {
    ...request,
    dispatches: updatedDispatches,
    status: newStatus,
    history: [...(request.history || []), historyLog],
    updatedAt: now,
  };
}

/**
 * ثبت تایید دریافت محموله ارسالی توسط سرپرست یا تکنسین سر کارگاه
 */
export function createConfirmReceiptPayload(
  request: MaterialRequest,
  dispatchId: string,
  user: User,
  project?: Project | null,
  options?: ConfirmReceiptOptions
): MaterialRequest {
  if (project && project.id !== request.projectId) {
    throw new Error('پروژه ارائه شده با شناسه پروژه درخواست متریال مغایرت دارد.');
  }

  if (!canConfirmMaterialReceipt(user, project, options)) {
    throw new Error('کاربر مجاز به تایید دریافت این محموله سر کارگاه نمی‌باشد.');
  }

  const dispatchIndex = (request.dispatches || []).findIndex((d) => d.id === dispatchId);
  if (dispatchIndex === -1) {
    throw new Error(`محموله ارسالی با شناسه «${dispatchId}» یافت نشد.`);
  }

  const targetDispatch = request.dispatches[dispatchIndex];
  if (targetDispatch.receivedAtSiteConfirmed) {
    return request; // قبلاً تایید شده (Idempotent)
  }

  const now = new Date().toISOString();
  const userName = getDisplayName(user.name);

  const confirmedDispatch: MaterialDispatchRecord = {
    ...targetDispatch,
    receivedAtSiteConfirmed: true,
    receivedAtSiteConfirmedAt: now,
    receivedAtSiteConfirmedByUserId: user.id,
    receivedAtSiteConfirmedByUserName: userName,
    isManagementOverride: options?.isManagementOverride ? true : undefined,
    overrideReason: options?.isManagementOverride ? options.overrideReason?.trim() : undefined,
  };

  const updatedDispatches = [...request.dispatches];
  updatedDispatches[dispatchIndex] = confirmedDispatch;

  const tempRequest: MaterialRequest = {
    ...request,
    dispatches: updatedDispatches,
  };
  const summary = getMaterialRequestSummary(tempRequest);

  // اگر تمام اقلام ارسال‌شده تایید دریافت شدند و همه اقلام کامل شدند
  const newStatus: MaterialRequestStatus = summary.isAllReceived
    ? 'DELIVERED_CONFIRMED'
    : request.status;

  const actionNote = options?.isManagementOverride
    ? `تایید دریافت محموله پیک «${targetDispatch.courierInfo}» سر کارگاه توسط مدیریت (${userName}) با ثبت مجوز مدیر: ${options.overrideReason?.trim()}`
    : `تایید دریافت محموله پیک «${targetDispatch.courierInfo}» سر کارگاه توسط ${userName}`;

  const historyLog = {
    id: `mat-act-${dispatchId}-recv`,
    timestamp: now,
    action: 'CONFIRMED_RECEIPT' as any,
    byUserId: user.id,
    byUserName: userName,
    note: actionNote,
  };

  return {
    ...request,
    dispatches: updatedDispatches,
    status: newStatus,
    history: [...(request.history || []), historyLog],
    updatedAt: now,
  };
}

/**
 * لغو رسمی درخواست متریال (جایگزین امن حذف فیزیکی جهت حفظ تاریخچه)
 */
export function cancelMaterialRequestPayload(
  request: MaterialRequest,
  user: User,
  reason: string
): MaterialRequest {
  if (!user || !user.active) {
    throw new Error('کاربر غیرفعال است.');
  }

  const isRequester = request.requestedByUserId === user.id;
  const isManager = canManageMaterialProcurement(user);
  if (!isRequester && !isManager) {
    throw new Error('فقط ثبت‌کننده درخواست یا مدیر مجاز به لغو درخواست متریال هستند.');
  }

  if (request.status === 'DELIVERED_CONFIRMED') {
    throw new Error('درخواست‌هایی که تحویل قطعی شده‌اند قابل لغو نیستند.');
  }

  if (request.status === 'CANCELLED') {
    return request;
  }

  const trimmedReason = reason.trim();
  if (!trimmedReason || trimmedReason.length < 3) {
    throw new Error('علت لغو درخواست باید حداقل شامل ۳ کاراکتر باشد.');
  }

  const now = new Date().toISOString();
  const userName = getDisplayName(user.name);

  const historyLog = {
    id: `mat-act-${Date.now()}-cancel`,
    timestamp: now,
    action: 'CANCELLED' as MaterialRequestStatus,
    byUserId: user.id,
    byUserName: userName,
    note: `لغو درخواست متریال: ${trimmedReason}`,
  };

  return {
    ...request,
    status: 'CANCELLED',
    history: [...(request.history || []), historyLog],
    updatedAt: now,
  };
}

/**
 * تغییر وضعیت دستی تامین توسط مسئول پیگیری (مثلاً به IN_PROCUREMENT یا REJECTED)
 */
export function updateMaterialRequestStatusPayload(
  request: MaterialRequest,
  newStatus: MaterialRequestStatus,
  user: User,
  note?: string,
  assignedFollowUpUser?: { id: string; name: string }
): MaterialRequest {
  if (!canManageMaterialProcurement(user)) {
    throw new Error('فقط مدیر QC و هماهنگ‌کننده مجاز به تغییر وضعیت تامین هستند.');
  }

  if (request.status === 'DELIVERED_CONFIRMED' && newStatus !== 'DELIVERED_CONFIRMED') {
    throw new Error('درخواست‌هایی که تحویل قطعی شده‌اند قابل تغییر وضعیت نیستند.');
  }

  if (newStatus === 'DELIVERED_CONFIRMED') {
    const summary = getMaterialRequestSummary(request);
    if (!summary.isAllReceived) {
      throw new Error('وضعیت «تحویل قطعی سر کارگاه» تنها پس از تایید فیزیکی دریافت تمامی اقلام توسط تکنسین سر کارگاه قابل ثبت است.');
    }
  }

  const now = new Date().toISOString();
  const userName = getDisplayName(user.name);

  const historyLog = {
    id: `mat-act-${Date.now()}-status`,
    timestamp: now,
    action: newStatus,
    byUserId: user.id,
    byUserName: userName,
    note: note || `تغییر وضعیت به ${MATERIAL_STATUS_LABELS[newStatus] || newStatus}`,
  };

  return {
    ...request,
    status: newStatus,
    assignedFollowUpUserId: assignedFollowUpUser?.id ?? request.assignedFollowUpUserId,
    assignedFollowUpUserName: assignedFollowUpUser?.name ?? request.assignedFollowUpUserName,
    history: [...(request.history || []), historyLog],
    updatedAt: now,
  };
}

/**
 * تولید متن برگه حواله خروج و رسید پیک جهت چاپ یا اشتراک‌گذاری در پیام‌رسان
 */
export function generatePrintableDispatchManifest(
  request: MaterialRequest,
  dispatch: MaterialDispatchRecord
): string {
  const lines: string[] = [];
  lines.push('========================================');
  lines.push('گالری طلایی | حواله تحویل و پیک متریال');
  lines.push('========================================');
  lines.push(`پروژه: ${request.projectTitle} (${request.projectCode})`);
  lines.push(`کارفرما: ${request.customerName || '—'}`);
  lines.push(`شماره تماس: ${request.customerPhone || '—'}`);
  lines.push(`آدرس کارگاه: ${request.customerAddress || '—'}`);
  lines.push('----------------------------------------');
  lines.push(`زمان صدور حواله: ${formatJalaliDateTime(dispatch.dispatchedAt)}`);
  lines.push(`پیک / ناوگان: ${dispatch.courierInfo}`);
  if (dispatch.trackingCode) {
    lines.push(`کد رهگیری: ${dispatch.trackingCode}`);
  }
  lines.push(`صادرکننده: ${dispatch.dispatchedByUserName}`);
  lines.push('----------------------------------------');
  lines.push('اقلام ارسالی:');
  dispatch.items.forEach((item, idx) => {
    lines.push(
      `  ${toPersianDigits(idx + 1)}. ${item.title} — ${toPersianDigits(item.dispatchedQty)} ${item.unit || ''}`
    );
  });
  if (dispatch.notes) {
    lines.push(`توضیحات: ${dispatch.notes}`);
  }
  lines.push('----------------------------------------');
  lines.push('امضای تحویل‌گیرنده سر کارگاه: _______________');
  lines.push('========================================');
  return lines.join('\n');
}
