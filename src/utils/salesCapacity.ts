import {
  SalesProjectBooking,
  DailyLathCapacity,
  BookingOption,
  SalesRepProfile,
  TeamDayAllocation,
  User,
} from '../types';
import { getUpcomingDays, formatToPersianDateString } from './jalali';
import { PermanentError } from './offlineQueue';
import { STORAGE_KEYS as APP_STORAGE_KEYS } from './storage';

const USERS_STORAGE_KEY = APP_STORAGE_KEYS.USERS;

// مقادیر پیش‌فرض (فقط وقتی مدیر QC در تنظیمات چیزی تعیین نکرده باشد)
export const MAX_LATHS_PER_TEAM = 20;
export const TOTAL_INSTALLATION_TEAMS = 2;
export const MAX_DAILY_COMPANY_LATHS = 40; // ۲ اکیپ × ۲۰ لت

export const INSTALLATION_TEAMS = [
  { id: 'TEAM_1', name: 'اکیپ نصب ۱', lead: '' },
  { id: 'TEAM_2', name: 'اکیپ نصب ۲', lead: '' },
];

// ============================================================================
// ظرفیت قابل تنظیم (تعداد اکیپ و لت هر اکیپ) — تعیین توسط مدیر QC در تنظیمات
// ============================================================================
export const SALES_CAPACITY_LIMITS = { minTeams: 1, maxTeams: 12, minLaths: 1, maxLaths: 200 } as const;
const CAPACITY_CONFIG_KEY = 'talaei_sales_capacity_config_v1';
export const SALES_CAPACITY_CHANGED_EVENT = 'talaei_sales_capacity_changed';

export interface SalesCapacityConfig {
  teamCount: number;
  lathsPerTeam: number;
  /** نام نمایشی اکیپ‌ها بر اساس شناسه (اختیاری؛ از فهرست اکیپ‌های واقعی) */
  teamNames?: Record<string, string>;
  /** روزهای کاری هفته به شماره Date.getDay() (۵ = جمعه). همان تنظیمی که برنامه‌ریزی نصب استفاده می‌کند */
  workingDays?: number[];
}

/** پیش‌فرض: همه روزها به جز جمعه — مطابق برنامه‌ریز نصب (capacity.ts) */
export const DEFAULT_WORKING_DAYS = [0, 1, 2, 3, 4, 6];

export interface ResolvedSalesCapacity {
  teamCount: number;
  lathsPerTeam: number;
  dailyTotal: number;
  teams: { id: string; name: string }[];
}

const PERSIAN_NUM = (n: number) => String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function normalizeSalesCapacityConfig(cfg?: Partial<SalesCapacityConfig> | null): SalesCapacityConfig {
  return {
    teamCount: clampInt(cfg?.teamCount, SALES_CAPACITY_LIMITS.minTeams, SALES_CAPACITY_LIMITS.maxTeams, TOTAL_INSTALLATION_TEAMS),
    lathsPerTeam: clampInt(cfg?.lathsPerTeam, SALES_CAPACITY_LIMITS.minLaths, SALES_CAPACITY_LIMITS.maxLaths, MAX_LATHS_PER_TEAM),
    teamNames: cfg?.teamNames || {},
    workingDays: normalizeWorkingDays(cfg?.workingDays),
  };
}

function normalizeWorkingDays(days: unknown): number[] {
  if (!Array.isArray(days)) return [...DEFAULT_WORKING_DAYS];
  const clean = Array.from(new Set(days.map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))).sort();
  return clean.length > 0 ? clean : [...DEFAULT_WORKING_DAYS];
}

function dateFromKey(dateKey: string): Date {
  const [gy, gm, gd] = dateKey.split('-').map(Number);
  return new Date(gy, gm - 1, gd, 12, 0, 0);
}

function keyFromDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** آیا در این تاریخ نصب انجام می‌شود؟ (جمعه و روزهای غیرکاری: خیر) */
export function isSalesWorkingDay(dateKey: string): boolean {
  const days = capacityConfig.workingDays || DEFAULT_WORKING_DAYS;
  return days.includes(dateFromKey(dateKey).getDay());
}

