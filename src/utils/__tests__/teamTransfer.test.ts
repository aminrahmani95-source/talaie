import { describe, it, expect } from 'vitest';
import {
  canTransferProjectTeam,
  getProjectTransferHistory,
  getLatestTeamTransfer,
  createTeamTransferPayload,
  createConfirmTransferReceiptPayload,
  createManagerOverrideTransferPayload,
  isPendingTransferAcknowledgment,
  hasPendingTransfer,
  isTransferResolved,
} from '../teamTransfer';
import {
  validateProjectPatchRoleGuards,
  validateTeamTransferAcknowledgmentPatch,
} from '../roleGuards';
import { Project, User, InstallationTeam } from '../../types';

describe('P2.2 Team Transfer & Handover Logic (انتقال رسمی اکیپ)', () => {
  const qcManager: User = {
    id: 'u-qc-1',
    name: 'مهندس رضایی',
    phone: '09121111111',
    role: 'QC_MANAGER',
    active: true,
  };

  const coordinator: User = {
    id: 'u-coord-1',
    name: 'هماهنگ‌کننده احمدی',
    phone: '09122222222',
    role: 'SCHEDULING_COORDINATOR',
    active: true,
  };

  const leadTech: User = {
    id: 'u-lead-1',
    name: 'سرپرست اکبری',
    phone: '09123333333',
    role: 'LEAD_TECHNICIAN',
    active: true,
    teamId: 'team-1',
  };

  const crewTech: User = {
    id: 'u-tech-1',
    name: 'تکنسین مرادی',
    phone: '09124444444',
    role: 'TECHNICIAN',
    active: true,
    teamId: 'team-1',
  };

  const team1: InstallationTeam = {
    id: 'team-1',
    name: 'اکیپ نصب ۱',
    code: 'TEAM_1',
    supervisorId: 'u-lead-1',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };

  const team2: InstallationTeam = {
    id: 'team-2',
    name: 'اکیپ نصب ۲',
    code: 'TEAM_2',
    supervisorId: 'u-lead-2',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };

  const targetSupervisor: User = {
    id: 'u-lead-2',
    name: 'سرپرست حسینی',
    phone: '09125555555',
    role: 'LEAD_TECHNICIAN',
    active: true,
    teamId: 'team-2',
  };

  const targetTech: User = {
    id: 'u-tech-2',
    name: 'تکنسین کاظمی',
    phone: '09126666666',
    role: 'TECHNICIAN',
    active: true,
    teamId: 'team-2',
  };

  const sampleProject: Project = {
    id: 'prj-101',
    code: 'PRJ-101',
    title: 'پروژه برج نیاوران',
    customerName: 'آقای تهرانی',
    customerPhone: '09120000000',
    address: 'نیاوران، خیابان یاس',
    shadePanels: 10,
    curtainPanels: 4,
    proposalImages: [],
    scheduledDate: '2026-11-20',
    scheduledTime: '09:00',
    assignedTeamId: 'team-1',
    assignedTeamName: 'اکیپ نصب ۱',
    leadTechnicianId: 'u-lead-1',
    assignedTechnicianIds: ['u-lead-1', 'u-tech-1'],
    isFullTools: true,
    toolsRequired: [],
    status: 'PAUSED',
    completionPhotos: [],
    qcStatus: 'NOT_STARTED',
    originalPlan: {
      lockedAt: '2026-11-20T08:00:00Z',
      activities: [
        { id: 'act-1', title: 'شید رول دستی', plannedQuantity: 10, unit: 'لت' },
        { id: 'act-2', title: 'پرده حریر سالن', plannedQuantity: 4, unit: 'لت' },
      ],
    },
    dailyLogs: [
      {
        id: 'log-1',
        date: '2026-11-20',
        byUserId: 'u-lead-1',
        byUserName: 'سرپرست اکبری',
        photos: [],
        activityProgress: [
          { activityId: 'act-1', completedQuantity: 6 },
          { activityId: 'act-2', completedQuantity: 1 },
        ],
        createdAt: '2026-11-20T17:00:00Z',
      },
    ],
    createdAt: '2026-11-19T00:00:00Z',
    updatedAt: '2026-11-20T17:00:00Z',
  };

  describe('صلاحیت‌های نقشی انتقال (Role Permissions)', () => {
    it('مدیر QC و هماهنگ‌کننده مجاز به انتقال اکیپ هستند', () => {
      expect(canTransferProjectTeam(qcManager)).toBe(true);
      expect(canTransferProjectTeam(coordinator)).toBe(true);
    });

    it('سرپرست و تکنسین اجازه تصمیم‌گیری برای انتقال اکیپ ندارند', () => {
      expect(canTransferProjectTeam(leadTech)).toBe(false);
      expect(canTransferProjectTeam(crewTech)).toBe(false);
    });

    it('کاربر غیرفعال اجازه انتقال ندارد', () => {
      expect(canTransferProjectTeam({ ...qcManager, active: false })).toBe(false);
    });

    it('تلاش سرپرست برای انتقال اکیپ با خطای دسترسی متوقف می‌شود', () => {
      expect(() =>
        createTeamTransferPayload({
          project: sampleProject,
          targetTeam: team2,
          currentUser: leadTech,
          reason: 'عدم فرصت ادامه کار',
        })
      ).toThrow('دسترسی غیرمجاز');
    });
  });

  describe('اعتبارسنجی فیلدهای انتقال (Validation Guards)', () => {
    it('انتقال به همان اکیپ فعلی مسدود است', () => {
      expect(() =>
        createTeamTransferPayload({
          project: sampleProject,
          targetTeam: team1,
          currentUser: qcManager,
          reason: 'تلاش اشتباه برای انتقال به همان تیم',
        })
      ).toThrow('اکیپ مقصد نمی‌تواند همان اکیپ منتسب جاری پروژه باشد');
    });

    it('ثبت دلیل انتقال الزامی است', () => {
      expect(() =>
        createTeamTransferPayload({
          project: sampleProject,
          targetTeam: team2,
          currentUser: coordinator,
          reason: '   ',
        })
      ).toThrow('ثبت دلیل مستند برای انتقال رسمی پروژه به اکیپ دیگر الزامی است');
    });
  });

  describe('تولید پچ و حفظ تک‌رکوردی پروژه (Single-Record Payload)', () => {
    it('پچ معتبر با انتساب به اکیپ جدید و صورت‌جلسه اقلام باقیمانده تولید می‌شود', () => {
      const { patch, transferRecord } = createTeamTransferPayload({
        project: sampleProject,
        targetTeam: team2,
        targetSupervisor,
        targetTeamMembers: [targetSupervisor, targetTech],
        currentUser: coordinator,
        reason: 'انباشت کار اکیپ ۱ و انتقال به اکیپ ۲ طبق هماهنگی',
        newScheduledDate: '2026-11-21',
      });

      // حفظ هویت و بروزرسانی اکیپ
      expect(patch.assignedTeamId).toBe('team-2');
      expect(patch.assignedTeamName).toBe('اکیپ نصب ۲');
      expect(patch.leadTechnicianId).toBe('u-lead-2');
      expect(patch.assignedTechnicianIds).toContain('u-lead-2');
      expect(patch.assignedTechnicianIds).toContain('u-tech-2');
      expect(patch.scheduledDate).toBe('2026-11-21');
      expect(patch.status).toBe('SCHEDULED');

      // ثبت صورت‌جلسه اقلام تحویلی
      expect(transferRecord.fromTeamId).toBe('team-1');
      expect(transferRecord.toTeamId).toBe('team-2');
      expect(transferRecord.transferredByUserId).toBe('u-coord-1');
      expect(transferRecord.receivingLeadConfirmed).toBe(false);

      // اقلام باقیمانده: شید (۱۰ - ۶ = ۴)، پرده (۴ - ۱ = ۳)
      const inv = transferRecord.handoverInventory || [];
      const shadeInv = inv.find((i) => i.activityId === 'act-1');
      const curtainInv = inv.find((i) => i.activityId === 'act-2');
      expect(shadeInv?.remainingQuantity).toBe(4);
      expect(curtainInv?.remainingQuantity).toBe(3);

      // تاریخچه انتقال‌ها اضافه می‌شود
      expect(patch.teamTransfers).toHaveLength(1);
      expect(patch.teamTransfers?.[0].id).toBe(transferRecord.id);
    });

    it('انتقال‌های متوالی بدون از بین رفتن سوابق قبلی آرایه را گسترش می‌دهند', () => {
      const projectWithHistory: Project = {
        ...sampleProject,
        teamTransfers: [
          {
            id: 'trf-prev',
            fromTeamId: 'team-old',
            fromTeamName: 'اکیپ قدیمی',
            toTeamId: 'team-1',
            toTeamName: 'اکیپ نصب ۱',
            transferredAt: '2026-11-15T10:00:00Z',
            transferredByUserId: 'u-qc-1',
            transferredByUserName: 'مهندس رضایی',
            reason: 'جابه‌جایی اولیه',
            receivingLeadConfirmed: true,
          },
        ],
      };

      const { patch } = createTeamTransferPayload({
        project: projectWithHistory,
        targetTeam: team2,
        currentUser: qcManager,
        reason: 'توقف کار ناشی از تاخیر کناف و انتقال به اکیپ بعدی',
      });

      expect(patch.teamTransfers).toHaveLength(2);
      expect(patch.teamTransfers?.[0].id).toBe('trf-prev');
      expect(patch.teamTransfers?.[1].toTeamId).toBe('team-2');

      const fullHistory = getProjectTransferHistory({ ...projectWithHistory, ...patch });
      expect(fullHistory).toHaveLength(2);
      const latest = getLatestTeamTransfer({ ...projectWithHistory, ...patch });
      expect(latest?.toTeamId).toBe('team-2');
    });
  });

  describe('گیت اجرایی و تایید رسمی تحویل‌گیری اکیپ (Transfer Acknowledgment & Execution Gate - P2.2 Remediation)', () => {
    const projectWithPendingTransfer: Project = {
      ...sampleProject,
      assignedTeamId: 'team-2',
      leadTechnicianId: 'u-lead-2',
      assignedTechnicianIds: ['u-lead-2', 'u-tech-2'],
      status: 'SCHEDULED',
      teamTransfers: [
        {
          id: 'trf-123',
          fromTeamId: 'team-1',
          fromTeamName: 'اکیپ نصب ۱',
          toTeamId: 'team-2',
          toTeamName: 'اکیپ نصب ۲',
          transferredAt: '2026-11-20T18:00:00Z',
          transferredByUserId: 'u-coord-1',
          transferredByUserName: 'هماهنگ‌کننده احمدی',
          reason: 'انتقال برای تکمیل',
          receivingLeadConfirmed: false,
          handoverInventory: [
            { activityId: 'act-1', activityTitle: 'شید رول دستی', remainingQuantity: 4, unit: 'لت' },
            { activityId: 'act-2', activityTitle: 'پرده حریر سالن', remainingQuantity: 3, unit: 'لت' },
          ],
        },
      ],
    };

    it('سناریو ۱: اکیپ مقصد پیش از ثبت رسمی تایید تحویل نمی‌تواند به EN_ROUTE برود', () => {
      expect(hasPendingTransfer(projectWithPendingTransfer)).toBe(true);
      expect(() =>
        validateProjectPatchRoleGuards(targetSupervisor, projectWithPendingTransfer, {
          status: 'EN_ROUTE',
        })
      ).toThrow(
        'پروژه به اکیپ جدید منتقل شده و در انتظار تایید رسمی تحویل اقلام سر کارگاه است. تا پیش از ثبت تایید توسط سرپرست اکیپ، شروع یا ادامه کار مجاز نیست.'
      );
    });

    it('سناریو ۲: اکیپ مقصد پیش از ثبت رسمی تایید تحویل نمی‌تواند به IN_PROGRESS برود', () => {
      expect(hasPendingTransfer(projectWithPendingTransfer)).toBe(true);
      expect(() =>
        validateProjectPatchRoleGuards(targetSupervisor, projectWithPendingTransfer, {
          status: 'IN_PROGRESS',
          startedAt: new Date().toISOString(),
        })
      ).toThrow(
        'پروژه به اکیپ جدید منتقل شده و در انتظار تایید رسمی تحویل اقلام سر کارگاه است. تا پیش از ثبت تایید توسط سرپرست اکیپ، شروع یا ادامه کار مجاز نیست.'
      );
    });

    it('سناریو ۳: فراخوانی مستقیم توابع گذار وضعیت و جهش مستقیم در پچ‌ها مسدود است', () => {
      // تلاش برای ثبت وضعیت همراه با آپدیت‌های جانبی
      expect(() =>
        validateProjectPatchRoleGuards(targetSupervisor, projectWithPendingTransfer, {
          status: 'EN_ROUTE',
          updatedAt: new Date().toISOString(),
        })
      ).toThrow('پروژه به اکیپ جدید منتقل شده و در انتظار تایید رسمی تحویل اقلام سر کارگاه است');
    });

    it('سناریو ۴: سرپرست اکیپ مقصد می‌تواند تحویل رسمی و صورت‌جلسه اقلام را تایید کند', () => {
      expect(isPendingTransferAcknowledgment(projectWithPendingTransfer, targetSupervisor)).toBe(true);
      const confirmPatch = createConfirmTransferReceiptPayload(projectWithPendingTransfer, targetSupervisor);

      expect(() =>
        validateProjectPatchRoleGuards(targetSupervisor, projectWithPendingTransfer, confirmPatch)
      ).not.toThrow();

      const updatedTransfers = confirmPatch.teamTransfers || [];
      expect(updatedTransfers).toHaveLength(1);
      expect(updatedTransfers[0].receivingLeadConfirmed).toBe(true);
      expect(updatedTransfers[0].receivingLeadConfirmedBy).toBe('سرپرست حسینی');
      expect(updatedTransfers[0].receivingLeadConfirmedAt).toBeDefined();
    });

    it('سناریو ۵: تکنسین عادی اکیپ مقصد اجازه تایید تحویل ندارد و فقط سرپرست اکیپ مجاز است', () => {
      // ساخت مستقیم پی‌لود با تکنسین عادی باید رد شود
      expect(() =>
        createConfirmTransferReceiptPayload(projectWithPendingTransfer, targetTech)
      ).toThrow('دسترسی غیرمجاز: صرفاً سرپرست اکیپ مقصد مجاز به تایید تحویل‌گیری پروژه است.');

      // حتی اگر تکنسین پچ تایید را مستقیماً ارسال کند، گارد امنیتی آن را رد می‌کند
      const validConfirmPatch = createConfirmTransferReceiptPayload(projectWithPendingTransfer, targetSupervisor);
      expect(() =>
        validateProjectPatchRoleGuards(targetTech, projectWithPendingTransfer, validConfirmPatch)
      ).toThrow('دسترسی غیرمجاز: صرفاً سرپرست اکیپ مقصد مجاز به تایید تحویل‌گیری پروژه است.');
    });

    it('سناریو ۶: اکیپ مبدا (ارسال‌کننده قبلی) نمی‌تواند انتقال خروجی خود را تایید کند', () => {
      expect(() =>
        createConfirmTransferReceiptPayload(projectWithPendingTransfer, leadTech)
      ).toThrow('دسترسی غیرمجاز: صرفاً سرپرست اکیپ مقصد مجاز به تایید تحویل‌گیری پروژه است.');

      const validConfirmPatch = createConfirmTransferReceiptPayload(projectWithPendingTransfer, targetSupervisor);
      expect(() =>
        validateTeamTransferAcknowledgmentPatch(
          leadTech,
          projectWithPendingTransfer,
          validConfirmPatch.teamTransfers,
          'team-1'
        )
      ).toThrow();
    });

    it('سناریو ۷: اکیپ یا سرپرست متفرقه (نامربوط) نمی‌تواند تایید تحویل را ثبت کند', () => {
      const unrelatedLead: User = {
        id: 'u-lead-99',
        name: 'سرپرست متفرقه',
        phone: '09129999999',
        role: 'LEAD_TECHNICIAN',
        active: true,
      };

      expect(() =>
        createConfirmTransferReceiptPayload(projectWithPendingTransfer, unrelatedLead)
      ).toThrow('دسترسی غیرمجاز');

      const validConfirmPatch = createConfirmTransferReceiptPayload(projectWithPendingTransfer, targetSupervisor);
      expect(() =>
        validateProjectPatchRoleGuards(unrelatedLead, projectWithPendingTransfer, validConfirmPatch, 'team-99')
      ).toThrow();
    });

    it('سناریو ۸: تایید تکراری تحویل به‌صورت امن رد می‌شود', () => {
      const projectAlreadyConfirmed: Project = {
        ...projectWithPendingTransfer,
        teamTransfers: [
          {
            ...projectWithPendingTransfer.teamTransfers![0],
            receivingLeadConfirmed: true,
            receivingLeadConfirmedAt: '2026-11-20T19:00:00Z',
            receivingLeadConfirmedBy: 'سرپرست حسینی',
          },
        ],
      };

      expect(hasPendingTransfer(projectAlreadyConfirmed)).toBe(false);
      expect(() =>
        createConfirmTransferReceiptPayload(projectAlreadyConfirmed, targetSupervisor)
      ).toThrow('این انتقال قبلاً توسط سرپرست اکیپ تایید شده است.');

      const confirmPatch = createConfirmTransferReceiptPayload(projectWithPendingTransfer, targetSupervisor);
      expect(() =>
        validateProjectPatchRoleGuards(targetSupervisor, projectAlreadyConfirmed, confirmPatch)
      ).toThrow('این انتقال قبلاً توسط سرپرست اکیپ تایید شده است.');
    });

    it('سناریو ۹: در فرآیند تایید تحویل، دستکاری در صورت‌جلسه اقلام یا فیلدهای تاریخی انتقال ممنوع است', () => {
      const validConfirmPatch = createConfirmTransferReceiptPayload(projectWithPendingTransfer, targetSupervisor);

      // دستکاری در مقادیر اقلام صورت‌جلسه
      const tamperedInventoryPatch = {
        teamTransfers: [
          {
            ...validConfirmPatch.teamTransfers![0],
            handoverInventory: [
              { activityId: 'act-1', activityTitle: 'شید رول دستی', remainingQuantity: 999, unit: 'لت' },
            ],
          },
        ],
      };
      expect(() =>
        validateProjectPatchRoleGuards(targetSupervisor, projectWithPendingTransfer, tamperedInventoryPatch)
      ).toThrow('دسترسی غیرمجاز: دستکاری مشخصات، دلیل یا اقلام صورت‌جلسه انتقال مجاز نیست.');

      // دستکاری در دلیل انتقال
      const tamperedReasonPatch = {
        teamTransfers: [
          {
            ...validConfirmPatch.teamTransfers![0],
            reason: 'دلیل ساختگی و جعلی',
          },
        ],
      };
      expect(() =>
        validateProjectPatchRoleGuards(targetSupervisor, projectWithPendingTransfer, tamperedReasonPatch)
      ).toThrow('دسترسی غیرمجاز: دستکاری مشخصات، دلیل یا اقلام صورت‌جلسه انتقال مجاز نیست.');
    });

    it('سناریو ۱۰: تداوم عادی کار چندروزه با همان اکیپ (PAUSED) بدون نیاز به انتقال یا صورت‌جلسه کار می‌کند', () => {
      // sampleProject دارای وضعیت PAUSED و فاقد رکورد انتقال اکیپ است
      expect(sampleProject.status).toBe('PAUSED');
      expect(hasPendingTransfer(sampleProject)).toBe(false);

      // سرپرست همان اکیپ بدون هیچ مانعی می‌تواند اعزام شود
      expect(() =>
        validateProjectPatchRoleGuards(leadTech, sampleProject, { status: 'EN_ROUTE' })
      ).not.toThrow();

      // و همچنین مستقیماً در کارگاه کار را ادامه دهد
      expect(() =>
        validateProjectPatchRoleGuards(leadTech, sampleProject, { status: 'IN_PROGRESS' })
      ).not.toThrow();
    });

    it('سناریو ۱۱: پس از ثبت تایید تحویل، اکیپ مقصد بدون مانع می‌تواند EN_ROUTE و سپس IN_PROGRESS شود', () => {
      const confirmPatch = createConfirmTransferReceiptPayload(projectWithPendingTransfer, targetSupervisor);
      const projectAfterConfirmed: Project = {
        ...projectWithPendingTransfer,
        ...confirmPatch,
      };

      expect(hasPendingTransfer(projectAfterConfirmed)).toBe(false);

      // اکنون اکیپ مقصد مجاز به تغییر وضعیت به EN_ROUTE است
      expect(() =>
        validateProjectPatchRoleGuards(targetSupervisor, projectAfterConfirmed, { status: 'EN_ROUTE' })
      ).not.toThrow();

      // پس از رسیدن، ورود به وضعیت IN_PROGRESS کاملاً مجاز است
      const projectEnRoute: Project = { ...projectAfterConfirmed, status: 'EN_ROUTE' };
      expect(() =>
        validateProjectPatchRoleGuards(targetSupervisor, projectEnRoute, { status: 'IN_PROGRESS' })
      ).not.toThrow();
    });

    it('سناریو ۱۲: سوابق تاریخی انتقال در انتقال‌های متوالی کاملاً دست‌نخورده باقی می‌ماند', () => {
      const projectWithConsecutiveTransfers: Project = {
        ...sampleProject,
        assignedTeamId: 'team-3',
        leadTechnicianId: 'u-lead-3',
        assignedTechnicianIds: ['u-lead-3'],
        status: 'SCHEDULED',
        teamTransfers: [
          {
            id: 'trf-1',
            fromTeamId: 'team-1',
            fromTeamName: 'اکیپ نصب ۱',
            toTeamId: 'team-2',
            toTeamName: 'اکیپ نصب ۲',
            transferredAt: '2026-11-15T10:00:00Z',
            transferredByUserId: 'u-qc-1',
            transferredByUserName: 'مهندس رضایی',
            reason: 'انتقال اول',
            receivingLeadConfirmed: true,
            receivingLeadConfirmedAt: '2026-11-15T11:00:00Z',
            receivingLeadConfirmedBy: 'سرپرست حسینی',
          },
          {
            id: 'trf-2',
            fromTeamId: 'team-2',
            fromTeamName: 'اکیپ نصب ۲',
            toTeamId: 'team-3',
            toTeamName: 'اکیپ نصب ۳',
            transferredAt: '2026-11-20T18:00:00Z',
            transferredByUserId: 'u-coord-1',
            transferredByUserName: 'هماهنگ‌کننده احمدی',
            reason: 'انتقال دوم',
            receivingLeadConfirmed: false,
          },
        ],
      };

      const leadTech3: User = {
        id: 'u-lead-3',
        name: 'سرپرست صادقی',
        phone: '09127777777',
        role: 'LEAD_TECHNICIAN',
        active: true,
        teamId: 'team-3',
      };

      // تایید انتقال دوم
      const confirmPatch = createConfirmTransferReceiptPayload(projectWithConsecutiveTransfers, leadTech3);
      expect(confirmPatch.teamTransfers).toHaveLength(2);
      // سابقه انتقال قبلی دست‌نخورده مانده است
      expect(confirmPatch.teamTransfers?.[0].id).toBe('trf-1');
      expect(confirmPatch.teamTransfers?.[0].receivingLeadConfirmedBy).toBe('سرپرست حسینی');
      // سابقه انتقال جاری تایید شده است
      expect(confirmPatch.teamTransfers?.[1].id).toBe('trf-2');
      expect(confirmPatch.teamTransfers?.[1].receivingLeadConfirmed).toBe(true);
      expect(confirmPatch.teamTransfers?.[1].receivingLeadConfirmedBy).toBe('سرپرست صادقی');

      // تایید گارد نقش برای این پچ معتبر
      expect(() =>
        validateProjectPatchRoleGuards(leadTech3, projectWithConsecutiveTransfers, confirmPatch)
      ).not.toThrow();

      // تلاش برای حذف یا دستکاری سابقه اول با خطای نقشی متوقف می‌شود
      const tamperedHistoryPatch = {
        teamTransfers: [
          { ...confirmPatch.teamTransfers![0], reason: 'دستکاری در سابقه قبلی' },
          confirmPatch.teamTransfers![1],
        ],
      };
      expect(() =>
        validateProjectPatchRoleGuards(leadTech3, projectWithConsecutiveTransfers, tamperedHistoryPatch)
      ).toThrow('دسترسی غیرمجاز: سوابق قبلی انتقال غیرقابل تغییر هستند.');
    });
  });

  describe('P2.2 Final Authorization Hardening & Manager Override (۱۲ سناریوی ارزیابی نهایی)', () => {
    const basePendingProject: Project = {
      ...sampleProject,
      assignedTeamId: 'team-2',
      leadTechnicianId: 'u-lead-2',
      assignedTechnicianIds: ['u-lead-2', 'u-tech-2'],
      status: 'SCHEDULED',
      teamTransfers: [
        {
          id: 'trf-final-1',
          fromTeamId: 'team-1',
          fromTeamName: 'اکیپ نصب ۱',
          toTeamId: 'team-2',
          toTeamName: 'اکیپ نصب ۲',
          transferredAt: '2026-11-20T18:00:00Z',
          transferredByUserId: 'u-coord-1',
          transferredByUserName: 'هماهنگ‌کننده احمدی',
          reason: 'انتقال پروژه جهت تکمیل اقلام باقیمانده',
          receivingLeadConfirmed: false,
          handoverInventory: [
            { activityId: 'act-1', activityTitle: 'شید رول دستی', remainingQuantity: 5, unit: 'لت' },
          ],
        },
      ],
    };

    it('سناریوی ۱: تایید رسمی توسط سرپرست رسمی و منتسب اکیپ مقصد با موفقیت ثبت و پروژه رفع انسداد می‌شود', () => {
      // سرپرست رسمی با هویت u-lead-2، رول LEAD_TECHNICIAN و اکیپ team-2
      expect(isPendingTransferAcknowledgment(basePendingProject, targetSupervisor)).toBe(true);

      const confirmPatch = createConfirmTransferReceiptPayload(basePendingProject, targetSupervisor);
      expect(confirmPatch.teamTransfers?.[0].receivingLeadConfirmed).toBe(true);
      expect(confirmPatch.teamTransfers?.[0].receivingLeadConfirmedBy).toBe('سرپرست حسینی');
      expect(confirmPatch.teamTransfers?.[0].isManagerOverride).toBe(false);

      // اعتبارسنجی گارد نقش
      expect(() =>
        validateProjectPatchRoleGuards(targetSupervisor, basePendingProject, confirmPatch, 'team-2')
      ).not.toThrow();

      // پس از اعمال پچ، پروژه دیگر در حالت انتظار تایید نیست
      const updatedProject = { ...basePendingProject, ...confirmPatch };
      expect(hasPendingTransfer(updatedProject)).toBe(false);
    });

    it('سناریوی ۲: تکنسینی که شناسه او اشتباهاً در leadTechnicianId قرار گرفته (رول غیراز سرپرست) رد می‌شود', () => {
      const fakeLeadTechnician: User = {
        id: 'u-lead-2', // شناسه با leadTechnicianId پروژه برابر است
        name: 'تکنسین جا زده به جای سرپرست',
        phone: '09120000001',
        role: 'TECHNICIAN', // رول نادرست است
        active: true,
        teamId: 'team-2',
      };

      expect(isPendingTransferAcknowledgment(basePendingProject, fakeLeadTechnician)).toBe(false);

      expect(() =>
        createConfirmTransferReceiptPayload(basePendingProject, fakeLeadTechnician)
      ).toThrow('دسترسی غیرمجاز: صرفاً سرپرست اکیپ مقصد مجاز به تایید تحویل‌گیری پروژه است.');

      const validConfirmPatch = createConfirmTransferReceiptPayload(basePendingProject, targetSupervisor);
      expect(() =>
        validateProjectPatchRoleGuards(fakeLeadTechnician, basePendingProject, validConfirmPatch, 'team-2')
      ).toThrow('دسترسی غیرمجاز: صرفاً سرپرست اکیپ مقصد مجاز به تایید تحویل‌گیری پروژه است.');
    });

    it('سناریوی ۳: سرپرست دیگری با رول LEAD_TECHNICIAN که در assignedTechnicianIds قرار دارد ولی leadTechnicianId نیست رد می‌شود', () => {
      const secondLeadInCrew: User = {
        id: 'u-lead-secondary',
        name: 'سرپرست کمکی در اکیپ',
        phone: '09120000002',
        role: 'LEAD_TECHNICIAN',
        active: true,
        teamId: 'team-2',
      };

      const projectWithTwoLeadsInCrew: Project = {
        ...basePendingProject,
        assignedTechnicianIds: ['u-lead-2', 'u-lead-secondary', 'u-tech-2'],
      };

      expect(isPendingTransferAcknowledgment(projectWithTwoLeadsInCrew, secondLeadInCrew)).toBe(false);

      expect(() =>
        createConfirmTransferReceiptPayload(projectWithTwoLeadsInCrew, secondLeadInCrew)
      ).toThrow('دسترسی غیرمجاز: صرفاً سرپرست اکیپ مقصد مجاز به تایید تحویل‌گیری پروژه است.');

      const validConfirmPatch = createConfirmTransferReceiptPayload(projectWithTwoLeadsInCrew, targetSupervisor);
      expect(() =>
        validateProjectPatchRoleGuards(secondLeadInCrew, projectWithTwoLeadsInCrew, validConfirmPatch, 'team-2')
      ).toThrow('دسترسی غیرمجاز: صرفاً سرپرست اکیپ مقصد مجاز به تایید تحویل‌گیری پروژه است.');
    });

    it('سناریوی ۴: سرپرست متعلق به اکیپ نامربوط یا اکیپ مبدا رد می‌شود', () => {
      const foreignLead: User = {
        id: 'u-lead-2', // حتی اگر ID تصادفاً یکسان باشد ولی اکیپ team-1 باشد
        name: 'سرپرست اکیپ ۱',
        phone: '09120000003',
        role: 'LEAD_TECHNICIAN',
        active: true,
        teamId: 'team-1', // مغایر با toTeamId: 'team-2'
      };

      expect(isPendingTransferAcknowledgment(basePendingProject, foreignLead)).toBe(false);

      expect(() =>
        createConfirmTransferReceiptPayload(basePendingProject, foreignLead)
      ).toThrow('دسترسی غیرمجاز: صرفاً سرپرست اکیپ مقصد مجاز به تایید تحویل‌گیری پروژه است.');

      const validConfirmPatch = createConfirmTransferReceiptPayload(basePendingProject, targetSupervisor);
      expect(() =>
        validateProjectPatchRoleGuards(foreignLead, basePendingProject, validConfirmPatch, 'team-1')
      ).toThrow('دسترسی غیرمجاز: صرفاً سرپرست اکیپ مقصد مجاز به تایید تحویل‌گیری پروژه است.');
    });

    it('سناریوی ۵: رفع انسداد مدیریتی QC_MANAGER با دلیل اجباری و متادیتای ممیزی کامل ثبت می‌شود', () => {
      // دلیل خالی یا فاصله‌ای باید رد شود
      expect(() =>
        createManagerOverrideTransferPayload({
          project: basePendingProject,
          user: qcManager,
          reason: '',
        })
      ).toThrow('ثبت دلیل مستند برای رفع انسداد مدیریتی انتقال الزامی است.');

      expect(() =>
        createManagerOverrideTransferPayload({
          project: basePendingProject,
          user: qcManager,
          reason: '   ',
        })
      ).toThrow('ثبت دلیل مستند برای رفع انسداد مدیریتی انتقال الزامی است.');

      // ثبت موفق با متادیتای کامل ممیزی
      const overridePatch = createManagerOverrideTransferPayload({
        project: basePendingProject,
        user: qcManager,
        reason: 'رفع انسداد مدیریتی به دلیل عدم دسترسی موقت سرپرست اکیپ مقصد به شبکه',
      });

      const updatedTransfer = overridePatch.teamTransfers?.[0];
      expect(updatedTransfer?.isManagerOverride).toBe(true);
      expect(updatedTransfer?.receivingLeadConfirmed).toBe(false);
      expect(updatedTransfer?.managerOverrideByUserId).toBe(qcManager.id);
      expect(updatedTransfer?.managerOverrideByUserName).toBe(qcManager.name);
      expect(updatedTransfer?.managerOverrideRole).toBe('QC_MANAGER');
      expect(updatedTransfer?.managerOverrideReason).toBe('رفع انسداد مدیریتی به دلیل عدم دسترسی موقت سرپرست اکیپ مقصد به شبکه');
      expect(updatedTransfer?.managerOverrideAt).toBeDefined();

      // اعتبارسنجی در گارد نقش
      expect(() =>
        validateProjectPatchRoleGuards(qcManager, basePendingProject, overridePatch)
      ).not.toThrow();

      // پروژه رفع انسداد می‌شود
      const unblockedProject = { ...basePendingProject, ...overridePatch };
      expect(hasPendingTransfer(unblockedProject)).toBe(false);
    });

    it('سناریوی ۶: رفع انسداد مدیریتی هرگز تایید فیزیکی سرپرست اکیپ تلقی نمی‌گردد و ترکیب آنها رد می‌شود', () => {
      const overridePatch = createManagerOverrideTransferPayload({
        project: basePendingProject,
        user: qcManager,
        reason: 'رفع انسداد با دستور مستقیم مدیریت',
      });

      // صریحاً بررسی می‌شود که receivingLeadConfirmed نباید true باشد
      expect(overridePatch.teamTransfers?.[0].receivingLeadConfirmed).toBe(false);

      // اگر پچی تلاش کند همزمان هم رفع انسداد ثبت کند و هم تایید فیزیکی سرپرست را جعل نماید، گارد رد می‌کند
      const tamperedDualPatch = {
        teamTransfers: [
          {
            ...overridePatch.teamTransfers![0],
            receivingLeadConfirmed: true,
          },
        ],
      };

      expect(() =>
        validateProjectPatchRoleGuards(qcManager, basePendingProject, tamperedDualPatch)
      ).toThrow('دسترسی غیرمجاز: رفع انسداد مدیریتی نباید به‌عنوان تایید دریافت فیزیکی سرپرست اکیپ ثبت شود.');
    });

    it('سناریوی ۷: تکنسین‌های عادی، سرپرستان و هماهنگ‌کننده نمی‌توانند از مسیر رفع انسداد مدیریتی استفاده کنند', () => {
      // سرپرست اکیپ نمی‌تواند override ثبت کند
      expect(() =>
        createManagerOverrideTransferPayload({
          project: basePendingProject,
          user: targetSupervisor,
          reason: 'تلاش سرپرست برای رفع انسداد خود',
        })
      ).toThrow('دسترسی غیرمجاز: رفع انسداد مدیریتی انتقال منحصراً در صلاحیت مدیر ارشد QC است.');

      // تکنسین عادی نمی‌تواند
      expect(() =>
        createManagerOverrideTransferPayload({
          project: basePendingProject,
          user: targetTech,
          reason: 'تلاش تکنسین',
        })
      ).toThrow('دسترسی غیرمجاز: رفع انسداد مدیریتی انتقال منحصراً در صلاحیت مدیر ارشد QC است.');

      // هماهنگ‌کننده نیز نمی‌تواند
      expect(() =>
        createManagerOverrideTransferPayload({
          project: basePendingProject,
          user: coordinator,
          reason: 'تلاش هماهنگ‌کننده',
        })
      ).toThrow('دسترسی غیرمجاز: رفع انسداد مدیریتی انتقال منحصراً در صلاحیت مدیر ارشد QC است.');

      // حتی اگر یک کاربر غیراز QC_MANAGER پچ معتبر override ارسال کند، در گارد جهش متوقف می‌شود
      const validOverridePatch = createManagerOverrideTransferPayload({
        project: basePendingProject,
        user: qcManager,
        reason: 'پچ معتبر مدیریتی',
      });

      expect(() =>
        validateProjectPatchRoleGuards(targetSupervisor, basePendingProject, validOverridePatch)
      ).toThrow('دسترسی غیرمجاز: رفع انسداد مدیریتی انتقال منحصراً در صلاحیت مدیر ارشد QC است.');

      expect(() =>
        validateProjectPatchRoleGuards(coordinator, basePendingProject, validOverridePatch)
      ).toThrow('دسترسی غیرمجاز: رفع انسداد مدیریتی انتقال منحصراً در صلاحیت مدیر ارشد QC است.');
    });

    it('سناریوی ۸: گیت اجرایی پروژه را تا زمان ثبت یکی از دو مسیر مجاز تایید (سرپرست یا مدیر) کاملاً مسدود نگه می‌دارد', () => {
      // پیش از تایید، ورود به EN_ROUTE و IN_PROGRESS مسدود است
      expect(() =>
        validateProjectPatchRoleGuards(targetSupervisor, basePendingProject, { status: 'EN_ROUTE' })
      ).toThrow('پروژه به اکیپ جدید منتقل شده و در انتظار تایید رسمی تحویل اقلام سر کارگاه است.');

      expect(() =>
        validateProjectPatchRoleGuards(targetSupervisor, basePendingProject, { status: 'IN_PROGRESS' })
      ).toThrow('پروژه به اکیپ جدید منتقل شده و در انتظار تایید رسمی تحویل اقلام سر کارگاه است.');

      // مسیر الف: با تایید سرپرست رفع انسداد می‌شود
      const leadPatch = createConfirmTransferReceiptPayload(basePendingProject, targetSupervisor);
      const projectUnblockedByLead = { ...basePendingProject, ...leadPatch };
      expect(() =>
        validateProjectPatchRoleGuards(targetSupervisor, projectUnblockedByLead, { status: 'EN_ROUTE' })
      ).not.toThrow();
      const leadEnRouteProject = { ...projectUnblockedByLead, status: 'EN_ROUTE' as const };
      expect(() =>
        validateProjectPatchRoleGuards(targetSupervisor, leadEnRouteProject, { status: 'IN_PROGRESS' })
      ).not.toThrow();

      // مسیر ب: با رفع انسداد مدیر QC رفع انسداد می‌شود
      const overridePatch = createManagerOverrideTransferPayload({
        project: basePendingProject,
        user: qcManager,
        reason: 'رفع انسداد مدیریتی رسمی',
      });
      const projectUnblockedByManager = { ...basePendingProject, ...overridePatch };
      expect(() =>
        validateProjectPatchRoleGuards(targetSupervisor, projectUnblockedByManager, { status: 'EN_ROUTE' })
      ).not.toThrow();
      const managerEnRouteProject = { ...projectUnblockedByManager, status: 'EN_ROUTE' as const };
      expect(() =>
        validateProjectPatchRoleGuards(targetSupervisor, managerEnRouteProject, { status: 'IN_PROGRESS' })
      ).not.toThrow();
    });

    it('سناریوی ۹: تداوم عادی کار چندروزه با همان اکیپ (PAUSED) بدون انتقال کاملاً بدون مانع ادامه می‌یابد', () => {
      const multiDayPausedProject: Project = {
        ...sampleProject,
        status: 'PAUSED',
        teamTransfers: [], // هیچ انتقالی رخ نداده است
      };

      expect(hasPendingTransfer(multiDayPausedProject)).toBe(false);

      // سرپرست همان اکیپ می‌تواند در روزهای بعد بدون مانع ادامه دهد
      expect(() =>
        validateProjectPatchRoleGuards(leadTech, multiDayPausedProject, { status: 'EN_ROUTE' })
      ).not.toThrow();

      expect(() =>
        validateProjectPatchRoleGuards(leadTech, multiDayPausedProject, { status: 'IN_PROGRESS' })
      ).not.toThrow();

      expect(() =>
        validateProjectPatchRoleGuards(leadTech, multiDayPausedProject, { status: 'PAUSED' })
      ).not.toThrow();
    });

    it('سناریوی ۱۰: سوابق انتقالات قبلی کاملاً تغییرناپذیر بوده و دستکاری مشخصات یا اقلام رد می‌شود', () => {
      const projectWithHistory: Project = {
        ...basePendingProject,
        teamTransfers: [
          {
            id: 'trf-old',
            fromTeamId: 'team-0',
            fromTeamName: 'اکیپ صفر',
            toTeamId: 'team-1',
            toTeamName: 'اکیپ یک',
            transferredAt: '2026-11-10T10:00:00Z',
            transferredByUserId: 'u-qc-1',
            transferredByUserName: 'مهندس رضایی',
            reason: 'انتقال قبلی نهایی‌شده',
            receivingLeadConfirmed: true,
            receivingLeadConfirmedAt: '2026-11-10T11:00:00Z',
            receivingLeadConfirmedBy: 'سرپرست قبلی',
          },
          basePendingProject.teamTransfers![0],
        ],
      };

      const validPatch = createConfirmTransferReceiptPayload(projectWithHistory, targetSupervisor);

      // دستکاری در رکورد اول (تاریخی)
      const tamperedHistory = {
        teamTransfers: [
          { ...validPatch.teamTransfers![0], reason: 'تغییر غیرمجاز سابقه قبلی' },
          validPatch.teamTransfers![1],
        ],
      };
      expect(() =>
        validateProjectPatchRoleGuards(targetSupervisor, projectWithHistory, tamperedHistory)
      ).toThrow('دسترسی غیرمجاز: سوابق قبلی انتقال غیرقابل تغییر هستند.');

      // دستکاری در صورت‌جلسه اقلام رکورد جاری
      const tamperedInventory = {
        teamTransfers: [
          validPatch.teamTransfers![0],
          {
            ...validPatch.teamTransfers![1],
            handoverInventory: [],
          },
        ],
      };
      expect(() =>
        validateProjectPatchRoleGuards(targetSupervisor, projectWithHistory, tamperedInventory)
      ).toThrow('دسترسی غیرمجاز: دستکاری مشخصات، دلیل یا اقلام صورت‌جلسه انتقال مجاز نیست.');
    });

    it('سناریوی ۱۱: تغییر حساب کاربری و تلاش برای بازپخش جهش ثبت‌شده کاربر دیگر مسدود می‌شود', () => {
      // سرپرست مجاز پچ تایید را می‌سازد
      const queuedPatchByLead = createConfirmTransferReceiptPayload(basePendingProject, targetSupervisor);

      // تکنسین دیگری پس از سوئیچ اکانت تلاش می‌کند پچ را اعمال کند
      expect(() =>
        validateProjectPatchRoleGuards(crewTech, basePendingProject, queuedPatchByLead, 'team-1')
      ).toThrow('دسترسی غیرمجاز: صرفاً سرپرست اکیپ مقصد مجاز به تایید تحویل‌گیری پروژه است.');

      // مدیر دیگری با هویت متفاوت تلاش می‌کند رفع انسداد مدیریتی ثبت‌شده توسط مدیر اول را بازپخش کند
      const queuedPatchByManager1 = createManagerOverrideTransferPayload({
        project: basePendingProject,
        user: qcManager,
        reason: 'رفع انسداد توسط مدیر ۱',
      });

      const anotherManager: User = {
        id: 'u-qc-2',
        name: 'مدیر دوم QC',
        phone: '09128888888',
        role: 'QC_MANAGER',
        active: true,
      };

      expect(() =>
        validateProjectPatchRoleGuards(anotherManager, basePendingProject, queuedPatchByManager1)
      ).toThrow('دسترسی غیرمجاز: شناسه مدیر ثبت‌کننده رفع انسداد باید با هویت جاری تطابق داشته باشد.');
    });

    it('سناریوی ۱۲: سوابق قدیمی و تاریخی انتقال بدون وجود پرچم رفع انسداد، ایمن و حل‌شده تلقی می‌شوند', () => {
      // ساخت رکورد قدیمی که صرفاً receivingLeadConfirmed = true دارد و isManagerOverride در آن undefined است
      const legacyTransferRecord = {
        id: 'trf-legacy',
        fromTeamId: 'team-1',
        fromTeamName: 'اکیپ نصب ۱',
        toTeamId: 'team-2',
        toTeamName: 'اکیپ نصب ۲',
        transferredAt: '2026-10-01T10:00:00Z',
        transferredByUserId: 'u-coord-1',
        transferredByUserName: 'هماهنگ‌کننده',
        reason: 'انتقال قدیمی',
        receivingLeadConfirmed: true,
        receivingLeadConfirmedAt: '2026-10-01T12:00:00Z',
        receivingLeadConfirmedBy: 'سرپرست قدیمی',
        // isManagerOverride تعریف نشده است (Legacy)
      };

      expect(isTransferResolved(legacyTransferRecord)).toBe(true);

      const legacyProject: Project = {
        ...sampleProject,
        assignedTeamId: 'team-2',
        leadTechnicianId: 'u-lead-2',
        teamTransfers: [legacyTransferRecord],
      };

      // پروژه سابقه انتقال دارد اما حل‌شده است، بنابراین در انتظار تایید نیست
      expect(hasPendingTransfer(legacyProject)).toBe(false);

      // اجرای کار بدون هیچ مانعی انجام می‌شود
      expect(() =>
        validateProjectPatchRoleGuards(targetSupervisor, legacyProject, { status: 'EN_ROUTE' })
      ).not.toThrow();

      expect(() =>
        validateProjectPatchRoleGuards(targetSupervisor, legacyProject, { status: 'IN_PROGRESS' })
      ).not.toThrow();
    });
  });

  describe('P2.2 Manager Override Integrity & Adversarial Hardening (مقاوم‌سازی آزمون‌های متخاصم متادیتای ممیزی)', () => {
    const basePendingProject: Project = {
      ...sampleProject,
      assignedTeamId: 'team-2',
      leadTechnicianId: 'u-lead-2',
      assignedTechnicianIds: ['u-lead-2', 'u-tech-2'],
      status: 'SCHEDULED',
      teamTransfers: [
        {
          id: 'trf-adv-1',
          fromTeamId: 'team-1',
          fromTeamName: 'اکیپ نصب ۱',
          toTeamId: 'team-2',
          toTeamName: 'اکیپ نصب ۲',
          transferredAt: '2026-11-20T18:00:00Z',
          transferredByUserId: 'u-coord-1',
          transferredByUserName: 'هماهنگ‌کننده احمدی',
          reason: 'انتقال پروژه',
          receivingLeadConfirmed: false,
          handoverInventory: [
            { activityId: 'act-1', activityTitle: 'شید رول دستی', remainingQuantity: 5, unit: 'لت' },
          ],
        },
      ],
    };

    const validAuditTransfer = {
      ...basePendingProject.teamTransfers![0],
      isManagerOverride: true,
      receivingLeadConfirmed: false,
      managerOverrideByUserId: 'u-qc-1',
      managerOverrideByUserName: 'مهندس رضایی',
      managerOverrideRole: 'QC_MANAGER' as const,
      managerOverrideAt: '2026-11-20T19:00:00.000Z',
      managerOverrideReason: 'توقف کارگاه و تصمیم مدیریت برای ادامه کار توسط اکیپ ۲',
    };

    it('آزمون ۱: رفع انسداد مدیریتی با متادیتای ممیزی کامل و معتبر اجرای پروژه را باز می‌کند', () => {
      expect(isTransferResolved(validAuditTransfer)).toBe(true);

      const unblockedProject: Project = {
        ...basePendingProject,
        teamTransfers: [validAuditTransfer],
      };

      expect(hasPendingTransfer(unblockedProject)).toBe(false);

      expect(() =>
        validateProjectPatchRoleGuards(targetSupervisor, unblockedProject, { status: 'EN_ROUTE' })
      ).not.toThrow();
    });

    it('آزمون ۲: پرچم isManagerOverride: true به تنهایی (بدون متادیتای ممیزی) هرگز اجرای پروژه را باز نمی‌کند', () => {
      const bareOverrideTransfer = {
        ...basePendingProject.teamTransfers![0],
        isManagerOverride: true,
        receivingLeadConfirmed: false,
        // کلیه فیلدهای متادیتای ممیزی ناموجود هستند
      };

      expect(isTransferResolved(bareOverrideTransfer)).toBe(false);

      const blockedProject: Project = {
        ...basePendingProject,
        teamTransfers: [bareOverrideTransfer],
      };

      expect(hasPendingTransfer(blockedProject)).toBe(true);

      expect(() =>
        validateProjectPatchRoleGuards(targetSupervisor, blockedProject, { status: 'EN_ROUTE' })
      ).toThrow('پروژه به اکیپ جدید منتقل شده و در انتظار تایید رسمی تحویل اقلام سر کارگاه است.');
    });

    it('آزمون ۳: فقدان یا خالی بودن شناسه کاربر مدیر (managerOverrideByUserId) مانع رفع انسداد می‌شود', () => {
      const missingIdTransfer = { ...validAuditTransfer, managerOverrideByUserId: undefined };
      const emptyIdTransfer = { ...validAuditTransfer, managerOverrideByUserId: '' };
      const whitespaceIdTransfer = { ...validAuditTransfer, managerOverrideByUserId: '   ' };

      expect(isTransferResolved(missingIdTransfer)).toBe(false);
      expect(isTransferResolved(emptyIdTransfer)).toBe(false);
      expect(isTransferResolved(whitespaceIdTransfer)).toBe(false);

      for (const t of [missingIdTransfer, emptyIdTransfer, whitespaceIdTransfer]) {
        const prj: Project = { ...basePendingProject, teamTransfers: [t as any] };
        expect(hasPendingTransfer(prj)).toBe(true);
        expect(() =>
          validateProjectPatchRoleGuards(targetSupervisor, prj, { status: 'EN_ROUTE' })
        ).toThrow('پروژه به اکیپ جدید منتقل شده و در انتظار تایید رسمی تحویل اقلام سر کارگاه است.');
      }
    });

    it('آزمون ۴: رول نامعتبر یا غیر از QC_MANAGER مانع رفع انسداد می‌شود', () => {
      const leadRoleTransfer = { ...validAuditTransfer, managerOverrideRole: 'LEAD_TECHNICIAN' as any };
      const techRoleTransfer = { ...validAuditTransfer, managerOverrideRole: 'TECHNICIAN' as any };
      const coordRoleTransfer = { ...validAuditTransfer, managerOverrideRole: 'SCHEDULING_COORDINATOR' as any };
      const undefinedRoleTransfer = { ...validAuditTransfer, managerOverrideRole: undefined as any };

      expect(isTransferResolved(leadRoleTransfer)).toBe(false);
      expect(isTransferResolved(techRoleTransfer)).toBe(false);
      expect(isTransferResolved(coordRoleTransfer)).toBe(false);
      expect(isTransferResolved(undefinedRoleTransfer)).toBe(false);

      const prj: Project = { ...basePendingProject, teamTransfers: [leadRoleTransfer] };
      expect(hasPendingTransfer(prj)).toBe(true);
      expect(() =>
        validateProjectPatchRoleGuards(targetSupervisor, prj, { status: 'EN_ROUTE' })
      ).toThrow('پروژه به اکیپ جدید منتقل شده و در انتظار تایید رسمی تحویل اقلام سر کارگاه است.');
    });

    it('آزمون ۵: برچسب زمانی خالی یا نامعتبر مانع رفع انسداد می‌شود', () => {
      const missingTimeTransfer = { ...validAuditTransfer, managerOverrideAt: undefined };
      const emptyTimeTransfer = { ...validAuditTransfer, managerOverrideAt: '' };
      const whitespaceTimeTransfer = { ...validAuditTransfer, managerOverrideAt: '   ' };
      const invalidDateTransfer = { ...validAuditTransfer, managerOverrideAt: 'not-a-valid-date' };

      expect(isTransferResolved(missingTimeTransfer)).toBe(false);
      expect(isTransferResolved(emptyTimeTransfer)).toBe(false);
      expect(isTransferResolved(whitespaceTimeTransfer)).toBe(false);
      expect(isTransferResolved(invalidDateTransfer)).toBe(false);

      for (const t of [missingTimeTransfer, emptyTimeTransfer, whitespaceTimeTransfer, invalidDateTransfer]) {
        const prj: Project = { ...basePendingProject, teamTransfers: [t as any] };
        expect(hasPendingTransfer(prj)).toBe(true);
        expect(() =>
          validateProjectPatchRoleGuards(targetSupervisor, prj, { status: 'EN_ROUTE' })
        ).toThrow('پروژه به اکیپ جدید منتقل شده و در انتظار تایید رسمی تحویل اقلام سر کارگاه است.');
      }
    });

    it('آزمون ۶: دلیل مستند خالی یا دارای فقط کاراکتر فاصله مانع رفع انسداد می‌شود', () => {
      const missingReasonTransfer = { ...validAuditTransfer, managerOverrideReason: undefined };
      const emptyReasonTransfer = { ...validAuditTransfer, managerOverrideReason: '' };
      const whitespaceReasonTransfer = { ...validAuditTransfer, managerOverrideReason: '      ' };

      expect(isTransferResolved(missingReasonTransfer)).toBe(false);
      expect(isTransferResolved(emptyReasonTransfer)).toBe(false);
      expect(isTransferResolved(whitespaceReasonTransfer)).toBe(false);

      for (const t of [missingReasonTransfer, emptyReasonTransfer, whitespaceReasonTransfer]) {
        const prj: Project = { ...basePendingProject, teamTransfers: [t as any] };
        expect(hasPendingTransfer(prj)).toBe(true);
        expect(() =>
          validateProjectPatchRoleGuards(targetSupervisor, prj, { status: 'EN_ROUTE' })
        ).toThrow('پروژه به اکیپ جدید منتقل شده و در انتظار تایید رسمی تحویل اقلام سر کارگاه است.');
      }
    });

    it('آزمون ۷: سازگاری سوابق تاریخی دارای receivingLeadConfirmed: true کاملاً حفظ می‌شود', () => {
      const historicalRecord = {
        id: 'trf-hist-99',
        fromTeamId: 'team-1',
        fromTeamName: 'اکیپ ۱',
        toTeamId: 'team-2',
        toTeamName: 'اکیپ ۲',
        transferredAt: '2026-09-01T10:00:00Z',
        transferredByUserId: 'u-coord-1',
        transferredByUserName: 'هماهنگ‌کننده',
        reason: 'انتقال تاریخی گذشته',
        receivingLeadConfirmed: true,
        receivingLeadConfirmedAt: '2026-09-01T12:00:00Z',
        receivingLeadConfirmedBy: 'سرپرست قبلی',
        // فاقد هرگونه فیلد override
      };

      expect(isTransferResolved(historicalRecord)).toBe(true);

      const histProject: Project = {
        ...sampleProject,
        assignedTeamId: 'team-2',
        leadTechnicianId: 'u-lead-2',
        teamTransfers: [historicalRecord],
      };

      expect(hasPendingTransfer(histProject)).toBe(false);

      expect(() =>
        validateProjectPatchRoleGuards(targetSupervisor, histProject, { status: 'EN_ROUTE' })
      ).not.toThrow();
    });

    it('آزمون ۸: رفع انسداد مدیریتی نمی‌تواند همزمان ادعای تایید فیزیکی سرپرست را داشته باشد (Dual Claim)', () => {
      const dualClaimTransfer = {
        ...validAuditTransfer,
        receivingLeadConfirmed: true, // ادعای همزمان تایید فیزیکی
      };

      // از دید isTransferResolved نامعتبر است و باز نمی‌شود
      expect(isTransferResolved(dualClaimTransfer)).toBe(false);

      const dualProject: Project = {
        ...basePendingProject,
        teamTransfers: [dualClaimTransfer],
      };
      expect(hasPendingTransfer(dualProject)).toBe(true);

      // در مرز اعتبارسنجی پچ با خطای امنیتی قاطع متوقف می‌شود
      expect(() =>
        validateProjectPatchRoleGuards(qcManager, basePendingProject, { teamTransfers: [dualClaimTransfer] })
      ).toThrow('دسترسی غیرمجاز: رفع انسداد مدیریتی نباید به‌عنوان تایید دریافت فیزیکی سرپرست اکیپ ثبت شود.');
    });

    it('آزمون ۹: کاربران غیرمجاز نمی‌توانند متادیتای رفع انسداد را تولید یا جهش آن را ثبت کنند', () => {
      // سرپرست نمی‌تواند تابع تولید پی‌لود رفع انسداد را فراخوانی کند
      expect(() =>
        createManagerOverrideTransferPayload({
          project: basePendingProject,
          user: targetSupervisor,
          reason: 'تلاش غیرمجاز سرپرست',
        })
      ).toThrow('دسترسی غیرمجاز: رفع انسداد مدیریتی انتقال منحصراً در صلاحیت مدیر ارشد QC است.');

      // تکنسین نمی‌تواند
      expect(() =>
        createManagerOverrideTransferPayload({
          project: basePendingProject,
          user: targetTech,
          reason: 'تلاش غیرمجاز تکنسین',
        })
      ).toThrow('دسترسی غیرمجاز: رفع انسداد مدیریتی انتقال منحصراً در صلاحیت مدیر ارشد QC است.');

      // ارسال پچ تولیدشده توسط مدیر با شناسه مدیر دیگر (جعل هویت) رد می‌شود
      const anotherManager: User = {
        id: 'u-qc-fake',
        name: 'مدیر قلابی',
        phone: '09129999999',
        role: 'QC_MANAGER',
        active: true,
      };

      expect(() =>
        validateProjectPatchRoleGuards(anotherManager, basePendingProject, { teamTransfers: [validAuditTransfer] })
      ).toThrow('دسترسی غیرمجاز: شناسه مدیر ثبت‌کننده رفع انسداد باید با هویت جاری تطابق داشته باشد.');
    });

    it('آزمون ۱۰: تداوم عادی کار چندروزه با همان اکیپ (PAUSED) بدون انتقال کاملاً بدون مانع ادامه می‌یابد', () => {
      const pausedNormalProject: Project = {
        ...sampleProject,
        status: 'PAUSED',
        teamTransfers: [],
      };

      expect(hasPendingTransfer(pausedNormalProject)).toBe(false);

      expect(() =>
        validateProjectPatchRoleGuards(leadTech, pausedNormalProject, { status: 'EN_ROUTE' })
      ).not.toThrow();

      expect(() =>
        validateProjectPatchRoleGuards(leadTech, pausedNormalProject, { status: 'IN_PROGRESS' })
      ).not.toThrow();

      expect(() =>
        validateProjectPatchRoleGuards(leadTech, pausedNormalProject, { status: 'PAUSED' })
      ).not.toThrow();
    });
  });
});
