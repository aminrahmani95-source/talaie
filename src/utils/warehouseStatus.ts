import type { Project, ProjectTechnicalHandover, User, WarehouseCounts } from '../types';
import { projectProductCounts } from './productCounts';
import { isHandoverGatePassed } from './roleGuards';
import { addDaysToKey } from './warehouseLists';
import { toPersianDigits } from './jalali';

/**
 * مدل واحد وضعیت انبار برای هر پروژه. همه‌ی داشبوردها (انبار، فرم مأموریت، تقویم مدیر،
 * مرکز کنترل، کارت سرپرست) از همین‌جا می‌خوانند تا یک پروژه همه‌جا یک وضعیت داشته باشد.
 *
 *  منتظر ورود ← (ورود ناقص) ← کالا در انبار ← بار آماده ← تحویل اکیپ
 */
export type WarehouseStage = 'NONE' | 'AWAITING' | 'PARTIAL' | 'IN_STOCK' | 'PACKED' | 'HANDED_OVER';

export const WAREHOUSE_STAGE_LABELS: Record<WarehouseStage, string> = {
  NONE: '',
  AWAITING: 'منتظر ورود کالا',
  PARTIAL: 'ورود ناقص',
  IN_STOCK: 'کالا در انبار',
  PACKED: 'بار آماده',
  HANDED_OVER: 'تحویل اکیپ شد',
};

/** کلاس‌های رنگی هر مرحله (روشن و تیره) */
export const WAREHOUSE_STAGE_TONES: Record<WarehouseStage, string> = {
  NONE: 'bg-canvas text-ink-3 border-line',
  AWAITING: 'bg-amber-500/15 text-amber-800 dark:text-amber-200 border-amber-500/40',
  PARTIAL: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/40',
  IN_STOCK: 'bg-sky-500/15 text-sky-800 dark:text-sky-200 border-sky-500/40',
  PACKED: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 border-emerald-500/40',
  HANDED_OVER: 'bg-violet-500/15 text-violet-800 dark:text-violet-200 border-violet-500/40',
};

const FINISHED = new Set(['COMPLETED', 'CANCELLED']);
const ON_SITE = new Set(['EN_ROUTE', 'IN_PROGRESS', 'PAUSED', 'STUCK']);

export function getWarehouseStage(p: Project): WarehouseStage {
  if (FINISHED.has(p.status)) return 'NONE';
  const prep = p.warehousePrep;
  if (prep?.handedOverAt) return 'HANDED_OVER';
  if (prep?.isPackedAndReady) return 'PACKED';
  // اکیپ سر کار است و بار جدایی بسته نشده: انبار کاری با این پروژه ندارد
  if (ON_SITE.has(p.status)) return 'NONE';
  if (isHandoverGatePassed(p)) return 'IN_STOCK';
  if (p.technicalHandover?.warehouseConfirmation?.isPartial) return 'PARTIAL';
  return 'AWAITING';
}

/** آیا کالای پروژه وارد انبار شده (گیت اعزام باز است)؟ */
export const isGoodsInWarehouse = (p: Project) => isHandoverGatePassed(p);

export const PRODUCT_KEYS: Array<{ key: keyof WarehouseCounts; label: string }> = [
  { key: 'shade', label: 'شید' },
  { key: 'rail', label: 'ریل' },
  { key: 'curtain', label: 'پرده' },
];

export interface CountDiff {
  key: keyof WarehouseCounts;
  label: string;
  expected: number;
  actual: number;
}

/** اختلاف دو شمارش (فقط محصولاتی که فرق دارند) */
export function diffCounts(expected: Partial<WarehouseCounts>, actual: Partial<WarehouseCounts>): CountDiff[] {
  return PRODUCT_KEYS.map(({ key, label }) => ({
    key,
    label,
    expected: Number(expected[key]) || 0,
    actual: Number(actual[key]) || 0,
  })).filter((d) => d.expected !== d.actual);
}

/** کسری‌های ورود کالا نسبت به تعداد فعلی سفارش (فقط کمبود، نه اضافه) */
export function receiptShortages(p: Project): CountDiff[] {
  const received = p.technicalHandover?.warehouseConfirmation?.receivedCounts;
  if (!received) return [];
  return diffCounts(projectProductCounts(p), received).filter((d) => d.actual < d.expected);
}

/** تعداد سفارش بعد از ثبت انبار تغییر کرده؟ (انبار باید دوباره بشمارد/ببندد) */
export function countsChangedSinceReceipt(p: Project): CountDiff[] {
  const wc = p.technicalHandover?.warehouseConfirmation;
  if (!wc?.expectedCounts || !(wc.confirmed || wc.isPartial)) return [];
  return diffCounts(wc.expectedCounts, projectProductCounts(p));
}

export function countsChangedSincePacking(p: Project): CountDiff[] {
  const prep = p.warehousePrep;
  if (!prep?.isPackedAndReady || !prep.expectedCounts) return [];
  return diffCounts(prep.expectedCounts, projectProductCounts(p));
}

/** «2 ریل کم» / «1 شید بیشتر» برای نمایش کوتاه */
export function formatCountDiffs(diffs: CountDiff[], mode: 'shortage' | 'change'): string {
  return diffs
    .map((d) =>
      mode === 'shortage'
        ? `${toPersianDigits(d.expected - d.actual)} ${d.label} کم`
        : `${d.label}: ${toPersianDigits(d.expected)} ← ${toPersianDigits(d.actual)}`
    )
    .join('، ');
}

export type WarehouseAlertLevel = 'urgent' | 'warn' | null;

/**
 * هشدار انبار برای داشبورد مدیر: کاری که تا 2 روز دیگر نصب دارد و کالایش نرسیده،
 * یا تعدادش بعد از ثبت انبار عوض شده.
 */
