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

export const MAX_LATHS_PER_TEAM = 15;
export const TOTAL_INSTALLATION_TEAMS = 4;
export const MAX_DAILY_COMPANY_LATHS = 60; // ۴ اکیپ × ۱۵ لت

export const INSTALLATION_TEAMS = [
  { id: 'TEAM_1', name: 'اکیپ ۱ (نقدعلیان)', lead: 'فرخ نقدعلیان' },
  { id: 'TEAM_2', name: 'اکیپ ۲ (کریمی)', lead: 'بهزاد کریمی' },
  { id: 'TEAM_3', name: 'اکیپ ۳ (میرزایی)', lead: 'مجتبی میرزایی' },
  { id: 'TEAM_4', name: 'اکیپ ۴ (سلیمانی)', lead: 'رضا سلیمانی' },
];

export const SALES_REPS_SEED: SalesRepProfile[] = [
  {
    id: 'u-sales-1',
    name: 'سپهر رادمنش',
    phone: '09127777771',
    avatarIcon: '🎯',
    caricatureTag: 'شکارچی لت و شید 🥇',
    rankBadge: 'GOLD',
    monthlyProjectsCount: 18,
    monthlyLathsCount: 290,
    activeBookingDays: 16,
    winStreak: 4,
  },
  {
    id: 'u-sales-2',
    name: 'نیلوفر صبوری',
    phone: '09127777772',
    avatarIcon: '🌟',
    caricatureTag: 'تیرانداز سرعت رزرو 🥈',
    rankBadge: 'SILVER',
    monthlyProjectsCount: 15,
    monthlyLathsCount: 245,
    activeBookingDays: 14,
    winStreak: 2,
  },
  {
    id: 'u-sales-3',
    name: 'آرمان شایگان',
    phone: '09127777773',
    avatarIcon: '⚡',
    caricatureTag: 'فرمانده روزهای طلایی 🥉',
    rankBadge: 'BRONZE',
    monthlyProjectsCount: 12,
    monthlyLathsCount: 180,
    activeBookingDays: 11,
    winStreak: 1,
  },
];

const STORAGE_KEY = 'talaei_sales_bookings_v1';

function getSeedBookings(): SalesProjectBooking[] {
  const upcoming = getUpcomingDays(14);
  const now = new Date().toISOString();

  return [
    {
      id: 'book-seed-1',
      customerName: 'دکتر ستاری',
      customerPhone: '09123344556',
      address: 'نیاوران، خیابان یاسر، برج نگین، طبقه ۸',
      lathsCount: 15,
      isSmart: true,
      notes: 'پنجره‌های قدی سالن دوبلکس - نیاز به نردبان ۴ متری و تست لیمیت هوشمند',
      requestedDate: upcoming[1]?.dateKey || '2026-11-21',
      jalaliDate: upcoming[1]?.persianDateStr || '۱۴۰۵/۰۹/۰۱',
      allocationMode: 'SPREAD_DAILY',
      allocatedTeams: ['TEAM_1'],
      allocatedDaysCount: 1,
      salesRepId: 'u-sales-1',
      salesRepName: 'سپهر رادمنش',
      createdAt: now,
    },
    {
      id: 'book-seed-2',
      customerName: 'مهندس پاشایی (ویلا لواسان)',
      customerPhone: '09129988776',
      address: 'لواسان، بلوار باستی، پلاک ۲۴',
      lathsCount: 30,
      isSmart: true,
      notes: 'شیدهای زیپ رول بیرونی برای تراس و سالن استخر',
      requestedDate: upcoming[2]?.dateKey || '2026-11-22',
      jalaliDate: upcoming[2]?.persianDateStr || '۱۴۰۵/۰۹/۰۲',
      allocationMode: 'SPREAD_DAILY',
      allocatedTeams: ['TEAM_2', 'TEAM_3'],
      allocatedDaysCount: 1,
      salesRepId: 'u-sales-2',
      salesRepName: 'نیلوفر صبوری',
      createdAt: now,
    },
    {
      id: 'book-seed-3',
      customerName: 'خانم افشار',
      customerPhone: '09124455667',
      address: 'سعادت‌آباد، علامه شمالی، برج سرو',
      lathsCount: 10,
      isSmart: false,
      notes: 'شید دستی ساده زنجیری - رنگ پارچه کد زغالی ۷۰۲',
      requestedDate: upcoming[4]?.dateKey || '2026-11-24',
      jalaliDate: upcoming[4]?.persianDateStr || '۱۴۰۵/۰۹/۰۴',
      allocationMode: 'SPREAD_DAILY',
      allocatedTeams: ['TEAM_1'],
      allocatedDaysCount: 1,
      salesRepId: 'u-sales-3',
      salesRepName: 'آرمان شایگان',
      createdAt: now,
    },
    {
      id: 'book-seed-4',
      customerName: 'دفتر مرکزی شرکت پترو کیش',
      customerPhone: '09125566778',
      address: 'خیابان ولیعصر، نرسیده به پارک وی، ساختمان الماس',
      lathsCount: 45,
      isSmart: true,
      notes: '۳ طبقه اداری - کار با ۳ اکیپ همزمان در روز پنج‌شنبه قبل از شروع ساعت کاری',
      requestedDate: upcoming[6]?.dateKey || '2026-11-26',
      jalaliDate: upcoming[6]?.persianDateStr || '۱۴۰۵/۰۹/۰۶',
      allocationMode: 'SPREAD_DAILY',
      allocatedTeams: ['TEAM_1', 'TEAM_2', 'TEAM_4'],
      allocatedDaysCount: 1,
      salesRepId: 'u-sales-1',
      salesRepName: 'سپهر رادمنش',
      createdAt: now,
    },
  ];
}

