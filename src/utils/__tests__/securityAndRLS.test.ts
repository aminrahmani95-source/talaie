import { describe, it, expect } from 'vitest';
import { canAccessProject, validateProjectPatchRoleGuards } from '../roleGuards';
import { Project, User } from '../../types';
import { PermanentError } from '../offlineQueue';

describe('Core Security & Access Control (canAccessProject & role guards)', () => {
  const qcManager: User = {
    id: 'u-qc',
    name: 'مدیر کنترل کیفی',
    phone: '09121111111',
    role: 'QC_MANAGER',
    active: true,
  };

  const coordinator: User = {
    id: 'u-coord',
    name: 'مسئول هماهنگی',
    phone: '09122222222',
    role: 'SCHEDULING_COORDINATOR',
    active: true,
  };

  const leadTech: User = {
    id: 'u-lead-1',
    name: 'سرپرست تیم ۱',
    phone: '09123333333',
    role: 'LEAD_TECHNICIAN',
    active: true,
  };

  const team1Tech: User = {
    id: 'u-tech-1',
    name: 'تکنسین تیم ۱',
    phone: '09124444444',
    role: 'TECHNICIAN',
    active: true,
  };

  const team2Tech: User = {
    id: 'u-tech-2',
    name: 'تکنسین تیم ۲',
    phone: '09125555555',
    role: 'TECHNICIAN',
    active: true,
  };

  const baseProject: Project = {
    id: 'p-101',
    code: 'T-101',
    title: 'پروژه زعفرانیه',
    customerName: 'آقای صادقی',
    customerPhone: '09129999999',
    address: 'زعفرانیه، خیابان آصف',
    shadePanels: 3,
    curtainPanels: 2,
    leadTechnicianId: leadTech.id,
    assignedTechnicianIds: [leadTech.id, team1Tech.id],
    assignedTeamId: 'team-1',
    assignedTeamName: 'اکیپ نصب ۱',
    scheduledDate: '2026-11-10',
    scheduledTime: '10:00',
    proposalImages: [],
    completionPhotos: [],
    status: 'SCHEDULED',
    qcStatus: 'NOT_STARTED',
    technicalHandover: {
      isHandoverComplete: true,
      productionConfirmation: { confirmed: true, confirmedAt: '2026-11-09T10:00:00Z', confirmedBy: 'مسئول' },
      warehouseConfirmation: { confirmed: true, confirmedAt: '2026-11-09T11:00:00Z', confirmedBy: 'مسئول' },
    },
    toolsRequired: ['دریل'],
    isFullTools: true,
    createdAt: '2026-11-08T10:00:00Z',
    updatedAt: '2026-11-08T10:00:00Z',
  };

  describe('canAccessProject access isolation', () => {
    it('allows active QC_MANAGER to access any project', () => {
      expect(canAccessProject(qcManager, baseProject)).toBe(true);
    });

    it('blocks inactive QC_MANAGER', () => {
      expect(canAccessProject({ ...qcManager, active: false }, baseProject)).toBe(false);
    });

    it('allows active SCHEDULING_COORDINATOR to access any project', () => {
      expect(canAccessProject(coordinator, baseProject)).toBe(true);
    });

    it('blocks inactive SCHEDULING_COORDINATOR', () => {
      expect(canAccessProject({ ...coordinator, active: false }, baseProject)).toBe(false);
    });

    it('allows LEAD_TECHNICIAN assigned as project lead to access project', () => {
      expect(canAccessProject(leadTech, baseProject)).toBe(true);
    });

    it('allows TECHNICIAN listed in assignedTechnicianIds to access project', () => {
      expect(canAccessProject(team1Tech, baseProject)).toBe(true);
    });

    it('allows TECHNICIAN belonging to assignedTeamId to access project', () => {
      const otherTeam1Member: User = {
        id: 'u-tech-1-new',
        name: 'تکنسین کمکی تیم ۱',
        phone: '09126666666',
        role: 'TECHNICIAN',
        active: true,
      };
      // Not listed in assignedTechnicianIds directly, but passes team ID match
      expect(canAccessProject(otherTeam1Member, baseProject, 'team-1')).toBe(true);
    });

    it('blocks unrelated TECHNICIAN from accessing project (cannot read customer details)', () => {
      expect(canAccessProject(team2Tech, baseProject, 'team-2')).toBe(false);
    });

    it('blocks assigned technician if their user account is deactivated', () => {
      expect(canAccessProject({ ...team1Tech, active: false }, baseProject)).toBe(false);
    });
  });

  describe('Role Guard protection of sensitive customer & management fields', () => {
    it('blocks technician from editing customerPhone', () => {
      expect(() =>
        validateProjectPatchRoleGuards(team1Tech, baseProject, { customerPhone: '09120000000' }, 'team-1')
      ).toThrow(PermanentError);
    });

    it('blocks technician from editing customer address', () => {
      expect(() =>
        validateProjectPatchRoleGuards(team1Tech, baseProject, { address: 'آدرس جدید' }, 'team-1')
      ).toThrow(PermanentError);
    });

    it('blocks technician from editing customerName', () => {
      expect(() =>
        validateProjectPatchRoleGuards(team1Tech, baseProject, { customerName: 'نام دیگر' }, 'team-1')
      ).toThrow(PermanentError);
    });

    it('blocks technician from editing qcScore or approving QC', () => {
      expect(() =>
        validateProjectPatchRoleGuards(team1Tech, baseProject, { qcScore: 95 }, 'team-1')
      ).toThrow(PermanentError);

      expect(() =>
        validateProjectPatchRoleGuards(team1Tech, baseProject, { qcStatus: 'APPROVED' }, 'team-1')
      ).toThrow(PermanentError);
    });

    it('blocks scheduling coordinator from approving QC or setting qcScore', () => {
      expect(() =>
        validateProjectPatchRoleGuards(coordinator, baseProject, { qcStatus: 'APPROVED' })
      ).toThrow('تأیید نهایی کنترل کیفی (QC) فقط در صلاحیت مدیر QC است');

      expect(() =>
        validateProjectPatchRoleGuards(coordinator, baseProject, { qcScore: 100 })
      ).toThrow('ثبت امتیاز کیفی فقط در صلاحیت مدیر QC است');
    });

    it('allows scheduling coordinator to update schedule and team assignments', () => {
      expect(() =>
        validateProjectPatchRoleGuards(coordinator, baseProject, {
          scheduledDate: '2026-11-12',
          assignedTeamId: 'team-2',
          assignedTeamName: 'اکیپ نصب ۲',
        })
      ).not.toThrow();
    });

    it('allows QC manager full control over all fields', () => {
      expect(() =>
        validateProjectPatchRoleGuards(qcManager, baseProject, {
          customerPhone: '09121234567',
          address: 'آدرس اصلاح شده',
          qcStatus: 'APPROVED',
          qcScore: 98,
        })
      ).not.toThrow();
    });
  });
});
