import { describe, it, expect } from 'vitest';
import {
  calculateItemBalances,
  getMaterialRequestSummary,
  canCreateMaterialRequest,
  canManageMaterialProcurement,
  canConfirmMaterialReceipt,
  createMaterialRequestPayload,
  createDispatchPayload,
  createConfirmReceiptPayload,
  cancelMaterialRequestPayload,
  updateMaterialRequestStatusPayload,
  generatePrintableDispatchManifest,
  CreateMaterialRequestInput,
  MATERIAL_STATUS_LABELS,
  MATERIAL_STATUS_COLORS,
} from '../materialRequests';
import { User, Project } from '../../types';

describe('Material Requests Domain Logic (Phase P2.3-R1 Hardened)', () => {
  const mockTechUser: User = {
    id: 'usr-tech-1',
    name: 'علی تقوی',
    phone: '09121111111',
    role: 'TECHNICIAN',
    active: true,
    teamId: 'team-1',
  };

  const mockLeadUser: User = {
    id: 'usr-lead-1',
    name: 'محسن کریمی',
    phone: '09122222222',
    role: 'LEAD_TECHNICIAN',
    active: true,
    teamId: 'team-1',
  };

  const mockManagerUser: User = {
    id: 'usr-mgr-1',
    name: 'مهندس حسینی',
    phone: '09123333333',
    role: 'QC_MANAGER',
    active: true,
  };

  const mockCoordinatorUser: User = {
    id: 'usr-coord-1',
    name: 'خانم رضایی',
    phone: '09124444444',
    role: 'SCHEDULING_COORDINATOR',
    active: true,
  };

  const mockUnassignedTech: User = {
    id: 'usr-tech-other',
    name: 'رضا کمالی',
    phone: '09125555555',
    role: 'TECHNICIAN',
    active: true,
    teamId: 'team-99',
  };

  const mockProject: Project = {
    id: 'prj-101',
    code: 'PRJ-101',
    title: 'پروژه برج زعفرانیه',
    customerName: 'آقای شریفی',
    customerPhone: '09129999999',
    address: 'زعفرانیه، خیابان آصف، برج نگین',
    shadePanels: 10,
    curtainPanels: 4,
    proposalImages: [],
    scheduledDate: '2026-11-15',
    scheduledTime: '09:00',
    assignedTeamId: 'team-1',
    assignedTeamName: 'اکیپ نصب ۱',
    leadTechnicianId: 'usr-lead-1',
    assignedTechnicianIds: ['usr-lead-1', 'usr-tech-1'],
    isFullTools: true,
    toolsRequired: [],
    status: 'IN_PROGRESS',
    completionPhotos: [],
    qcStatus: 'NOT_STARTED',
    createdAt: '2026-11-10T08:00:00Z',
    updatedAt: '2026-11-10T08:00:00Z',
  };

  describe('Constants and Status Dictionary', () => {
    it('defines CANCELLED status label and colors', () => {
      expect(MATERIAL_STATUS_LABELS.CANCELLED).toBe('لغو شده');
      expect(MATERIAL_STATUS_COLORS.CANCELLED).toBeDefined();
      expect(MATERIAL_STATUS_COLORS.CANCELLED.text).toContain('stone');
    });
  });

  describe('calculateItemBalances and getMaterialRequestSummary', () => {
    it('calculates zero balances when no dispatches exist', () => {
      const req = createMaterialRequestPayload({
        project: mockProject,
        user: mockTechUser,
        category: 'HARDWARE',
        reason: 'SHORTAGE',
        urgency: 'NORMAL',
        items: [
          { title: 'پایه سقفی', requestedQty: 10, unit: 'عدد' },
          { title: 'موتور سامفی', requestedQty: 2, unit: 'دستگاه' },
        ],
      });

      const balances = calculateItemBalances(req);
      expect(balances[0].requestedQty).toBe(10);
      expect(balances[0].totalDispatchedQty).toBe(0);
      expect(balances[0].totalReceivedQty).toBe(0);
      expect(balances[0].pendingReceiptQty).toBe(0);
      expect(balances[0].remainingToDispatch).toBe(10);
      expect(balances[0].isFullyDispatched).toBe(false);

      const summary = getMaterialRequestSummary(req);
      expect(summary.totalItems).toBe(2);
      expect(summary.isAllDispatched).toBe(false);
      expect(summary.isAllReceived).toBe(false);
      expect(summary.hasPendingReceipt).toBe(false);
    });
  });

  describe('Role Guards & Fail-Closed Invariants', () => {
    describe('canCreateMaterialRequest', () => {
      it('allows assigned technician or lead with matching project', () => {
        expect(canCreateMaterialRequest(mockTechUser, mockProject)).toBe(true);
        expect(canCreateMaterialRequest(mockLeadUser, mockProject)).toBe(true);
      });

      it('allows technician assigned via matching teamId', () => {
        const teamTech: User = {
          id: 'usr-team-tech',
          name: 'تکنسین کمکی',
          phone: '09120000000',
          role: 'TECHNICIAN',
          active: true,
          teamId: 'team-1',
        };
        expect(canCreateMaterialRequest(teamTech, mockProject)).toBe(true);
      });

      it('fails closed when technician is not assigned to the project', () => {
        expect(canCreateMaterialRequest(mockUnassignedTech, mockProject)).toBe(false);
      });

      it('fails closed when technician has no project context', () => {
        expect(canCreateMaterialRequest(mockTechUser, null)).toBe(false);
        expect(canCreateMaterialRequest(mockTechUser, undefined)).toBe(false);
      });

      it('allows QC_MANAGER and SCHEDULING_COORDINATOR with or without project context', () => {
        expect(canCreateMaterialRequest(mockManagerUser, mockProject)).toBe(true);
        expect(canCreateMaterialRequest(mockManagerUser, null)).toBe(true);
        expect(canCreateMaterialRequest(mockCoordinatorUser, undefined)).toBe(true);
      });

      it('rejects inactive users', () => {
        expect(canCreateMaterialRequest({ ...mockManagerUser, active: false }, mockProject)).toBe(false);
        expect(canCreateMaterialRequest({ ...mockTechUser, active: false }, mockProject)).toBe(false);
      });
    });

    describe('canManageMaterialProcurement', () => {
      it('permits QC_MANAGER, SCHEDULING_COORDINATOR and WAREHOUSE', () => {
        expect(canManageMaterialProcurement(mockManagerUser)).toBe(true);
        expect(canManageMaterialProcurement(mockCoordinatorUser)).toBe(true);
        const warehouseUser: User = {
          id: 'u-wh-1',
          name: 'انباردار ۱',
          phone: '09120000008',
          role: 'WAREHOUSE',
          active: true,
        };
        expect(canManageMaterialProcurement(warehouseUser)).toBe(true);
        expect(canManageMaterialProcurement(mockLeadUser)).toBe(false);
        expect(canManageMaterialProcurement(mockTechUser)).toBe(false);
        expect(canManageMaterialProcurement(mockUnassignedTech)).toBe(false);
      });

      it('rejects inactive managers', () => {
        expect(canManageMaterialProcurement({ ...mockManagerUser, active: false })).toBe(false);
      });
    });

    describe('canConfirmMaterialReceipt (Fail-Closed & Management Override)', () => {
      it('allows assigned lead and assigned technicians on the project', () => {
        expect(canConfirmMaterialReceipt(mockLeadUser, mockProject)).toBe(true);
        expect(canConfirmMaterialReceipt(mockTechUser, mockProject)).toBe(true);
      });

      it('allows team member matching assignedTeamId', () => {
        const teamTech: User = {
          id: 'usr-team-only',
          name: 'نصاب کمکی اکیپ',
          phone: '09121112233',
          role: 'TECHNICIAN',
          active: true,
          teamId: 'team-1',
        };
        expect(canConfirmMaterialReceipt(teamTech, mockProject)).toBe(true);
      });

      it('fails closed for unassigned technician even if project is valid', () => {
        expect(canConfirmMaterialReceipt(mockUnassignedTech, mockProject)).toBe(false);
      });

      it('fails closed when project is missing', () => {
        expect(canConfirmMaterialReceipt(mockTechUser, null)).toBe(false);
        expect(canConfirmMaterialReceipt(mockTechUser, undefined)).toBe(false);
      });

      it('rejects manager when no explicit override is provided', () => {
        expect(canConfirmMaterialReceipt(mockManagerUser, mockProject)).toBe(false);
        expect(canConfirmMaterialReceipt(mockCoordinatorUser, mockProject)).toBe(false);
      });

      it('rejects manager override when reason is empty or less than 5 characters', () => {
        expect(
          canConfirmMaterialReceipt(mockManagerUser, mockProject, {
            isManagementOverride: true,
            overrideReason: '',
          })
        ).toBe(false);

        expect(
          canConfirmMaterialReceipt(mockManagerUser, mockProject, {
            isManagementOverride: true,
            overrideReason: 'تست',
          })
        ).toBe(false);
      });

      it('permits manager override when reason has at least 5 characters', () => {
        expect(
          canConfirmMaterialReceipt(mockManagerUser, mockProject, {
            isManagementOverride: true,
            overrideReason: 'تایید تلفنی با سرپرست کارگاه',
          })
        ).toBe(true);

        expect(
          canConfirmMaterialReceipt(mockCoordinatorUser, mockProject, {
            isManagementOverride: true,
            overrideReason: 'تایید اضطراری دفتر مرکزی',
          })
        ).toBe(true);
      });

      it('does NOT allow technician to use management override flag', () => {
        expect(
          canConfirmMaterialReceipt(mockUnassignedTech, mockProject, {
            isManagementOverride: true,
            overrideReason: 'تلاش تکنسین برای بایپس مجوز',
          })
        ).toBe(false);
      });

      it('rejects inactive users', () => {
        expect(
          canConfirmMaterialReceipt({ ...mockTechUser, active: false }, mockProject)
        ).toBe(false);
        expect(
          canConfirmMaterialReceipt(
            { ...mockManagerUser, active: false },
            mockProject,
            { isManagementOverride: true, overrideReason: 'تایید تلفنی با سرپرست کارگاه' }
          )
        ).toBe(false);
      });
    });
  });

  describe('createMaterialRequestPayload', () => {
    it('validates non-empty items and creates a valid request with assigned team info', () => {
      const input: CreateMaterialRequestInput = {
        project: mockProject,
        user: mockTechUser,
        category: 'HARDWARE',
        reason: 'SHORTAGE',
        urgency: 'URGENT',
        items: [
          { title: 'پایه سقفی شید رول', requestedQty: 4, unit: 'عدد' },
          { title: 'زنجیر استیل یدک', requestedQty: 2, unit: 'متر' },
        ],
        notes: 'جهت پنجره پذیرایی کم آمده است.',
      };

      const result = createMaterialRequestPayload(input);
      expect(result.id).toMatch(/^mat-req-/);
      expect(result.projectId).toBe(mockProject.id);
      expect(result.projectCode).toBe(mockProject.code);
      expect(result.assignedTeamId).toBe('team-1');
      expect(result.assignedTeamName).toBe('اکیپ نصب ۱');
      expect(result.status).toBe('SUBMITTED');
      expect(result.items).toHaveLength(2);
      expect(result.items[0].title).toBe('پایه سقفی شید رول');
      expect(result.items[0].requestedQty).toBe(4);
      expect(result.dispatches).toEqual([]);
      expect(result.history).toHaveLength(1);
      expect(result.history[0].action).toBe('SUBMITTED');
    });

    it('rejects unauthorized user from creating request for unassigned project', () => {
      expect(() =>
        createMaterialRequestPayload({
          project: mockProject,
          user: mockUnassignedTech,
          category: 'HARDWARE',
          reason: 'SHORTAGE',
          urgency: 'NORMAL',
          items: [{ title: 'پایه', requestedQty: 2, unit: 'عدد' }],
        })
      ).toThrow(/کاربر مجاز به ثبت درخواست متریال برای این پروژه نمی‌باشد/);
    });

    it('rejects empty items list or invalid quantities', () => {
      expect(() =>
        createMaterialRequestPayload({
          project: mockProject,
          user: mockTechUser,
          category: 'HARDWARE',
          reason: 'SHORTAGE',
          urgency: 'NORMAL',
          items: [],
        })
      ).toThrow('حداقل یک قلم متریال درخواستی باید ثبت گردد.');

      expect(() =>
        createMaterialRequestPayload({
          project: mockProject,
          user: mockTechUser,
          category: 'HARDWARE',
          reason: 'SHORTAGE',
          urgency: 'NORMAL',
          items: [{ title: 'پایه', requestedQty: 0, unit: 'عدد' }],
        })
      ).toThrow(/باید عددی مثبت و بزرگتر از صفر باشد/);

      expect(() =>
        createMaterialRequestPayload({
          project: mockProject,
          user: mockTechUser,
          category: 'HARDWARE',
          reason: 'SHORTAGE',
          urgency: 'NORMAL',
          items: [{ title: 'پایه', requestedQty: -3, unit: 'عدد' }],
        })
      ).toThrow(/باید عددی مثبت و بزرگتر از صفر باشد/);
    });
  });

  describe('createDispatchPayload & Over-Dispatch Prevention', () => {
    it('prevents over-dispatch when dispatchedQty exceeds remaining balance', () => {
      const req = createMaterialRequestPayload({
        project: mockProject,
        user: mockTechUser,
        category: 'HARDWARE',
        reason: 'SHORTAGE',
        urgency: 'NORMAL',
        items: [{ title: 'پایه سقفی', requestedQty: 5, unit: 'عدد' }],
      });

      expect(() =>
        createDispatchPayload(
          req,
          {
            courierInfo: 'پیک اسنپ',
            items: [{ itemId: req.items[0].id, dispatchedQty: 6 }],
          },
          mockManagerUser
        )
      ).toThrow(/نمی‌تواند بیشتر از مانده تامین/);
    });

    it('rejects zero or negative quantities with clear error', () => {
      const req = createMaterialRequestPayload({
        project: mockProject,
        user: mockTechUser,
        category: 'HARDWARE',
        reason: 'SHORTAGE',
        urgency: 'NORMAL',
        items: [{ title: 'پایه سقفی', requestedQty: 5, unit: 'عدد' }],
      });

      expect(() =>
        createDispatchPayload(
          req,
          {
            courierInfo: 'پیک اسنپ',
            items: [{ itemId: req.items[0].id, dispatchedQty: 0 }],
          },
          mockManagerUser
        )
      ).toThrow(/باید عددی مثبت و بزرگتر از صفر باشد/);

      expect(() =>
        createDispatchPayload(
          req,
          {
            courierInfo: 'پیک اسنپ',
            items: [{ itemId: req.items[0].id, dispatchedQty: -1 }],
          },
          mockManagerUser
        )
      ).toThrow(/باید عددی مثبت و بزرگتر از صفر باشد/);
    });

    it('rejects dispatch creation when request is CANCELLED or DELIVERED_CONFIRMED', () => {
      const req = createMaterialRequestPayload({
        project: mockProject,
        user: mockTechUser,
        category: 'HARDWARE',
        reason: 'SHORTAGE',
        urgency: 'NORMAL',
        items: [{ title: 'پایه سقفی', requestedQty: 5, unit: 'عدد' }],
      });

      const cancelled = cancelMaterialRequestPayload(req, mockTechUser, 'عدم نیاز پروژه');

      expect(() =>
        createDispatchPayload(
          cancelled,
          {
            courierInfo: 'پیک اسنپ',
            items: [{ itemId: req.items[0].id, dispatchedQty: 2 }],
          },
          mockManagerUser
        )
      ).toThrow(/امکان ارسال محموله برای درخواست با وضعیت «لغو شده» وجود ندارد/);
    });
  });

  describe('createConfirmReceiptPayload & Idempotency', () => {
    it('verifies project association, updates balance, and is idempotent', () => {
      const req = createMaterialRequestPayload({
        project: mockProject,
        user: mockTechUser,
        category: 'HARDWARE',
        reason: 'SHORTAGE',
        urgency: 'NORMAL',
        items: [
          { title: 'پایه سقفی', requestedQty: 10, unit: 'عدد' },
          { title: 'موتور سامفی', requestedQty: 2, unit: 'دستگاه' },
        ],
      });

      const itemId1 = req.items[0].id;
      const itemId2 = req.items[1].id;

      // Dispatch 1: 6 bases dispatched by courier
      const reqWithDisp1 = createDispatchPayload(
        req,
        {
          courierInfo: 'اسنپ باکس - راننده بهرامی',
          trackingCode: 'SNP-9921',
          items: [{ itemId: itemId1, dispatchedQty: 6 }],
        },
        mockManagerUser
      );

      const dispId1 = reqWithDisp1.dispatches[0].id;

      // Reject receipt confirmation if mismatched project is passed
      const mismatchedProject: Project = { ...mockProject, id: 'prj-other-999' };
      expect(() =>
        createConfirmReceiptPayload(reqWithDisp1, dispId1, mockLeadUser, mismatchedProject)
      ).toThrow(/پروژه ارائه شده با شناسه پروژه درخواست متریال مغایرت دارد/);

      // Reject if unassigned user attempts to confirm
      expect(() =>
        createConfirmReceiptPayload(reqWithDisp1, dispId1, mockUnassignedTech, mockProject)
      ).toThrow(/کاربر مجاز به تایید دریافت این محموله سر کارگاه نمی‌باشد/);

      // Successful confirmation by assigned technician
      const reqWithReceipt1 = createConfirmReceiptPayload(
        reqWithDisp1,
        dispId1,
        mockLeadUser,
        mockProject
      );
      expect(reqWithReceipt1.dispatches[0].receivedAtSiteConfirmed).toBe(true);
      expect(reqWithReceipt1.status).toBe('PARTIALLY_DISPATCHED');

      // Idempotent: calling again on already confirmed dispatch returns the same object without extra history
      const reqDuplicate = createConfirmReceiptPayload(
        reqWithReceipt1,
        dispId1,
        mockLeadUser,
        mockProject
      );
      expect(reqDuplicate).toBe(reqWithReceipt1);
      expect(reqDuplicate.history.length).toBe(reqWithReceipt1.history.length);

      // Dispatch 2: Remaining 4 bases and 2 motors
      const reqWithDisp2 = createDispatchPayload(
        reqWithReceipt1,
        {
          courierInfo: 'پیک موتوری شرکت - آقای مرادی',
          items: [
            { itemId: itemId1, dispatchedQty: 4 },
            { itemId: itemId2, dispatchedQty: 2 },
          ],
        },
        mockManagerUser
      );

      expect(reqWithDisp2.status).toBe('DISPATCHED');
      const dispId2 = reqWithDisp2.dispatches[1].id;

      // Confirm Dispatch 2 via management override with justification
      const reqFullyDelivered = createConfirmReceiptPayload(
        reqWithDisp2,
        dispId2,
        mockManagerUser,
        mockProject,
        {
          isManagementOverride: true,
          overrideReason: 'تایید تلفنی سرپرست در حین ماموریت',
        }
      );

      expect(reqFullyDelivered.status).toBe('DELIVERED_CONFIRMED');
      expect(reqFullyDelivered.dispatches[1].isManagementOverride).toBe(true);
      expect(reqFullyDelivered.dispatches[1].overrideReason).toBe('تایید تلفنی سرپرست در حین ماموریت');

      const summary = getMaterialRequestSummary(reqFullyDelivered);
      expect(summary.isAllReceived).toBe(true);
      expect(summary.hasPendingReceipt).toBe(false);
    });
  });

  describe('updateMaterialRequestStatusPayload & DELIVERED_CONFIRMED Gate', () => {
    it('disallows manual transition to DELIVERED_CONFIRMED if dispatches are not physically confirmed', () => {
      const req = createMaterialRequestPayload({
        project: mockProject,
        user: mockTechUser,
        category: 'FABRIC',
        reason: 'INCORRECT_SPEC',
        urgency: 'NORMAL',
        items: [{ title: 'پارچه شید', requestedQty: 5, unit: 'متر' }],
      });

      expect(() =>
        updateMaterialRequestStatusPayload(req, 'DELIVERED_CONFIRMED', mockManagerUser)
      ).toThrow(/تنها پس از تایید فیزیکی دریافت تمامی اقلام توسط تکنسین/);
    });

    it('prevents changing status of a request that is already DELIVERED_CONFIRMED', () => {
      const req = createMaterialRequestPayload({
        project: mockProject,
        user: mockTechUser,
        category: 'HARDWARE',
        reason: 'SHORTAGE',
        urgency: 'NORMAL',
        items: [{ title: 'پایه', requestedQty: 1, unit: 'عدد' }],
      });

      const disp = createDispatchPayload(
        req,
        { courierInfo: 'پیک', items: [{ itemId: req.items[0].id, dispatchedQty: 1 }] },
        mockManagerUser
      );

      const delivered = createConfirmReceiptPayload(
        disp,
        disp.dispatches[0].id,
        mockTechUser,
        mockProject
      );

      expect(delivered.status).toBe('DELIVERED_CONFIRMED');

      expect(() =>
        updateMaterialRequestStatusPayload(delivered, 'REJECTED', mockManagerUser)
      ).toThrow(/درخواست‌هایی که تحویل قطعی شده‌اند قابل تغییر وضعیت نیستند/);
    });
  });

  describe('cancelMaterialRequestPayload (Cancellation Workflow)', () => {
    it('allows requester to cancel their submitted request with reason', () => {
      const req = createMaterialRequestPayload({
        project: mockProject,
        user: mockTechUser,
        category: 'HARDWARE',
        reason: 'SHORTAGE',
        urgency: 'NORMAL',
        items: [{ title: 'پایه', requestedQty: 2, unit: 'عدد' }],
      });

      const cancelled = cancelMaterialRequestPayload(req, mockTechUser, 'دیگر نیازی به این قلم نیست.');
      expect(cancelled.status).toBe('CANCELLED');
      expect(cancelled.history[cancelled.history.length - 1].action).toBe('CANCELLED');
      expect(cancelled.history[cancelled.history.length - 1].note).toContain('دیگر نیازی به این قلم نیست.');
    });

    it('allows manager to cancel request with reason', () => {
      const req = createMaterialRequestPayload({
        project: mockProject,
        user: mockTechUser,
        category: 'HARDWARE',
        reason: 'SHORTAGE',
        urgency: 'NORMAL',
        items: [{ title: 'پایه', requestedQty: 2, unit: 'عدد' }],
      });

      const cancelled = cancelMaterialRequestPayload(req, mockManagerUser, 'لغو به درخواست مهندس ناظر');
      expect(cancelled.status).toBe('CANCELLED');
    });

    it('rejects cancellation from unrelated technician', () => {
      const req = createMaterialRequestPayload({
        project: mockProject,
        user: mockTechUser,
        category: 'HARDWARE',
        reason: 'SHORTAGE',
        urgency: 'NORMAL',
        items: [{ title: 'پایه', requestedQty: 2, unit: 'عدد' }],
      });

      expect(() =>
        cancelMaterialRequestPayload(req, mockUnassignedTech, 'تلاش برای لغو درخواست همکار')
      ).toThrow(/فقط ثبت‌کننده درخواست یا مدیر مجاز به لغو درخواست متریال هستند/);
    });

    it('rejects cancellation reason shorter than 3 characters', () => {
      const req = createMaterialRequestPayload({
        project: mockProject,
        user: mockTechUser,
        category: 'HARDWARE',
        reason: 'SHORTAGE',
        urgency: 'NORMAL',
        items: [{ title: 'پایه', requestedQty: 2, unit: 'عدد' }],
      });

      expect(() => cancelMaterialRequestPayload(req, mockTechUser, 'نه')).toThrow(
        /علت لغو درخواست باید حداقل شامل 3 کاراکتر باشد/
      );
    });
  });

  describe('generatePrintableDispatchManifest', () => {
    it('produces formatted Persian manifest for courier and receipt sign-off', () => {
      const req = createMaterialRequestPayload({
        project: mockProject,
        user: mockTechUser,
        category: 'HARDWARE',
        reason: 'SHORTAGE',
        urgency: 'NORMAL',
        items: [{ title: 'پایه سقفی', requestedQty: 4, unit: 'عدد' }],
      });

      const reqWithDisp = createDispatchPayload(
        req,
        {
          courierInfo: 'وانت باربری',
          trackingCode: 'TRK-100',
          notes: 'تحویل سرپرست اکیپ شود',
          items: [{ itemId: req.items[0].id, dispatchedQty: 4 }],
        },
        mockManagerUser
      );

      const manifest = generatePrintableDispatchManifest(
        reqWithDisp,
        reqWithDisp.dispatches[0]
      );

      expect(manifest).toContain('گالری طلایی | حواله تحویل و پیک متریال');
      expect(manifest).toContain('پروژه: پروژه برج زعفرانیه (PRJ-101)');
      expect(manifest).toContain('پیک / ناوگان: وانت باربری');
      expect(manifest).toContain('کد رهگیری: TRK-100');
      expect(manifest).toContain('پایه سقفی');
      expect(manifest).toContain('امضای تحویل‌گیرنده سر کارگاه');
    });
  });
});