/**
 * چند روز کاری پشت‌سرهم از تاریخ شروع (روزهای تعطیل رد می‌شوند).
 * اگر خود تاریخ شروع تعطیل باشد، فهرست خالی برمی‌گردد.
 */
export function workingDaysFrom(startKey: string, count: number): string[] {
  if (!isSalesWorkingDay(startKey)) return [];
  const out: string[] = [];
  const d = dateFromKey(startKey);
  for (let guard = 0; out.length < count && guard < count * 7 + 7; guard++) {
    const key = keyFromDate(d);
    if (isSalesWorkingDay(key)) out.push(key);
    d.setDate(d.getDate() + 1);
  }
  return out;
}

/** وضعیت یک روز در تقویم فروش؛ «محدود» یعنی کمتر از ظرفیت یک اکیپ باقی مانده */
export type SalesDayStatus = 'CLOSED' | 'FULL' | 'LIMITED' | 'FREE';
export function getSalesDayStatus(day: DailyLathCapacity): SalesDayStatus {
  if (day.isClosed) return 'CLOSED';
  if (day.remainingLaths <= 0) return 'FULL';
  if (day.remainingLaths <= getSalesCapacity().lathsPerTeam) return 'LIMITED';
  return 'FREE';
}

function loadCapacityConfig(): SalesCapacityConfig {
  if (typeof window === 'undefined') return normalizeSalesCapacityConfig(null);
  try {
    const raw = localStorage.getItem(CAPACITY_CONFIG_KEY);
    return normalizeSalesCapacityConfig(raw ? JSON.parse(raw) : null);
  } catch {
    return normalizeSalesCapacityConfig(null);
  }
}

let capacityConfig: SalesCapacityConfig = loadCapacityConfig();

/** ظرفیت فعلی (تعداد اکیپ، لت هر اکیپ، سقف کل روزانه و فهرست اکیپ‌ها) */
export function getSalesCapacity(): ResolvedSalesCapacity {
  const { teamCount, lathsPerTeam, teamNames = {} } = capacityConfig;
  const teams = Array.from({ length: teamCount }, (_, i) => {
    const id = `TEAM_${i + 1}`;
    return { id, name: teamNames[id] || `اکیپ نصب ${PERSIAN_NUM(i + 1)}` };
  });
  return { teamCount, lathsPerTeam, dailyTotal: teamCount * lathsPerTeam, teams };
}

/** به‌روزرسانی ظرفیت (از تنظیمات سامانه). تقویم‌های باز بلافاصله دوباره محاسبه می‌شوند. */
export function setSalesCapacityConfig(cfg: Partial<SalesCapacityConfig>): void {
  const next = normalizeSalesCapacityConfig({ ...capacityConfig, ...cfg });
  const changed = JSON.stringify(next) !== JSON.stringify(capacityConfig);
  capacityConfig = next;
  if (!changed || typeof window === 'undefined') return;
  try {
    localStorage.setItem(CAPACITY_CONFIG_KEY, JSON.stringify(next));
  } catch {
    // ignore storage errors; in-memory config still applies
  }
  window.dispatchEvent(new Event(SALES_CAPACITY_CHANGED_EVENT));
  window.dispatchEvent(new Event('talaei_sales_bookings_updated'));
}

export const SALES_REPS_SEED: SalesRepProfile[] = [];

const STORAGE_KEY = 'talaei_sales_bookings_v1';
const PENDING_SYNC_KEY = 'talaei_sales_bookings_pending_sync_v1';

/** رویدادی که ماژول همگام‌سازی سرور به آن گوش می‌دهد تا تغییرات محلی را به Supabase ارسال کند. */
export const SALES_BOOKINGS_DIRTY_EVENT = 'talaei_sales_bookings_dirty';

export interface PendingSalesSync {
  upserts: string[];
  deletes: string[];
}

