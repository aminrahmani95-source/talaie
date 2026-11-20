import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  MAX_LATHS_PER_TEAM,
  MAX_DAILY_COMPANY_LATHS,
  INSTALLATION_TEAMS,
  getDailyCapacity,
  calculateBookingOptions,
  createSalesBooking,
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
});
