import { describe, it, expect } from 'vitest';
import {
  ALLOWED_TECHNICIAN_PATCH_KEYS,
  isValidStatusTransition,
  validateProjectPatchRoleGuards,
  validateTicketRoleGuards,
  validateEvaluationRoleGuards,
} from '../roleGuards';
import { Project, ProjectStatus, Ticket, User, StuckIncident } from '../../types';
import { PermanentError } from '../offlineQueue';

describe('Role Guards & State Machine Validation', () => {
  const qcManager: User = {
    id: 'user-qc-1',
    name: 'مسئول QC',
    phone: '09124339038',
    role: 'QC_MANAGER',
    active: true,
  };

  const leadTech: User = {
    id: 'user-lead-1',
    name: 'سرپرست نصب',
    phone: '09121111111',
    role: 'LEAD_TECHNICIAN',
    active: true,
  };

  const technician: User = {
    id: 'user-tech-1',
    name: 'تکنسین نصب',
    phone: '09122222222',
    role: 'TECHNICIAN',
    active: true,
  };

  const unassignedTech: User = {
    id: 'user-tech-99',
    name: 'تکنسین متفرقه',
    phone: '09123333333',
    role: 'TECHNICIAN',
    active: true,
  };

  const mockProject: Project = {
    id: 'proj-1',
    code: 'T-101',
    title: 'پروژه سعادت‌آباد',
    customerName: 'آقای صادقی',
    customerPhone: '09129999999',
    address: 'سعادت‌آباد، میدان کاج',
    shadePanels: 4,
    curtainPanels: 2,
    leadTechnicianId: leadTech.id,
    assignedTechnicianIds: [leadTech.id, technician.id],
    scheduledDate: '2026-11-01',
    scheduledTime: '09:30',
    status: 'SCHEDULED',
    qcStatus: 'NOT_STARTED',
    isFullTools: true,
    toolsRequired: ['دریل چکشی', 'تراز لیزری'],
    proposalImages: [],
    completionPhotos: [],
    createdAt: '2026-11-01T08:00:00Z',
    updatedAt: '2026-11-01T08:00:00Z',
  };

  describe('isValidStatusTransition', () => {
    it('allows valid BPMN transitions', () => {
      expect(isValidStatusTransition('SCHEDULED', 'EN_ROUTE')).toBe(true);
      expect(isValidStatusTransition('EN_ROUTE', 'IN_PROGRESS')).toBe(true);
      expect(isValidStatusTransition('IN_PROGRESS', 'COMPLETED')).toBe(true);
      expect(isValidStatusTransition('EN_ROUTE', 'STUCK')).toBe(true);
      expect(isValidStatusTransition('IN_PROGRESS', 'STUCK')).toBe(true);
    });

    it('rejects invalid or skipping transitions', () => {
      // Skipping EN_ROUTE
      expect(isValidStatusTransition('SCHEDULED', 'IN_PROGRESS')).toBe(false);
      // Skipping directly to COMPLETED
      expect(isValidStatusTransition('SCHEDULED', 'COMPLETED')).toBe(false);
      expect(isValidStatusTransition('EN_ROUTE', 'COMPLETED')).toBe(false);
      // Stuck cannot directly complete
      expect(isValidStatusTransition('STUCK', 'COMPLETED')).toBe(false);
      // Backward transitions
      expect(isValidStatusTransition('COMPLETED', 'IN_PROGRESS')).toBe(false);
      expect(isValidStatusTransition('IN_PROGRESS', 'SCHEDULED')).toBe(false);
      expect(isValidStatusTransition('SCHEDULED', 'STUCK')).toBe(false);
    });
  });

  describe('validateProjectPatchRoleGuards', () => {
    it('allows QC_MANAGER unrestricted access on any project and key', () => {
      expect(() => {
        validateProjectPatchRoleGuards(qcManager, mockProject, {
          title: 'عنوان جدید',
          scheduledDate: '2026-12-01',
          status: 'COMPLETED',
          qcStatus: 'APPROVED',
          leadTechnicianId: 'new-lead-id',
        });
      }).not.toThrow();
    });

    it('blocks technician if not assigned to the project', () => {
      expect(() => {
        validateProjectPatchRoleGuards(unassignedTech, mockProject, {
          status: 'EN_ROUTE',
        });
      }).toThrowError(PermanentError);
      expect(() => {
        validateProjectPatchRoleGuards(unassignedTech, mockProject, {
          status: 'EN_ROUTE',
        });
      }).toThrowError(/شما مسئول یا تکنسین تخصیص‌یافته به این پروژه نیستید/);
    });

    it('allows assigned technician or lead to patch permitted keys', () => {
      expect(() => {
        validateProjectPatchRoleGuards(technician, mockProject, {
          status: 'EN_ROUTE',
          updatedAt: new Date().toISOString(),
        });
      }).not.toThrow();

      expect(() => {
        validateProjectPatchRoleGuards(leadTech, mockProject, {
          status: 'EN_ROUTE',
          updatedAt: new Date().toISOString(),
        });
      }).not.toThrow();
    });

    it('blocks technician from patching unauthorized keys', () => {
      const disallowedKeys = ['title', 'customerName', 'address', 'scheduledDate', 'leadTechnicianId', 'price'];
      for (const key of disallowedKeys) {
        expect(() => {
          validateProjectPatchRoleGuards(technician, mockProject, {
            [key]: 'hacked_value',
          });
        }).toThrowError(PermanentError);
      }
    });

    it('strictly enforces qcStatus rules for technicians', () => {
      const inProgressProject: Project = {
        ...mockProject,
        status: 'IN_PROGRESS',
        startedAt: '2026-11-01T08:00:00Z',
      };

      // Technician cannot set qcStatus = APPROVED
      expect(() => {
        validateProjectPatchRoleGuards(technician, inProgressProject, {
          status: 'COMPLETED',
          qcStatus: 'APPROVED',
        });
      }).toThrowError(/تکنسین فقط می‌تواند وضعیت QC را روی PENDING تنظیم کند/);

      // Technician cannot set qcStatus = REJECTED
      expect(() => {
        validateProjectPatchRoleGuards(technician, inProgressProject, {
          status: 'COMPLETED',
          qcStatus: 'REJECTED',
        });
      }).toThrowError(/تکنسین فقط می‌تواند وضعیت QC را روی PENDING تنظیم کند/);

      // Technician cannot set qcStatus = PENDING without status = COMPLETED
      expect(() => {
        validateProjectPatchRoleGuards(technician, inProgressProject, {
          qcStatus: 'PENDING',
        });
      }).toThrowError(/تنظیم وضعیت QC روی PENDING فقط همراه با اتمام کار \(COMPLETED\) مجاز است/);

      // Valid: status = COMPLETED and qcStatus = PENDING
      expect(() => {
        validateProjectPatchRoleGuards(technician, inProgressProject, {
          status: 'COMPLETED',
          qcStatus: 'PENDING',
          completedAt: new Date().toISOString(),
        });
      }).not.toThrow();
    });

    it('enforces status transition machine for technicians', () => {
      // 1. Double tap / skipping EN_ROUTE from SCHEDULED directly to IN_PROGRESS
      expect(() => {
        validateProjectPatchRoleGuards(technician, mockProject, {
          status: 'IN_PROGRESS',
        });
      }).toThrowError(/انتقال وضعیت از «SCHEDULED» به «IN_PROGRESS» برای تکنسین مجاز نیست/);

      // 2. Valid transition from SCHEDULED to EN_ROUTE
      expect(() => {
        validateProjectPatchRoleGuards(technician, mockProject, {
          status: 'EN_ROUTE',
        });
      }).not.toThrow();

      // 3. Valid transition from EN_ROUTE to IN_PROGRESS
      const enRouteProject: Project = { ...mockProject, status: 'EN_ROUTE' };
      expect(() => {
        validateProjectPatchRoleGuards(technician, enRouteProject, {
          status: 'IN_PROGRESS',
          startedAt: new Date().toISOString(),
        });
      }).not.toThrow();

      // 4. Valid reporting stuck from IN_PROGRESS to STUCK
      const inProgressProject: Project = { ...mockProject, status: 'IN_PROGRESS' };
      const newIncident: StuckIncident = {
        id: 'stuck-1',
        stuckAt: '2026-11-01T10:00:00Z',
        category: 'HARDWARE_SHORTAGE',
        description: 'کسری پایه',
        reportedBy: technician.name,
        photos: [],
        targetMaxHours: 72,
        resolutionStatus: 'OPEN',
      };

      expect(() => {
        validateProjectPatchRoleGuards(technician, inProgressProject, {
          status: 'STUCK',
          stuckIncidents: [newIncident],
        });
      }).not.toThrow();
    });

    it('enforces stuckIncidents append-only rules for technicians', () => {
      const initialIncident: StuckIncident = {
        id: 'stuck-1',
        stuckAt: '2026-11-01T10:00:00Z',
        category: 'HARDWARE_SHORTAGE',
        description: 'کسری پایه',
        reportedBy: technician.name,
        photos: [],
        targetMaxHours: 72,
        resolutionStatus: 'RESOLVED',
        resolvedAt: '2026-11-01T11:00:00Z',
        resolvedBy: qcManager.name,
      };

      const projectWithStuck: Project = {
        ...mockProject,
        status: 'IN_PROGRESS',
        stuckIncidents: [initialIncident],
      };

      const secondValidIncident: StuckIncident = {
        id: 'stuck-2',
        stuckAt: '2026-11-01T12:00:00Z',
        category: 'FABRIC_DEFECT',
        description: 'پارگی پارچه',
        reportedBy: technician.name,
        photos: [],
        targetMaxHours: 72,
        resolutionStatus: 'OPEN',
      };

      // 1. Valid append of a second incident with resolutionStatus = OPEN
      expect(() => {
        validateProjectPatchRoleGuards(technician, projectWithStuck, {
          status: 'STUCK',
          stuckIncidents: [initialIncident, secondValidIncident],
        });
      }).not.toThrow();

      // 2. Reject if newly appended incident has resolutionStatus = RESOLVED
      expect(() => {
        validateProjectPatchRoleGuards(technician, projectWithStuck, {
          status: 'STUCK',
          stuckIncidents: [
            initialIncident,
            { ...secondValidIncident, resolutionStatus: 'RESOLVED' },
          ],
        });
      }).toThrowError(/دسترسی غیرمجاز: تکنسین فقط میتواند گزارش استاک جدید ثبت کند/);

      // 3. Reject if existing incident was modified
      expect(() => {
        validateProjectPatchRoleGuards(technician, projectWithStuck, {
          status: 'STUCK',
          stuckIncidents: [
            { ...initialIncident, description: 'دستکاری گزارش قبلی' },
            secondValidIncident,
          ],
        });
      }).toThrowError(/دسترسی غیرمجاز: تکنسین فقط میتواند گزارش استاک جدید ثبت کند/);

      // 4. Reject if no new incident appended (same length)
      expect(() => {
        validateProjectPatchRoleGuards(technician, projectWithStuck, {
          stuckIncidents: [initialIncident],
        });
      }).toThrowError(/دسترسی غیرمجاز: تکنسین فقط میتواند گزارش استاک جدید ثبت کند/);

      // 5. Reject if incidents array truncated
      expect(() => {
        validateProjectPatchRoleGuards(technician, projectWithStuck, {
          stuckIncidents: [],
        });
      }).toThrowError(/دسترسی غیرمجاز: تکنسین فقط میتواند گزارش استاک جدید ثبت کند/);

      // 6. QC_MANAGER is unrestricted and can modify or resolve incidents
      expect(() => {
        validateProjectPatchRoleGuards(qcManager, projectWithStuck, {
          stuckIncidents: [
            { ...initialIncident, resolutionNote: 'تایید مدیر QC' },
          ],
        });
      }).not.toThrow();
    });

    it('enforces multi-day PAUSED transitions and rules', () => {
      expect(isValidStatusTransition('IN_PROGRESS', 'PAUSED')).toBe(true);
      expect(isValidStatusTransition('PAUSED', 'EN_ROUTE')).toBe(true);
      expect(isValidStatusTransition('PAUSED', 'IN_PROGRESS')).toBe(true);
      expect(isValidStatusTransition('PAUSED', 'STUCK')).toBe(true);
      expect(isValidStatusTransition('SCHEDULED', 'PAUSED')).toBe(false);

      const inProgressProject: Project = { ...mockProject, status: 'IN_PROGRESS' };
      expect(() => {
        validateProjectPatchRoleGuards(technician, inProgressProject, {
          status: 'PAUSED',
        });
      }).not.toThrow();
    });

    it('enforces append-only rules on dailyLogs', () => {
      const existingLog = {
        id: 'log-1',
        date: '2026-11-01',
        note: 'روز اول نصب ریل‌ها انجام شد',
        photos: [],
        byUserId: technician.id,
        byUserName: technician.name,
        createdAt: '2026-11-01T15:00:00Z',
      };
      const projectWithLog: Project = {
        ...mockProject,
        status: 'PAUSED',
        dailyLogs: [existingLog],
      };

      // Appending valid daily log by same technician
      const newLog = {
        id: 'log-2',
        date: '2026-11-02',
        note: 'روز دوم پارچه‌ها آویزان شدند',
        photos: [],
        byUserId: technician.id,
        byUserName: technician.name,
        createdAt: '2026-11-02T16:00:00Z',
      };
      expect(() => {
        validateProjectPatchRoleGuards(technician, projectWithLog, {
          dailyLogs: [existingLog, newLog],
        });
      }).not.toThrow();

      // Appending log with another user's ID
      expect(() => {
        validateProjectPatchRoleGuards(technician, projectWithLog, {
          dailyLogs: [existingLog, { ...newLog, byUserId: 'other-user' }],
        });
      }).toThrowError(/ثبت لاگ روزانه فقط با هویت خودتان مجاز است/);

      // Mutating previous log
      expect(() => {
        validateProjectPatchRoleGuards(technician, projectWithLog, {
          dailyLogs: [{ ...existingLog, note: 'دستکاری شد' }, newLog],
        });
      }).toThrowError(/ویرایش لاگ‌های روزانه قبلی مجاز نیست/);
    });

    it('enforces open/close rules on workSessions', () => {
      const openSession = {
        date: '2026-11-01',
        startedAt: '2026-11-01T08:00:00Z',
        byUserId: technician.id,
        byUserName: technician.name,
      };
      const projectWithOpenSession: Project = {
        ...mockProject,
        status: 'IN_PROGRESS',
        workSessions: [openSession],
      };

      // Closing own open session
      const closedSession = {
        ...openSession,
        endedAt: '2026-11-01T16:00:00Z',
      };
      expect(() => {
        validateProjectPatchRoleGuards(technician, projectWithOpenSession, {
          workSessions: [closedSession],
        });
      }).not.toThrow();

      // A teammate may close the lead's open session (e.g. finishing the job for the crew)
      const sessionByLead = {
        ...openSession,
        byUserId: leadTech.id,
        byUserName: leadTech.name,
      };
      const projectWithLeadSession: Project = {
        ...mockProject,
        status: 'IN_PROGRESS',
        workSessions: [sessionByLead],
      };
      expect(() => {
        validateProjectPatchRoleGuards(technician, projectWithLeadSession, {
          workSessions: [{ ...sessionByLead, endedAt: '2026-11-01T16:00:00Z' }],
        });
      }).not.toThrow();

      // ...but cannot rewrite its start time while closing it
      expect(() => {
        validateProjectPatchRoleGuards(technician, projectWithLeadSession, {
          workSessions: [{ ...sessionByLead, startedAt: '2026-11-01T01:00:00Z', endedAt: '2026-11-01T16:00:00Z' }],
        });
      }).toThrowError(/تغییر سایر مشخصات جلسه کاری مجاز نیست/);

      // Unchanged arrays (no-op) are allowed
      expect(() => {
        validateProjectPatchRoleGuards(technician, projectWithLeadSession, {
          workSessions: [sessionByLead],
          dailyLogs: [],
        });
      }).not.toThrow();
    });
  });

  describe('validateEvaluationRoleGuards', () => {
    it('allows QC_MANAGER to append evaluation', () => {
      expect(() => {
        validateEvaluationRoleGuards(qcManager);
      }).not.toThrow();
    });

    it('blocks LEAD_TECHNICIAN and TECHNICIAN from appending evaluation', () => {
      expect(() => {
        validateEvaluationRoleGuards(leadTech);
      }).toThrowError(/دسترسی غیرمجاز: تنها مدیر ارشد QC می‌تواند ارزیابی پرسنل را ثبت کند/);

      expect(() => {
        validateEvaluationRoleGuards(technician);
      }).toThrowError(/دسترسی غیرمجاز: تنها مدیر ارشد QC می‌تواند ارزیابی پرسنل را ثبت کند/);
    });
  });

  describe('validateTicketRoleGuards', () => {
    it('allows QC_MANAGER to perform any ticket operation including resolution', () => {
      expect(() => {
        validateTicketRoleGuards(qcManager, mockProject, {
          status: 'RESOLVED',
          resolutionNote: 'رفع شد',
        });
      }).not.toThrow();
    });

    it('blocks technician from resolving tickets', () => {
      expect(() => {
        validateTicketRoleGuards(technician, mockProject, {
          status: 'RESOLVED',
        });
      }).toThrowError(/تنها مدیر ارشد QC می‌تواند وضعیت تیکت را به حل‌شده/);
    });

    it('blocks technician from creating ticket on unassigned project', () => {
      expect(() => {
        validateTicketRoleGuards(unassignedTech, mockProject, {
          type: 'DAMAGED_HARDWARE',
          description: 'نیاز به ۲ عدد پایه',
          status: 'OPEN',
        });
      }).toThrowError(/شما تنها مجاز به ثبت تیکت روی پروژه‌های تخصیص‌یافته به خودتان هستید/);
    });

    it('allows technician to create open ticket on assigned project', () => {
      expect(() => {
        validateTicketRoleGuards(technician, mockProject, {
          type: 'DAMAGED_HARDWARE',
          description: 'نیاز به ۲ عدد پایه',
          status: 'OPEN',
        });
      }).not.toThrow();
    });
  });
});
