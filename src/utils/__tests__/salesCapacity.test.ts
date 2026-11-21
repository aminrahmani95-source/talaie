import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  MAX_LATHS_PER_TEAM,
  MAX_DAILY_COMPANY_LATHS,
  INSTALLATION_TEAMS,
  getDailyCapacity,
  calculateBookingOptions,
  createSalesBooking,
  updateSalesBooking,
  deleteSalesBooking,
  getSalesRepLeaderboard,
  getThreeMonthCapacities,
} from '../salesCapacity';
import { SalesProjectBooking } from '../../types';

// Standard in-memory localStorage polyfill for Node test environment
const createLocalStorageMock = () => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = String(value);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
  };
};

describe('Sales & 60-Lath Capacity Engine Tests', () => {
  let storageMock: ReturnType<typeof createLocalStorageMock>;

  beforeEach(() => {
    storageMock = createLocalStorageMock();
    vi.stubGlobal('localStorage', storageMock);
    vi.stubGlobal('window', {
      dispatchEvent: vi.fn(),
    });
  });

  it('1. enforces company cap of 60 laths across 4 installation teams', () => {
    expect(MAX_DAILY_COMPANY_LATHS).toBe(60);
    expect(MAX_LATHS_PER_TEAM).toBe(15);
    expect(INSTALLATION_TEAMS).toHaveLength(4);
  });

  it('2. correctly calculates daily capacity with zero bookings', () => {
    const capacity = getDailyCapacity('2026-12-01', []);
    expect(capacity.maxLaths).toBe(60);
    expect(capacity.bookedLaths).toBe(0);
    expect(capacity.remainingLaths).toBe(60);
    expect(capacity.teams).toHaveLength(4);
    capacity.teams.forEach((team) => {
      expect(team.bookedLaths).toBe(0);
      expect(team.maxLaths).toBe(15);
    });
  });

  it('3. deducts capacity and caps team capacity at 15 laths per team', () => {
    const mockBookings: SalesProjectBooking[] = [
      {
        id: 'b-1',
        customerName: 'تست ۱',
        customerPhone: '09121111111',
        address: 'تهران',
        lathsCount: 15,
        isSmart: true,
        notes: '',
        requestedDate: '2026-12-01',
        jalaliDate: '۱۴۰۵/۰۹/۱۰',
        allocationMode: 'SPREAD_DAILY',
        allocatedTeams: ['TEAM_1'],
        allocatedDaysCount: 1,
        salesRepId: 'u-sales-1',
        salesRepName: 'سپهر رادمنش',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'b-2',
        customerName: 'تست ۲',
        customerPhone: '09122222222',
        address: 'تهران',
        lathsCount: 30,
        isSmart: false,
        notes: '',
        requestedDate: '2026-12-01',
        jalaliDate: '۱۴۰۵/۰۹/۱۰',
        allocationMode: 'SPREAD_DAILY',
        allocatedTeams: ['TEAM_2', 'TEAM_3'],
        allocatedDaysCount: 1,
        salesRepId: 'u-sales-2',
        salesRepName: 'نیلوفر صبوری',
        createdAt: new Date().toISOString(),
      },
    ];

    const capacity = getDailyCapacity('2026-12-01', mockBookings);
    expect(capacity.bookedLaths).toBe(45); // 15 + 15 + 15
    expect(capacity.remainingLaths).toBe(15);

    const team1 = capacity.teams.find((t) => t.teamId === 'TEAM_1');
    const team4 = capacity.teams.find((t) => t.teamId === 'TEAM_4');
    expect(team1?.bookedLaths).toBe(15);
    expect(team4?.bookedLaths).toBe(0);
  });

  it('4. offers both multi-team spread and consecutive days options', () => {
    const options = calculateBookingOptions(30, '2026-12-05');
    expect(options.spreadOption).toBeDefined();
    expect(options.consecutiveOption).toBeDefined();
    expect(options.spreadOption.requiredDays).toBe(1);
    expect(options.consecutiveOption.requiredDays).toBe(2); // 30 laths / 15 per day = 2 days
  });

  it('5. creates and persists a sales booking successfully', () => {
    const newBooking = createSalesBooking({
      customerName: 'شرکت تجارت الکترونیک',
      customerPhone: '09128889900',
      address: 'سعادت‌آباد، صرافهای جنوبی',
      lathsCount: 20,
      isSmart: true,
      notes: 'پنجره‌های سالن کنفرانس',
      requestedDate: '2026-12-10',
      jalaliDate: '۱۴۰۵/۰۹/۱۹',
      allocationMode: 'SPREAD_DAILY',
      allocatedTeams: ['TEAM_1', 'TEAM_2'],
      allocatedDaysCount: 1,
      salesRepId: 'u-sales-1',
      salesRepName: 'سپهر رادمنش',
    });

    expect(newBooking.id).toMatch(/^book-/);
    const capacity = getDailyCapacity('2026-12-10');
    expect(capacity.bookedLaths).toBeGreaterThan(0);
  });

  it('6. calculates leaderboard ranking based on projects count and assigns badges', () => {
    const leaderboard = getSalesRepLeaderboard();
    expect(leaderboard).toHaveLength(3);
    expect(leaderboard[0].rankBadge).toBe('GOLD');
    expect(leaderboard[1].rankBadge).toBe('SILVER');
    expect(leaderboard[2].rankBadge).toBe('BRONZE');
    // Sorted descending by projects count
    expect(leaderboard[0].monthlyProjectsCount).toBeGreaterThanOrEqual(
      leaderboard[1].monthlyProjectsCount
    );
  });

  it('7. generates 90-day upcoming capacities correctly', () => {
    const days = getThreeMonthCapacities(90);
    expect(days).toHaveLength(90);
    days.forEach((day) => {
      expect(day.maxLaths).toBe(60);
      expect(day.remainingLaths).toBeLessThanOrEqual(60);
      expect(day.remainingLaths).toBeGreaterThanOrEqual(0);
    });
  });

  it('8. updates an existing sales booking and persists changes', () => {
    const created = createSalesBooking({
      customerName: 'پروژه سعادت‌آباد قدیم',
      customerPhone: '09123334455',
      address: 'میدان کاج',
      lathsCount: 15,
      isSmart: false,
      notes: 'شید معمولی',
      requestedDate: '2026-12-15',
      jalaliDate: '۱۴۰۵/۰۹/۲۴',
      allocationMode: 'SPREAD_DAILY',
      allocatedTeams: ['TEAM_1'],
      allocatedDaysCount: 1,
      salesRepId: 'u-sales-1',
      salesRepName: 'سپهر رادمنش',
    });

    const updated = updateSalesBooking(created.id, {
      customerName: 'پروژه سعادت‌آباد اصلاح‌شده',
      lathsCount: 25,
      isSmart: true,
      notes: 'تغییر به شید هوشمند موتوردار',
    });

    expect(updated.customerName).toBe('پروژه سعادت‌آباد اصلاح‌شده');
    expect(updated.lathsCount).toBe(25);
    expect(updated.isSmart).toBe(true);
    expect(updated.notes).toBe('تغییر به شید هوشمند موتوردار');
  });

  it('9. prevents self-capacity collision when recalculating options for existing booking via excludeBookingId', () => {
    // Fill 60 laths on 2026-12-20
    const booking = createSalesBooking({
      customerName: 'پروژه فول ظرفیت',
      customerPhone: '09120000000',
      address: 'تهران',
      lathsCount: 60,
      isSmart: true,
      notes: '',
      requestedDate: '2026-12-20',
      jalaliDate: '۱۴۰۵/۰۹/۲۹',
      allocationMode: 'SPREAD_DAILY',
      allocatedTeams: ['TEAM_1', 'TEAM_2', 'TEAM_3', 'TEAM_4'],
      allocatedDaysCount: 1,
      salesRepId: 'u-sales-1',
      salesRepName: 'سپهر رادمنش',
    });

    // Without excludeBookingId, day is full (0 remaining)
    const optionsFull = calculateBookingOptions(15, '2026-12-20');
    expect(optionsFull.spreadOption.isAvailable).toBe(false);

    // With excludeBookingId, booking's own 60 laths are excluded, freeing up capacity for edit
    const optionsWithExclusion = calculateBookingOptions(30, '2026-12-20', booking.id);
    expect(optionsWithExclusion.spreadOption.isAvailable).toBe(true);
  });

  it('10. deletes a booking and immediately restores free capacity', () => {
    const bookingToDelete = createSalesBooking({
      customerName: 'پروژه کنسلی مشتری',
      customerPhone: '09129999999',
      address: 'فرمانیه',
      lathsCount: 30,
      isSmart: true,
      notes: 'کنسلی به دلیل تاخیر کارفرما',
      requestedDate: '2026-12-25',
      jalaliDate: '۱۴۰۵/۱۰/۰۴',
      allocationMode: 'SPREAD_DAILY',
      allocatedTeams: ['TEAM_1', 'TEAM_2'],
      allocatedDaysCount: 1,
      salesRepId: 'u-sales-2',
      salesRepName: 'نیلوفر صبوری',
    });

    const capBefore = getDailyCapacity('2026-12-25');
    expect(capBefore.bookedLaths).toBe(30);

    const deleted = deleteSalesBooking(bookingToDelete.id);
    expect(deleted).toBe(true);

    const capAfter = getDailyCapacity('2026-12-25');
    expect(capAfter.bookedLaths).toBe(0);
    expect(capAfter.remainingLaths).toBe(60);
  });

  it('11. enables consecutive option for 50 laths on empty days without bug', () => {
    // 50 laths on an arbitrary future date
    const options = calculateBookingOptions(50, '2026-12-18');
    expect(options.consecutiveOption.isAvailable).toBe(true);
    expect(options.consecutiveOption.requiredDays).toBe(4); // 50 / 15 = 4 days
    expect(options.consecutiveOption.daysDetails).toHaveLength(4);

    // Spread option in 1 day is also available (50 <= 60 across 4 teams)
    expect(options.spreadOption.isAvailable).toBe(true);
    expect(options.spreadOption.requiredDays).toBe(1);
  });

  it('12. allows large projects (>60 laths, e.g. 115 laths) across multi-day spread and consecutive days', () => {
    const options = calculateBookingOptions(115, '2026-12-28');
    // Spread option mobilizes teams at 60 laths/day cap: Math.ceil(115 / 60) = 2 days
    expect(options.spreadOption.isAvailable).toBe(true);
    expect(options.spreadOption.requiredDays).toBe(2);
    expect(options.spreadOption.daysDetails).toHaveLength(2);

    // Consecutive option: 1 team over Math.ceil(115 / 15) = 8 days
    expect(options.consecutiveOption.isAvailable).toBe(true);
    expect(options.consecutiveOption.requiredDays).toBe(8);
    expect(options.consecutiveOption.daysDetails).toHaveLength(8);
  });
});
