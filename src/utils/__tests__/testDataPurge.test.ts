import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getStoredBookings, SALES_REPS_SEED } from '../salesCapacity';
import { StorageService } from '../storage';
import { Project, Ticket, MaterialRequest } from '../../types';

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

describe('Clean Production Slate & Test Data Purge Verification', () => {
  let storageMock: ReturnType<typeof createLocalStorageMock>;

  beforeEach(() => {
    storageMock = createLocalStorageMock();
    vi.stubGlobal('localStorage', storageMock);
    vi.stubGlobal('window', {
      dispatchEvent: vi.fn(),
      localStorage: storageMock,
    });
  });

  it('1. returns empty bookings on initial start without any fake seed data', () => {
    const bookings = getStoredBookings();
    expect(bookings).toEqual([]);
    expect(bookings).toHaveLength(0);
  });

  it('2. automatically purges legacy seed bookings (book-seed-*) if present in cache', () => {
    // Simulate legacy storage containing seed bookings
    storageMock.setItem(
      'talaei_sales_bookings_v1',
      JSON.stringify([
        { id: 'book-seed-1', customerName: 'دکتر ستاری', lathsCount: 15 },
        { id: 'book-seed-2', customerName: 'مهندس پاشایی (ویلا لواسان)', lathsCount: 30 },
        { id: 'book-real-99', customerName: 'مشتری واقعی جدید', lathsCount: 10 },
      ])
    );

    const cleaned = getStoredBookings();
    expect(cleaned).toHaveLength(1);
    expect(cleaned[0].id).toBe('book-real-99');
    expect(cleaned[0].customerName).toBe('مشتری واقعی جدید');

    // Storage is cleaned
    const savedInStorage = JSON.parse(storageMock.getItem('talaei_sales_bookings_v1') || '[]');
    expect(savedInStorage).toHaveLength(1);
    expect(savedInStorage[0].id).toBe('book-real-99');
  });

  it('3. sales rep seed baseline profiles start at 0 without dummy counts', () => {
    SALES_REPS_SEED.forEach((rep) => {
      expect(rep.monthlyProjectsCount).toBe(0);
      expect(rep.monthlyLathsCount).toBe(0);
      expect(rep.activeBookingDays).toBe(0);
      expect(rep.winStreak).toBe(0);
    });
  });

  it('4. StorageService.getProjects filters out mock and seed-derived projects', () => {
    const rawProjects = [
      { id: 'p-1', title: 'پروژه تستی ۱', customerName: 'تست' },
      { id: 'p-demo-99', title: 'پروژه دمو', customerName: 'تست' },
      { id: 'p-from-sale-book-seed-1', title: 'رزرو فروش: دکتر ستاری', customerName: 'دکتر ستاری' },
      { id: 'p-real-1001', title: 'پروژه واقعی نیاوران', customerName: 'آقای شمس' },
    ];
    storageMock.setItem('talaie_projects_v6', JSON.stringify(rawProjects));

    const projects = StorageService.getProjects();
    expect(projects).toHaveLength(1);
    expect(projects[0].id).toBe('p-real-1001');
    expect(projects[0].customerName).toBe('آقای شمس');
  });

  it('5. StorageService.getTickets filters out mock and test tickets', () => {
    const rawTickets = [
      { id: 't-1', title: 'تیکت تستی پیش‌فرض' },
      { id: 't-demo-4', title: 'تیکت دمو' },
      { id: 't-seed-10', title: 'تیکت سید' },
      { id: 't-real-501', title: 'تیکت تامین متریال واقعی' },
    ];
    storageMock.setItem('talaie_tickets_v6', JSON.stringify(rawTickets));

    const tickets = StorageService.getTickets();
    expect(tickets).toHaveLength(1);
    expect(tickets[0].id).toBe('t-real-501');
  });

  it('6. StorageService.getMaterialRequests filters out mock material requests', () => {
    const rawMaterials = [
      { id: 'mat-demo-1', itemName: 'موتور تستی' },
      { id: 'mat-test-2', itemName: 'پایه تستی' },
      { id: 'mat-real-88', itemName: 'ریل ۵ متری استاندارد' },
    ];
    storageMock.setItem('talaie_material_requests_v6', JSON.stringify(rawMaterials));

    const materials = StorageService.getMaterialRequests();
    expect(materials).toHaveLength(1);
    expect(materials[0].id).toBe('mat-real-88');
  });

  it('7. StorageService.resetAll wipes both talaie_ and talaei_ keys including sales bookings', () => {
    storageMock.setItem('talaie_projects_v6', JSON.stringify([{ id: 'p-1' }]));
    storageMock.setItem('talaei_sales_bookings_v1', JSON.stringify([{ id: 'b-1' }]));
    storageMock.setItem('talaie_theme', 'dark');

    StorageService.resetAll();

    expect(storageMock.getItem('talaie_projects_v6')).toBeNull();
    expect(storageMock.getItem('talaei_sales_bookings_v1')).toBeNull();
    // Theme preference preserved
    expect(storageMock.getItem('talaie_theme')).toBe('dark');
  });
});