export function getStoredBookings(): SalesProjectBooking[] {
  if (typeof window === 'undefined') return getSeedBookings();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial = getSeedBookings();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(raw) as SalesProjectBooking[];
  } catch (err) {
    console.error('Failed to read sales bookings from localStorage:', err);
    return getSeedBookings();
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

  // محاسبه پیش‌فرض برای ۴ اکیپ
  const teamAllocations: TeamDayAllocation[] = INSTALLATION_TEAMS.map((t) => ({
    teamId: t.id,
    teamName: t.name,
    bookedLaths: 0,
    maxLaths: MAX_LATHS_PER_TEAM,
  }));

  dayBookings.forEach((booking) => {
    const dayDetail = booking.daysDetails?.find((d) => d.date === dateKey);
    if (dayDetail && dayDetail.teams && dayDetail.teams.length > 0) {
      dayDetail.teams.forEach((t) => {
        const teamAlloc = teamAllocations.find((item) => item.teamId === t.teamId);
        if (teamAlloc) {
          teamAlloc.bookedLaths = Math.min(MAX_LATHS_PER_TEAM, teamAlloc.bookedLaths + t.laths);
        }
      });
      return;
    }

    // حالت پشتیبان برای داده‌های بدون daysDetails
    const teamsCount = Math.max(1, booking.allocatedTeams.length);
    const lathsPerTeam = Math.ceil(Math.min(booking.lathsCount, MAX_DAILY_COMPANY_LATHS) / teamsCount);

    booking.allocatedTeams.forEach((tId) => {
      const teamAlloc = teamAllocations.find((item) => item.teamId === tId);
      if (teamAlloc) {
        teamAlloc.bookedLaths = Math.min(MAX_LATHS_PER_TEAM, teamAlloc.bookedLaths + lathsPerTeam);
      }
    });
  });

  const totalBookedLaths = teamAllocations.reduce((sum, t) => sum + t.bookedLaths, 0);
  const remainingLaths = Math.max(0, MAX_DAILY_COMPANY_LATHS - totalBookedLaths);

  // استخراج نام روز جلالی
  const [gy, gm, gd] = dateKey.split('-').map(Number);
  const d = new Date(gy, gm - 1, gd);
  const jalaliDateStr = formatToPersianDateString(d);
  const dayName = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه', 'شنبه'][d.getDay()] || 'شنبه';

  return {
    date: dateKey,
    jalaliDate: jalaliDateStr,
    dayName,
    maxLaths: MAX_DAILY_COMPANY_LATHS,
    bookedLaths: totalBookedLaths,
    remainingLaths,
    teams: teamAllocations,
    bookingsCount: dayBookings.length,
  };
}

/**
 * دریافت وضعیت ظرفیت برای یک بازه ۳ ماهه (۹۰ روز) با شروع از ماه جاری (آذر)
 */