export function getPendingSalesSync(): PendingSalesSync {
  if (typeof window === 'undefined') return { upserts: [], deletes: [] };
  try {
    const raw = localStorage.getItem(PENDING_SYNC_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return {
      upserts: Array.isArray(parsed?.upserts) ? parsed.upserts : [],
      deletes: Array.isArray(parsed?.deletes) ? parsed.deletes : [],
    };
  } catch {
    return { upserts: [], deletes: [] };
  }
}

export function savePendingSalesSync(pending: PendingSalesSync): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(pending));
  } catch {
    // ignore quota errors; the next full sync will reconcile
  }
}

/** علامت‌گذاری یک رزرو برای ارسال به سرور (ایجاد/ویرایش یا حذف). */
function markSalesBookingForSync(bookingId: string, kind: 'upsert' | 'delete'): void {
  if (typeof window === 'undefined') return;
  const pending = getPendingSalesSync();
  const upserts = new Set(pending.upserts);
  const deletes = new Set(pending.deletes);
  if (kind === 'upsert') {
    upserts.add(bookingId);
    deletes.delete(bookingId);
  } else {
    upserts.delete(bookingId);
    deletes.add(bookingId);
  }
  savePendingSalesSync({ upserts: [...upserts], deletes: [...deletes] });
  window.dispatchEvent(new Event(SALES_BOOKINGS_DIRTY_EVENT));
}

function getSeedBookings(): SalesProjectBooking[] {
  // Empty seed bookings for clean production environment (no mock/test data)
  return [];
}

export function getStoredBookings(): SalesProjectBooking[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Automatically purge any dummy seed or test bookings
    const cleaned = (parsed as SalesProjectBooking[]).filter(
      (b) =>
        b &&
        b.id &&
        !b.id.startsWith('book-seed-') &&
        !b.id.startsWith('b-demo-') &&
        !b.id.startsWith('test-')
    );
    if (cleaned.length !== parsed.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
    }
    return cleaned;
  } catch (err) {
    console.error('Failed to read sales bookings from localStorage:', err);
    return [];
  }
}

export function saveStoredBookings(bookings: SalesProjectBooking[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bookings));
    window.dispatchEvent(new Event('talaei_sales_bookings_updated'));
  } catch (err) {
    console.error('Failed to save sales bookings:', err);
  }
}

/**
 * محاسبه وضعیت و ظرفیت لت‌های یک روز مشخص برای همه اکیپ‌ها
 * با امکان مستثنی کردن یک رزرو خاص جهت سناریوی ویرایش
 */
export function getDailyCapacity(
  dateKey: string,
  customBookings?: SalesProjectBooking[],
  excludeBookingId?: string
): DailyLathCapacity {
  const allBookings = customBookings || getStoredBookings();
  const bookings = excludeBookingId
    ? allBookings.filter((b) => b.id !== excludeBookingId)
    : allBookings;

  // فیلتر رزروهایی که این روز خاص را تحت پوشش قرار می‌دهند
  const dayBookings = bookings.filter((b) => {
    if (b.daysDetails && b.daysDetails.length > 0) {
      return b.daysDetails.some((d) => d.date === dateKey);
    }
    return b.requestedDate === dateKey;
  });

  // ظرفیت هر اکیپ طبق تنظیمات مدیر QC؛ روز تعطیل ظرفیت ندارد
  const cap = getSalesCapacity();
  const isClosed = !isSalesWorkingDay(dateKey);
  const teamAllocations: TeamDayAllocation[] = cap.teams.map((t) => ({
    teamId: t.id,
    teamName: t.name,
    bookedLaths: 0,
    maxLaths: isClosed ? 0 : cap.lathsPerTeam,
  }));

  dayBookings.forEach((booking) => {
    const dayDetail = booking.daysDetails?.find((d) => d.date === dateKey);
    if (dayDetail && dayDetail.teams && dayDetail.teams.length > 0) {
      dayDetail.teams.forEach((t) => {
        const teamAlloc = teamAllocations.find((item) => item.teamId === t.teamId);
        if (teamAlloc) {
          teamAlloc.bookedLaths = Math.min(cap.lathsPerTeam, teamAlloc.bookedLaths + t.laths);
        }
      });
      return;
    }

    // حالت پشتیبان برای داده‌های بدون daysDetails
    const teamsCount = Math.max(1, booking.allocatedTeams.length);
    const lathsPerTeam = Math.ceil(Math.min(booking.lathsCount, cap.dailyTotal) / teamsCount);

    booking.allocatedTeams.forEach((tId) => {
      const teamAlloc = teamAllocations.find((item) => item.teamId === tId);
      if (teamAlloc) {
        teamAlloc.bookedLaths = Math.min(cap.lathsPerTeam, teamAlloc.bookedLaths + lathsPerTeam);
      }
    });
  });

  const totalBookedLaths = teamAllocations.reduce((sum, t) => sum + t.bookedLaths, 0);
  const maxLaths = isClosed ? 0 : cap.dailyTotal;
  const remainingLaths = Math.max(0, maxLaths - totalBookedLaths);

  // استخراج نام روز جلالی
  const [gy, gm, gd] = dateKey.split('-').map(Number);
  const d = new Date(gy, gm - 1, gd);
  const jalaliDateStr = formatToPersianDateString(d);
  const dayName = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه', 'شنبه'][d.getDay()] || 'شنبه';

  return {
    date: dateKey,
    jalaliDate: jalaliDateStr,
    dayName,
    maxLaths,
    bookedLaths: totalBookedLaths,
    remainingLaths,
    teams: teamAllocations,
    bookingsCount: dayBookings.length,
    isClosed,
  };
}

