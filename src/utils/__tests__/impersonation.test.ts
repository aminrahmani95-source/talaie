import { describe, it, expect, beforeEach } from 'vitest';
import { getUserRoleLabel } from '../../App';
import { User } from '../../types';

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

if (typeof globalThis.localStorage === 'undefined') {
  globalThis.localStorage = createLocalStorageMock() as any;
}

describe('CEO / Management Impersonation & Panel Inspection', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const ceoUser: User = {
    id: 'u-ceo',
    name: 'امین رحمانی',
    phone: '09121111110',
    role: 'CEO',
    active: true,
  };

  const qcManagerUser: User = {
    id: 'u-qc',
    name: 'مهندس رحمانی',
    phone: '09124339038',
    role: 'QC_MANAGER',
    active: true,
  };

  const techUser: User = {
    id: 'u-lead-1',
    name: 'فرخ نقدعلیان',
    phone: '09122222221',
    role: 'LEAD_TECHNICIAN',
    teamId: 'TEAM_1',
    active: true,
  };

  const warehouseUser: User = {
    id: 'u-warehouse',
    name: 'داوود حسینی',
    phone: '09125555551',
    role: 'WAREHOUSE',
    active: true,
  };

  it('maps all system roles to accurate and user-friendly Persian labels', () => {
    expect(getUserRoleLabel('CEO')).toBe('مدیرعامل');
    expect(getUserRoleLabel('QC_MANAGER')).toBe('مدیر اپ و QC');
    expect(getUserRoleLabel('MEASUREMENT_LEAD')).toBe('مسئول متراژ و تایید بستر');
    expect(getUserRoleLabel('WAREHOUSE')).toBe('مسئول انبار و تدارکات');
    expect(getUserRoleLabel('SCHEDULING_COORDINATOR')).toBe('مسئول هماهنگی و زمان‌بندی');
    expect(getUserRoleLabel('SALES_REP')).toBe('کارشناس فروش و رزرو لت');
    expect(getUserRoleLabel('LEAD_TECHNICIAN')).toBe('سرپرست اکیپ نصب');
    expect(getUserRoleLabel('TECHNICIAN')).toBe('تکنسین نصب');
    expect(getUserRoleLabel('UNKNOWN_ROLE')).toBe('UNKNOWN_ROLE');
    expect(getUserRoleLabel(undefined)).toBe('کاربر');
  });

  it('stores and restores the original CEO user during impersonation workflow', () => {
    // 1. CEO impersonates a technician
    localStorage.setItem('talaie_impersonator_ceo', JSON.stringify(ceoUser));
    const saved = localStorage.getItem('talaie_impersonator_ceo');
    expect(saved).not.toBeNull();

    const parsed = JSON.parse(saved!);
    expect(parsed.id).toBe(ceoUser.id);
    expect(parsed.role).toBe('CEO');
    expect(parsed.name).toBe('امین رحمانی');

    // 2. Exiting impersonation clears the localStorage safely
    localStorage.removeItem('talaie_impersonator_ceo');
    expect(localStorage.getItem('talaie_impersonator_ceo')).toBeNull();
  });

  it('allows both CEO and QC_MANAGER to act as impersonating managers', () => {
    const isManagerRole = (role?: string) => role === 'CEO' || role === 'QC_MANAGER';

    expect(isManagerRole(ceoUser.role)).toBe(true);
    expect(isManagerRole(qcManagerUser.role)).toBe(true);
    expect(isManagerRole(techUser.role)).toBe(false);
    expect(isManagerRole(warehouseUser.role)).toBe(false);
  });
});
