import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  canAccessProject,
  isValidStatusTransition,
  validateProjectPatchRoleGuards,
  validateTicketRoleGuards,
  validateEvaluationRoleGuards,
  validateProjectDeleteRoleGuards,
  validateCeoRegistryAccess,
  validateTeamTransferAcknowledgmentPatch,
  isHandoverGatePassed,
} from '../roleGuards';
import { canApproveFinalQC } from '../qcWorkflow';
import {
  canEditSalesBooking,
  canDeleteSalesBooking,
  createSalesBooking,
  updateSalesBooking,
  deleteSalesBooking,
} from '../salesCapacity';
import { canManageMaterialProcurement } from '../materialRequests';
import { Project, User, Ticket, SalesProjectBooking } from '../../types';
import { PermanentError } from '../offlineQueue';

describe('Talaei Full 5-Role RBAC & Authority Boundaries Verification', () => {
  // Test Users for all 8 organizational roles
  const ceoUser: User = {
    id: 'u-ceo',
    name: 'امید طلایی (مدیرعامل)',
    phone: '09121111110',
    role: 'CEO',
    active: true,
  };

  const qcManagerUser: User = {
    id: 'u-qc-mgr',
    name: 'امین رحمانی (مدیر ارشد QC)',
    phone: '09124339038',
    role: 'QC_MANAGER',
    active: true,
  };

  const coordinatorUser: User = {
    id: 'u-coord',
    name: 'سارا سعادت (هماهنگ‌کننده نصب)',
    phone: '09122222222',
    role: 'SCHEDULING_COORDINATOR',
    active: true,
  };

  const salesRepUser1: User = {
    id: 'u-sales-1',
    name: 'سپهر رادمنش',
    phone: '09127777771',
    role: 'SALES_REP',
    active: true,
  };

  const salesRepUser2: User = {
    id: 'u-sales-2',
    name: 'نیلوفر صبوری',
    phone: '09127777772',
    role: 'SALES_REP',
    active: true,
  };

  const warehouseUser: User = {
    id: 'u-wh',
    name: 'حسین انباردار',
    phone: '09128888888',
    role: 'WAREHOUSE',
    active: true,
  };

  const leadTechUser: User = {
    id: 'u-lead-1',
    name: 'فرخ نقدعلیان (سرپرست اکیپ ۱)',
    phone: '09123333331',
    role: 'LEAD_TECHNICIAN',
    teamId: 'TEAM_1',
    active: true,
  };

  const technicianUser: User = {
    id: 'u-tech-1',
    name: 'علی محمدی (تکنسین اکیپ ۱)',
    phone: '09123333332',
    role: 'TECHNICIAN',
    teamId: 'TEAM_1',
    active: true,
  };

  const unrelatedTechUser: User = {
    id: 'u-tech-2',
    name: 'محسن کریمی (تکنسین اکیپ ۲)',
    phone: '09123333333',
    role: 'TECHNICIAN',
    teamId: 'TEAM_2',
    active: true,
  };

  const measurementLeadUser: User = {
    id: 'u-measure',
    name: 'مهندس اندازه‌گیری',
    phone: '09129999991',
    role: 'MEASUREMENT_LEAD',
    active: true,
  };

  const baseProject: Project = {
    id: 'prj-rbac-101',
    code: 'PRJ-101',
    title: 'پروژه برج نگین',
    customerName: 'مهندس حسینی',
    customerPhone: '09123456780',
    address: 'زعفرانیه، کوچه نسترن',
    status: 'IN_PROGRESS',
    qcStatus: 'NOT_STARTED',
    leadTechnicianId: leadTechUser.id,
    assignedTechnicianIds: [leadTechUser.id, technicianUser.id],
    assignedTeamId: 'TEAM_1',
    assignedTeamName: 'اکیپ ۱ (نقدعلیان)',
    technicalHandover: {
      isHandoverComplete: true,
      warehouseConfirmation: {
        confirmed: true,
        confirmedAt: '2026-11-20T10:00:00Z',
        confirmedBy: warehouseUser.name,
      },
    },
    toolsRequired: ['دریل'],
    isFullTools: true,
    createdAt: '2026-11-20T08:00:00Z',
    updatedAt: '2026-11-20T08:00:00Z',
  };

  // Mock localStorage for sales booking tests
  let store: Record<string, string> = {};
  beforeEach(() => {
    store = {};
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = String(v);
      },
      removeItem: (k: string) => {
        delete store[k];
      },
      clear: () => {
        store = {};
      },
    });
    vi.stubGlobal('window', {
      dispatchEvent: vi.fn(),
    });
  });

  // ============================================================================
  // ۱. مدیرعامل (CEO) - تنها فرد دارای اختیار حذف و مشاهده شناسنامه رسمی
  // ============================================================================
  describe('1. CEO: Exclusive Deletion & Official Registry Authority', () => {
    it('authorizes CEO and QC Manager to delete projects', () => {
      expect(() => validateProjectDeleteRoleGuards(ceoUser)).not.toThrow();
      expect(() => validateProjectDeleteRoleGuards(qcManagerUser)).not.toThrow();
    });

    it('denies non-management roles from deleting projects', () => {
      const nonAdminRoles = [
        coordinatorUser,
        salesRepUser1,
        warehouseUser,
        leadTechUser,
        technicianUser,
        measurementLeadUser,
      ];

      for (const nonAdmin of nonAdminRoles) {
        expect(() => validateProjectDeleteRoleGuards(nonAdmin)).toThrow(PermanentError);
        expect(() => validateProjectDeleteRoleGuards(nonAdmin)).toThrowError(
          /منحصراً مدیریت/
        );
      }
    });

    it('denies inactive CEO from deleting projects', () => {
      expect(() => validateProjectDeleteRoleGuards({ ...ceoUser, active: false })).toThrow(PermanentError);
    });

    it('grants official registry access EXCLUSIVELY to CEO', () => {
      expect(validateCeoRegistryAccess(ceoUser)).toBe(true);
      expect(validateCeoRegistryAccess(qcManagerUser)).toBe(false);
      expect(validateCeoRegistryAccess(coordinatorUser)).toBe(false);
      expect(validateCeoRegistryAccess(salesRepUser1)).toBe(false);
      expect(validateCeoRegistryAccess(warehouseUser)).toBe(false);
      expect(validateCeoRegistryAccess(leadTechUser)).toBe(false);
      expect(validateCeoRegistryAccess(technicianUser)).toBe(false);
      expect(validateCeoRegistryAccess({ ...ceoUser, active: false })).toBe(false);
    });

    it('authorizes QC Manager exclusively to delete sales bookings', () => {
      expect(canDeleteSalesBooking(qcManagerUser)).toBe(true);
      expect(canDeleteSalesBooking(ceoUser)).toBe(false);
      expect(canDeleteSalesBooking(coordinatorUser)).toBe(false);
      expect(canDeleteSalesBooking(salesRepUser1)).toBe(false);
      expect(canDeleteSalesBooking(warehouseUser)).toBe(false);
      expect(canDeleteSalesBooking(technicianUser)).toBe(false);

      const booking = createSalesBooking({
        customerName: 'مشتری آزمایشی',
        customerPhone: '09120000000',
        address: 'تهران',
        lathsCount: 10,
        isSmart: true,
        requestedDate: '2026-12-01',
        jalaliDate: '۱۴۰۵/۰۹/۱۰',
        allocationMode: 'SPREAD_DAILY',
        allocatedTeams: ['TEAM_1'],
        allocatedDaysCount: 1,
        salesRepId: salesRepUser1.id,
        salesRepName: salesRepUser1.name,
      });

      // Non-QC-Manager attempt to delete fails
      expect(() => deleteSalesBooking(booking.id, salesRepUser1)).toThrow(PermanentError);
      expect(() => deleteSalesBooking(booking.id, ceoUser)).toThrow(PermanentError);

      // QC Manager succeeds
      expect(deleteSalesBooking(booking.id, qcManagerUser)).toBe(true);
    });

    it('denies CEO from approving final QC or submitting personnel evaluations', () => {
      expect(canApproveFinalQC(ceoUser, baseProject).allowed).toBe(false);
      expect(() =>
        validateProjectPatchRoleGuards(ceoUser, baseProject, { qcStatus: 'APPROVED' })
      ).toThrow(PermanentError);
      expect(() => validateEvaluationRoleGuards(ceoUser)).toThrow(PermanentError);
    });
  });

  // ============================================================================
  // ۲. مدیر اپ و QC (QC_MANAGER) - راهبری عملیاتی، تخصیص اکیپ‌ها و تأیید نهایی کیفی
  // ============================================================================
  describe('2. QC_MANAGER: Operational Leadership, Crew Allocation & Quality Gate', () => {
    it('authorizes QC Manager to allocate teams and crews on projects', () => {
      expect(() =>
        validateProjectPatchRoleGuards(qcManagerUser, baseProject, {
          assignedTeamId: 'TEAM_2',
          leadTechnicianId: 'u-lead-2',
          assignedTechnicianIds: ['u-lead-2', 'u-tech-2'],
        })
      ).not.toThrow();
    });

    it('grants QC Manager exclusive authority for final QC approval on completed projects', () => {
      const completedProject: Project = {
        ...baseProject,
        status: 'COMPLETED',
        qcStatus: 'PENDING',
        completionReportedAt: '2026-11-20T16:00:00Z',
        customerHandover: {
          satisfactionScore: 5,
          customerSignature: 'data:image/png;base64,sig',
          checklist: {
            dimensionsMatch: true,
            accessoriesInstalled: true,
            cleaningDone: true,
            safetyTested: true,
            clientTrained: true,
          },
        },
      };

      expect(canApproveFinalQC(qcManagerUser, completedProject).allowed).toBe(true);
      expect(() =>
        validateProjectPatchRoleGuards(qcManagerUser, completedProject, {
          qcStatus: 'APPROVED',
          qcApprovedBy: qcManagerUser.id,
        })
      ).not.toThrow();
    });

    it('authorizes QC Manager to register defects, qcInspections and personnel evaluations', () => {
      expect(() =>
        validateProjectPatchRoleGuards(qcManagerUser, baseProject, {
          qcInspections: [
            {
              id: 'insp-10',
              passed: true,
              inspectorId: qcManagerUser.id,
              date: '2026-11-20T11:00:00Z',
              score: 95,
            },
          ],
        })
      ).not.toThrow();

      expect(() => validateEvaluationRoleGuards(qcManagerUser)).not.toThrow();
    });

    it('authorizes QC Manager to execute managerOverride on blocked team transfers', () => {
      const transferredProject: Project = {
        ...baseProject,
        teamTransfers: [
          {
            id: 'tr-1',
            fromTeamId: 'TEAM_1',
            fromTeamName: 'اکیپ ۱',
            toTeamId: 'TEAM_2',
            toTeamName: 'اکیپ ۲',
            transferredAt: '2026-11-20T12:00:00Z',
            transferredByUserId: qcManagerUser.id,
            transferredByUserName: qcManagerUser.name,
            reason: 'اضافه بار کاری',
            notes: '',
            transferredWorkloadHours: 4,
            handoverInventory: [],
            receivingLeadConfirmed: false,
          },
        ],
      };

      const validOverride = [
        {
          ...transferredProject.teamTransfers![0],
          receivingLeadConfirmed: false,
          isManagerOverride: true,
          managerOverrideRole: 'QC_MANAGER',
          managerOverrideByUserId: qcManagerUser.id,
          managerOverrideReason: 'تایید اضطراری شروع کار به دستور مدیر ارشد QC',
          managerOverrideAt: '2026-11-20T13:00:00Z',
        },
      ];

      expect(() =>
        validateTeamTransferAcknowledgmentPatch(qcManagerUser, transferredProject, validOverride)
      ).not.toThrow();
    });

    it('authorizes QC Manager to delete sales bookings and installation projects', () => {
      expect(() => validateProjectDeleteRoleGuards(qcManagerUser)).not.toThrow();
      expect(canDeleteSalesBooking(qcManagerUser)).toBe(true);
    });
  });

  // ============================================================================
  // ۳. پرسنل فروش (SALES_REP) - فقط ویرایش رزروهای خود و ممنوعیت ادیت دیگران
  // ============================================================================
  describe('3. SALES_REP: Own Booking Modification Exclusivity & Strict Isolation', () => {
    let rep1Booking: SalesProjectBooking;
    let rep2Booking: SalesProjectBooking;

    beforeEach(() => {
      rep1Booking = createSalesBooking({
        customerName: 'مشتری سپهر رادمنش',
        customerPhone: '09121111111',
        address: 'فرمانیه',
        lathsCount: 15,
        isSmart: true,
        requestedDate: '2026-12-05',
        jalaliDate: '۱۴۰۵/۰۹/۱۴',
        allocationMode: 'SPREAD_DAILY',
        allocatedTeams: ['TEAM_1'],
        allocatedDaysCount: 1,
        salesRepId: salesRepUser1.id,
        salesRepName: salesRepUser1.name,
      });

      rep2Booking = createSalesBooking({
        customerName: 'مشتری نیلوفر صبوری',
        customerPhone: '09122222222',
        address: 'کامرانیه',
        lathsCount: 20,
        isSmart: true,
        requestedDate: '2026-12-06',
        jalaliDate: '۱۴۰۵/۰۹/۱۵',
        allocationMode: 'SPREAD_DAILY',
        allocatedTeams: ['TEAM_2'],
        allocatedDaysCount: 1,
        salesRepId: salesRepUser2.id,
        salesRepName: salesRepUser2.name,
      });
    });

    it('permits SALES_REP to edit their own bookings', () => {
      expect(canEditSalesBooking(salesRepUser1, rep1Booking)).toBe(true);
      expect(canEditSalesBooking(salesRepUser2, rep2Booking)).toBe(true);

      const updated = updateSalesBooking(
        rep1Booking.id,
        { customerName: 'مشتری ویرایش‌شده سپهر', notes: 'یادداشت جدید' },
        salesRepUser1
      );
      expect(updated.customerName).toBe('مشتری ویرایش‌شده سپهر');
    });

    it('STRICTLY PROHIBITS SALES_REP from editing bookings registered by other reps', () => {
      expect(canEditSalesBooking(salesRepUser1, rep2Booking)).toBe(false);
      expect(canEditSalesBooking(salesRepUser2, rep1Booking)).toBe(false);

      expect(() =>
        updateSalesBooking(rep2Booking.id, { customerName: 'تغییر غیرمجاز' }, salesRepUser1)
      ).toThrow(PermanentError);
      expect(() =>
        updateSalesBooking(rep2Booking.id, { customerName: 'تغییر غیرمجاز' }, salesRepUser1)
      ).toThrowError(/کارشناس فروش فقط مجاز به ویرایش پروژه‌های ثبت‌شده توسط خود می‌باشد/);
    });

    it('permits CEO full administrative authority to edit any booking', () => {
      expect(canEditSalesBooking(ceoUser, rep1Booking)).toBe(true);
      expect(canEditSalesBooking(ceoUser, rep2Booking)).toBe(true);

      const updatedByCeo = updateSalesBooking(
        rep1Booking.id,
        { customerName: 'تغییر توسط مدیرعامل' },
        ceoUser
      );
      expect(updatedByCeo.customerName).toBe('تغییر توسط مدیرعامل');
    });

    it('prohibits SALES_REP from deleting any booking', () => {
      expect(canDeleteSalesBooking(salesRepUser1)).toBe(false);
      expect(() => deleteSalesBooking(rep1Booking.id, salesRepUser1)).toThrow(PermanentError);
    });

    it('prohibits SALES_REP from patching technical fields or approving QC', () => {
      expect(() =>
        validateProjectPatchRoleGuards(salesRepUser1, baseProject, { qcStatus: 'APPROVED' })
      ).toThrow(PermanentError);
      expect(() =>
        validateProjectPatchRoleGuards(salesRepUser1, baseProject, { status: 'COMPLETED' })
      ).toThrow(PermanentError);
    });
  });

  // ============================================================================
  // ۴. انباردار (WAREHOUSE) - گیت ورود کالا، بسته‌بندی و رفع تیکت‌های کسری
  // ============================================================================
  describe('4. WAREHOUSE: Goods Intake Gate, Preparation & Shortage Ticket Resolution', () => {
    it('enforces Goods Intake Gate: projects cannot be scheduled or dispatched without warehouse intake confirmation', () => {
      const projectWithoutIntake: Project = {
        ...baseProject,
        status: 'MEASUREMENT_PENDING',
        technicalHandover: {
          isHandoverComplete: false,
          warehouseConfirmation: { confirmed: false },
        },
      };

      expect(isHandoverGatePassed(projectWithoutIntake)).toBe(false);

      expect(() =>
        validateProjectPatchRoleGuards(coordinatorUser, projectWithoutIntake, {
          status: 'SCHEDULED',
          scheduledDate: '2026-11-25',
          assignedTeamId: 'TEAM_1',
        })
      ).toThrow(PermanentError);
      expect(() =>
        validateProjectPatchRoleGuards(coordinatorUser, projectWithoutIntake, {
          status: 'SCHEDULED',
        })
      ).toThrowError(/پیش‌نیاز تحویل و ورود کالا به انبار/);
    });

    it('allows WAREHOUSE to patch technicalHandover and warehousePrep', () => {
      expect(() =>
        validateProjectPatchRoleGuards(warehouseUser, baseProject, {
          technicalHandover: {
            warehouseConfirmation: {
              confirmed: true,
              confirmedAt: '2026-11-21T09:00:00Z',
              confirmedBy: warehouseUser.name,
            },
          },
          warehousePrep: {
            packingCompleted: true,
            packedBy: warehouseUser.name,
            packedAt: '2026-11-21T10:00:00Z',
          },
          updatedAt: '2026-11-21T10:00:00Z',
        })
      ).not.toThrow();
    });

    it('prohibits WAREHOUSE from tampering with status, customer data or technician fields', () => {
      expect(() =>
        validateProjectPatchRoleGuards(warehouseUser, baseProject, { status: 'COMPLETED' })
      ).toThrow(PermanentError);

      expect(() =>
        validateProjectPatchRoleGuards(warehouseUser, baseProject, { customerPhone: '09120000000' })
      ).toThrow(PermanentError);

      expect(() =>
        validateProjectPatchRoleGuards(warehouseUser, baseProject, { qcStatus: 'APPROVED' })
      ).toThrow(PermanentError);
    });

    it('authorizes WAREHOUSE to manage material procurement and dispatch', () => {
      expect(canManageMaterialProcurement(warehouseUser)).toBe(true);
    });

    it('authorizes WAREHOUSE to resolve shortage tickets (قطعات و کسری)', () => {
      const ticket: Partial<Ticket> = {
        id: 't-shortage-1',
        projectId: baseProject.id,
        type: 'MISSING_ITEMS',
        description: 'کسری بست کمربندی و لیمیت هوشمند',
        status: 'RESOLVED',
      };

      expect(() => validateTicketRoleGuards(warehouseUser, baseProject, ticket)).not.toThrow();
    });

    it('prohibits WAREHOUSE from deleting projects or bookings', () => {
      expect(() => validateProjectDeleteRoleGuards(warehouseUser)).toThrow(PermanentError);
      expect(canDeleteSalesBooking(warehouseUser)).toBe(false);
    });
  });

  // ============================================================================
  // ۵. تکنسین‌ها (TECHNICIAN & LEAD_TECHNICIAN) - وظایف کارگاهی و محدودیت‌ها
  // ============================================================================
  describe('5. TECHNICIAN & LEAD_TECHNICIAN: Field Execution & Strict Boundaries', () => {
    it('permits assigned crew to access and update allowed fields only', () => {
      expect(canAccessProject(technicianUser, baseProject, 'TEAM_1')).toBe(true);
      expect(canAccessProject(leadTechUser, baseProject, 'TEAM_1')).toBe(true);

      // Allowed fields
      expect(() =>
        validateProjectPatchRoleGuards(
          technicianUser,
          baseProject,
          {
            beforePhotos: ['data:image/png;base64,photo1'],
            handoverChecklist: { dimensionsMatch: true },
            updatedAt: new Date().toISOString(),
          },
          'TEAM_1'
        )
      ).not.toThrow();
    });

    it('strictly isolates unassigned technicians from viewing or patching project', () => {
      expect(canAccessProject(unrelatedTechUser, baseProject, 'TEAM_2')).toBe(false);

      expect(() =>
        validateProjectPatchRoleGuards(
          unrelatedTechUser,
          baseProject,
          { beforePhotos: ['photo'] },
          'TEAM_2'
        )
      ).toThrow(PermanentError);
      expect(() =>
        validateProjectPatchRoleGuards(
          unrelatedTechUser,
          baseProject,
          { beforePhotos: ['photo'] },
          'TEAM_2'
        )
      ).toThrowError(/شما مسئول یا تکنسین تخصیص‌یافته به این پروژه نیستید/);
    });

    it('prohibits technicians from mutating customer phone, address, or customerName', () => {
      expect(() =>
        validateProjectPatchRoleGuards(
          technicianUser,
          baseProject,
          { customerPhone: '09129990000' },
          'TEAM_1'
        )
      ).toThrow(PermanentError);

      expect(() =>
        validateProjectPatchRoleGuards(
          technicianUser,
          baseProject,
          { address: 'تهران، زعفرانیه' },
          'TEAM_1'
        )
      ).toThrow(PermanentError);
    });

    it('prohibits technician from approving QC (only PENDING is permitted at completion)', () => {
      expect(() =>
        validateProjectPatchRoleGuards(
          technicianUser,
          baseProject,
          { qcStatus: 'APPROVED' },
          'TEAM_1'
        )
      ).toThrow(PermanentError);

      // Allowed to set PENDING when finishing job
      expect(() =>
        validateProjectPatchRoleGuards(
          technicianUser,
          baseProject,
          { status: 'COMPLETED', qcStatus: 'PENDING' },
          'TEAM_1'
        )
      ).not.toThrow();
    });

    it('prohibits technicians from resolving tickets', () => {
      const ticket: Partial<Ticket> = {
        id: 't-10',
        projectId: baseProject.id,
        status: 'RESOLVED',
      };

      expect(() =>
        validateTicketRoleGuards(technicianUser, baseProject, ticket, 'TEAM_1')
      ).toThrow(PermanentError);
    });

    it('requires LEAD_TECHNICIAN of the destination team to confirm team transfers', () => {
      const transferredProject: Project = {
        ...baseProject,
        leadTechnicianId: leadTechUser.id,
        teamTransfers: [
          {
            id: 'tr-destination-1',
            fromTeamId: 'TEAM_2',
            fromTeamName: 'اکیپ ۲',
            toTeamId: 'TEAM_1',
            toTeamName: 'اکیپ ۱',
            transferredAt: '2026-11-21T08:00:00Z',
            transferredByUserId: qcManagerUser.id,
            transferredByUserName: qcManagerUser.name,
            reason: 'انتقال تخصصی',
            notes: '',
            transferredWorkloadHours: 2,
            handoverInventory: [],
            receivingLeadConfirmed: false,
          },
        ],
      };

      const patchTransfer = [
        {
          ...transferredProject.teamTransfers![0],
          receivingLeadConfirmed: true,
          receivingLeadConfirmedAt: '2026-11-21T09:00:00Z',
          receivingLeadConfirmedBy: leadTechUser.name,
        },
      ];

      // Regular technician fails
      expect(() =>
        validateTeamTransferAcknowledgmentPatch(technicianUser, transferredProject, patchTransfer, 'TEAM_1')
      ).toThrow(PermanentError);

      // Origin lead technician fails
      expect(() =>
        validateTeamTransferAcknowledgmentPatch(unrelatedTechUser, transferredProject, patchTransfer, 'TEAM_2')
      ).toThrow(PermanentError);

      // Strict destination lead succeeds
      expect(() =>
        validateTeamTransferAcknowledgmentPatch(leadTechUser, transferredProject, patchTransfer, 'TEAM_1')
      ).not.toThrow();
    });

    it('enforces append-only daily logs and restricts supervisor confirmation to lead', () => {
      const existingProject: Project = {
        ...baseProject,
        dailyLogs: [
          {
            id: 'log-1',
            byUserId: technicianUser.id,
            byUserName: technicianUser.name,
            timestamp: '2026-11-20T17:00:00Z',
            note: 'نصب ریل‌ها به پایان رسید.',
            photos: [],
            supervisorConfirmed: false,
          },
        ],
      };

      // Appending a new log by technician: allowed
      const newLog = {
        id: 'log-2',
        byUserId: technicianUser.id,
        byUserName: technicianUser.name,
        timestamp: '2026-11-21T17:00:00Z',
        note: 'پرده‌ها آویزان شد.',
        photos: [],
        supervisorConfirmed: false,
      };

      expect(() =>
        validateProjectPatchRoleGuards(
          technicianUser,
          existingProject,
          { dailyLogs: [...existingProject.dailyLogs!, newLog] },
          'TEAM_1'
        )
      ).not.toThrow();

      // Attempting to self-confirm supervisor by helper technician: denied
      const selfConfirmedLog = { ...newLog, supervisorConfirmed: true };
      expect(() =>
        validateProjectPatchRoleGuards(
          technicianUser,
          existingProject,
          { dailyLogs: [...existingProject.dailyLogs!, selfConfirmedLog] },
          'TEAM_1'
        )
      ).toThrow(PermanentError);
      expect(() =>
        validateProjectPatchRoleGuards(
          technicianUser,
          existingProject,
          { dailyLogs: [...existingProject.dailyLogs!, selfConfirmedLog] },
          'TEAM_1'
        )
      ).toThrowError(/تایید گزارش روزانه منحصراً در صلاحیت سرپرست اکیپ یا مدیر QC است/);

      // Lead technician appending with supervisorConfirmed: true is allowed
      const leadLog = {
        id: 'log-3',
        byUserId: leadTechUser.id,
        byUserName: leadTechUser.name,
        timestamp: '2026-11-21T18:00:00Z',
        note: 'تایید نهایی کارهای انجام‌شده توسط سرپرست اکیپ.',
        photos: [],
        supervisorConfirmed: true,
      };

      expect(() =>
        validateProjectPatchRoleGuards(
          leadTechUser,
          existingProject,
          { dailyLogs: [...existingProject.dailyLogs!, leadLog] },
          'TEAM_1'
        )
      ).not.toThrow();
    });

    it('prohibits technicians from deleting projects, bookings, or tickets', () => {
      expect(() => validateProjectDeleteRoleGuards(technicianUser)).toThrow(PermanentError);
      expect(() => validateProjectDeleteRoleGuards(leadTechUser)).toThrow(PermanentError);
      expect(canDeleteSalesBooking(technicianUser)).toBe(false);
      expect(canDeleteSalesBooking(leadTechUser)).toBe(false);
    });
  });
});