export function warehouseAlert(p: Project, todayKey: string): { level: WarehouseAlertLevel; text: string } {
  const stage = getWarehouseStage(p);
  if (stage === 'NONE' || stage === 'HANDED_OVER') return { level: null, text: '' };
  const soon = Boolean(p.scheduledDate && p.scheduledDate <= addDaysToKey(todayKey, 2));
  if ((stage === 'AWAITING' || stage === 'PARTIAL') && soon) {
    return {
      level: 'urgent',
      text: stage === 'PARTIAL' ? 'نصب نزدیک است و بار ناقص رسیده' : 'نصب نزدیک است و کالا هنوز به انبار نرسیده',
    };
  }
  const changed = countsChangedSinceReceipt(p);
  const changedPack = countsChangedSincePacking(p);
  if (changed.length || changedPack.length) {
    return { level: 'warn', text: 'تعداد سفارش بعد از ثبت انبار تغییر کرده' };
  }
  if (stage === 'IN_STOCK' && p.technicalHandover?.warehouseConfirmation?.shortageAccepted) {
    return { level: 'warn', text: 'کالا با کسری تأیید شده' };
  }
  return { level: null, text: '' };
}

// ---------------------------------------------------------------------------
// اقدام‌های انبار → patch پروژه (تابع خالص؛ App فقط commit می‌کند)
// ---------------------------------------------------------------------------

export type WarehouseAction =
  | {
      kind: 'RECEIPT';
      receivedCounts?: WarehouseCounts;
      shelfLocation?: string;
      notes?: string;
      /** بخشی از بار رسیده؛ گیت بسته می‌ماند */
      partial?: boolean;
      /** با وجود کسری تأیید شود (گیت باز) */
      acceptShortage?: boolean;
    }
  | { kind: 'REVOKE_RECEIPT' }
  | { kind: 'PACK'; notes?: string; packedCounts?: WarehouseCounts; toolsPacked?: boolean }
  | { kind: 'UNPACK' }
  | { kind: 'HAND_OVER'; toName?: string; via: 'WAREHOUSE' | 'LEAD' };

type Actor = Pick<User, 'id' | 'name'>;

export function buildWarehousePatch(
  project: Project,
  action: WarehouseAction,
  actor: Actor,
  actorDisplayName: string,
  nowIso: string
): Partial<Project> {
  const expectedCounts = projectProductCounts(project);
  const prevHandover: ProjectTechnicalHandover = project.technicalHandover || {
    isHandoverComplete: false,
    warehouseConfirmation: { confirmed: false },
  };

  const handoverPatch = (h: ProjectTechnicalHandover): ProjectTechnicalHandover => {
    const next = { ...h };
    // پرچم مهاجرت تاریخی هرگز از سمت کاربر ارسال نمی‌شود
    if (!project.technicalHandover?.isHistoricalMigration) delete (next as any).isHistoricalMigration;
    return next;
  };

  switch (action.kind) {
    case 'RECEIPT': {
      const confirmed = !action.partial;
      const updated: ProjectTechnicalHandover = handoverPatch({
        ...prevHandover,
        warehouseConfirmation: {
          confirmed,
          isPartial: action.partial ? true : undefined,
          shortageAccepted: confirmed && action.acceptShortage ? true : undefined,
          confirmedBy: actorDisplayName,
          confirmedByUserId: actor.id,
          confirmedAt: nowIso,
          shelfLocation: action.shelfLocation?.trim() || undefined,
          notes: action.notes?.trim() || undefined,
          receivedCounts: action.receivedCounts,
          expectedCounts,
        },
        isHandoverComplete: confirmed,
        officialHandoverDate: confirmed ? prevHandover.officialHandoverDate || nowIso : undefined,
        unlockedAt: confirmed ? prevHandover.unlockedAt || nowIso : undefined,
      });
      return { technicalHandover: updated, updatedAt: nowIso };
    }
    case 'REVOKE_RECEIPT': {
      const updated = handoverPatch({
        ...prevHandover,
        warehouseConfirmation: { confirmed: false },
        isHandoverComplete: false,
        officialHandoverDate: undefined,
        unlockedAt: undefined,
      });
      const patch: Partial<Project> = { technicalHandover: updated, updatedAt: nowIso };
      // بار بسته‌شده‌ی کالایی که «در انبار نیست» معنی ندارد
      if (project.warehousePrep?.isPackedAndReady) {
        patch.warehousePrep = { isPackedAndReady: false };
      }
      return patch;
    }
    case 'PACK':
      return {
        warehousePrep: {
          isPackedAndReady: true,
          packedAt: nowIso,
          packedByUserId: actor.id,
          packedByUserName: actorDisplayName,
          notes: action.notes?.trim() || '',
          packedCounts: action.packedCounts || expectedCounts,
          expectedCounts,
          toolsPacked: action.toolsPacked ?? true,
        },
        updatedAt: nowIso,
      };
    case 'UNPACK':
      return {
        warehousePrep: { isPackedAndReady: false, notes: project.warehousePrep?.notes || '' },
        updatedAt: nowIso,
      };
    case 'HAND_OVER':
      return {
        warehousePrep: {
          // تحویل بدون بسته‌بندی ثبت‌شده هم ممکن است (سرپرست بار را مستقیم برداشته)
          isPackedAndReady: true,
          ...(project.warehousePrep || {}),
          handedOverAt: nowIso,
          handedOverByName: actorDisplayName,
          handedOverToName: action.toName?.trim() || (action.via === 'LEAD' ? actorDisplayName : undefined),
          handedOverVia: action.via,
        },
        updatedAt: nowIso,
      };
  }
}
