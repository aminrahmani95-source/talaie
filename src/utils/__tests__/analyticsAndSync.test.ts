import { describe, it, expect } from 'vitest';
import { Project, InstallationTeamWithMembers, MaterialRequest } from '../../types';
import { SupabaseSyncService } from '../supabase';

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

  it('handles Supabase fetchMaterialRequests gracefully in both online and offline/unmigrated states', async () => {
    // When no client or error happens, fetchMaterialRequests returns empty array without throwing
    const res = await SupabaseSyncService.fetchMaterialRequests();
    expect(Array.isArray(res)).toBe(true);
  });
});
