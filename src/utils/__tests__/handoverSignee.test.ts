import { describe, it, expect } from 'vitest';
import { Project, HandoverChecklist } from '../../types';

describe('P1 Handover & Customer Satisfaction Architecture', () => {
  const baseChecklist: HandoverChecklist = {
    floorProtectiveClothUsed: true,
    cradleBracketsSecured: true,
    remoteTested: true,
    leveled: true,
    ironedPleated: true,
    cleaned: true,
  };

  const createBaseProject = (id: string): Project => ({
    id,
    code: `PRJ-${id}`,
    title: `پروژه تست تحویل ${id}`,
    customerName: 'آقای صادقی',
    customerPhone: '09121111111',
    address: 'تهران، خیابان فرشته',
    shadePanels: 2,
    curtainPanels: 1,
    scheduledTime: '10:00',
    assignedTechnicianIds: ['tech-1'],
    isFullTools: true,
    toolsRequired: [],
    completionPhotos: [],
    status: 'IN_PROGRESS',
    qcStatus: 'NOT_STARTED',
    proposalImages: [],
    requiredDurationHours: 6,
    scheduledDate: '2026-11-10',
    createdAt: '2026-11-09T08:00:00.000Z',
    updatedAt: '2026-11-09T08:00:00.000Z',
  });

  it('supports Residential Customer handover with signature and optional satisfaction rating', () => {
    const project = createBaseProject('res-1');

    const completionPatch: Partial<Project> = {
      status: 'COMPLETED',
      qcStatus: 'PENDING',
      completedAt: '2026-11-10T16:00:00.000Z',
      handoverChecklist: baseChecklist,
      handoverSigneeType: 'RESIDENTIAL_CUSTOMER',
      customerSignature: 'data:image/png;base64,signature123',
      customerSatisfaction: 5,
    };

    const updated = { ...project, ...completionPatch };

    expect(updated.status).toBe('COMPLETED');
    expect(updated.qcStatus).toBe('PENDING');
    expect(updated.handoverSigneeType).toBe('RESIDENTIAL_CUSTOMER');
    expect(updated.customerSignature).toBe('data:image/png;base64,signature123');
    expect(updated.customerSatisfaction).toBe(5);
  });

  it('allows Residential Customer completion with omitted/optional satisfaction rating', () => {
    const project = createBaseProject('res-2');

    const completionPatch: Partial<Project> = {
      status: 'COMPLETED',
      qcStatus: 'PENDING',
      completedAt: '2026-11-10T16:00:00.000Z',
      handoverChecklist: baseChecklist,
      handoverSigneeType: 'RESIDENTIAL_CUSTOMER',
      customerSignature: 'data:image/png;base64,sig',
      customerSatisfaction: undefined, // Optional satisfaction
    };

    const updated = { ...project, ...completionPatch };

    expect(updated.status).toBe('COMPLETED');
    expect(updated.customerSatisfaction).toBeUndefined();
    expect(updated.customerSignature).toBeDefined();
  });

  it('supports Construction Representative handover with contact details and role', () => {
    const project = createBaseProject('rep-1');

    const completionPatch: Partial<Project> = {
      status: 'COMPLETED',
      qcStatus: 'PENDING',
      completedAt: '2026-11-10T17:30:00.000Z',
      handoverChecklist: baseChecklist,
      handoverSigneeType: 'CONSTRUCTION_REPRESENTATIVE',
      representativeName: 'مهندس حسینی',
      representativeRole: 'ناظر عالیه معماری',
      representativePhone: '09122223344',
      customerSignature: 'data:image/png;base64,repSignature',
      customerSatisfaction: 4,
    };

    const updated = { ...project, ...completionPatch };

    expect(updated.handoverSigneeType).toBe('CONSTRUCTION_REPRESENTATIVE');
    expect(updated.representativeName).toBe('مهندس حسینی');
    expect(updated.representativeRole).toBe('ناظر عالیه معماری');
    expect(updated.representativePhone).toBe('09122223344');
    expect(updated.customerSignature).toBe('data:image/png;base64,repSignature');
  });

  it('supports Documented Absence Exemption without customer signature', () => {
    const project = createBaseProject('absent-1');

    const completionPatch: Partial<Project> = {
      status: 'COMPLETED',
      qcStatus: 'PENDING',
      completedAt: '2026-11-10T19:00:00.000Z',
      handoverChecklist: baseChecklist,
      handoverSigneeType: 'UNAVAILABLE_EXEMPT',
      unavailabilityReason: 'کارفرما به علت ترافیک حاضر نشد و با تماس تلفنی ساعت ۱۸ هماهنگ شد کلید به حراست برج تحویل گردد.',
      unavailabilityPhotos: ['https://example.com/door-locked.jpg', 'https://example.com/key-handover.jpg'],
      customerSignature: undefined, // No customer signature required!
      customerSatisfaction: undefined,
    };

    const updated = { ...project, ...completionPatch };

    expect(updated.status).toBe('COMPLETED');
    expect(updated.qcStatus).toBe('PENDING');
    expect(updated.handoverSigneeType).toBe('UNAVAILABLE_EXEMPT');
    expect(updated.customerSignature).toBeUndefined();
    expect(updated.unavailabilityReason).toContain('حراست برج');
    expect(updated.unavailabilityPhotos?.length).toBe(2);
  });

  it('creates a formal corrective action when QC manager rejects a completed project', () => {
    const completedProject: Project = {
      ...createBaseProject('qc-rej-1'),
      status: 'COMPLETED',
      qcStatus: 'PENDING',
      assignedTeamId: 'team-gold-1',
      assignedTeamName: 'اکیپ طلایی ۱',
      completedAt: '2026-11-10T16:00:00.000Z',
    };

    const rejectPatch: Partial<Project> = {
      status: 'IN_PROGRESS',
      qcStatus: 'REJECTED',
      qcNotes: 'لت دوم از سمت راست ۱ سانتی‌متر از تراز افقی خارج است و نیاز به ریگلاژ مجدد دارد.',
      qcCorrectiveAction: {
        required: true,
        issue: 'لت دوم از سمت راست ۱ سانتی‌متر از تراز افقی خارج است و نیاز به ریگلاژ مجدد دارد.',
        assignedTeamId: completedProject.assignedTeamId,
        deadline: '2026-11-12',
        completed: false,
      },
      reworkStartedAt: '2026-11-11T09:00:00.000Z',
      qcReviewedAt: '2026-11-11T09:00:00.000Z',
      qcReviewedBy: 'مدیر کنترل کیفیت',
    };

    const reworked = { ...completedProject, ...rejectPatch };

    expect(reworked.status).toBe('IN_PROGRESS');
    expect(reworked.qcStatus).toBe('REJECTED');
    expect(reworked.qcCorrectiveAction?.required).toBe(true);
    expect(reworked.qcCorrectiveAction?.assignedTeamId).toBe('team-gold-1');
    expect(reworked.qcCorrectiveAction?.completed).toBe(false);
  });

  it('marks corrective action completed when QC manager approves after rework', () => {
    const reworkedProject: Project = {
      ...createBaseProject('qc-app-1'),
      status: 'COMPLETED',
      qcStatus: 'PENDING',
      qcCorrectiveAction: {
        required: true,
        issue: 'ریگلاژ لت دوم',
        assignedTeamId: 'team-gold-1',
        completed: false,
      },
    };

    const approvePatch: Partial<Project> = {
      status: 'COMPLETED',
      qcStatus: 'APPROVED',
      qcScore: 5,
      qcNotes: 'ریگلاژ با دقت بالا تایید شد.',
      qcReviewedAt: '2026-11-12T11:00:00.000Z',
      qcReviewedBy: 'مدیر کنترل کیفیت',
      qcCorrectiveAction: {
        ...reworkedProject.qcCorrectiveAction!,
        completed: true,
        completedAt: '2026-11-12T11:00:00.000Z',
      },
    };

    const approved = { ...reworkedProject, ...approvePatch };

    expect(approved.qcStatus).toBe('APPROVED');
    expect(approved.qcScore).toBe(5);
    expect(approved.qcCorrectiveAction?.completed).toBe(true);
    expect(approved.qcCorrectiveAction?.completedAt).toBeDefined();
  });
});
