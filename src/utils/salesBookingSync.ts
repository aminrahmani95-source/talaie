/**
 * همگام‌سازی رزروهای فروش (sales_bookings) با سرور Supabase
 *
 * پیش از این، رزروهای فروش فقط در localStorage همان دستگاه ذخیره می‌شدند؛ یعنی رزرو یک کارشناس
 * فروش روی گوشی خودش، در تقویم ظرفیت مدیر QC یا کارشناس دیگر دیده نمی‌شد و احتمال رزرو
 * هم‌زمان یک ظرفیت توسط دو نفر وجود داشت.
 *
 * طراحی:
 * - localStorage همچنان کش آفلاین و منبع خواندن هم‌زمان (sync) برای محاسبات ظرفیت است.
 * - هر تغییر محلی در یک صف «در انتظار ارسال» ثبت می‌شود و به محض اتصال به سرور ارسال می‌گردد.
 * - پس از ارسال، فهرست کامل از سرور دریافت و با موارد ارسال‌نشده ادغام می‌شود (سرور مرجع نهایی است).
 */
import type { SalesProjectBooking } from '../types';
import { SupabaseSyncService } from './supabase';
import {
  getStoredBookings,
  saveStoredBookings,
  getPendingSalesSync,
  savePendingSalesSync,
  SALES_BOOKINGS_DIRTY_EVENT,
} from './salesCapacity';

const TABLE = 'sales_bookings';
const POLL_INTERVAL_MS = 60_000;

interface SalesBookingRow {
  id: string;
  customer_name: string;
  customer_phone: string;
  address: string;
  laths_count: number;
  is_smart: boolean;
  notes: string | null;
  requested_date: string;
  jalali_date: string;
  allocation_mode: SalesProjectBooking['allocationMode'];
  allocated_teams: string[] | null;
  allocated_days_count: number;
  sales_rep_id: string;
  sales_rep_name: string;
  created_at: string;
  updated_at?: string;
  data?: Partial<SalesProjectBooking> | null;
}

export function bookingToRow(b: SalesProjectBooking): SalesBookingRow {
  return {
    id: b.id,
    customer_name: b.customerName,
    customer_phone: b.customerPhone || '',
    address: b.address || '',
    laths_count: b.lathsCount,
    is_smart: b.isSmart,
    notes: b.notes || '',
    requested_date: b.requestedDate,
    jalali_date: b.jalaliDate,
    allocation_mode: b.allocationMode,
    allocated_teams: b.allocatedTeams || [],
    allocated_days_count: b.allocatedDaysCount || 1,
    sales_rep_id: b.salesRepId,
    sales_rep_name: b.salesRepName,
    created_at: b.createdAt,
    updated_at: new Date().toISOString(),
    // نسخه کامل رکورد (شامل daysDetails و اطلاعات تبدیل به پروژه) برای سازگاری رو به جلو
    data: b,
  };
}

export function rowToBooking(row: SalesBookingRow): SalesProjectBooking {
  const fromColumns: SalesProjectBooking = {
    id: row.id,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    address: row.address,
    lathsCount: row.laths_count,
    isSmart: row.is_smart,
    notes: row.notes || '',
    requestedDate: row.requested_date,
    jalaliDate: row.jalali_date,
    allocationMode: row.allocation_mode,
    allocatedTeams: row.allocated_teams || [],
    allocatedDaysCount: row.allocated_days_count,
    salesRepId: row.sales_rep_id,
    salesRepName: row.sales_rep_name,
    createdAt: row.created_at,
  };
  // ستون‌های جدول مرجع هستند؛ data فقط فیلدهای تکمیلی را اضافه می‌کند
  return { ...(row.data || {}), ...fromColumns };
}

/** ادغام فهرست سرور با تغییرات محلیِ هنوز ارسال‌نشده */
export function mergeServerBookings(
  server: SalesProjectBooking[],
  local: SalesProjectBooking[],
  pending: { upserts: string[]; deletes: string[] }
): SalesProjectBooking[] {
  const deletes = new Set(pending.deletes);
  const upserts = new Set(pending.upserts);
  const byId = new Map<string, SalesProjectBooking>();
  for (const b of server) {
    if (!deletes.has(b.id)) byId.set(b.id, b);
  }
  for (const b of local) {
    if (upserts.has(b.id)) byId.set(b.id, b); // نسخه محلی ارسال‌نشده اولویت دارد
  }
  return [...byId.values()].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
}

let syncInFlight: Promise<void> | null = null;
let warnedUnavailable = false;