/**
 * وضعیت ظرفیت روزانه از امروز تا ۹۰ روز آینده
 */
export function getThreeMonthCapacities(daysCount = 90): DailyLathCapacity[] {
  const upcomingDays = getUpcomingDays(daysCount);
  const bookings = getStoredBookings();

  return upcomingDays.slice(0, daysCount).map((day) => {
    return getDailyCapacity(day.dateKey, bookings);
  });
}

/**
 * پیشنهاد دو حالت رزرو شناور به کارشناس فروش بر اساس تعداد لت درخواستی
 * با امکان مستثنی کردن رزرو در حال ویرایش جهت جلوگیری از اشغال کاذب ظرفیت
 */
export function calculateBookingOptions(
  lathsCount: number,
  requestedDateKey: string,
  excludeBookingId?: string
): {
  spreadOption: BookingOption;
  consecutiveOption: BookingOption;
} {
  const allBookings = getStoredBookings();
  const bookings = excludeBookingId
    ? allBookings.filter((b) => b.id !== excludeBookingId)
    : allBookings;
  const currentCapacity = getDailyCapacity(requestedDateKey, bookings);


  // --------------------------------------------------------------------------
  // حالت اول: پخش بین چند اکیپ (SPREAD_DAILY)
  // اگر تعداد لت <= ۴۰ باشد: در ۱ روز انجام می‌شود.
  // اگر تعداد لت > ۴۰ باشد (مانند ۱۱۵ لت): بین اکیپ‌ها با سقف ۴۰ لت در روز پخش می‌شود.
  // --------------------------------------------------------------------------
  let spreadOption: BookingOption;

  const cap = getSalesCapacity();
  const dailyTotalFa = PERSIAN_NUM(cap.dailyTotal);

  if (lathsCount <= cap.dailyTotal) {
    const availableTeams = currentCapacity.teams.filter(
      (t) => t.maxLaths - t.bookedLaths > 0
    );

    let remainingToSpread = lathsCount;
    const spreadTeams: { teamId: string; teamName: string; laths: number }[] = [];

    for (const team of availableTeams) {
      if (remainingToSpread <= 0) break;
      const freeCapacity = team.maxLaths - team.bookedLaths;
      const allocated = Math.min(freeCapacity, remainingToSpread);
      spreadTeams.push({
        teamId: team.teamId,
        teamName: team.teamName,
        laths: allocated,
      });
      remainingToSpread -= allocated;
    }

    const isSpreadAvailable = currentCapacity.remainingLaths >= lathsCount && remainingToSpread === 0;

    spreadOption = {
      mode: 'SPREAD_DAILY',
      title: `پخش همزمان بین ${spreadTeams.length > 1 ? `${spreadTeams.length} اکیپ` : 'اکیپ نصب'} در ۱ روز`,
      description: isSpreadAvailable
        ? `انجام کامل کار در روز ${currentCapacity.dayName} با همکاری ${spreadTeams.map((t) => t.teamName).join(' و ')}`
        : `ظرفیت خالی این روز (${currentCapacity.remainingLaths} لت) کمتر از ${lathsCount} لت درخواستی است.`,
      isAvailable: isSpreadAvailable,
      requiredDays: 1,
      allocatedTeams: spreadTeams.map((t) => t.teamId),
      daysDetails: [
        {
          date: requestedDateKey,
          jalaliDate: currentCapacity.jalaliDate,
          teams: spreadTeams,
        },
      ],
    };
  } else {
    // سناریوی لت‌های بالا (> ۴۰ لت، مانند ۱۱۵ لت) با بسیج اکیپ‌ها و سقف روزانه ۴۰ لت
    const spreadDaysNeeded = Math.ceil(lathsCount / cap.dailyTotal);
    let remLaths = lathsCount;
    let spreadMultiFit = true;
    const spreadDaysDetails: BookingOption['daysDetails'] = [];
    const allAllocatedTeamsSet = new Set<string>();

    const spreadDayKeys = workingDaysFrom(requestedDateKey, spreadDaysNeeded);
    if (spreadDayKeys.length < spreadDaysNeeded) spreadMultiFit = false;
    for (let i = 0; i < spreadDayKeys.length; i++) {
      const checkDateKey = spreadDayKeys[i];
      const persianDateStr = formatToPersianDateString(dateFromKey(checkDateKey));
      const dayCap = getDailyCapacity(checkDateKey, bookings);

      const dayAllocatedTeams: { teamId: string; teamName: string; laths: number }[] = [];
      let neededForToday = Math.min(remLaths, cap.dailyTotal);

      if (dayCap.remainingLaths < neededForToday) {
        spreadMultiFit = false;
        break;
      }

      for (const t of dayCap.teams) {
        if (neededForToday <= 0) break;
        const freeInTeam = t.maxLaths - t.bookedLaths;
        if (freeInTeam > 0) {
          const alloc = Math.min(freeInTeam, neededForToday);
          dayAllocatedTeams.push({ teamId: t.teamId, teamName: t.teamName, laths: alloc });
          allAllocatedTeamsSet.add(t.teamId);
          neededForToday -= alloc;
        }
      }

      if (neededForToday > 0) {
        spreadMultiFit = false;
        break;
      }

      spreadDaysDetails.push({
        date: checkDateKey,
        jalaliDate: persianDateStr,
        teams: dayAllocatedTeams,
      });
      remLaths -= Math.min(remLaths, cap.dailyTotal);
    }

    spreadOption = {
      mode: 'SPREAD_DAILY',
      title: `بسیج همزمان اکیپ‌ها (سقف ${dailyTotalFa} لت/روز) در ${spreadDaysNeeded} روز`,
      description: spreadMultiFit
        ? `تحویل سریع ${lathsCount} لت ظرف ${spreadDaysNeeded} روز با حداکثر توان روزانه ${dailyTotalFa} لت`
        : `ظرفیت روزانه اکیپ‌ها در بازه ${spreadDaysNeeded} روزه پاسخگوی ${lathsCount} لت نیست.`,
      isAvailable: spreadMultiFit,
      requiredDays: spreadDaysNeeded,
      allocatedTeams: Array.from(allAllocatedTeamsSet),
      daysDetails: spreadDaysDetails,
    };
  }

  // --------------------------------------------------------------------------
  // حالت دوم: تخصیص یک اکیپ برای چند روز متوالی (CONSECUTIVE_DAYS)
  // تولید مستقیم روزهای متوالی از requestedDateKey تا هرگز به اشتباه خاموش نباشد!
  // --------------------------------------------------------------------------
  const consecutiveDaysNeeded = Math.ceil(lathsCount / cap.lathsPerTeam);
  let consecutiveAvailable = false;
  let chosenTeamId = 'TEAM_1';
  let chosenTeamName = cap.teams[0]?.name || 'اکیپ نصب';
  let consecutiveDaysDetails: BookingOption['daysDetails'] = [];

  for (const team of cap.teams) {
    let teamFit = true;
    const tempDetails: BookingOption['daysDetails'] = [];
    let remLaths = lathsCount;

    const teamDayKeys = workingDaysFrom(requestedDateKey, consecutiveDaysNeeded);
    if (teamDayKeys.length < consecutiveDaysNeeded) teamFit = false;
    for (let i = 0; teamFit && i < teamDayKeys.length; i++) {
      const checkDateKey = teamDayKeys[i];
      const persianDateStr = formatToPersianDateString(dateFromKey(checkDateKey));

      const dayCap = getDailyCapacity(checkDateKey, bookings);
      const teamAlloc = dayCap.teams.find((t) => t.teamId === team.id);
      const freeInTeam = teamAlloc ? teamAlloc.maxLaths - teamAlloc.bookedLaths : 0;
      const neededToday = Math.min(cap.lathsPerTeam, remLaths);

      if (freeInTeam < neededToday) {
        teamFit = false;
        break;
      }

      tempDetails.push({
        date: checkDateKey,
        jalaliDate: persianDateStr,
        teams: [{ teamId: team.id, teamName: team.name, laths: neededToday }],
      });
      remLaths -= neededToday;
    }

    if (teamFit && remLaths === 0) {
      consecutiveAvailable = true;
      chosenTeamId = team.id;
      chosenTeamName = team.name;
      consecutiveDaysDetails = tempDetails;
      break;
    }
  }

  const consecutiveOption: BookingOption = {
    mode: 'CONSECUTIVE_DAYS',
    title: `رزرو اختصاصی یک اکیپ در ${consecutiveDaysNeeded} روز متوالی`,
    description: consecutiveAvailable
      ? `اختصاص ${chosenTeamName} به مدت ${consecutiveDaysNeeded} روز کاری متوالی (روزانه تا ${PERSIAN_NUM(cap.lathsPerTeam)} لت)`
      : `امکان رزرو ${consecutiveDaysNeeded} روز متوالی با یک اکیپ در این تاریخ وجود ندارد.`,
    isAvailable: consecutiveAvailable,
    requiredDays: consecutiveDaysNeeded,
    allocatedTeams: [chosenTeamId],
    daysDetails: consecutiveDaysDetails,
  };

  if (!isSalesWorkingDay(requestedDateKey)) {
    const closedText = 'این روز تعطیل است و نصب انجام نمی‌شود؛ یک روز کاری انتخاب کنید.';
    spreadOption.isAvailable = false;
    spreadOption.description = closedText;
    consecutiveOption.isAvailable = false;
    consecutiveOption.description = closedText;
  }

  return { spreadOption, consecutiveOption };
}

