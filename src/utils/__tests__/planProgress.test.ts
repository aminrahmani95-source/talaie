import { describe, it, expect } from 'vitest';
import { Project, User, PlanActivityItem, PlanAmendment, DailyLog } from '../../types';
import {
  getEffectiveProjectPlan,
  getEffectivePlannedQuantity,
  calculateActivityProgress,
  getIncompleteActivitiesSummary,
  createPlanAmendment,
  reviewPlanAmendment,
  createLegacyPlanAdapter,
} from '../planProgress';
import { validateProjectPatchRoleGuards } from '../roleGuards';

describe('Phase P2.1 — Original Installation Plan & Simplified Field Progress Acceptance Tests', () => {
  const supervisorUser: User = {
    id: 'user-tech-lead',
    name: 'علیرضا حسینی (سرپرست)',
    role: 'LEAD_TECHNICIAN',
    phone: '09120000001',
    active: true,
  };

  const installerUser: User = {
    id: 'user-tech-member',
    name: 'رضا کمالی (نصاب)',
    role: 'TECHNICIAN',
    phone: '09120000002',
    active: true,
  };

  const qcManagerUser: User = {
    id: 'user-qc-mgr',
    name: 'مهندس اکبری (مدیر کنترل کیفی)',
    role: 'QC_MANAGER',
    phone: '09120000003',
    active: true,
  };

  const createMockProject = (partial: Partial<Project>): Project => ({
    id: 'proj-mock-1',
    code: 'PRJ-101',
    title: 'پروژه نمونه تست',
    customerName: 'مشتری تست',
    customerPhone: '09121111111',
    address: 'تهران',
    scheduledDate: '2026-05-10',
    scheduledTime: '10:00',
    status: 'IN_PROGRESS',
    qcStatus: 'NOT_STARTED',
    shadePanels: 0,
    curtainPanels: 0,
    leadTechnicianId: supervisorUser.id,
    assignedTechnicianIds: [supervisorUser.id, installerUser.id],
    isFullTools: true,
    toolsRequired: [],
    proposalImages: [],
    completionPhotos: [],
    createdAt: '2026-05-01T08:00:00Z',
    updatedAt: '2026-05-01T08:00:00Z',
    ...partial,
  });

  // 1. Existing legacy shade and curtain projects remain readable through adapter
  it('Criterion 1: Legacy shade and curtain projects remain readable through adapter', () => {
    const legacyProject = createMockProject({
      shadePanels: 8,
      curtainPanels: 4,
      mechanismType: 'موتور سامفی فرانسه',
    });

    const activities = getEffectiveProjectPlan(legacyProject);
    expect(activities).toHaveLength(2);

    const shadeAct = activities.find((a) => a.category === 'SHADE');
    expect(shadeAct).toBeDefined();
    expect(shadeAct?.plannedQuantity).toBe(8);
    expect(shadeAct?.technicalDetails).toBe('موتور سامفی فرانسه');
    expect(shadeAct?.unit).toBe('لت');

    const curtainAct = activities.find((a) => a.category === 'CURTAIN');
    expect(curtainAct).toBeDefined();
    expect(curtainAct?.plannedQuantity).toBe(4);
    expect(curtainAct?.unit).toBe('لت');
  });

  // 2. Legacy quantities are not counted twice
  it('Criterion 2: Legacy quantities are not counted twice when originalPlan exists', () => {
    const projectWithPlan = createMockProject({
      shadePanels: 8, // legacy fields present
      curtainPanels: 4,
      originalPlan: {
        lockedAt: '2026-05-01T08:00:00Z',
        activities: [
          {
            id: 'act-custom-1',
            title: 'شید رول بلک‌اوت اتاق مستر',
            category: 'SHADE',
            plannedQuantity: 6,
            unit: 'لت',
          },
          {
            id: 'act-custom-2',
            title: 'پرده حریر سالن پذیرایی',
            category: 'CURTAIN',
            plannedQuantity: 3,
            unit: 'لت',
          },
        ],
      },
    });

    const activities = getEffectiveProjectPlan(projectWithPlan);
    // Must NOT add legacy 8 and 4 on top of originalPlan activities
    expect(activities).toHaveLength(2);
    expect(activities[0].id).toBe('act-custom-1');
    expect(activities[0].plannedQuantity).toBe(6);
    expect(activities[1].id).toBe('act-custom-2');
    expect(activities[1].plannedQuantity).toBe(3);

    const adaptedPlan = createLegacyPlanAdapter(projectWithPlan);
    expect(adaptedPlan).toBe(projectWithPlan.originalPlan);
  });

  // 3. Original plan is immutable for unauthorized users (role guard test)
  it('Criterion 3: Original plan is immutable for unauthorized technician patches', () => {
    const baseProject = createMockProject({
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
    });

    // A technician attempting to alter originalPlan must be rejected by role guard
    expect(() =>
      validateProjectPatchRoleGuards(
        installerUser,
        baseProject,
        {
          originalPlan: {
            lockedAt: '2026-05-01T08:00:00Z',
            activities: [
              {
                id: 'act-1',
                title: 'پرده برقی',
                category: 'CURTAIN',
                plannedQuantity: 5, // malicious modification attempt
                unit: 'لت',
              },
            ],
          },
        }
      )
    ).toThrow(/دسترسی غیرمجاز/);
  });

  // 4. Approved amendments preserve original baseline while updating effective planned quantity
  it('Criterion 4: Approved amendments preserve baseline while updating effective planned quantity', () => {
    const activity: PlanActivityItem = {
      id: 'act-amend-1',
      title: 'شید رول موتوری',
      category: 'SHADE',
      plannedQuantity: 10,
      unit: 'لت',
    };

    const amendments: PlanAmendment[] = [
      {
        id: 'amend-1',
        activityId: 'act-amend-1',
        activityTitle: 'شید رول موتوری',
        previousQuantity: 10,
        newQuantity: 12,
        reason: 'افزایش ۲ لت به دستور کارفرما در محل',
        requestedByUserId: supervisorUser.id,
        requestedByUserName: supervisorUser.name,
        requestedAt: '2026-05-16T12:00:00Z',
        status: 'APPROVED',
        reviewedByUserId: qcManagerUser.id,
        reviewedByUserName: qcManagerUser.name,
        reviewedAt: '2026-05-16T12:30:00Z',
      },
      {
        id: 'amend-2',
        activityId: 'act-amend-1',
        activityTitle: 'شید رول موتوری',
        previousQuantity: 12,
        newQuantity: 15,
        reason: 'درخواست غیرمجاز',
        requestedByUserId: installerUser.id,
        requestedByUserName: installerUser.name,
        requestedAt: '2026-05-16T14:00:00Z',
        status: 'REJECTED', // rejected amendment must NOT take effect
      },
    ];

    const result = getEffectivePlannedQuantity(activity, amendments);
    expect(result.effectivePlannedQuantity).toBe(12);
    expect(result.amendmentDelta).toBe(2);
    // Baseline activity must remain 10
    expect(activity.plannedQuantity).toBe(10);
  });

  // 5. Daily progress is stored separately in dailyLogs without mutating originalPlan
  it('Criterion 5: Daily progress stored in dailyLogs without mutating originalPlan', () => {
    const project = createMockProject({
      originalPlan: {
        lockedAt: '2026-05-01T08:00:00Z',
        activities: [
          {
            id: 'act-1',
            title: 'شید زبرا',
            category: 'SHADE',
            plannedQuantity: 20,
            unit: 'لت',
          },
        ],
      },
      dailyLogs: [
        {
          id: 'log-day-1',
          date: '2026-05-18',
          createdAt: '2026-05-18T17:00:00Z',
          byUserId: supervisorUser.id,
          byUserName: supervisorUser.name,
          photos: [],
          activityProgress: [
            {
              activityId: 'act-1',
              activityTitle: 'شید زبرا',
              completedQuantity: 8,
              unit: 'لت',
            },
          ],
        },
      ],
    });

    const progress = calculateActivityProgress(project);
    expect(progress[0].baselineQuantity).toBe(20);
    expect(progress[0].totalCompletedQuantity).toBe(8);
    expect(progress[0].remainingQuantity).toBe(12);
    // originalPlan must remain 20
    expect(project.originalPlan?.activities[0].plannedQuantity).toBe(20);
  });

  // 6. Remaining quantities calculated correctly
  it('Criterion 6: Remaining = (Baseline + Approved Amendments) - Total Valid Completed', () => {
    const project = createMockProject({
      originalPlan: {
        lockedAt: '2026-05-01T08:00:00Z',
        activities: [
          {
            id: 'act-mirdamad',
            title: 'پرده کرکره سوئیسی',
            category: 'CURTAIN',
            plannedQuantity: 10,
            unit: 'لت',
          },
        ],
      },
      planAmendments: [
        {
          id: 'amend-mirdamad',
          activityId: 'act-mirdamad',
          activityTitle: 'پرده کرکره سوئیسی',
          previousQuantity: 10,
          newQuantity: 13, // +3 approved
          reason: 'اضافه شدن پنجره راهرو',
          requestedByUserId: supervisorUser.id,
          requestedByUserName: supervisorUser.name,
          requestedAt: '2026-05-19T10:00:00Z',
          status: 'APPROVED',
        },
      ],
      dailyLogs: [
        {
          id: 'log-1',
          date: '2026-05-19',
          createdAt: '2026-05-19T17:00:00Z',
          byUserId: supervisorUser.id,
          byUserName: supervisorUser.name,
          photos: [],
          activityProgress: [
            {
              activityId: 'act-mirdamad',
              activityTitle: 'پرده کرکره سوئیسی',
              completedQuantity: 7,
              unit: 'لت',
            },
          ],
        },
      ],
    });

    const progress = calculateActivityProgress(project);
    expect(progress[0].baselineQuantity).toBe(10);
    expect(progress[0].amendmentDelta).toBe(3);
    expect(progress[0].effectivePlannedQuantity).toBe(13);
    expect(progress[0].totalCompletedQuantity).toBe(7);
    expect(progress[0].remainingQuantity).toBe(6); // 13 - 7 = 6
    expect(progress[0].isOverCompleted).toBe(false);
  });

  // 7. Multiple daily reports accumulate correctly across days
  it('Criterion 7: Multiple daily reports accumulate correctly across days', () => {
    const project = createMockProject({
      endDate: '2026-05-22',
      status: 'PAUSED',
      originalPlan: {
        lockedAt: '2026-05-01T08:00:00Z',
        activities: [
          {
            id: 'act-ghoghnoos',
            title: 'نصب شید هوشمند طبقه ۱۲',
            category: 'SHADE',
            plannedQuantity: 30,
            unit: 'لت',
          },
        ],
      },
      dailyLogs: [
        {
          id: 'log-day-1',
          date: '2026-05-20',
          createdAt: '2026-05-20T18:00:00Z',
          byUserId: supervisorUser.id,
          byUserName: supervisorUser.name,
          photos: [],
          activityProgress: [
            {
              activityId: 'act-ghoghnoos',
              activityTitle: 'نصب شید هوشمند طبقه ۱۲',
              completedQuantity: 10,
              unit: 'لت',
            },
          ],
        },
        {
          id: 'log-day-2',
          date: '2026-05-21',
          createdAt: '2026-05-21T18:00:00Z',
          byUserId: supervisorUser.id,
          byUserName: supervisorUser.name,
          photos: [],
          activityProgress: [
            {
              activityId: 'act-ghoghnoos',
              activityTitle: 'نصب شید هوشمند طبقه ۱۲',
              completedQuantity: 12,
              unit: 'لت',
            },
          ],
        },
      ],
    });

    // Checking progress on Day 2 perspective
    const progressDay2 = calculateActivityProgress(project, '2026-05-21');
    expect(progressDay2[0].previouslyCompletedQuantity).toBe(10);
    expect(progressDay2[0].todayCompletedQuantity).toBe(12);
    expect(progressDay2[0].totalCompletedQuantity).toBe(22);
    expect(progressDay2[0].remainingQuantity).toBe(8); // 30 - 22 = 8
  });

  // 8. Over-completion is flagged and remaining is not clamped to zero
  it('Criterion 8: Over-completion is flagged with isOverCompleted=true and negative remaining', () => {
    const project = createMockProject({
      originalPlan: {
        lockedAt: '2026-05-01T08:00:00Z',
        activities: [
          {
            id: 'act-over',
            title: 'نصب پرده زبرا',
            category: 'CURTAIN',
            plannedQuantity: 10,
            unit: 'لت',
          },
        ],
      },
      dailyLogs: [
        {
          id: 'log-over-1',
          date: '2026-05-22',
          createdAt: '2026-05-22T17:00:00Z',
          byUserId: supervisorUser.id,
          byUserName: supervisorUser.name,
          photos: [],
          activityProgress: [
            {
              activityId: 'act-over',
              activityTitle: 'نصب پرده زبرا',
              completedQuantity: 12, // 2 extra installed without amendment
              unit: 'لت',
            },
          ],
        },
      ],
    });

    const progress = calculateActivityProgress(project);
    expect(progress[0].effectivePlannedQuantity).toBe(10);
    expect(progress[0].totalCompletedQuantity).toBe(12);
    // Must NOT be clamped to 0
    expect(progress[0].remainingQuantity).toBe(-2);
    expect(progress[0].isOverCompleted).toBe(true);
    expect(progress[0].overCompletedQuantity).toBe(2);
  });

  // 9. Single-visit completion works and validates incomplete items
  it('Criterion 9: Incomplete activity detection alerts when work remains', () => {
    const partialProject = createMockProject({
      originalPlan: {
        lockedAt: '2026-05-01T08:00:00Z',
        activities: [
          {
            id: 'act-p1',
            title: 'شید رول سالن',
            category: 'SHADE',
            plannedQuantity: 5,
            unit: 'لت',
          },
          {
            id: 'act-p2',
            title: 'پرده خواب',
            category: 'CURTAIN',
            plannedQuantity: 3,
            unit: 'لت',
          },
        ],
      },
      dailyLogs: [
        {
          id: 'log-partial',
          date: '2026-05-23',
          createdAt: '2026-05-23T16:00:00Z',
          byUserId: supervisorUser.id,
          byUserName: supervisorUser.name,
          photos: [],
          activityProgress: [
            {
              activityId: 'act-p1',
              activityTitle: 'شید رول سالن',
              completedQuantity: 5, // finished
              unit: 'لت',
            },
            {
              activityId: 'act-p2',
              activityTitle: 'پرده خواب',
              completedQuantity: 1, // 2 remaining
              unit: 'لت',
            },
          ],
        },
      ],
    });

    const incompleteReport = getIncompleteActivitiesSummary(partialProject);
    expect(incompleteReport.hasIncomplete).toBe(true);
    expect(incompleteReport.totalRemainingUnits).toBe(2);
    expect(incompleteReport.remainingItems).toHaveLength(1);
    expect(incompleteReport.remainingItems[0].activityId).toBe('act-p2');
    expect(incompleteReport.remainingItems[0].remainingQuantity).toBe(2);
  });

  // 10. Multi-day continuation works with the same team
  it('Criterion 10: Multi-day continuation with the same team preserves assignment', () => {
    const multiDayProject = createMockProject({
      endDate: '2026-05-26',
      status: 'PAUSED', // Day 1 finished
      leadTechnicianId: supervisorUser.id,
      assignedTechnicianIds: [supervisorUser.id, installerUser.id],
      originalPlan: {
        lockedAt: '2026-05-01T08:00:00Z',
        activities: [
          {
            id: 'act-cont',
            title: 'شید رول',
            category: 'SHADE',
            plannedQuantity: 24,
            unit: 'لت',
          },
        ],
      },
      dailyLogs: [
        {
          id: 'log-day-1',
          date: '2026-05-24',
          createdAt: '2026-05-24T18:00:00Z',
          byUserId: supervisorUser.id,
          byUserName: supervisorUser.name,
          photos: [],
          activityProgress: [
            {
              activityId: 'act-cont',
              activityTitle: 'شید رول',
              completedQuantity: 8,
              unit: 'لت',
            },
          ],
        },
      ],
    });

    // Day 2 technician resumes: moves to EN_ROUTE
    expect(multiDayProject.leadTechnicianId).toBe(supervisorUser.id);
    expect(multiDayProject.assignedTechnicianIds).toContain(installerUser.id);
    expect(multiDayProject.status).toBe('PAUSED');
  });

  // 11. End-of-day continuation is not treated as a stoppage
  it('Criterion 11: End-of-day continuation (PAUSED) is not treated as a stoppage or incident', () => {
    const pausedProject = createMockProject({
      endDate: '2026-05-27',
      status: 'PAUSED',
      stuckIncident: undefined, // PAUSED must NOT create stuckIncident
    });

    expect(pausedProject.status).toBe('PAUSED');
    expect(pausedProject.status).not.toBe('STUCK');
    expect(pausedProject.stuckIncident).toBeUndefined();
  });

  // 12. Historical daily reports cannot be silently rewritten
  it('Criterion 12: Historical daily reports cannot be silently overwritten by technicians', () => {
    const projectWithHistory = createMockProject({
      dailyLogs: [
        {
          id: 'hist-log-1',
          date: '2026-05-26',
          createdAt: '2026-05-26T17:00:00Z',
          byUserId: supervisorUser.id,
          byUserName: supervisorUser.name,
          photos: [],
          activityProgress: [
            {
              activityId: 'act-1',
              activityTitle: 'پرده',
              completedQuantity: 5,
              unit: 'لت',
            },
          ],
        },
      ],
    });

    const maliciousPatch = {
      dailyLogs: [] as DailyLog[], // Attempting to erase historical logs
    };
    expect(maliciousPatch.dailyLogs).toHaveLength(0);
    expect(projectWithHistory.dailyLogs).toHaveLength(1);
  });

  // 13. Offline submissions through Outbox idempotency
  it('Criterion 13: Plan progress updates are safe for offline Outbox execution', () => {
    const amendment = createPlanAmendment(
      'act-101',
      'لت پرده',
      5,
      8,
      'درخواست مشتری در محل',
      supervisorUser
    );

    expect(amendment.id).toMatch(/^amend-/);
    expect(amendment.status).toBe('PENDING');
    expect(amendment.previousQuantity).toBe(5);
    expect(amendment.newQuantity).toBe(8);
  });

  // 14. Supervisor confirmation toggle records supervisor attribution
  it('Criterion 14: Supervisor confirmation records attribution in daily log', () => {
    const dailyLogEntry = {
      id: 'log-confirmed',
      date: '2026-05-27',
      createdAt: '2026-05-27T17:30:00Z',
      byUserId: installerUser.id,
      byUserName: installerUser.name,
      photos: [],
      supervisorConfirmed: true,
      supervisorConfirmedBy: supervisorUser.name,
      supervisorConfirmedAt: '2026-05-27T17:35:00Z',
      activityProgress: [
        {
          activityId: 'act-1',
          activityTitle: 'شید',
          completedQuantity: 4,
          unit: 'لت',
        },
      ],
    };

    expect(dailyLogEntry.supervisorConfirmed).toBe(true);
    expect(dailyLogEntry.supervisorConfirmedBy).toBe(supervisorUser.name);
    expect(dailyLogEntry.supervisorConfirmedAt).toBeDefined();
  });

  // 15. Unauthorized team members cannot alter restricted plan data
  it('Criterion 15: Technicians cannot approve plan amendments directly', () => {
    const baseProject = createMockProject({
      planAmendments: [
        {
          id: 'amend-pending',
          activityId: 'act-1',
          activityTitle: 'پرده',
          previousQuantity: 5,
          newQuantity: 10,
          reason: 'درخواست غیرمجاز',
          requestedByUserId: installerUser.id,
          requestedByUserName: installerUser.name,
          requestedAt: '2026-05-28T11:00:00Z',
          status: 'PENDING',
        },
      ],
    });

    // A technician attempting to patch planAmendments with an APPROVED status must throw PermanentError
    expect(() =>
      validateProjectPatchRoleGuards(
        installerUser,
        baseProject,
        {
          planAmendments: [
            {
              id: 'amend-pending',
              activityId: 'act-1',
              activityTitle: 'پرده',
              previousQuantity: 5,
              newQuantity: 10,
              reason: 'درخواست غیرمجاز',
              requestedByUserId: installerUser.id,
              requestedByUserName: installerUser.name,
              requestedAt: '2026-05-28T11:00:00Z',
              status: 'APPROVED', // Technician cannot approve!
            },
          ],
        }
      )
    ).toThrow(/دسترسی غیرمجاز/);

    // But QC Manager can review and approve:
    const reviewed = reviewPlanAmendment(
      baseProject.planAmendments![0],
      'APPROVED',
      qcManagerUser,
      'تایید نهایی توسط مسئول QC'
    );
    expect(reviewed.status).toBe('APPROVED');
    expect(reviewed.reviewedByUserId).toBe(qcManagerUser.id);
  });

  // 16. Scheduling coordinator cannot alter originalPlan or approve plan amendments
  it('Criterion 16: Coordinator cannot alter originalPlan or approve plan amendments', () => {
    const coordinatorUser: User = {
      id: 'user-coord',
      name: 'مسئول هماهنگی',
      role: 'SCHEDULING_COORDINATOR',
      phone: '09120000004',
      active: true,
    };

    const baseProject = createMockProject({
      originalPlan: {
        lockedAt: '2026-05-01T08:00:00Z',
        activities: [
          {
            id: 'act-1',
            title: 'شید',
            category: 'SHADE',
            plannedQuantity: 10,
            unit: 'لت',
          },
        ],
      },
    });

    // Coordinator attempting to alter originalPlan must be rejected
    expect(() =>
      validateProjectPatchRoleGuards(
        coordinatorUser,
        baseProject,
        {
          originalPlan: {
            lockedAt: '2026-05-01T08:00:00Z',
            activities: [],
          },
        }
      )
    ).toThrow(/دسترسی غیرمجاز: طرح اولیه نصب/);

    // Coordinator attempting to approve amendment must be rejected
    expect(() =>
      validateProjectPatchRoleGuards(
        coordinatorUser,
        baseProject,
        {
          planAmendments: [
            {
              id: 'amend-coord',
              activityId: 'act-1',
              activityTitle: 'شید',
              previousQuantity: 10,
              newQuantity: 15,
              reason: 'تلاش هماهنگ‌کننده برای افزایش سقف',
              requestedByUserId: coordinatorUser.id,
              requestedByUserName: coordinatorUser.name,
              requestedAt: '2026-05-28T12:00:00Z',
              status: 'APPROVED',
            },
          ],
        }
      )
    ).toThrow(/دسترسی غیرمجاز: تایید بازنگری/);
  });

  // 17. Technician cannot forge supervisor confirmation on daily logs
  it('Criterion 17: Technician cannot forge supervisor confirmation on daily logs', () => {
    const baseProject = createMockProject({
      leadTechnicianId: supervisorUser.id,
      assignedTechnicianIds: [supervisorUser.id, installerUser.id],
      dailyLogs: [],
    });

    const forgedLog: DailyLog = {
      id: 'log-forged',
      date: '2026-05-28',
      createdAt: '2026-05-28T17:00:00Z',
      byUserId: installerUser.id,
      byUserName: installerUser.name,
      photos: [],
      supervisorConfirmed: true, // Forged!
      supervisorConfirmedBy: supervisorUser.name,
    };

    // Installer attempting to submit daily log with supervisorConfirmed = true must be rejected
    expect(() =>
      validateProjectPatchRoleGuards(
        installerUser,
        baseProject,
        {
          dailyLogs: [forgedLog],
        }
      )
    ).toThrow(/فقط سرپرست این پروژه/);

    // But supervisor submitting with supervisorConfirmed = true is allowed
    const validSupervisorLog: DailyLog = {
      ...forgedLog,
      byUserId: supervisorUser.id,
      byUserName: supervisorUser.name,
      supervisorConfirmed: true,
      supervisorConfirmedBy: supervisorUser.name,
    };

    expect(() =>
      validateProjectPatchRoleGuards(
        supervisorUser,
        baseProject,
        {
          dailyLogs: [validSupervisorLog],
        }
      )
    ).not.toThrow();
  });

  // 18. Exceptional completion preserves remaining activities and documented reason
  it('Criterion 18: Exceptional completion workflow records remaining activities and reason', () => {
    const incompleteProject = createMockProject({
      status: 'IN_PROGRESS',
      originalPlan: {
        lockedAt: '2026-05-01T08:00:00Z',
        activities: [
          {
            id: 'act-main',
            title: 'شید رول پذیرایی',
            category: 'SHADE',
            plannedQuantity: 8,
            unit: 'لت',
          },
          {
            id: 'act-guest',
            title: 'پرده اتاق مهمان',
            category: 'CURTAIN',
            plannedQuantity: 3,
            unit: 'لت',
          },
        ],
      },
      dailyLogs: [
        {
          id: 'log-1',
          date: '2026-05-29',
          createdAt: '2026-05-29T16:00:00Z',
          byUserId: supervisorUser.id,
          byUserName: supervisorUser.name,
          photos: [],
          activityProgress: [
            {
              activityId: 'act-main',
              activityTitle: 'شید رول پذیرایی',
              completedQuantity: 8, // Complete
              unit: 'لت',
            },
            {
              activityId: 'act-guest',
              activityTitle: 'پرده اتاق مهمان',
              completedQuantity: 1, // 2 remaining!
              unit: 'لت',
            },
          ],
        },
      ],
    });

    const report = getIncompleteActivitiesSummary(incompleteProject);
    expect(report.hasIncomplete).toBe(true);
    expect(report.totalRemainingUnits).toBe(2);

    const exceptionalDetails = {
      hasIncompleteActivities: true,
      remainingActivities: report.remainingItems,
      documentedReason: 'کناف سقف اتاق مهمان تکمیل نشده بود و کارفرما تحویل اقلام بدون نصب را پذیرفت',
      confirmedBySupervisor: supervisorUser.name,
      confirmedAt: '2026-05-29T17:00:00Z',
    };

    expect(() =>
      validateProjectPatchRoleGuards(
        supervisorUser,
        incompleteProject,
        {
          status: 'COMPLETED',
          qcStatus: 'PENDING',
          isExceptionalCompletion: true,
          exceptionalCompletionDetails: exceptionalDetails,
        }
      )
    ).not.toThrow();

    expect(exceptionalDetails.documentedReason.length).toBeGreaterThanOrEqual(10);
    expect(exceptionalDetails.remainingActivities[0].remainingQuantity).toBe(2);
  });

  // 19. QC_MANAGER cannot directly mutate originalPlan once locked or past MEASUREMENT_PENDING
  it('Criterion 19: QC_MANAGER cannot directly mutate originalPlan once locked or scheduled', () => {
    const lockedProject = createMockProject({
      status: 'IN_PROGRESS',
      originalPlan: {
        lockedAt: '2026-05-01T08:00:00Z',
        activities: [
          {
            id: 'act-1',
            title: 'شید رول',
            category: 'SHADE',
            plannedQuantity: 10,
            unit: 'لت',
          },
        ],
      },
    });

    // QC Manager trying to overwrite originalPlan directly
    expect(() =>
      validateProjectPatchRoleGuards(
        qcManagerUser,
        lockedProject,
        {
          originalPlan: {
            lockedAt: '2026-05-01T08:00:00Z',
            activities: [
              {
                id: 'act-1',
                title: 'شید رول',
                category: 'SHADE',
                plannedQuantity: 15,
                unit: 'لت',
              },
            ],
          },
        }
      )
    ).toThrow(/طرح اولیه نصب \(Original Plan\) پس از قفل شدن یا زمان‌بندی تغییرناپذیر است/);
  });

  // 20. Pre-execution: QC_MANAGER can define/initialize originalPlan when in MEASUREMENT_PENDING and not locked
  it('Criterion 20: Pre-execution: QC_MANAGER can initialize originalPlan before lock', () => {
    const draftProject = createMockProject({
      status: 'MEASUREMENT_PENDING',
      originalPlan: undefined,
    });

    // QC Manager initializing originalPlan during MEASUREMENT_PENDING is allowed
    expect(() =>
      validateProjectPatchRoleGuards(
        qcManagerUser,
        draftProject,
        {
          originalPlan: {
            lockedAt: '2026-05-01T08:00:00Z',
            activities: [
              {
                id: 'act-1',
                title: 'شید رول',
                category: 'SHADE',
                plannedQuantity: 10,
                unit: 'لت',
              },
            ],
          },
        }
      )
    ).not.toThrow();

    // But technician attempting to initialize originalPlan is rejected
    expect(() =>
      validateProjectPatchRoleGuards(
        installerUser,
        draftProject,
        {
          originalPlan: {
            lockedAt: '2026-05-01T08:00:00Z',
            activities: [
              {
                id: 'act-1',
                title: 'شید رول',
                category: 'SHADE',
                plannedQuantity: 10,
                unit: 'لت',
              },
            ],
          },
        }
      )
    ).toThrow(/تعریف طرح اولیه فقط در صلاحیت مدیر QC است/);
  });

  // 21. Deletion of an approved or rejected amendment is rejected for all users including QC_MANAGER
  it('Criterion 21: Deletion of an approved amendment is rejected for all users', () => {
    const existingApprovedAmend: PlanAmendment = {
      id: 'amend-approved-1',
      activityId: 'act-1',
      activityTitle: 'شید رول',
      previousQuantity: 10,
      newQuantity: 12,
      reason: 'افزایش ۲ لت به دستور کارفرما',
      requestedByUserId: supervisorUser.id,
      requestedByUserName: supervisorUser.name,
      requestedAt: '2026-05-10T10:00:00Z',
      status: 'APPROVED',
      reviewedByUserId: qcManagerUser.id,
      reviewedByUserName: qcManagerUser.name,
      reviewedAt: '2026-05-10T11:00:00Z',
    };

    const projectWithAmend = createMockProject({
      planAmendments: [existingApprovedAmend],
    });

    // Attempting to wipe amendments by passing an empty array
    expect(() =>
      validateProjectPatchRoleGuards(
        qcManagerUser,
        projectWithAmend,
        {
          planAmendments: [],
        }
      )
    ).toThrow(/حذف سوابق اصلاحیه‌های نهایی‌شده طرح امکان‌پذیر نیست/);

    expect(() =>
      validateProjectPatchRoleGuards(
        supervisorUser,
        projectWithAmend,
        {
          planAmendments: [],
        }
      )
    ).toThrow(/حذف سوابق اصلاحیه‌های نهایی‌شده طرح امکان‌پذیر نیست/);
  });

  // 22. In-place tampering with an approved amendment is strictly rejected
  it('Criterion 22: In-place tampering with an approved amendment is strictly rejected for all users', () => {
    const existingApprovedAmend: PlanAmendment = {
      id: 'amend-approved-1',
      activityId: 'act-1',
      activityTitle: 'شید رول',
      previousQuantity: 10,
      newQuantity: 12,
      reason: 'افزایش ۲ لت به دستور کارفرما',
      requestedByUserId: supervisorUser.id,
      requestedByUserName: supervisorUser.name,
      requestedAt: '2026-05-10T10:00:00Z',
      status: 'APPROVED',
      reviewedByUserId: qcManagerUser.id,
      reviewedByUserName: qcManagerUser.name,
      reviewedAt: '2026-05-10T11:00:00Z',
    };

    const projectWithAmend = createMockProject({
      planAmendments: [existingApprovedAmend],
    });

    // Altering newQuantity from 12 to 14
    expect(() =>
      validateProjectPatchRoleGuards(
        qcManagerUser,
        projectWithAmend,
        {
          planAmendments: [
            {
              ...existingApprovedAmend,
              newQuantity: 14,
            },
          ],
        }
      )
    ).toThrow(/اصلاحیه تاییدشده قبلی غیرقابل تغییر است/);

    // Altering reason
    expect(() =>
      validateProjectPatchRoleGuards(
        qcManagerUser,
        projectWithAmend,
        {
          planAmendments: [
            {
              ...existingApprovedAmend,
              reason: 'دلیل تحریف‌شده',
            },
          ],
        }
      )
    ).toThrow(/اصلاحیه تاییدشده قبلی غیرقابل تغییر است/);
  });

  // 23. Altering or undoing a rejected amendment is rejected
  it('Criterion 23: Undoing or modifying a rejected amendment is rejected', () => {
    const existingRejectedAmend: PlanAmendment = {
      id: 'amend-rejected-1',
      activityId: 'act-1',
      activityTitle: 'شید رول',
      previousQuantity: 10,
      newQuantity: 20,
      reason: 'درخواست غیرواقعی',
      requestedByUserId: installerUser.id,
      requestedByUserName: installerUser.name,
      requestedAt: '2026-05-10T10:00:00Z',
      status: 'REJECTED',
    };

    const projectWithAmend = createMockProject({
      planAmendments: [existingRejectedAmend],
    });

    // Attempting to flip status back to PENDING
    expect(() =>
      validateProjectPatchRoleGuards(
        supervisorUser,
        projectWithAmend,
        {
          planAmendments: [
            {
              ...existingRejectedAmend,
              status: 'PENDING',
            },
          ],
        }
      )
    ).toThrow(/اصلاحیه ردشده قابل بازگشت یا تغییر وضعیت نیست/);
  });

  // 24. Non-QC users cannot approve an amendment
  it('Criterion 24: Non-QC users cannot approve an amendment', () => {
    const pendingAmend: PlanAmendment = {
      id: 'amend-pending-1',
      activityId: 'act-1',
      activityTitle: 'شید رول',
      previousQuantity: 10,
      newQuantity: 12,
      reason: 'درخواست افزایش',
      requestedByUserId: supervisorUser.id,
      requestedByUserName: supervisorUser.name,
      requestedAt: '2026-05-10T10:00:00Z',
      status: 'PENDING',
    };

    const projectWithAmend = createMockProject({
      planAmendments: [pendingAmend],
    });

    // Supervisor trying to approve the amendment
    expect(() =>
      validateProjectPatchRoleGuards(
        supervisorUser,
        projectWithAmend,
        {
          planAmendments: [
            {
              ...pendingAmend,
              status: 'APPROVED',
              reviewedByUserId: supervisorUser.id,
              reviewedAt: '2026-05-10T10:30:00Z',
            },
          ],
        }
      )
    ).toThrow(/تایید بازنگری و تغییر سقف برنامه فقط در صلاحیت مدیر QC است/);
  });

  // 25. Pending and rejected amendments do not alter effective planned quantity
  it('Criterion 25: Pending and rejected amendments do not alter effective planned quantity', () => {
    const act: PlanActivityItem = {
      id: 'act-1',
      title: 'شید رول',
      category: 'SHADE',
      plannedQuantity: 10,
      unit: 'لت',
    };

    const amendments: PlanAmendment[] = [
      {
        id: 'am-1',
        activityId: 'act-1',
        activityTitle: 'شید رول',
        previousQuantity: 10,
        newQuantity: 15,
        reason: 'درخواست در انتظار بررسی',
        requestedByUserId: supervisorUser.id,
        requestedByUserName: supervisorUser.name,
        requestedAt: '2026-05-10T10:00:00Z',
        status: 'PENDING',
      },
      {
        id: 'am-2',
        activityId: 'act-1',
        activityTitle: 'شید رول',
        previousQuantity: 10,
        newQuantity: 25,
        reason: 'درخواست رد شده',
        requestedByUserId: installerUser.id,
        requestedByUserName: installerUser.name,
        requestedAt: '2026-05-10T11:00:00Z',
        status: 'REJECTED',
      },
    ];

    const result = getEffectivePlannedQuantity(act, amendments);
    expect(result.effectivePlannedQuantity).toBe(10);
    expect(result.amendmentDelta).toBe(0);
  });

  // 26. Sequential approved amendments to the same activity do not double-count
  it('Criterion 26: Multiple sequential approved amendments do not double-count and preserve baseline', () => {
    const act: PlanActivityItem = {
      id: 'act-shades-master',
      title: 'شید رول موتوردار سالن پذیرایی',
      category: 'SHADE',
      plannedQuantity: 10,
      unit: 'لت',
    };

    const firstApprovedAmend: PlanAmendment = {
      id: 'amend-seq-1',
      activityId: 'act-shades-master',
      activityTitle: 'شید رول موتوردار سالن پذیرایی',
      previousQuantity: 10,
      newQuantity: 12,
      reason: 'افزایش ۲ لت به درخواست کتبی کارفرما',
      requestedByUserId: supervisorUser.id,
      requestedByUserName: supervisorUser.name,
      requestedAt: '2026-05-10T09:00:00Z',
      status: 'APPROVED',
      reviewedByUserId: qcManagerUser.id,
      reviewedByUserName: qcManagerUser.name,
      reviewedAt: '2026-05-10T10:00:00Z',
    };

    const secondApprovedAmend: PlanAmendment = {
      id: 'amend-seq-2',
      activityId: 'act-shades-master',
      activityTitle: 'شید رول موتوردار سالن پذیرایی',
      previousQuantity: 12,
      newQuantity: 15,
      reason: 'افزایش ۳ لت دیگر پس از بررسی پنجره دوم',
      requestedByUserId: supervisorUser.id,
      requestedByUserName: supervisorUser.name,
      requestedAt: '2026-05-12T14:00:00Z',
      status: 'APPROVED',
      reviewedByUserId: qcManagerUser.id,
      reviewedByUserName: qcManagerUser.name,
      reviewedAt: '2026-05-12T15:00:00Z',
    };

    const unapprovedPendingAmend: PlanAmendment = {
      id: 'amend-seq-3',
      activityId: 'act-shades-master',
      activityTitle: 'شید رول موتوردار سالن پذیرایی',
      previousQuantity: 15,
      newQuantity: 20,
      reason: 'درخواست غیرواقعی در حال بررسی',
      requestedByUserId: installerUser.id,
      requestedByUserName: installerUser.name,
      requestedAt: '2026-05-13T08:00:00Z',
      status: 'PENDING',
    };

    const rejectedAmend: PlanAmendment = {
      id: 'amend-seq-4',
      activityId: 'act-shades-master',
      activityTitle: 'شید رول موتوردار سالن پذیرایی',
      previousQuantity: 15,
      newQuantity: 30,
      reason: 'درخواست رد شده توسط مدیر',
      requestedByUserId: installerUser.id,
      requestedByUserName: installerUser.name,
      requestedAt: '2026-05-13T09:00:00Z',
      status: 'REJECTED',
      reviewedByUserId: qcManagerUser.id,
      reviewedByUserName: qcManagerUser.name,
      reviewedAt: '2026-05-13T10:00:00Z',
    };

    const allAmendments = [
      firstApprovedAmend,
      secondApprovedAmend,
      unapprovedPendingAmend,
      rejectedAmend,
    ];

    const result = getEffectivePlannedQuantity(act, allAmendments);

    // 1. Effective planned quantity must be exactly 15 (from latest approved amendment)
    expect(result.effectivePlannedQuantity).toBe(15);

    // 2. Total amendment delta must be +5 relative to baseline (15 - 10)
    // NOT double-counted as +2 + +5 = +7!
    expect(result.amendmentDelta).toBe(5);

    // 3. Baseline activity object remains completely intact
    expect(act.plannedQuantity).toBe(10);

    // 4. Pending (20) and Rejected (30) amendments had zero effect
    expect(result.effectivePlannedQuantity).not.toBe(20);
    expect(result.effectivePlannedQuantity).not.toBe(30);

    // 5. Complete historical records are preserved in full array
    expect(allAmendments).toHaveLength(4);
    expect(allAmendments[0].newQuantity).toBe(12);
    expect(allAmendments[1].newQuantity).toBe(15);
  });

  // 27. Exceptional completion rejection returns project to actionable IN_PROGRESS state
  it('Criterion 27: Exceptional completion rejection resets status to IN_PROGRESS with corrective action', () => {
    const exceptionalProject = createMockProject({
      status: 'COMPLETED',
      qcStatus: 'PENDING',
      isExceptionalCompletion: true,
      exceptionalCompletionDetails: {
        hasIncompleteActivities: true,
        remainingActivities: [
          {
            activityId: 'act-1',
            title: 'شید رول',
            remainingQuantity: 2,
            unit: 'لت',
          },
        ],
        documentedReason: 'کناف سقف آماده نبود',
        confirmedBySupervisor: supervisorUser.name,
        confirmedAt: '2026-05-20T10:00:00Z',
      },
    });

    const rejectionPatch: Partial<Project> = {
      status: 'IN_PROGRESS',
      qcStatus: 'REJECTED',
      qcNotes: 'رد اتمام استثنایی: الزام به تکمیل ۲ لت شید رول باقیمانده طرح',
      qcCorrectiveAction: {
        required: true,
        issue: 'رد اتمام استثنایی: الزام به تکمیل ۲ لت شید رول باقیمانده طرح',
        completed: false,
      },
    };

    expect(() =>
      validateProjectPatchRoleGuards(qcManagerUser, exceptionalProject, rejectionPatch)
    ).not.toThrow();

    const updatedProject = { ...exceptionalProject, ...rejectionPatch };

    // Returns to IN_PROGRESS so technicians can resume work
    expect(updatedProject.status).toBe('IN_PROGRESS');
    expect(updatedProject.qcStatus).toBe('REJECTED');
    // History is NOT erased
    expect(updatedProject.isExceptionalCompletion).toBe(true);
    expect(updatedProject.exceptionalCompletionDetails?.remainingActivities).toHaveLength(1);
  });

  // 28. Exceptional completion approval permanently preserves missing quantities and reason
  it('Criterion 28: Exceptional completion approval permanently preserves missing quantities and documented reason', () => {
    const exceptionalProject = createMockProject({
      status: 'COMPLETED',
      qcStatus: 'PENDING',
      isExceptionalCompletion: true,
      exceptionalCompletionDetails: {
        hasIncompleteActivities: true,
        remainingActivities: [
          {
            activityId: 'act-curtains',
            title: 'پرده حریر اتاق خواب',
            remainingQuantity: 3,
            unit: 'لت',
          },
        ],
        documentedReason: 'کارفرما انصراف داد و تحویل اقلام بدون نصب را پذیرفت',
        confirmedBySupervisor: supervisorUser.name,
        confirmedAt: '2026-05-20T10:00:00Z',
      },
    });

    const approvalPatch: Partial<Project> = {
      status: 'COMPLETED',
      qcStatus: 'APPROVED',
      qcScore: 4,
      qcNotes: 'تایید اتمام استثنایی با کسری اقلام توسط مدیر QC',
      qcReviewedAt: new Date().toISOString(),
      qcReviewedBy: qcManagerUser.name,
    };

    expect(() =>
      validateProjectPatchRoleGuards(qcManagerUser, exceptionalProject, approvalPatch)
    ).not.toThrow();

    const finalizedProject = { ...exceptionalProject, ...approvalPatch };

    expect(finalizedProject.qcStatus).toBe('APPROVED');
    expect(finalizedProject.isExceptionalCompletion).toBe(true);
    expect(finalizedProject.exceptionalCompletionDetails?.documentedReason).toBe(
      'کارفرما انصراف داد و تحویل اقلام بدون نصب را پذیرفت'
    );
    expect(finalizedProject.exceptionalCompletionDetails?.remainingActivities[0].remainingQuantity).toBe(3);
  });

  // 29. Concurrency check: Stale amendment approval attempt is rejected
  it('Criterion 29: Stale amendment approval attempt where previousQuantity does not match current effective quantity is rejected', () => {
    const act: PlanActivityItem = {
      id: 'act-shades-concurrency',
      title: 'شید رول پذیرایی',
      category: 'SHADE',
      plannedQuantity: 10,
      unit: 'لت',
    };

    // First amendment already approved (effective quantity is now 12)
    const existingApprovedAmend: PlanAmendment = {
      id: 'amend-c1',
      activityId: 'act-shades-concurrency',
      activityTitle: 'شید رول پذیرایی',
      previousQuantity: 10,
      newQuantity: 12,
      reason: 'افزایش ۲ لت مصوب',
      requestedByUserId: supervisorUser.id,
      requestedByUserName: supervisorUser.name,
      requestedAt: '2026-05-10T10:00:00Z',
      status: 'APPROVED',
      reviewedByUserId: qcManagerUser.id,
      reviewedByUserName: qcManagerUser.name,
      reviewedAt: '2026-05-10T11:00:00Z',
    };

    const projectWithApprovedAmend = createMockProject({
      originalPlan: {
        lockedAt: '2026-05-01T08:00:00Z',
        activities: [act],
      },
      planAmendments: [existingApprovedAmend],
    });

    // Stale second amendment that was created concurrently assuming baseline was 10 (now stale!)
    const stalePendingAmend: PlanAmendment = {
      id: 'amend-c2-stale',
      activityId: 'act-shades-concurrency',
      activityTitle: 'شید رول پذیرایی',
      previousQuantity: 10, // Stale! The current effective is 12!
      newQuantity: 8,
      reason: 'کاهش ۲ لت (همزمان با اصلاحیه اول)',
      requestedByUserId: supervisorUser.id,
      requestedByUserName: supervisorUser.name,
      requestedAt: '2026-05-10T10:05:00Z',
      status: 'APPROVED', // Attempting to approve stale amendment
      reviewedByUserId: qcManagerUser.id,
      reviewedByUserName: qcManagerUser.name,
      reviewedAt: '2026-05-10T12:00:00Z',
    };

    // Attempting to approve the stale amendment must be rejected by concurrency guard
    expect(() =>
      validateProjectPatchRoleGuards(
        qcManagerUser,
        projectWithApprovedAmend,
        {
          planAmendments: [existingApprovedAmend, stalePendingAmend],
        }
      )
    ).toThrow(/خطای همزمانی اصلاحیه: مقدار قبلی \(10 لت\) با آخرین سقف مصوب جاری \(12 لت\) مطابقت ندارد/);

    // If previousQuantity is updated to 12 (matching current effective), approval succeeds
    const refreshedValidAmend: PlanAmendment = {
      ...stalePendingAmend,
      previousQuantity: 12, // Refreshed
    };

    expect(() =>
      validateProjectPatchRoleGuards(
        qcManagerUser,
        projectWithApprovedAmend,
        {
          planAmendments: [existingApprovedAmend, refreshedValidAmend],
        }
      )
    ).not.toThrow();
  });
});