export function getThreeMonthCapacities(daysCount = 90): DailyLathCapacity[] {
  const upcomingDays = getUpcomingDays(daysCount + 15);
  const bookings = getStoredBookings();

  // عدم نمایش روزهای ماه قبل (آبان) و شروع مستقیم از آذر
  const activeDays = upcomingDays.filter((day) => {
    const parts = day.persianDateStr.split('/');
    const month = parseInt(parts[1], 10);
    return month >= 9 || parseInt(parts[0], 10) > 1405;
  });

  return activeDays.slice(0, daysCount).map((day) => {
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

  const [gy, gm, gd] = requestedDateKey.split('-').map(Number);
  const startDate = new Date(gy, gm - 1, gd, 12, 0, 0);

  // --------------------------------------------------------------------------
  // حالت اول: پخش بین چند اکیپ (SPREAD_DAILY)
  // اگر تعداد لت <= ۶۰ باشد: در ۱ روز انجام می‌شود.
  // اگر تعداد لت > ۶۰ باشد (مانند ۱۱۵ لت): بین اکیپ‌ها با سقف ۶۰ لت در روز پخش می‌شود.
  // --------------------------------------------------------------------------
  let spreadOption: BookingOption;

  if (lathsCount <= MAX_DAILY_COMPANY_LATHS) {
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
    // سناریوی لت‌های بالا (> ۶۰ لت، مانند ۱۱۵ لت) با بسیج اکیپ‌ها و سقف روزانه ۶۰ لت
    const spreadDaysNeeded = Math.ceil(lathsCount / MAX_DAILY_COMPANY_LATHS);
    let remLaths = lathsCount;
    let spreadMultiFit = true;
    const spreadDaysDetails: BookingOption['daysDetails'] = [];
    const allAllocatedTeamsSet = new Set<string>();

    for (let i = 0; i < spreadDaysNeeded; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      const checkDateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const persianDateStr = formatToPersianDateString(d);
      const dayCap = getDailyCapacity(checkDateKey, bookings);

      const dayAllocatedTeams: { teamId: string; teamName: string; laths: number }[] = [];
      let neededForToday = Math.min(remLaths, MAX_DAILY_COMPANY_LATHS);

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
      remLaths -= Math.min(remLaths, MAX_DAILY_COMPANY_LATHS);
    }

    spreadOption = {
      mode: 'SPREAD_DAILY',
      title: `بسیج همزمان اکیپ‌ها (سقف ۶۰ لت/روز) در ${spreadDaysNeeded} روز`,
      description: spreadMultiFit
        ? `تحویل سریع ${lathsCount} لت ظرف ${spreadDaysNeeded} روز با حداکثر توان روزانه ۶۰ لت`
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
  const consecutiveDaysNeeded = Math.ceil(lathsCount / MAX_LATHS_PER_TEAM);
  let consecutiveAvailable = false;
  let chosenTeamId = 'TEAM_1';
  let chosenTeamName = INSTALLATION_TEAMS[0].name;
  let consecutiveDaysDetails: BookingOption['daysDetails'] = [];

  for (const team of INSTALLATION_TEAMS) {
    let teamFit = true;
    const tempDetails: BookingOption['daysDetails'] = [];
    let remLaths = lathsCount;

    for (let i = 0; i < consecutiveDaysNeeded; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      const checkDateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const persianDateStr = formatToPersianDateString(d);

      const dayCap = getDailyCapacity(checkDateKey, bookings);
      const teamAlloc = dayCap.teams.find((t) => t.teamId === team.id);
      const freeInTeam = teamAlloc ? teamAlloc.maxLaths - teamAlloc.bookedLaths : 0;
      const neededToday = Math.min(MAX_LATHS_PER_TEAM, remLaths);

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
      ? `اختصاص ${chosenTeamName} به مدت ${consecutiveDaysNeeded} روز متوالی (روزانه تا ۱۵ لت)`
      : `امکان رزرو ${consecutiveDaysNeeded} روز متوالی با یک اکیپ در این تاریخ وجود ندارد.`,
    isAvailable: consecutiveAvailable,
    requiredDays: consecutiveDaysNeeded,
    allocatedTeams: [chosenTeamId],
    daysDetails: consecutiveDaysDetails,
  };

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
  return newBooking;
}

/**
 * بررسی دسترسی ویرایش رزرو فروش:
 * ۱. مدیرعامل دسترسی کامل دارد.
 * ۲. کارشناس فروش فقط مجاز به ویرایش رزروهای ثبت‌شده توسط خودش می‌باشد.
 */
export function canEditSalesBooking(user: User, booking: SalesProjectBooking): boolean {
  if (!user || !user.active) return false;
  if (user.role === 'CEO') return true;
  if (user.role === 'SALES_REP' || user.role === 'SALES') {
    const matchId = Boolean(booking.salesRepId && booking.salesRepId === user.id);
    const matchName = Boolean(
      booking.salesRepName &&
      (booking.salesRepName.trim() === user.name.trim() ||
        user.name.includes(booking.salesRepName) ||
        booking.salesRepName.includes(user.name))
    );
    return matchId || matchName;
  }
  return false;
}

/**
 * بررسی دسترسی حذف رزرو فروش:
 * منحصراً در اختیار مدیرعامل (CEO) می‌باشد.
 */
export function canDeleteSalesBooking(user: User): boolean {
  return Boolean(user && user.role === 'CEO' && user.active);
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
  return true;
}

/**
 * حذف رزرو پروژه و آزادسازی ظرفیت لت‌ها (انحصاراً در پنل مدیرعامل)
 */
export function deleteSalesBooking(bookingId: string, user?: User): boolean {
  if (user && !canDeleteSalesBooking(user)) {
    throw new PermanentError('دسترسی غیرمجاز: حذف پروژه منحصراً در اختیار مدیرعامل می‌باشد.');
  }

  const bookings = getStoredBookings();
  const filtered = bookings.filter((b) => b.id !== bookingId);
  if (filtered.length === bookings.length) {
    return false;
  }
  saveStoredBookings(filtered);
  return true;
}

/**
 * محاسبه جدول رده‌بندی زنده کارشناسان فروش با منطق گیمیفیکیشن
 */
export function getSalesRepLeaderboard(): SalesRepProfile[] {
  const bookings = getStoredBookings();

  return SALES_REPS_SEED.map((rep) => {
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
