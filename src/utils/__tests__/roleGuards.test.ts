import { describe, it, expect } from 'vitest';
import {
  isValidStatusTransition,
  validateProjectPatchRoleGuards,
  validateTicketRoleGuards,
  validateEvaluationRoleGuards,
} from '../roleGuards';
import { Project, User, StuckIncident } from '../../types';
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

  const coordinator: User = {
    id: 'user-coord-1',
    name: 'مسئول هماهنگی',
    phone: '09124444444',
    role: 'SCHEDULING_COORDINATOR',
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

    it('only the project lead runs the work steps; other crew members are told to leave it to the lead', () => {
      expect(() => {
        validateProjectPatchRoleGuards(technician, mockProject, {
          status: 'EN_ROUTE',
          updatedAt: new Date().toISOString(),
        });
      }).toThrow(/فقط سرپرست این پروژه/);

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
          validateProjectPatchRoleGuards(leadTech, mockProject, {
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
        validateProjectPatchRoleGuards(leadTech, inProgressProject, {
          status: 'COMPLETED',
          qcStatus: 'APPROVED',
        });
      }).toThrowError(/تکنسین فقط می‌تواند وضعیت QC را روی PENDING تنظیم کند/);

      // Technician cannot set qcStatus = REJECTED
      expect(() => {
        validateProjectPatchRoleGuards(leadTech, inProgressProject, {
          status: 'COMPLETED',
          qcStatus: 'REJECTED',
        });
      }).toThrowError(/تکنسین فقط می‌تواند وضعیت QC را روی PENDING تنظیم کند/);

      // Technician cannot set qcStatus = PENDING without status = COMPLETED
      expect(() => {
        validateProjectPatchRoleGuards(leadTech, inProgressProject, {
          qcStatus: 'PENDING',
        });
      }).toThrowError(/تنظیم وضعیت QC روی PENDING فقط همراه با اتمام کار \(COMPLETED\) مجاز است/);

      // Valid: status = COMPLETED and qcStatus = PENDING
      expect(() => {
        validateProjectPatchRoleGuards(leadTech, inProgressProject, {
          status: 'COMPLETED',
          qcStatus: 'PENDING',
          completedAt: new Date().toISOString(),
          representativeName: 'مهندس رضایی',
          representativeRole: 'مهندس ناظر',
          representativePhone: '09121112233',
        });
      }).not.toThrow();
    });

    it('enforces status transition machine for technicians', () => {
      // 1. Double tap / skipping EN_ROUTE from SCHEDULED directly to IN_PROGRESS
      expect(() => {
        validateProjectPatchRoleGuards(leadTech, mockProject, {
          status: 'IN_PROGRESS',
        });
      }).toThrowError(/انتقال وضعیت از «SCHEDULED» به «IN_PROGRESS» برای تکنسین مجاز نیست/);

      // 2. Valid transition from SCHEDULED to EN_ROUTE
      expect(() => {
        validateProjectPatchRoleGuards(leadTech, mockProject, {
          status: 'EN_ROUTE',
        });
      }).not.toThrow();

      // 3. Valid transition from EN_ROUTE to IN_PROGRESS
      const enRouteProject: Project = { ...mockProject, status: 'EN_ROUTE' };
      expect(() => {
        validateProjectPatchRoleGuards(leadTech, enRouteProject, {
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
        validateProjectPatchRoleGuards(leadTech, inProgressProject, {
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
        validateProjectPatchRoleGuards(leadTech, projectWithStuck, {
          status: 'STUCK',
          stuckIncidents: [initialIncident, secondValidIncident],
        });
      }).not.toThrow();

      // 2. Reject if newly appended incident has resolutionStatus = RESOLVED
      expect(() => {
        validateProjectPatchRoleGuards(leadTech, projectWithStuck, {
          status: 'STUCK',
          stuckIncidents: [
            initialIncident,
            { ...secondValidIncident, resolutionStatus: 'RESOLVED' },
          ],
        });
      }).toThrowError(/دسترسی غیرمجاز: تکنسین فقط میتواند گزارش استاک جدید ثبت کند/);

      // 3. Reject if existing incident was modified
      expect(() => {
        validateProjectPatchRoleGuards(leadTech, projectWithStuck, {
          status: 'STUCK',
          stuckIncidents: [
            { ...initialIncident, description: 'دستکاری گزارش قبلی' },
            secondValidIncident,
          ],
        });
      }).toThrowError(/دسترسی غیرمجاز: تکنسین فقط میتواند گزارش استاک جدید ثبت کند/);

      // 4. Reject if no new incident appended (same length)
      expect(() => {
        validateProjectPatchRoleGuards(leadTech, projectWithStuck, {
          stuckIncidents: [initialIncident],
        });
      }).toThrowError(/دسترسی غیرمجاز: تکنسین فقط میتواند گزارش استاک جدید ثبت کند/);

      // 5. Reject if incidents array truncated
      expect(() => {
        validateProjectPatchRoleGuards(leadTech, projectWithStuck, {
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
        validateProjectPatchRoleGuards(leadTech, inProgressProject, {
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

      // سرپرست پروژه گزارش روزانه‌ی خودش را اضافه می‌کند
      const newLog = {
        id: 'log-2',
        date: '2026-11-02',
        note: 'روز دوم پارچه‌ها آویزان شدند',
        photos: [],
        byUserId: leadTech.id,
        byUserName: leadTech.name,
        createdAt: '2026-11-02T16:00:00Z',
      };
      expect(() => {
        validateProjectPatchRoleGuards(leadTech, projectWithLog, {
          dailyLogs: [existingLog, newLog],
        });
      }).not.toThrow();

      // Appending log with another user's ID
      expect(() => {
        validateProjectPatchRoleGuards(leadTech, projectWithLog, {
          dailyLogs: [existingLog, { ...newLog, byUserId: 'other-user' }],
        });
      }).toThrowError(/ثبت لاگ روزانه فقط با هویت خودتان مجاز است/);

      // Mutating previous log
      expect(() => {
        validateProjectPatchRoleGuards(leadTech, projectWithLog, {
          dailyLogs: [{ ...existingLog, note: 'دستکاری شد' }, newLog],
        });
      }).toThrowError(/ویرایش لاگ‌های روزانه قبلی مجاز نیست/);

      // تکنسین (نه سرپرست) اصلاً گزارش روزانه ثبت نمی‌کند، چه برسد به تأیید سرپرست
      expect(() => {
        validateProjectPatchRoleGuards(technician, projectWithLog, {
          dailyLogs: [existingLog, { ...newLog, byUserId: technician.id, supervisorConfirmed: true }],
        });
      }).toThrowError(/فقط سرپرست این پروژه/);

      // Lead technician CAN submit daily log with supervisorConfirmed = true
      expect(() => {
        validateProjectPatchRoleGuards(leadTech, projectWithLog, {
          dailyLogs: [existingLog, { ...newLog, byUserId: leadTech.id, supervisorConfirmed: true }],
        });
      }).not.toThrow();
    });

    it('allows exceptional completion fields in technician patch', () => {
      expect(() => {
        validateProjectPatchRoleGuards(leadTech, { ...mockProject, status: 'IN_PROGRESS' }, {
          status: 'COMPLETED',
          qcStatus: 'PENDING',
          isExceptionalCompletion: true,
          exceptionalCompletionDetails: {
            hasIncompleteActivities: true,
            remainingActivities: [{ activityId: 'act-1', title: 'پرده', remainingQuantity: 1, unit: 'لت' }],
            documentedReason: 'کناف سقف آماده نبود و کارفرما عدم نصب را پذیرفت',
            confirmedBySupervisor: leadTech.name,
            confirmedAt: '2026-11-02T16:00:00Z',
          },
        });
      }).not.toThrow();
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
        validateProjectPatchRoleGuards(leadTech, projectWithOpenSession, {
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
        validateProjectPatchRoleGuards(leadTech, projectWithLeadSession, {
          workSessions: [{ ...sessionByLead, endedAt: '2026-11-01T16:00:00Z' }],
        });
      }).not.toThrow();

      // ...but cannot rewrite its start time while closing it
      expect(() => {
        validateProjectPatchRoleGuards(leadTech, projectWithLeadSession, {
          workSessions: [{ ...sessionByLead, startedAt: '2026-11-01T01:00:00Z', endedAt: '2026-11-01T16:00:00Z' }],
        });
      }).toThrowError(/تغییر سایر مشخصات جلسه کاری مجاز نیست/);

      // Unchanged arrays (no-op) are allowed
      expect(() => {
        validateProjectPatchRoleGuards(leadTech, projectWithLeadSession, {
          workSessions: [sessionByLead],
          dailyLogs: [],
        });
      }).not.toThrow();
    });

    it('strictly forbids ANY user (including QC_MANAGER) from mutating locked originalPlan directly', () => {
      const lockedProject: Project = {
        ...mockProject,
        status: 'IN_PROGRESS',
        originalPlan: {
          lockedAt: '2026-05-01T08:00:00Z',
          activities: [
            {
              id: 'act-1',
              title: 'پرده برقی',
              category: 'CURTAIN',
              plannedQuantity: 10,
              unit: 'لت',
            },
          ],
        },
      };

      // QC_MANAGER blocked
      expect(() => {
        validateProjectPatchRoleGuards(qcManager, lockedProject, {
          originalPlan: {
            lockedAt: '2026-05-01T08:00:00Z',
            activities: [
              {
                id: 'act-1',
                title: 'پرده برقی',
                category: 'CURTAIN',
                plannedQuantity: 15,
                unit: 'لت',
              },
            ],
          },
        });
      }).toThrowError(/طرح اولیه نصب \(Original Plan\) پس از قفل شدن یا زمان‌بندی تغییرناپذیر است/);

      // Coordinator blocked
      expect(() => {
        validateProjectPatchRoleGuards(coordinator, lockedProject, {
          originalPlan: {
            lockedAt: '2026-05-01T08:00:00Z',
            activities: [],
          },
        });
      }).toThrowError(/طرح اولیه نصب \(Original Plan\) پس از قفل شدن یا زمان‌بندی تغییرناپذیر است/);

      // Technician blocked
      expect(() => {
        validateProjectPatchRoleGuards(leadTech, lockedProject, {
          originalPlan: {
            lockedAt: '2026-05-01T08:00:00Z',
            activities: [],
          },
        });
      }).toThrowError(/طرح اولیه نصب \(Original Plan\) پس از قفل شدن یا زمان‌بندی تغییرناپذیر است/);
    });

    it('allows QC_MANAGER to initialize originalPlan only before lock during MEASUREMENT_PENDING', () => {
      const draftProject: Project = {
        ...mockProject,
        status: 'MEASUREMENT_PENDING',
        originalPlan: undefined,
      };

      expect(() => {
        validateProjectPatchRoleGuards(qcManager, draftProject, {
          originalPlan: {
            lockedAt: '2026-05-01T08:00:00Z',
            activities: [
              {
                id: 'act-1',
                title: 'شید رول',
                category: 'SHADE',
                plannedQuantity: 5,
                unit: 'لت',
              },
            ],
          },
        });
      }).not.toThrow();

      // Technician cannot initialize it even during MEASUREMENT_PENDING
      expect(() => {
        validateProjectPatchRoleGuards(leadTech, draftProject, {
          originalPlan: {
            lockedAt: '2026-05-01T08:00:00Z',
            activities: [],
          },
        });
      }).toThrowError(/تعریف طرح اولیه فقط در صلاحیت مدیر QC است/);
    });

    it('enforces approved amendment immutability: deletion and field changes are rejected for ALL users', () => {
      const approvedAmend = {
        id: 'amend-10',
        activityId: 'act-1',
        activityTitle: 'پرده برقی',
        previousQuantity: 10,
        newQuantity: 12,
        reason: 'افزایش ۲ لت کارفرما',
        requestedByUserId: technician.id,
        requestedByUserName: technician.name,
        requestedAt: '2026-05-15T10:00:00Z',
        status: 'APPROVED' as const,
        reviewedByUserId: qcManager.id,
        reviewedByUserName: qcManager.name,
        reviewedAt: '2026-05-15T11:00:00Z',
      };

      const projectWithAmend: Project = {
        ...mockProject,
        status: 'IN_PROGRESS',
        planAmendments: [approvedAmend],
      };

      // 1. Deletion blocked for QC_MANAGER
      expect(() => {
        validateProjectPatchRoleGuards(qcManager, projectWithAmend, {
          planAmendments: [],
        });
      }).toThrowError(/حذف سوابق اصلاحیه‌های نهایی‌شده طرح امکان‌پذیر نیست/);

      // 2. Tampering quantity blocked for QC_MANAGER
      expect(() => {
        validateProjectPatchRoleGuards(qcManager, projectWithAmend, {
          planAmendments: [{ ...approvedAmend, newQuantity: 18 }],
        });
      }).toThrowError(/اصلاحیه تاییدشده قبلی غیرقابل تغییر است/);

      // 3. Tampering reason blocked for QC_MANAGER
      expect(() => {
        validateProjectPatchRoleGuards(qcManager, projectWithAmend, {
          planAmendments: [{ ...approvedAmend, reason: 'علت دیگر' }],
        });
      }).toThrowError(/اصلاحیه تاییدشده قبلی غیرقابل تغییر است/);

      // 4. Technician cannot approve a new amendment
      const pendingAmend = {
        id: 'amend-11',
        activityId: 'act-1',
        activityTitle: 'پرده برقی',
        previousQuantity: 12,
        newQuantity: 14,
        reason: 'درخواست جدید',
        requestedByUserId: technician.id,
        requestedByUserName: technician.name,
        requestedAt: '2026-05-16T10:00:00Z',
        status: 'APPROVED' as const, // Unauthorized approval!
      };

      expect(() => {
        validateProjectPatchRoleGuards(leadTech, projectWithAmend, {
          planAmendments: [approvedAmend, pendingAmend],
        });
      }).toThrowError(/تایید بازنگری و تغییر سقف برنامه فقط در صلاحیت مدیر QC است/);
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
