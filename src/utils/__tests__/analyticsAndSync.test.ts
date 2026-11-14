import { describe, it, expect } from 'vitest';
import { Project, InstallationTeamWithMembers, MaterialRequest, User } from '../../types';
import { SupabaseSyncService } from '../supabase';
import { createConfirmReceiptPayload, canConfirmMaterialReceipt } from '../materialRequests';

describe('Phase P4: Analytics, Operational Intelligence & Sync Hardening', () => {
  const _sampleTeams: InstallationTeamWithMembers[] = [
    {
      id: 'team-1',
      name: 'اکیپ نصب ۱ (شمال تهران)',
      code: 'TEAM-1',
      dailyCapacityHours: 8,
      workingDays: [0, 1, 2, 3, 4, 6],
      createdAt: '2026-11-01T00:00:00Z',
      updatedAt: '2026-11-01T00:00:00Z',
      supervisor: {
        id: 'usr-1',
        name: 'سرپرست حسینی',
        phone: '09121111111',
        role: 'LEAD_TECHNICIAN',
        active: true,
      },
      technicians: [],
      totalMembers: 1,
    },
    {
      id: 'team-2',
      name: 'اکیپ نصب ۲ (غرب تهران)',
      code: 'TEAM-2',
      dailyCapacityHours: 8,
      workingDays: [0, 1, 2, 3, 4, 6],
      createdAt: '2026-11-01T00:00:00Z',
      updatedAt: '2026-11-01T00:00:00Z',
      supervisor: {
        id: 'usr-2',
        name: 'سرپرست رضایی',
        phone: '09122222222',
        role: 'LEAD_TECHNICIAN',
        active: true,
      },
      technicians: [],
      totalMembers: 1,
    },
  ];

  const sampleProjects: Project[] = [
    {
      id: 'prj-1',
      code: 'PRJ-101',
      title: 'پروژه برج فرشته',
      customerName: 'آقای بهرامی',
      customerPhone: '09120000000',
      address: 'فرشته',
      shadePanels: 4,
      curtainPanels: 2,
      scheduledDate: '2026-11-10',
      scheduledTime: '09:00',
      assignedTeamId: 'team-1',
      assignedTechnicianIds: ['usr-1'],
      completionPhotos: [],
      isFullTools: true,
      toolsRequired: [],
      proposalImages: [],
      status: 'COMPLETED',
      qcStatus: 'APPROVED',
      qcScore: 5,
      customerSatisfaction: 5,
      customerSignature: 'data:image/png;base64,sig1',
      qcInspections: [
        {
          id: 'qci-1',
          projectId: 'prj-1',
          inspectionDate: '2026-11-10T17:00:00Z',
          inspectorUserId: 'qc-1',
          inspectorUserName: 'مدیر کیوسی',
          inspectorRole: 'QC_MANAGER',
          result: 'PASS',
          overallScore: 5,
          checklist: [],
          defects: [],
          createdAt: '2026-11-10T17:00:00Z',
        },
      ],
      createdAt: '2026-11-09T08:00:00Z',
      updatedAt: '2026-11-10T17:00:00Z',
    },
    {
      id: 'prj-2',
      code: 'PRJ-102',
      title: 'پروژه سعادت‌آباد',
      customerName: 'خانم علوی',
      customerPhone: '09123333333',
      address: 'سعادت‌آباد',
      shadePanels: 6,
      curtainPanels: 0,
      scheduledDate: '2026-11-11',
      scheduledTime: '10:00',
      assignedTeamId: 'team-1',
      assignedTechnicianIds: ['usr-1'],
      completionPhotos: [],
      isFullTools: true,
      toolsRequired: [],
      proposalImages: [],
      status: 'COMPLETED',
      qcStatus: 'APPROVED',
      qcScore: 4,
      customerSatisfaction: 4,
      qcDefects: [
        {
          id: 'def-1',
          description: 'نقص در تراز والان',
          category: 'LEVELING',
          severity: 'MINOR',
          status: 'VERIFIED',
          createdAt: '2026-11-11T16:00:00Z',
          createdByUserId: 'qc-1',
          createdByUserName: 'مدیر کیوسی',
        },
      ],
      qcInspections: [
        {
          id: 'qci-2-fail',
          projectId: 'prj-2',
          inspectionDate: '2026-11-11T16:00:00Z',
          inspectorUserId: 'qc-1',
          inspectorUserName: 'مدیر کیوسی',
          inspectorRole: 'QC_MANAGER',
          result: 'FAIL',
          overallScore: 3,
          checklist: [],
          defects: [],
          createdAt: '2026-11-11T16:00:00Z',
        },
        {
          id: 'qci-2-pass',
          projectId: 'prj-2',
          inspectionDate: '2026-11-11T18:00:00Z',
          inspectorUserId: 'qc-1',
          inspectorUserName: 'مدیر کیوسی',
          inspectorRole: 'QC_MANAGER',
          result: 'PASS',
          overallScore: 4,
          checklist: [],
          defects: [],
          createdAt: '2026-11-11T18:00:00Z',
        },
      ],
      createdAt: '2026-11-10T08:00:00Z',
      updatedAt: '2026-11-11T18:00:00Z',
    },
    {
      id: 'prj-3',
      code: 'PRJ-103',
      title: 'پروژه شهرک غرب',
      customerName: 'دکتر افشار',
      customerPhone: '09124444444',
      address: 'شهرک غرب',
      shadePanels: 2,
      curtainPanels: 3,
      scheduledDate: '2026-11-12',
      scheduledTime: '11:00',
      assignedTeamId: 'team-2',
      assignedTechnicianIds: ['usr-2'],
      completionPhotos: [],
      isFullTools: true,
      toolsRequired: [],
      proposalImages: [],
      status: 'COMPLETED',
      qcStatus: 'APPROVED',
      qcScore: 4.5,
      customerSatisfaction: 5,
      handoverSigneeType: 'UNAVAILABLE_EXEMPT',
      unavailabilityReason: 'کارفرما در خارج از کشور بود.',
      createdAt: '2026-11-11T08:00:00Z',
      updatedAt: '2026-11-12T17:00:00Z',
    },
  ];

  const _sampleMaterials: MaterialRequest[] = [
    {
      id: 'mat-1',
      projectId: 'prj-1',
      projectTitle: 'پروژه برج فرشته',
      projectCode: 'PRJ-101',
      category: 'HARDWARE',
      reason: 'SHORTAGE',
      items: [
        {
          id: 'i-1',
          title: 'بست کرپی اضافه',
          category: 'HARDWARE',
          requestedQty: 10,
          unit: 'عدد',
        },
      ],
      urgency: 'CRITICAL_BLOCKING',
      status: 'DELIVERED_CONFIRMED',
      requestedByUserId: 'usr-1',
      requestedByUserName: 'سرپرست حسینی',
      requestedAt: '2026-11-10T12:00:00Z',
      notes: 'نیازمند ارسال فوری با پیک',
      dispatches: [],
      history: [],
      createdAt: '2026-11-10T12:00:00Z',
      updatedAt: '2026-11-10T14:00:00Z',
    },
    {
      id: 'mat-2',
      projectId: 'prj-2',
      projectTitle: 'پروژه سعادت‌آباد',
      projectCode: 'PRJ-102',
      category: 'MOTOR',
      reason: 'DEFECT_DAMAGE',
      items: [
        {
          id: 'i-2',
          title: 'ریموت ۵ کانال سامفی',
          category: 'MOTOR',
          requestedQty: 1,
          unit: 'دستگاه',
        },
      ],
      urgency: 'URGENT',
      status: 'DISPATCHED',
      requestedByUserId: 'usr-1',
      requestedByUserName: 'سرپرست حسینی',
      requestedAt: '2026-11-11T12:00:00Z',
      dispatches: [],
      history: [],
      createdAt: '2026-11-11T12:00:00Z',
      updatedAt: '2026-11-11T13:00:00Z',
    },
  ];

  it('calculates QC metrics and First-Time Pass Rate correctly', () => {
    // ۲ پروژه دارای رکورد بازرسی هستند:
    // prj-1 در بازرسی اول PASS شده
    // prj-2 در بازرسی اول FAIL و در بازرسی دوم PASS شده
    const inspected = sampleProjects.filter((p) => p.qcInspections && p.qcInspections.length > 0);
    expect(inspected.length).toBe(2);

    const firstTimePassCount = inspected.filter((p) => p.qcInspections![0].result === 'PASS').length;
    expect(firstTimePassCount).toBe(1);

    const firstTimePassRate = Math.round((firstTimePassCount / inspected.length) * 100);
    expect(firstTimePassRate).toBe(50); // ۵۰ درصد

    const scoredProjects = sampleProjects.filter((p) => p.qcScore && p.qcScore > 0);
    const avgScore = scoredProjects.reduce((sum, p) => sum + (p.qcScore || 0), 0) / scoredProjects.length;
    // (5 + 4 + 4.5) / 3 = 13.5 / 3 = 4.5
    expect(Number(avgScore.toFixed(1))).toBe(4.5);
  });

  it('aggregates installation volume across teams accurately', () => {
    const totalShades = sampleProjects.reduce((sum, p) => sum + (p.shadePanels || 0), 0);
    const totalCurtains = sampleProjects.reduce((sum, p) => sum + (p.curtainPanels || 0), 0);

    // 4 + 6 + 2 = 12 شید
    expect(totalShades).toBe(12);
    // 2 + 0 + 3 = 5 پرده
    expect(totalCurtains).toBe(5);
    expect(totalShades + totalCurtains).toBe(17);

    // تفکیک اکیپ ۱: prj-1 (4 شید + 2 پرده) + prj-2 (6 شید + 0 پرده) = 10 شید + 2 پرده = 12 پنل
    const team1Projects = sampleProjects.filter((p) => p.assignedTeamId === 'team-1');
    const team1Panels = team1Projects.reduce((s, p) => s + (p.shadePanels || 0) + (p.curtainPanels || 0), 0);
    expect(team1Panels).toBe(12);

    // تفکیک اکیپ ۲: prj-3 (2 شید + 3 پرده) = 5 پنل
    const team2Projects = sampleProjects.filter((p) => p.assignedTeamId === 'team-2');
    const team2Panels = team2Projects.reduce((s, p) => s + (p.shadePanels || 0) + (p.curtainPanels || 0), 0);
    expect(team2Panels).toBe(5);
  });

  it('aggregates customer satisfaction ratings and distinguish signed vs unavailable exempt', () => {
    const signedCount = sampleProjects.filter((p) => Boolean(p.customerSignature)).length;
    expect(signedCount).toBe(1);

    const unavailableCount = sampleProjects.filter(
      (p) => p.handoverSigneeType === 'UNAVAILABLE_EXEMPT' || p.customerAcceptance?.status === 'UNAVAILABLE'
    ).length;
    expect(unavailableCount).toBe(1);

    const ratedProjects = sampleProjects.filter((p) => p.customerSatisfaction && p.customerSatisfaction > 0);
    const avgSat = ratedProjects.reduce((sum, p) => sum + (p.customerSatisfaction || 0), 0) / ratedProjects.length;
    // (5 + 4 + 5) / 3 = 14 / 3 = 4.67 -> 4.7
    expect(Number(avgSat.toFixed(1))).toBe(4.7);
  });

  describe('P4: First-Time Pass Rate Corrected Denominator', () => {
    it('calculates pass rate exclusively on projects with actual inspection history', () => {
      // پروژه ۱: دارای بازرسی نوبت اول با نتیجه PASS
      const prjWithPass: Project = {
        ...sampleProjects[0],
        id: 'prj-pass',
        qcInspections: [
          {
            id: 'insp-1',
            projectId: 'prj-pass',
            inspectionDate: '2026-11-10T10:00:00Z',
            inspectorUserId: 'qc-1',
            inspectorUserName: 'مدیر QC',
            inspectorRole: 'QC_MANAGER',
            result: 'PASS',
            overallScore: 5,
            checklist: [],
            defects: [],
            createdAt: '2026-11-10T10:00:00Z',
          },
        ],
      };

      // پروژه ۲: دارای بازرسی اول با FAIL و بازرسی دوم با PASS (قبولی نوبت اول نیست)
      const prjWithFailFirst: Project = {
        ...sampleProjects[1],
        id: 'prj-fail-first',
        qcInspections: [
          {
            id: 'insp-2-fail',
            projectId: 'prj-fail-first',
            inspectionDate: '2026-11-11T10:00:00Z',
            inspectorUserId: 'qc-1',
            inspectorUserName: 'مدیر QC',
            inspectorRole: 'QC_MANAGER',
            result: 'FAIL',
            overallScore: 2,
            checklist: [],
            defects: [],
            createdAt: '2026-11-11T10:00:00Z',
          },
          {
            id: 'insp-2-pass',
            projectId: 'prj-fail-first',
            inspectionDate: '2026-11-11T14:00:00Z',
            inspectorUserId: 'qc-1',
            inspectorUserName: 'مدیر QC',
            inspectorRole: 'QC_MANAGER',
            result: 'PASS',
            overallScore: 4,
            checklist: [],
            defects: [],
            createdAt: '2026-11-11T14:00:00Z',
          },
        ],
      };

      // پروژه ۳: پروژه قدیمی که qcStatus آن APPROVED است اما هیچ برگه بازرسی ثبت نشده ندارد (نباید مخرج را مخدوش کند)
      const prjLegacyApproved: Project = {
        ...sampleProjects[2],
        id: 'prj-legacy-approved',
        qcStatus: 'APPROVED',
        qcInspections: [], // فاقد سابقه بازرسی رسمی
      };

      const testList = [prjWithPass, prjWithFailFirst, prjLegacyApproved];

      // جامعه آماری مخرج اصلاح‌شده: فقط پروژه‌های دارای qcInspections
      const inspected = testList.filter((p) => p.qcInspections && p.qcInspections.length > 0);
      expect(inspected.length).toBe(2); // دقیقاً ۲ پروژه (پروژه قدیمی بدون برگه بازرسی شمرده نمی‌شود)

      const firstTimePassCount = inspected.filter((p) => p.qcInspections![0].result === 'PASS').length;
      expect(firstTimePassCount).toBe(1);

      // ۱ از ۲ = ۵۰٪ (اگر پروژه قدیمی مخرج را به ۳ افزایش می‌داد، به اشتباه ۳۳٪ محاسبه می‌شد)
      const rate = Math.round((firstTimePassCount / inspected.length) * 100);
      expect(rate).toBe(50);
    });

    it('returns 0 when there are zero eligible projects with inspection history', () => {
      const projectsWithoutInspections: Project[] = [
        { ...sampleProjects[0], qcInspections: [] },
        { ...sampleProjects[1], qcInspections: undefined },
      ];

      const inspected = projectsWithoutInspections.filter((p) => p.qcInspections && p.qcInspections.length > 0);
      const firstTimePassCount = inspected.filter((p) => p.qcInspections![0].result === 'PASS').length;
      const rate = inspected.length > 0 ? Math.round((firstTimePassCount / inspected.length) * 100) : 0;

      expect(inspected.length).toBe(0);
      expect(rate).toBe(0);
    });
  });

  describe('Migration 015: Unified patch_project Integrity Verification', () => {
    it('verifies that migration 015 preserves all P2.1, P2.2, and P3 safeguards', async () => {
      const fs: any = await import('fs' as any);
      const mig015 = fs.readFileSync('supabase/migrations/015_p3_final_qc_scoring_and_defects.sql', 'utf8');

      // ۱. محافظت از طرح اولیه (P2.1 Original Plan)
      expect(mig015).toContain('originalPlan');
      expect(mig015).toContain('lockedAt');
      expect(mig015).toContain('MEASUREMENT_PENDING');

      // ۲. محافظت از بازنگری‌های طرح (P2.1 Plan Amendments & Stale Concurrency)
      expect(mig015).toContain('planAmendments');
      expect(mig015).toContain('previousQuantity');
      expect(mig015).toContain('خطای همزمانی اصلاحیه');

      // ۳. اعتبارسنجی سقف ظرفیت (P1 Capacity Validation)
      expect(mig015).toContain('validate_schedule_capacity');

      // ۴. گیت انتقال اکیپ و تایید سرپرست تحویل‌گیرنده (P2.2 Team Transfer Execution Gate)
      expect(mig015).toContain('receivingLeadConfirmed');
      expect(mig015).toContain('isManagerOverride');
      expect(mig015).toContain('managerOverrideRole');
      expect(mig015).toContain('شروع یا ادامه کار مسدود است: پروژه در انتظار تایید رسمی تحویل‌گیری');

      // ۵. گیت تایید نهایی QC و عیوب بحرانی (P3 Final QC Approval Gate)
      expect(mig015).toContain("patch ? 'qcStatus' and patch->>'qcStatus' = 'APPROVED'");
      expect(mig015).toContain('v_has_critical_defect');
      expect(mig015).toContain('امکان صدور تأیید نهایی QC وجود ندارد: پروژه دارای عدم‌انطباق یا نقص بحرانی');

      // ۶. تغییرناپذیری تاریخچه بازرسی‌های QC (P3 Append-only qcInspections)
      expect(mig015).toContain('qcInspections');
      expect(mig015).toContain('دسترسی غیرمجاز: حذف یا کاهش سوابق بازرسی‌های کیفی مجاز نیست.');

      // ۷. انحصار تایید رفع نقص به مدیر QC و قفل کامل عیوب تاییدشده (P3 Defect Complete Freeze)
      expect(mig015).toContain("(v_matched_d->>'status') = 'VERIFIED'");
      expect(mig015).toContain('v_matched_d is distinct from v_old_d');
      expect(mig015).toContain('دسترسی غیرمجاز: سوابق نقص راستی‌آزمایی‌شده قبلی کاملاً قفل بوده و هرگونه ویرایش آن ممنوع است.');
      expect(mig015).toContain('دسترسی غیرمجاز: تایید راستی‌آزمایی رفع نقص منحصراً در صلاحیت مدیر ارشد QC است.');
      expect(mig015).toContain('دسترسی غیرمجاز: ثبت رسمی نقص کیفی منحصراً در صلاحیت مدیر ارشد QC است.');
      expect(mig015).toContain('دسترسی غیرمجاز: حذف یا تعویض عیوب کیفی ثبت‌شده مجاز نیست.');
      expect(mig015).toContain('دسترسی غیرمجاز: مشخصات و شدت نقص کیفی ثبت‌شده توسط تکنسین قابل تغییر نیست.');
      expect(mig015).toContain('در صورت رفع نقص، ثبت مستند اقدام انجام‌شده الزامی است.');

      // ۸. پذیرش کارفرما و دلیل موجه عدم حضور (P3 Customer Acceptance)
      expect(mig015).toContain('customerAcceptance');
      expect(mig015).toContain('unavailabilityReason');

      // ۹. حفاظت از سوابق جلسات کاری و لاگ روزانه تکنسین (P2.1 DailyLogs & WorkSessions)
      expect(mig015).toContain('dailyLogs');
      expect(mig015).toContain('workSessions');
      expect(mig015).toContain('supervisorConfirmed');
    });

    it('verifies that complete_setup.sql contains identical patch_project safeguards and complete defect freeze', async () => {
      const fs: any = await import('fs' as any);
      const completeSql = fs.readFileSync('supabase/complete_setup.sql', 'utf8');

      expect(completeSql).toContain('create or replace function public.patch_project(id text, patch jsonb)');
      expect(completeSql).toContain('originalPlan');
      expect(completeSql).toContain('planAmendments');
      expect(completeSql).toContain('validate_schedule_capacity');
      expect(completeSql).toContain('receivingLeadConfirmed');
      expect(completeSql).toContain('isManagerOverride');
      expect(completeSql).toContain('v_has_critical_defect');
      expect(completeSql).toContain('v_matched_d is distinct from v_old_d');
      expect(completeSql).toContain('دسترسی غیرمجاز: سوابق نقص راستی‌آزمایی‌شده قبلی کاملاً قفل بوده و هرگونه ویرایش آن ممنوع است.');
      expect(completeSql).toContain('دسترسی غیرمجاز: تایید راستی‌آزمایی رفع نقص منحصراً در صلاحیت مدیر ارشد QC است.');
      expect(completeSql).toContain('دسترسی غیرمجاز: ثبت رسمی نقص کیفی منحصراً در صلاحیت مدیر ارشد QC است.');
    });
  });

  describe('Material Requests: Server RPC & Database Boundary Protection', () => {
    it('verifies migration 014 creates separate create_material_request and patch_material_request functions with atomic concurrency safety', async () => {
      const fs: any = await import('fs' as any);
      const mig014 = fs.readFileSync('supabase/migrations/014_p2_3_material_requests.sql', 'utf8');

      // تابع ایجاد درخواست با درج اتمیک و مدیریت استثنای همزمانی (Atomic Concurrency Handling)
      expect(mig014).toContain('create or replace function public.create_material_request(id text, request_data jsonb)');
      expect(mig014).toContain('insert into public.material_requests');
      expect(mig014).toContain('exception');
      expect(mig014).toContain('when unique_violation then');
      expect(mig014).toContain('تعارض شناسه: این شناسه درخواست قبلاً برای پروژه دیگری ثبت گردیده است.');
      expect(mig014).toContain('تعارض شناسه: این شناسه متعلق به درخواست کاربر دیگری است.');
      expect(mig014).toContain('return v_existing.data;');

      // تابع ویرایش با قفل سطری و لیست سفید صریح فیلدهای تکنسین (Strict Whitelist - history is forbidden for technicians)
      expect(mig014).toContain('create or replace function public.patch_material_request(id text, patch jsonb)');
      expect(mig014).toContain('where public.material_requests.id = patch_material_request.id');
      expect(mig014).toContain('for update;');
      expect(mig014).toContain("patch_key not in ('status', 'dispatches', 'updatedAt')");
      expect(mig014).toContain('دسترسی غیرمجاز: تکنسین اجازه ویرایش فیلد «%» را در درخواست متریال ندارد.');
      expect(mig014).toContain('دسترسی غیرمجاز: مشخصات محموله ارسالی توسط تکنسین قابل تغییر نیست.');
      expect(mig014).toContain('دسترسی غیرمجاز: تایید تحویل فقط با هویت خودتان مجاز است.');
      expect(mig014).toContain('امکان ثبت تحویل قطعی وجود ندارد: هنوز برخی محموله‌های ارسالی سر کارگاه تایید دریافت نشده‌اند.');
    });

    it('verifies that complete_setup.sql and verify_setup.sql match material request security expectations', async () => {
      const fs: any = await import('fs' as any);
      const completeSql = fs.readFileSync('supabase/complete_setup.sql', 'utf8');
      const verifySql = fs.readFileSync('supabase/verify_setup.sql', 'utf8');

      // بررسی یکپارچگی create_material_request و patch_material_request در complete_setup.sql
      expect(completeSql).toContain('create or replace function public.create_material_request(id text, request_data jsonb)');
      expect(completeSql).toContain('when unique_violation then');
      expect(completeSql).toContain('create or replace function public.patch_material_request(id text, patch jsonb)');
      expect(completeSql).toContain("patch_key not in ('status', 'dispatches', 'updatedAt')");

      // بررسی تطابق دقیق نام‌های پالیسی RLS در verify_setup.sql
      expect(verifySql).toContain("('public', 'material_requests', 'Authenticated active users can read material requests')");
      expect(verifySql).toContain("('public', 'material_requests', 'Authenticated users can insert material requests')");
      expect(verifySql).toContain("('public', 'material_requests', 'QC Managers delete material requests')");
      expect(verifySql).not.toContain("('public', 'material_requests', 'QC Managers update material requests')");
    });

    it('verifies Outbox synchronization handler routes CREATE_MATERIAL_REQUEST to create_material_request', async () => {
      const fs: any = await import('fs' as any);
      const supabaseTs = fs.readFileSync('src/utils/supabase.ts', 'utf8');

      // بررسی تفکیک مسیر CREATE_MATERIAL_REQUEST
      expect(supabaseTs).toContain("case 'CREATE_MATERIAL_REQUEST': {");
      expect(supabaseTs).toContain("client.rpc('create_material_request'");

      // بررسی مسیر PATCH_MATERIAL_REQUEST
      expect(supabaseTs).toContain("case 'PATCH_MATERIAL_REQUEST': {");
      expect(supabaseTs).toContain("client.rpc('patch_material_request'");
    });

    it('verifies technician payload construction isolates status, dispatches, and updatedAt from history', () => {
      // شبیه‌سازی ایجاد پچ تایید دریافت سر کارگاه برای تکنسین
      const sampleReq: MaterialRequest = {
        id: 'mat-100',
        projectId: 'prj-1',
        projectTitle: 'پروژه تست',
        projectCode: 'PRJ-100',
        category: 'HARDWARE',
        reason: 'SHORTAGE',
        items: [{ id: 'i-1', title: 'پیچ', category: 'HARDWARE', requestedQty: 10, unit: 'عدد' }],
        urgency: 'NORMAL',
        status: 'DISPATCHED',
        requestedByUserId: 'tech-1',
        requestedByUserName: 'تکنسین تست',
        requestedAt: '2026-11-14T10:00:00Z',
        dispatches: [
          {
            id: 'disp-1',
            courierInfo: 'پیک موتور',
            trackingCode: 'TRK-1',
            dispatchedAt: '2026-11-14T11:00:00Z',
            dispatchedByUserId: 'coord-1',
            dispatchedByUserName: 'هماهنگ‌کننده تست',
            items: [{ itemId: 'i-1', title: 'پیچ', dispatchedQty: 10, unit: 'عدد' }],
            receivedAtSiteConfirmed: false,
          },
        ],
        history: [],
        createdAt: '2026-11-14T10:00:00Z',
        updatedAt: '2026-11-14T11:00:00Z',
      };

      const techUser: User = {
        id: 'tech-1',
        name: 'علی تقوی',
        phone: '09121111111',
        role: 'LEAD_TECHNICIAN',
        teamId: 'team-1',
        active: true,
      };

      const prj: Project = {
        ...sampleProjects[0],
        id: 'prj-1',
        assignedTeamId: 'team-1',
        leadTechnicianId: 'tech-1',
      };

      const updated = createConfirmReceiptPayload(sampleReq, 'disp-1', techUser, prj);

      // پچ ارسالی تکنسین به سرور
      const technicianPatch = {
        status: updated.status,
        dispatches: updated.dispatches,
        updatedAt: updated.updatedAt,
      };

      // ۱. تایید تحویل و وضعیت جدید به درستی تنظیم شده است
      expect(technicianPatch.status).toBe('DELIVERED_CONFIRMED');
      expect(technicianPatch.dispatches[0].receivedAtSiteConfirmed).toBe(true);
      expect(technicianPatch.dispatches[0].receivedAtSiteConfirmedByUserId).toBe('tech-1');

      // ۲. پچ ارسالی تکنسین حاوی هیچ فیلد غیرمجازی نیست (فاقد history، items، projectId و ...)
      const keys = Object.keys(technicianPatch);
      expect(keys.sort()).toEqual(['dispatches', 'status', 'updatedAt'].sort());
      expect(technicianPatch).not.toHaveProperty('history');
      expect(technicianPatch).not.toHaveProperty('items');
      expect(technicianPatch).not.toHaveProperty('projectId');
    });

    it('verifies server-side durable receipt history generation and replay duplicate protection in SQL', async () => {
      const fs: any = await import('fs' as any);
      const mig014 = fs.readFileSync('supabase/migrations/014_p2_3_material_requests.sql', 'utf8');
      const completeSql = fs.readFileSync('supabase/complete_setup.sql', 'utf8');

      for (const sql of [mig014, completeSql]) {
        // ۱. ممنوعیت کامل ارسال مستقیم history توسط تکنسین
        expect(sql).toContain("patch_key not in ('status', 'dispatches', 'updatedAt')");
        expect(sql).toContain('دسترسی غیرمجاز: تکنسین اجازه ویرایش فیلد «%» را در درخواست متریال ندارد.');

        // ۲. ایجاد خودکار رویداد تایید تحویل در سمت سرور بر مبنای هویت auth.uid()
        expect(sql).toContain("'mat-act-' || (v_new_d->>'id') || '-recv'");
        expect(sql).toContain("'action', 'CONFIRMED_RECEIPT'");
        expect(sql).toContain("'byUserId', auth.uid()::text");
        expect(sql).toContain("jsonb_set(v_updated_data, '{history}', v_history)");

        // ۳. محافظت در برابر تکرار و Replay/Retry در صف آفلاین (Idempotent Deduplication)
        expect(sql).toContain("coalesce((v_old_d->>'receivedAtSiteConfirmed')::boolean, false) = false");
        expect(sql).toContain("not exists (");
        expect(sql).toContain("where elem->>'id' = ('mat-act-' || (v_new_d->>'id') || '-recv')");

        // ۴. ممیزی امنیتی نام کاربر احرازشده (عدم اتکا به نام ارسالی کلاینت و فال‌بک خنثی «کاربر احرازشده»)
        expect(sql).toContain("select full_name into v_user_name");
        expect(sql).toContain("from public.profiles");
        expect(sql).toContain("where public.profiles.id = auth.uid();");
        expect(sql).toContain("coalesce(nullif(trim(v_user_name), ''), 'کاربر احرازشده')");
        // اطمینان از اینکه در تولید رویداد هرگز از نام ارسالی کلاینت استفاده نمی‌شود
        expect(sql).not.toContain("v_new_d->>'receivedAtSiteConfirmedByUserName', 'تکنسین نصب'");

        // ۵. تفکیک زمان وقوع فیزیکی در محل از زمان ثبت سیستمی در سرور (serverRecordedAt vs timestamp)
        expect(sql).toContain("'timestamp', coalesce(v_new_d->>'receivedAtSiteConfirmedAt', now()::text)");
        expect(sql).toContain("'serverRecordedAt', now()::text");
      }
    });

    it('verifies client and server reconciliation consistency for material receipt audit events', () => {
      const dispatchId = 'disp-789';
      const expectedServerEventId = `mat-act-${dispatchId}-recv`;

      const techUser: User = {
        id: 'usr-tech-audit',
        name: 'علی تقوی',
        phone: '09121111111',
        role: 'TECHNICIAN',
        active: true,
        teamId: 'team-1',
      };

      const prj: Project = {
        ...sampleProjects[0],
        id: 'prj-audit-test',
        assignedTeamId: 'team-1',
        leadTechnicianId: 'usr-tech-audit',
        assignedTechnicianIds: ['usr-tech-audit'],
      };

      const req: MaterialRequest = {
        id: 'req-audit-1',
        projectId: prj.id,
        projectCode: prj.code,
        projectTitle: prj.title,
        requestedByUserId: 'usr-tech-audit',
        requestedByUserName: 'علی تقوی',
        requestedAt: '2026-11-14T08:00:00Z',
        category: 'HARDWARE',
        reason: 'SHORTAGE',
        urgency: 'NORMAL',
        items: [{ id: 'item-1', title: 'پایه سقفی', category: 'HARDWARE', requestedQty: 2, unit: 'عدد' }],
        dispatches: [
          {
            id: dispatchId,
            dispatchedAt: '2026-11-14T09:00:00Z',
            dispatchedByUserId: 'mgr-1',
            dispatchedByUserName: 'مدیر تدارکات',
            courierInfo: 'پیک ویژه',
            items: [{ itemId: 'item-1', dispatchedQty: 2 }],
            receivedAtSiteConfirmed: false,
          },
        ],
        status: 'DISPATCHED',
        history: [],
        createdAt: '2026-11-14T08:00:00Z',
        updatedAt: '2026-11-14T08:00:00Z',
      };

      const updated = createConfirmReceiptPayload(req, dispatchId, techUser, prj);
      const clientReceiptEvent = updated.history.find((h) => h.id === expectedServerEventId);

      // شناسه رویداد کلاینت دقیقاً با الگوی قطعی سرور یکسان است
      expect(clientReceiptEvent).toBeDefined();
      expect(clientReceiptEvent?.id).toBe(expectedServerEventId);
      expect(clientReceiptEvent?.action).toBe('CONFIRMED_RECEIPT');
      expect(clientReceiptEvent?.byUserId).toBe(techUser.id);

      // شبیه‌سازی دریافت رویداد تکمیلی از سمت سرور شامل serverRecordedAt
      const simulatedServerEvent: typeof clientReceiptEvent = {
        ...clientReceiptEvent!,
        serverRecordedAt: '2026-11-14T10:15:30.123Z',
        byUserName: 'علی تقوی (احرازشده در سرور)',
      };

      expect(simulatedServerEvent.serverRecordedAt).toBeDefined();
      expect(simulatedServerEvent.timestamp).toBe(updated.dispatches[0].receivedAtSiteConfirmedAt);
    });

    it('verifies receipt confirmation authorization for QC_MANAGER, SCHEDULING_COORDINATOR, and LEAD_TECHNICIAN', () => {
      const prj: Project = {
        ...sampleProjects[0],
        id: 'prj-auth-test',
        assignedTeamId: 'team-1',
        leadTechnicianId: 'lead-1',
        assignedTechnicianIds: ['lead-1', 'tech-2'],
      };

      const leadUser: User = {
        id: 'lead-1',
        name: 'سرپرست تست',
        phone: '09121111111',
        role: 'LEAD_TECHNICIAN',
        teamId: 'team-1',
        active: true,
      };

      const qcManagerUser: User = {
        id: 'qc-mgr-1',
        name: 'مدیر QC',
        phone: '09122222222',
        role: 'QC_MANAGER',
        active: true,
      };

      const coordUser: User = {
        id: 'coord-1',
        name: 'هماهنگ‌کننده دفتر',
        phone: '09123333333',
        role: 'SCHEDULING_COORDINATOR',
        active: true,
      };

      const unassignedUser: User = {
        id: 'tech-other',
        name: 'تکنسین متفرقه',
        phone: '09124444444',
        role: 'TECHNICIAN',
        teamId: 'team-other',
        active: true,
      };

      // الف) سرپرست منصوب پروژه مجاز به تایید تحویل سر کارگاه است
      expect(canConfirmMaterialReceipt(leadUser, prj)).toBe(true);

      // ب) مدیر QC با ثبت مجوز مدیریتی معتبر مجاز است
      expect(canConfirmMaterialReceipt(qcManagerUser, prj, {
        isManagementOverride: true,
        overrideReason: 'تایید با هماهنگی تلفنی مدیر QC',
      })).toBe(true);

      // ج) هماهنگ‌کننده با ثبت مجوز مدیریتی معتبر مجاز است
      expect(canConfirmMaterialReceipt(coordUser, prj, {
        isManagementOverride: true,
        overrideReason: 'تایید سیستمی توسط هماهنگ‌کننده دفتر مرکزی',
      })).toBe(true);

      // د) مدیر یا هماهنگ‌کننده بدون ثبت دلیل یا تایید مدیریتی روی پروژه نامربوط رد می‌شود
      expect(canConfirmMaterialReceipt(qcManagerUser, prj)).toBe(false);
      expect(canConfirmMaterialReceipt(coordUser, prj)).toBe(false);

      // هـ) کاربر متفرقه غیرمنصوب به هیچ وجه مجاز نیست
      expect(canConfirmMaterialReceipt(unassignedUser, prj)).toBe(false);
    });
  });

  it('handles Supabase fetchMaterialRequests gracefully in both online and offline/unmigrated states', async () => {
    // When no client or error happens, fetchMaterialRequests returns empty array without throwing
    const res = await SupabaseSyncService.fetchMaterialRequests();
    expect(Array.isArray(res)).toBe(true);
  });
});