async function pushPending(): Promise<void> {
  const client = SupabaseSyncService.getClient();
  if (!client) return;
  const pending = getPendingSalesSync();
  if (pending.upserts.length === 0 && pending.deletes.length === 0) return;

  const local = getStoredBookings();
  const doneUpserts = new Set<string>();
  const doneDeletes = new Set<string>();

  const toUpsert = local.filter((b) => pending.upserts.includes(b.id));
  // رکوردهایی که در صف هستند ولی دیگر محلی وجود ندارند، از صف خارج می‌شوند
  pending.upserts.filter((id) => !toUpsert.some((b) => b.id === id)).forEach((id) => doneUpserts.add(id));

  if (toUpsert.length > 0) {
    const { error } = await client.from(TABLE).upsert(toUpsert.map(bookingToRow), { onConflict: 'id' });
    if (error) throw error;
    toUpsert.forEach((b) => doneUpserts.add(b.id));
  }

  for (const id of pending.deletes) {
    const { error } = await client.from(TABLE).delete().eq('id', id);
    if (error) throw error;
    doneDeletes.add(id);
  }

  // فقط مواردی که در فاصله ارسال دوباره تغییر نکرده‌اند از صف خارج می‌شوند
  const pushedSnapshot = new Map(toUpsert.map((b) => [b.id, JSON.stringify(b)]));
  const currentLocal = new Map(getStoredBookings().map((b) => [b.id, JSON.stringify(b)]));
  const latest = getPendingSalesSync();
  savePendingSalesSync({
    upserts: latest.upserts.filter((id) => {
      if (!doneUpserts.has(id)) return true;
      const pushed = pushedSnapshot.get(id);
      return pushed !== undefined && currentLocal.has(id) && currentLocal.get(id) !== pushed;
    }),
    deletes: latest.deletes.filter((id) => !doneDeletes.has(id)),
  });
}

async function pullFromServer(): Promise<void> {
  const client = SupabaseSyncService.getClient();
  if (!client) return;
  const { data, error } = await client.from(TABLE).select('*').order('created_at', { ascending: false });
  if (error) throw error;
  const server = (data as SalesBookingRow[] | null)?.map(rowToBooking) || [];
  const merged = mergeServerBookings(server, getStoredBookings(), getPendingSalesSync());
  const before = JSON.stringify(getStoredBookings());
  if (JSON.stringify(merged) !== before) {
    saveStoredBookings(merged);
  }
}

/** ارسال تغییرات معوق و دریافت آخرین وضعیت از سرور (ایمن برای فراخوانی مکرر) */
export function syncSalesBookings(): Promise<void> {
  if (syncInFlight) return syncInFlight;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return Promise.resolve();

  syncInFlight = (async () => {
    try {
      await pushPending();
      await pullFromServer();
      warnedUnavailable = false;
    } catch (err: any) {
      // اگر جدول هنوز در سرور ساخته نشده باشد (مایگریشن 018/023 اجرا نشده)، برنامه به حالت محلی ادامه می‌دهد
      if (!warnedUnavailable) {
        console.warn('[SalesBookingSync] همگام‌سازی رزروهای فروش ناموفق بود؛ داده‌ها محلی نگه داشته شدند.', err?.message || err);
        warnedUnavailable = true;
      }
    } finally {
      syncInFlight = null;
    }
  })();
  return syncInFlight;
}

/**
 * شروع همگام‌سازی خودکار: بلافاصله، هنگام تغییر محلی، بازگشت اینترنت، بازگشت به تب و هر ۶۰ ثانیه.
 * خروجی: تابع توقف.
 */
export function startSalesBookingSync(): () => void {
  if (typeof window === 'undefined') return () => {};

  const trigger = () => {
    void syncSalesBookings();
  };
  const onVisibility = () => {
    if (document.visibilityState === 'visible') trigger();
  };

  trigger();
  window.addEventListener(SALES_BOOKINGS_DIRTY_EVENT, trigger);
  window.addEventListener('online', trigger);
  document.addEventListener('visibilitychange', onVisibility);
  const interval = window.setInterval(trigger, POLL_INTERVAL_MS);

  // اشتراک لحظه‌ای (در صورت فعال بودن Realtime برای جدول در Supabase)
  let channel: ReturnType<NonNullable<ReturnType<typeof SupabaseSyncService.getClient>>['channel']> | null = null;
  try {
    const client = SupabaseSyncService.getClient();
    if (client) {
      channel = client
        .channel('talaie_sales_bookings_channel')
        .on('postgres_changes', { event: '*', schema: 'public', table: TABLE }, trigger)
        .subscribe();
    }
  } catch {
    channel = null;
  }

  return () => {
    window.removeEventListener(SALES_BOOKINGS_DIRTY_EVENT, trigger);
    window.removeEventListener('online', trigger);
    document.removeEventListener('visibilitychange', onVisibility);
    window.clearInterval(interval);
    if (channel) {
      try {
        SupabaseSyncService.getClient()?.removeChannel(channel);
      } catch {
        // ignore
      }
    }
  };
}
