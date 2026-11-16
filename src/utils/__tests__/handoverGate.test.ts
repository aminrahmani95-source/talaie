import { describe, it, expect } from 'vitest';
import { isHandoverGatePassed, validateProjectPatchRoleGuards } from '../roleGuards';
import { Project, User } from '../../types';
import { PermanentError } from '../offlineQueue';

describe('Official Technical Handover Gate (Gating & Verification)', () => {
  const coordinator: User = {
    id: 'u-coord',
    name: 'مسئول هماهنگی',
    phone: '09121112233',
    role: 'SCHEDULING_COORDINATOR',
    active: true,
  };

  const qcManager: User = {
    id: 'u-qc',
    name: 'مدیر کیفی',
    phone: '09123334455',
    role: 'QC_MANAGER',
    active: true,
  };

  const rawProject: Project = {
    id: 'p-handover-1',
    code: 'T-900',
    title: 'پروژه اقدسیه',
    customerName: 'آقای رستمی',
    customerPhone: '09123333333',
    address: 'اقدسیه، گلستان',
    shadePanels: 2,
    curtainPanels: 3,
    scheduledDate: '',
    scheduledTime: '',
    proposalImages: [],
    completionPhotos: [],
    leadTechnicianId: '',
    assignedTechnicianIds: [],
    status: 'MEASUREMENT_PENDING',
    qcStatus: 'NOT_STARTED',
    toolsRequired: [],
    isFullTools: true,
    createdAt: '2026-11-08T00:00:00Z',
    updatedAt: '2026-11-08T00:00:00Z',
  };

  describe('isHandoverGatePassed predicate logic', () => {
    it('returns false when no handover data is present on a new project', () => {
      expect(isHandoverGatePassed(rawProject)).toBe(false);
    });

    it('returns false when warehouse confirmation is not confirmed', () => {
      const p: Project = {
        ...rawProject,
        technicalHandover: {
          isHandoverComplete: false,
          warehouseConfirmation: {
            confirmed: false,
          },
        },
      };
      expect(isHandoverGatePassed(p)).toBe(false);
    });

    it('returns true when warehouse confirmation is confirmed', () => {
      const p: Project = {
        ...rawProject,
        technicalHandover: {
          isHandoverComplete: true,
          warehouseConfirmation: {
            confirmed: true,
            confirmedAt: '2026-11-08T11:00:00Z',
            confirmedBy: 'مسئول انبار',
          },
        },
      };
      expect(isHandoverGatePassed(p)).toBe(true);
    });

    it('returns true when patch completes warehouse confirmation', () => {
      const p: Project = {
        ...rawProject,
        technicalHandover: {
          isHandoverComplete: false,
          warehouseConfirmation: {
            confirmed: false,
          },
        },
      };
      const patch = {
        technicalHandover: {
          isHandoverComplete: true,
          warehouseConfirmation: {
            confirmed: true,
            confirmedAt: '2026-11-08T11:00:00Z',
            confirmedBy: 'مسئول انبار',
          },
        },
      };
      expect(isHandoverGatePassed(p, patch)).toBe(true);
    });

    it('exempts historical migration records with isHistoricalMigration: true', () => {
      const historicalProject: Project = {
        ...rawProject,
        technicalHandover: {
          isHandoverComplete: true,
          isHistoricalMigration: true,
          warehouseConfirmation: { confirmed: true },
        },
      };
      expect(isHandoverGatePassed(historicalProject)).toBe(true);
    });

    it('rejects attempt to forge isHistoricalMigration inside patch on an unconfirmed project', () => {
      const forgedPatch = {
        technicalHandover: {
          isHistoricalMigration: true,
        },
      };
      expect(isHandoverGatePassed(rawProject, forgedPatch)).toBe(false);
    });

    it('exempts existing active projects created before handover gate without technicalHandover', () => {
      const activePreMigrationProject: Project = {
        ...rawProject,
        status: 'IN_PROGRESS',
      };
      expect(isHandoverGatePassed(activePreMigrationProject)).toBe(true);
    });
  });

  describe('Handover Gate Enforcement on Scheduling & Dispatch', () => {
    it('blocks transitioning to SCHEDULED when handover gate is incomplete', () => {
      expect(() =>
        validateProjectPatchRoleGuards(coordinator, rawProject, { status: 'SCHEDULED' })
      ).toThrow(PermanentError);
      expect(() =>
        validateProjectPatchRoleGuards(coordinator, rawProject, { status: 'SCHEDULED' })
      ).toThrow('پروژه تا زمان ثبت و تأیید پیش‌نیاز تحویل و ورود کالا به انبار، قابل زمان‌بندی و اعزام اکیپ نیست');
    });

    it('blocks setting scheduledDate when handover gate is incomplete', () => {
      expect(() =>
        validateProjectPatchRoleGuards(coordinator, rawProject, { scheduledDate: '2026-11-15' })
      ).toThrow(PermanentError);
    });

    it('blocks assigning a team when handover gate is incomplete', () => {
      expect(() =>
        validateProjectPatchRoleGuards(coordinator, rawProject, { assignedTeamId: 'team-1' })
      ).toThrow(PermanentError);
    });

    it('blocks QC Manager from scheduling if gate is not passed (database integrity)', () => {
      expect(() =>
        validateProjectPatchRoleGuards(qcManager, rawProject, { status: 'SCHEDULED', scheduledDate: '2026-11-15' })
      ).toThrow(PermanentError);
    });

    it('permits scheduling once warehouse confirmation is supplied in the patch', () => {
      const validPatch = {
        status: 'SCHEDULED',
        scheduledDate: '2026-11-15',
        assignedTeamId: 'team-1',
        technicalHandover: {
          isHandoverComplete: true,
          warehouseConfirmation: {
            confirmed: true,
            confirmedAt: '2026-11-08T11:00:00Z',
            confirmedBy: 'مسئول انبار',
          },
        },
      };

      expect(() =>
        validateProjectPatchRoleGuards(coordinator, rawProject, validPatch)
      ).not.toThrow();
    });

    it('blocks patch attempting to inject isHistoricalMigration flag', () => {
      const forgedPatch = {
        status: 'SCHEDULED',
        technicalHandover: {
          isHistoricalMigration: true,
        },
      };

      expect(() =>
        validateProjectPatchRoleGuards(coordinator, rawProject, forgedPatch)
      ).toThrow(PermanentError);
      expect(() =>
        validateProjectPatchRoleGuards(coordinator, rawProject, forgedPatch)
      ).toThrow('امکان تغییر یا انتساب دستی پرچم سوابق تاریخی وجود ندارد');
    });

    it('permits warehouse user to confirm warehouse receipt in technicalHandover', () => {
      const warehouseUser: User = {
        id: 'u-warehouse',
        name: 'داوود حسینی (مسئول انبار)',
        phone: '09125555551',
        role: 'WAREHOUSE',
        active: true,
      };

      const patch = {
        technicalHandover: {
          isHandoverComplete: true,
          warehouseConfirmation: {
            confirmed: true,
            confirmedBy: 'داوود حسینی',
            confirmedAt: '2026-11-16T10:00:00Z',
            shelfLocation: 'قفسه B-12',
            notes: 'اقلام کامل تحویل شد',
          },
        },
        updatedAt: '2026-11-16T10:00:00Z',
      };

      expect(() =>
        validateProjectPatchRoleGuards(warehouseUser, rawProject, patch)
      ).not.toThrow();
    });

    it('blocks warehouse user from patching unauthorized fields', () => {
      const warehouseUser: User = {
        id: 'u-warehouse',
        name: 'داوود حسینی (مسئول انبار)',
        phone: '09125555551',
        role: 'WAREHOUSE',
        active: true,
      };

      const unauthorizedPatch = {
        customerName: 'مشتری تغییریافته',
        address: 'آدرس جدید',
      };

      expect(() =>
        validateProjectPatchRoleGuards(warehouseUser, rawProject, unauthorizedPatch)
      ).toThrow(PermanentError);
      expect(() =>
        validateProjectPatchRoleGuards(warehouseUser, rawProject, unauthorizedPatch)
      ).toThrow('مسئول انبار اجازه تغییر فیلد «customerName» را ندارد.');
    });
  });
});