/**
 * ثبت نهایی سفارش فروش و رزرو ظرفیت
 */
export function createSalesBooking(
  bookingInput: Omit<SalesProjectBooking, 'id' | 'createdAt'>
): SalesProjectBooking {
  const bookings = getStoredBookings();
  const id = `book-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const newBooking: SalesProjectBooking = {
    ...bookingInput,
    id,
    createdAt: new Date().toISOString(),
  };

  const updated = [newBooking, ...bookings];
  saveStoredBookings(updated);
  markSalesBookingForSync(newBooking.id, 'upsert');
  return newBooking;
}

/**
 * بررسی دسترسی ویرایش رزرو فروش:
 * ۱. مدیرعامل دسترسی کامل دارد.
 * ۲. کارشناس فروش فقط مجاز به ویرایش رزروهای ثبت‌شده توسط خودش می‌باشد.
 */
export function canEditSalesBooking(user: User, booking: SalesProjectBooking): boolean {
  if (!user || !user.active) return false;
  if (user.role === 'CEO' || user.role === 'QC_MANAGER') return true;
  if (user.role === 'SALES_REP') {
    // Ownership is decided by ID. Fuzzy name matching (substring) allowed one rep
    // to edit another rep's bookings when names overlapped (e.g. "علی" ⊂ "علی رضایی").
    if (booking.salesRepId) return booking.salesRepId === user.id;
    // Legacy bookings without an ID: exact (trimmed) name match only.
    return Boolean(booking.salesRepName && booking.salesRepName.trim() === user.name.trim());
  }
  return false;
}

/**
 * بررسی دسترسی حذف رزرو فروش:
 * منحصراً در اختیار مدیر اپ و QC (QC_MANAGER) می‌باشد.
 */
export function canDeleteSalesBooking(user: User): boolean {
  return Boolean(user && user.role === 'QC_MANAGER' && user.active);
}

/**
 * به‌روزرسانی اطلاعات پروژه یا تغییر تاریخ/تعداد لت‌های رزرو
 */
export function updateSalesBooking(
  bookingId: string,
  updates: Partial<Omit<SalesProjectBooking, 'id' | 'createdAt'>>,
  user?: User
): SalesProjectBooking {
  const bookings = getStoredBookings();
  const index = bookings.findIndex((b) => b.id === bookingId);
  if (index === -1) {
    throw new Error('رزرو مورد نظر یافت نشد.');
  }

  if (user && !canEditSalesBooking(user, bookings[index])) {
    throw new PermanentError('دسترسی غیرمجاز: کارشناس فروش فقط مجاز به ویرایش پروژه‌های ثبت‌شده توسط خود می‌باشد.');
  }

  const updatedBooking: SalesProjectBooking = {
    ...bookings[index],
    ...updates,
  };

  const updatedList = [...bookings];
  updatedList[index] = updatedBooking;
  saveStoredBookings(updatedList);
  markSalesBookingForSync(updatedBooking.id, 'upsert');
  return updatedBooking;
}

/**
 * انتساب رزرو فروش به پروژه اجرایی نصاب‌ها (توسط مدیر اپ و QC)
 */
export function linkBookingToInstallationProject(
  bookingId: string,
  projectId: string,
  scheduledDate: string,
  assignedTeamId: string
): boolean {
  const bookings = getStoredBookings();
  const index = bookings.findIndex((b) => b.id === bookingId);
  if (index === -1) return false;

  bookings[index] = {
    ...bookings[index],
    convertedToProjectId: projectId,
    scheduledInstallationDate: scheduledDate,
    assignedInstallationTeamId: assignedTeamId,
  };

  saveStoredBookings(bookings);
  markSalesBookingForSync(bookingId, 'upsert');
  return true;
}

/**
 * حذف رزرو پروژه و آزادسازی ظرفیت لت‌ها (انحصاراً در پنل مدیر اپ و QC)
 */
export function deleteSalesBooking(bookingId: string, user?: User): boolean {
  if (user && !canDeleteSalesBooking(user)) {
    throw new PermanentError('دسترسی غیرمجاز: حذف پروژه منحصراً در اختیار مدیریت اپ و QC می‌باشد.');
  }

  const bookings = getStoredBookings();
  const filtered = bookings.filter((b) => b.id !== bookingId);
  if (filtered.length === bookings.length) {
    return false;
  }
  saveStoredBookings(filtered);
  markSalesBookingForSync(bookingId, 'delete');
  return true;
}

function getNonSalesUserIds(): Set<string> {
  const ids = new Set<string>([
    'u-ceo',
    'u-qc-manager',
    'u-real-technician',
    'u-coordinator',
    'u-measurement',
    'u-warehouse',
  ]);
  if (typeof window !== 'undefined') {
    try {
      // the people list the app actually keeps (an old, wrong key meant nobody was ever excluded)
      const raw = localStorage.getItem(USERS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          parsed.forEach((u: any) => {
            if (u && u.id && u.role && u.role !== 'SALES_REP' && u.role !== 'SALES') {
              ids.add(u.id);
            }
          });
        }
      }
    } catch {
      // ignore
    }
  }
  return ids;
}

export function isExcludedFromSalesLeaderboard(
  repId: string,
  repName?: string,
  excludedUserIds?: string[]
): boolean {
  if (excludedUserIds && excludedUserIds.includes(repId)) return true;
  const nonSalesIds = getNonSalesUserIds();
  if (nonSalesIds.has(repId)) return true;
  if (repName) {
    const clean = repName.trim().toLowerCase();
    if (
      clean.includes('رحمانی') ||
      clean.includes('طلایی') ||
      clean.includes('مدیر') ||
      clean.includes('سرپرست') ||
      clean.includes('تکنسین') ||
      clean.includes('انبار') ||
      clean.includes('هماهنگی') ||
      clean.includes('متراژ') ||
      clean.includes('qc')
    ) {
      return true;
    }
  }
  return false;
}

/**
 * محاسبه جدول رده‌بندی زنده کارشناسان فروش با منطق گیمیفیکیشن
 * مدیران سامانه، مدیرعامل و پرسنل غیرفروش از این جدول مستثنی هستند
 */
export function getSalesRepLeaderboard(
  customReps?: SalesRepProfile[],
  excludedUserIds?: string[]
): SalesRepProfile[] {
  const bookings = getStoredBookings();
  const baseReps = customReps || SALES_REPS_SEED;

  let candidateReps: SalesRepProfile[] = [];

  if (baseReps.length > 0) {
    candidateReps = baseReps.filter(
      (r) => !isExcludedFromSalesLeaderboard(r.id, r.name, excludedUserIds)
    );
  } else {
    // If no seeded reps, compute dynamically from existing bookings
    const repsMap = new Map<string, SalesRepProfile>();
    bookings.forEach((b) => {
      if (
        b.salesRepId &&
        !isExcludedFromSalesLeaderboard(b.salesRepId, b.salesRepName, excludedUserIds)
      ) {
        const existing = repsMap.get(b.salesRepId) || {
          id: b.salesRepId,
          name: b.salesRepName || 'کارشناس فروش',
          phone: '',
          avatarIcon: '🎯',
          caricatureTag: '',
          rankBadge: 'STANDARD' as const,
          monthlyProjectsCount: 0,
          monthlyLathsCount: 0,
          activeBookingDays: 0,
          winStreak: 0,
        };
        repsMap.set(b.salesRepId, existing);
      }
    });
    candidateReps = Array.from(repsMap.values());
  }

  return candidateReps
    .map((rep) => {
      const repBookings = bookings.filter((b) => b.salesRepId === rep.id);
      const projectsCount = rep.monthlyProjectsCount + repBookings.length;
      const lathsCount = rep.monthlyLathsCount + repBookings.reduce((sum, b) => sum + b.lathsCount, 0);
      const uniqueDays = new Set(repBookings.map((b) => b.requestedDate)).size;

      return {
        ...rep,
        monthlyProjectsCount: projectsCount,
        monthlyLathsCount: lathsCount,
        activeBookingDays: Math.min(30, rep.activeBookingDays + uniqueDays),
      };
    })
    .sort((a, b) => b.monthlyProjectsCount - a.monthlyProjectsCount)
    .map((rep, idx) => {
      let rankBadge: SalesRepProfile['rankBadge'] = 'STANDARD';
      let caricatureTag = rep.caricatureTag;

      if (idx === 0) {
        rankBadge = 'GOLD';
        caricatureTag = 'شکارچی لت و شید 🥇';
      } else if (idx === 1) {
        rankBadge = 'SILVER';
        caricatureTag = 'تیرانداز سرعت رزرو 🥈';
      } else if (idx === 2) {
        rankBadge = 'BRONZE';
        caricatureTag = 'فرمانده روزهای طلایی 🥉';
      }

      return {
        ...rep,
        rankBadge,
        caricatureTag,
      };
    });
}
