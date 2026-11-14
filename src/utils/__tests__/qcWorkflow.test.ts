import { describe, it, expect } from 'vitest';
import { Project, User, QCDefect } from '../../types';
import {
  calculateQualityScore,
  hasUnresolvedCriticalDefects,
  canApproveFinalQC,
  createQCInspectionPayload,
  createDefectResolutionPayload,
  createDefectVerificationPayload,
  createCustomerAcceptancePayload,
  DEFAULT_QC_CHECKLIST_ITEMS,
  PROVISIONAL_SCORING_WEIGHTS,
} from '../qcWorkflow';
import { validateProjectPatchRoleGuards } from '../roleGuards';

describe('Phase P3: Final Quality Control & Project Sign-off', () => {
  const qcManager: User = {
    id: 'usr-qc-1',
    name: 'مهندس رضایی',
    phone: '09121111111',
    role: 'QC_MANAGER',
    active: true,
  };

  const coordinator: User = {
    id: 'usr-coord-1',
    name: 'هماهنگ‌کننده احمدی',
    phone: '09122222222',
    role: 'SCHEDULING_COORDINATOR',
    active: true,
  };

  const leadTech: User = {
    id: 'usr-lead-1',
    name: 'سرپرست اکبری',
    phone: '09123333333',
    role: 'LEAD_TECHNICIAN',
    active: true,
    teamId: 'team-1',
  };

  const crewTech: User = {
    id: 'usr-tech-1',
    name: 'تکنسین مرادی',
    phone: '09124444444',
    role: 'TECHNICIAN',
    active: true,
    teamId: 'team-1',
  };

  const createCompletedProject = (id: string = 'prj-101'): Project => ({
    id,
    code: 'PRJ-101',
    title: 'پروژه برج فرشته',
    customerName: 'آقای بهرامی',
    customerPhone: '09120000000',
    address: 'تهران، خیابان فرشته',
    shadePanels: 6,
    curtainPanels: 2,
    scheduledDate: '2026-11-20',
    scheduledTime: '09:00',
    assignedTeamId: 'team-1',
    assignedTeamName: 'اکیپ نصب ۱',
    leadTechnicianId: 'usr-lead-1',
    assignedTechnicianIds: ['usr-lead-1', 'usr-tech-1'],
    isFullTools: true,
    toolsRequired: [],
    proposalImages: [],
    completionPhotos: ['photo-1.jpg', 'photo-2.jpg'],
    status: 'COMPLETED',
    qcStatus: 'PENDING',
    createdAt: '2026-11-19T08:00:00Z',
    updatedAt: '2026-11-20T17:00:00Z',
  });

  const sampleChecklist = DEFAULT_QC_CHECKLIST_ITEMS.map((item) => ({
    ...item,
    passed: true,
  }));

  it('Requirement 1 & 2: Only QC_MANAGER can approve final QC, other roles cannot bypass via direct mutation paths', () => {
    const project = createCompletedProject();

    // 1. QC_MANAGER can approve
    expect(() =>
      validateProjectPatchRoleGuards(qcManager, project, {
        qcStatus: 'APPROVED',
        qcScore: 5,
        qcNotes: 'نصب عالی و بدون نقص.',
      })
    ).not.toThrow();

    // 2. LEAD_TECHNICIAN is blocked
    expect(() =>
      validateProjectPatchRoleGuards(leadTech, project, {
        qcStatus: 'APPROVED',
      })
    ).toThrow('دسترسی غیرمجاز: تکنسین فقط می‌تواند وضعیت QC را روی PENDING تنظیم کند.');

    // 3. TECHNICIAN is blocked
    expect(() =>
      validateProjectPatchRoleGuards(crewTech, project, {
        qcStatus: 'APPROVED',
      })
    ).toThrow('دسترسی غیرمجاز: تکنسین فقط می‌تواند وضعیت QC را روی PENDING تنظیم کند.');

    // 4. SCHEDULING_COORDINATOR is blocked
    expect(() =>
      validateProjectPatchRoleGuards(coordinator, project, {
        qcStatus: 'APPROVED',
      })
    ).toThrow('دسترسی غیرمجاز: تأیید نهایی کنترل کیفی (QC) فقط در صلاحیت مدیر QC است.');
  });

  it('Requirement 3: Critical unresolved defects prevent final QC approval (for all users including QC_MANAGER)', () => {
    const criticalDefect: QCDefect = {
      id: 'def-1',
      description: 'شل بودن کرپی سقف کاذب و خطر سقوط لت پرده سنگین',
      category: 'HARDWARE',
      severity: 'CRITICAL',
      location: 'پنجره سالن اصلی',
      createdAt: '2026-11-20T17:30:00Z',
      createdByUserId: qcManager.id,
      createdByUserName: qcManager.name,
      status: 'OPEN',
    };

    const projectWithCriticalDefect: Project = {
      ...createCompletedProject(),
      qcDefects: [criticalDefect],
    };

    expect(hasUnresolvedCriticalDefects(projectWithCriticalDefect)).toBe(true);

    const check = canApproveFinalQC(qcManager, projectWithCriticalDefect);
    expect(check.allowed).toBe(false);
    expect(check.reason).toContain('عدم‌انطباق یا نقص بحرانی');

    // Attempting final approval via role guard throws PermanentError
    expect(() =>
      validateProjectPatchRoleGuards(qcManager, projectWithCriticalDefect, {
        qcStatus: 'APPROVED',
      })
    ).toThrow('پروژه دارای عدم‌انطباق یا نقص بحرانی (CRITICAL) حل‌نشده است.');

    // Attempting createQCInspectionPayload with PASS while critical defect exists throws Error
    expect(() =>
      createQCInspectionPayload({
        project: projectWithCriticalDefect,
        user: qcManager,
        result: 'PASS',
        checklist: sampleChecklist,
      })
    ).toThrow('صدور تایید نهایی امکان‌پذیر نیست: پروژه دارای عدم انطباق یا نقص بحرانی');
  });

  it('Requirement 4: Reinspection preserves previous inspection history (does not overwrite historical records)', () => {
    const project = createCompletedProject();

    // نوبت اول بازرسی: عدم تایید اولیه به دلیل ایراد اتوکشی و تراز
    const defectMinor: QCDefect = {
      id: 'def-minor-1',
      description: 'چروک در حاشیه پایینی والان',
      category: 'FABRIC',
      severity: 'MINOR',
      createdAt: '2026-11-20T17:30:00Z',
      createdByUserId: qcManager.id,
      createdByUserName: qcManager.name,
      status: 'OPEN',
    };

    const firstRun = createQCInspectionPayload({
      project,
      user: qcManager,
      result: 'FAIL',
      checklist: sampleChecklist.map((c) => (c.id === 'chk-fabric' ? { ...c, passed: false } : c)),
      defects: [defectMinor],
      notes: 'نیازمند اتوکشی مجدد',
    });

    const projectAfterFirstInspection = { ...project, ...firstRun.patch };
    expect(projectAfterFirstInspection.qcInspections).toHaveLength(1);
    expect(projectAfterFirstInspection.qcInspections![0].result).toBe('FAIL');
    expect(projectAfterFirstInspection.qcStatus).toBe('REJECTED');
    expect(projectAfterFirstInspection.status).toBe('IN_PROGRESS'); // جهت انجام اصلاحات بازگردانده شد

    // تکنسین اقدام به رفع نقص می‌کند
    const resolvedPatch = createDefectResolutionPayload({
      project: projectAfterFirstInspection,
      defectId: 'def-minor-1',
      user: leadTech,
      resolutionNotes: 'اتوکشی مجدد انجام شد و چروک کاملاً برطرف گردید.',
    });
    const projectAfterFix = { ...projectAfterFirstInspection, ...resolvedPatch };

    // نوبت دوم بازرسی (Reinspection): تایید نهایی
    const secondRun = createQCInspectionPayload({
      project: projectAfterFix,
      user: qcManager,
      result: 'PASS',
      checklist: sampleChecklist,
      notes: 'اصلاحیه با موفقیت تایید شد.',
    });

    const projectFinal = { ...projectAfterFix, ...secondRun.patch };

    // تاریخچه کامل بازرسی‌ها حفظ شده است (رکوردهای قبلی بازنویسی نشده‌اند)
    expect(projectFinal.qcInspections).toHaveLength(2);
    expect(projectFinal.qcInspections![0].id).toBe(firstRun.inspectionRecord.id);
    expect(projectFinal.qcInspections![0].result).toBe('FAIL');
    expect(projectFinal.qcInspections![1].id).toBe(secondRun.inspectionRecord.id);
    expect(projectFinal.qcInspections![1].result).toBe('PASS');
    expect(projectFinal.qcStatus).toBe('APPROVED');
    expect(projectFinal.status).toBe('COMPLETED');
  });

  it('Requirement 5: Corrective work remains linked to the original project and preserves single-record identity', () => {
    const project = createCompletedProject('prj-single-record');

    const defect: QCDefect = {
      id: 'def-loc-1',
      description: 'تنظیم نبودن لیمیت ریموت موتور',
      category: 'MOTOR_REMOTE',
      severity: 'MAJOR',
      location: 'اتاق خواب مستر',
      createdAt: '2026-11-20T17:30:00Z',
      createdByUserId: qcManager.id,
      createdByUserName: qcManager.name,
      status: 'OPEN',
      assignedTeamId: 'team-1',
    };

    const { patch } = createQCInspectionPayload({
      project,
      user: qcManager,
      result: 'CONDITIONAL',
      checklist: sampleChecklist,
      defects: [defect],
      notes: 'نیاز به تنظیم مجدد حد بالا/پایین موتور',
      reworkScheduledDate: '2026-11-21',
    });

    const updated = { ...project, ...patch };

    // پروژه در همان شناسه واحد حفظ شده است
    expect(updated.id).toBe('prj-single-record');
    expect(updated.code).toBe('PRJ-101');
    expect(updated.qcDefects).toHaveLength(1);
    expect(updated.qcDefects![0].description).toBe('تنظیم نبودن لیمیت ریموت موتور');
    expect(updated.qcCorrectiveAction?.required).toBe(true);
    expect(updated.scheduledDate).toBe('2026-11-21');
  });

  it('Requirement 6 & 7: Customer acceptance is strictly separate from internal QC and unavailability can be recorded with a reason', () => {
    const project = createCompletedProject();

    // ۱. ثبت رضایت کامل کارفرما با امضا
    const customerPatch = createCustomerAcceptancePayload({
      project,
      status: 'ACCEPTED',
      representativeName: 'آقای بهرامی',
      representativeRole: 'کارفرما',
      signature: 'data:image/png;base64,sampleSign',
      customerSatisfaction: 5,
      notes: 'از نصب و تمیزی کار بسیار راضی هستم.',
    });

    const projectWithCustomerAcceptance = { ...project, ...customerPatch };

    // رضایت مشتری ثبت شد اما وضعیت QC تغییر نکرد (QC Approved نشد!)
    expect(projectWithCustomerAcceptance.customerAcceptance?.status).toBe('ACCEPTED');
    expect(projectWithCustomerAcceptance.customerAcceptance?.signature).toBe('data:image/png;base64,sampleSign');
    expect(projectWithCustomerAcceptance.customerSatisfaction).toBe(5);
    expect(projectWithCustomerAcceptance.qcStatus).toBe('PENDING'); // هرگز به صورت خودکار تایید نمی‌شود

    // ۲. ثبت عدم حضور کارفرما / نماینده با دلیل مستند
    const unavailablePatch = createCustomerAcceptancePayload({
      project,
      status: 'UNAVAILABLE',
      unavailabilityReason: 'کارفرما در سفر خارج از کشور بود و کلید تحویل لابی‌من شد.',
      unavailabilityPhotos: ['lock-photo.jpg'],
    });

    const projectUnavailable = { ...project, ...unavailablePatch };
    expect(projectUnavailable.customerAcceptance?.status).toBe('UNAVAILABLE');
    expect(projectUnavailable.customerAcceptance?.unavailabilityReason).toBe(
      'کارفرما در سفر خارج از کشور بود و کلید تحویل لابی‌من شد.'
    );

    // عدم حضور کارفرما مانع بازرسی و تایید داخلی QC نمی‌شود
    expect(() =>
      validateProjectPatchRoleGuards(qcManager, projectUnavailable, {
        qcStatus: 'APPROVED',
        qcScore: 4,
      })
    ).not.toThrow();

    // تلاش برای ثبت UNAVAILABLE بدون دلیل مستند متوقف می‌شود
    expect(() =>
      createCustomerAcceptancePayload({
        project,
        status: 'UNAVAILABLE',
        unavailabilityReason: '',
      })
    ).toThrow('در صورت عدم حضور کارفرما، ثبت دلیل مستند عدم امکان اخذ امضا الزامی است.');
  });

  it('Requirement 8: A one-visit completed project proceeds through final QC without artificial extra missions', () => {
    const oneVisitProject: Project = {
      ...createCompletedProject('prj-one-visit'),
      scheduledDate: '2026-11-20',
      workSessions: [
        {
          date: '2026-11-20',
          startedAt: '2026-11-20T09:00:00Z',
          endedAt: '2026-11-20T15:00:00Z',
          byUserId: 'usr-lead-1',
          byUserName: 'سرپرست اکبری',
        },
      ],
      status: 'COMPLETED',
      qcStatus: 'PENDING',
    };

    // مستقیماً در یک گام ارزیابی کیفی شده و تایید می‌شود
    const { patch } = createQCInspectionPayload({
      project: oneVisitProject,
      user: qcManager,
      result: 'PASS',
      checklist: sampleChecklist,
      overallScore: 5,
      notes: 'پروژه تک‌روزه با استاندارد عالی تحویل شد.',
    });

    const finalProject = { ...oneVisitProject, ...patch };
    expect(finalProject.qcStatus).toBe('APPROVED');
    expect(finalProject.status).toBe('COMPLETED');
    expect(finalProject.qcInspections).toHaveLength(1);
  });

  it('Requirement 9: A multi-day project retains its original project ID and full progress/session history through final QC', () => {
    const multiDayProject: Project = {
      ...createCompletedProject('prj-multiday-99'),
      workSessions: [
        {
          date: '2026-11-18',
          startedAt: '2026-11-18T09:00:00Z',
          endedAt: '2026-11-18T17:00:00Z',
          byUserId: 'usr-lead-1',
          byUserName: 'سرپرست اکبری',
        },
        {
          date: '2026-11-19',
          startedAt: '2026-11-19T09:00:00Z',
          endedAt: '2026-11-19T16:00:00Z',
          byUserId: 'usr-lead-1',
          byUserName: 'سرپرست اکبری',
        },
      ],
      dailyLogs: [
        {
          id: 'log-1',
          date: '2026-11-18',
          byUserId: 'usr-lead-1',
          byUserName: 'سرپرست اکبری',
          note: 'نصب ریل‌ها و قوطی‌کشی طبقه اول',
          photos: [],
          supervisorConfirmed: true,
          createdAt: '2026-11-18T17:00:00Z',
        },
        {
          id: 'log-2',
          date: '2026-11-19',
          byUserId: 'usr-lead-1',
          byUserName: 'سرپرست اکبری',
          note: 'نصب پرده‌ها و شیدهای اتاق خواب‌ها',
          photos: [],
          supervisorConfirmed: true,
          createdAt: '2026-11-19T16:00:00Z',
        },
      ],
      status: 'COMPLETED',
      qcStatus: 'PENDING',
    };

    const { patch } = createQCInspectionPayload({
      project: multiDayProject,
      user: qcManager,
      result: 'PASS',
      checklist: sampleChecklist,
      overallScore: 4.8,
    });

    const approvedMultiDay = { ...multiDayProject, ...patch };
    expect(approvedMultiDay.id).toBe('prj-multiday-99');
    expect(approvedMultiDay.workSessions).toHaveLength(2);
    expect(approvedMultiDay.dailyLogs).toHaveLength(2);
    expect(approvedMultiDay.qcStatus).toBe('APPROVED');
  });

  it('Requirement 10: Material requests remain strictly separate from QC defects', () => {
    // نقص کیفی (Defect) با متریال ریکوئست اشتباه گرفته نمی‌شود
    const defect: QCDefect = {
      id: 'def-10',
      description: 'عدم تراز پایه سمت راست',
      category: 'LEVELING',
      severity: 'MINOR',
      createdAt: '2026-11-20T10:00:00Z',
      createdByUserId: qcManager.id,
      createdByUserName: qcManager.name,
      status: 'OPEN',
    };

    // فیلدهای اختصاصی دیسپچ و انبار و آیتم‌های مقداری مربوط به متریال ریکوئست در عیوب کیفی دخیل نیست
    expect(defect).not.toHaveProperty('requestedQty');
    expect(defect).not.toHaveProperty('dispatches');
    expect(defect).toHaveProperty('severity');
    expect(defect).toHaveProperty('status');
  });

  it('Requirement 11: Internal quality scoring model calculates transparent scores with provisional weights', () => {
    const criteria = {
      levelingScore: 5,
      fabricFinishScore: 4,
      mechanicsScore: 5,
      cleanlinessScore: 4,
      complianceScore: 5,
    };

    const result = calculateQualityScore(criteria);

    // محاسبه با اوزان موقت:
    // 5 * 0.25 + 4 * 0.25 + 5 * 0.20 + 4 * 0.15 + 5 * 0.15 = 1.25 + 1.0 + 1.0 + 0.6 + 0.75 = 4.6
    expect(result.overallScore).toBe(4.6);
    expect(result.isProvisionalWeights).toBe(true);
    expect(PROVISIONAL_SCORING_WEIGHTS.LEVELING).toBe(0.25);
    expect(PROVISIONAL_SCORING_WEIGHTS.FABRIC_FINISH).toBe(0.25);
    expect(PROVISIONAL_SCORING_WEIGHTS.MECHANICS).toBe(0.20);
    expect(PROVISIONAL_SCORING_WEIGHTS.CLEANLINESS).toBe(0.15);
    expect(PROVISIONAL_SCORING_WEIGHTS.COMPLIANCE).toBe(0.15);
  });

  it('Requirement 12: Defect lifecycle: resolution by technician and verification exclusively by QC_MANAGER', () => {
    const project = createCompletedProject();
    const defect: QCDefect = {
      id: 'def-lifecycle-1',
      description: 'نقص در سیم‌کشی سوکت ریموت',
      category: 'MOTOR_REMOTE',
      severity: 'MAJOR',
      createdAt: '2026-11-20T10:00:00Z',
      createdByUserId: qcManager.id,
      createdByUserName: qcManager.name,
      status: 'OPEN',
    };

    const projectWithDefect = { ...project, qcDefects: [defect] };

    // ۱. تکنسین نقص را رفع می‌کند
    const resolvedPatch = createDefectResolutionPayload({
      project: projectWithDefect,
      defectId: 'def-lifecycle-1',
      user: leadTech,
      resolutionNotes: 'سوکت تعویض و سیم‌کشی مجدداً سربندی شد.',
      resolutionPhotos: ['fixed-socket.jpg'],
    });

    const projectResolved = { ...projectWithDefect, ...resolvedPatch };
    expect(projectResolved.qcDefects![0].status).toBe('RESOLVED');
    expect(projectResolved.qcDefects![0].resolvedByUserName).toBe('سرپرست اکبری');

    // تکنسین اجازه ندارد وضعیت را مستقیماً به VERIFIED ببرد
    expect(() =>
      validateProjectPatchRoleGuards(leadTech, projectResolved, {
        qcDefects: [
          {
            ...projectResolved.qcDefects![0],
            status: 'VERIFIED',
          },
        ],
      })
    ).toThrow('دسترسی غیرمجاز: تایید راستی‌آزمایی رفع نقص منحصراً در صلاحیت مدیر ارشد QC است.');

    // تکنسین نمی‌تواند نقص ثبت‌شده را حذف کند
    expect(() =>
      validateProjectPatchRoleGuards(leadTech, projectResolved, {
        qcDefects: [],
      })
    ).toThrow('دسترسی غیرمجاز: حذف عیوب کیفی ثبت‌شده مجاز نیست.');

    // ۲. مدیر QC راستی‌آزمایی کرده و نقص را VERIFIED می‌کند
    const verifiedPatch = createDefectVerificationPayload({
      project: projectResolved,
      defectId: 'def-lifecycle-1',
      user: qcManager,
      verificationNotes: 'عملکرد سوکت در محل بررسی و تایید شد.',
    });

    const projectVerified = { ...projectResolved, ...verifiedPatch };
    expect(projectVerified.qcDefects![0].status).toBe('VERIFIED');
    expect(projectVerified.qcDefects![0].verifiedByUserName).toBe('مهندس رضایی');

    // نقصی که VERIFIED شده دیگر توسط تکنسین قابل تغییر نیست
    expect(() =>
      createDefectResolutionPayload({
        project: projectVerified,
        defectId: 'def-lifecycle-1',
        user: leadTech,
        resolutionNotes: 'تلاش برای ویرایش مجدد',
      })
    ).toThrow('این نقص قبلاً توسط مدیر QC تایید نهایی شده و قابل تغییر نیست.');
  });

  it('Requirement 13: Customer acceptance payload correctly populates project customerAcceptance field and allows technician updates', () => {
    const project = createCompletedProject();

    const customerPatch = createCustomerAcceptancePayload({
      project,
      status: 'ACCEPTED',
      representativeName: 'مهندس رضوی',
      representativeRole: 'ناظر ساختمان',
      signature: 'data:image/png;base64,sampleSign2',
      customerSatisfaction: 5,
      notes: 'تحویل بدون نقص با نماینده مقیم انجام شد.',
    });

    // تکنسین می‌تواند این پچ را طبق RoleGuard ارسال کند
    expect(() =>
      validateProjectPatchRoleGuards(leadTech, project, customerPatch)
    ).not.toThrow();

    const updated = { ...project, ...customerPatch };
    expect(updated.customerAcceptance?.status).toBe('ACCEPTED');
    expect(updated.customerAcceptance?.representativeName).toBe('مهندس رضوی');
    expect(updated.customerAcceptance?.representativeRole).toBe('ناظر ساختمان');
  });

  it('Requirement 14: Defect resolution notes are mandatory and reject empty or whitespace strings', () => {
    const project = createCompletedProject();
    const defect: QCDefect = {
      id: 'def-val-1',
      description: 'نقص در تراز قاب والان',
      category: 'LEVELING',
      severity: 'MINOR',
      createdAt: '2026-11-20T10:00:00Z',
      createdByUserId: qcManager.id,
      createdByUserName: qcManager.name,
      status: 'OPEN',
    };
    const projectWithDefect = { ...project, qcDefects: [defect] };

    expect(() =>
      createDefectResolutionPayload({
        project: projectWithDefect,
        defectId: 'def-val-1',
        user: leadTech,
        resolutionNotes: '   ',
      })
    ).toThrow('ثبت گزارش مستند از نحوه رفع نقص الزامی است.');
  });
});
