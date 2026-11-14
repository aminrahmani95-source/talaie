import { describe, it, expect } from 'vitest';
import {
  calculateTeamDayLoad,
  detectScheduleConflicts,
  buildTeamOperationalStatuses,
  getTeamDailyCapacity,
  checkSimultaneousTimeOverlap,
  getProjectDailyDurationHours,
} from '../capacity';
import {
  Project,
  InstallationTeam,
  InstallationTeamWithMembers,
  SystemSettings,
} from '../../types';

describe('Team Capacity & Workload-Based Scheduling (Configurable Capacity & Conflicts)', () => {
  const defaultSettings: SystemSettings = {
    companyName: 'گالری طلایی',
    visibilityWindowDays: 5,
    defaultTools: ['دریل', 'متر لیزری'],
    defaultTeamDailyCapacityHours: 8,
    workingDaysPerWeek: [0, 1, 2, 3, 4, 6], // همه روزها جز جمعه
  };

  const unconfiguredSettings: SystemSettings = {
    companyName: 'گالری طلایی',
    visibilityWindowDays: 5,
    defaultTools: ['دریل'],
    defaultTeamDailyCapacityHours: null,
  };

  const team1: InstallationTeam = {
    id: 'team-1',
    code: 'TEAM_1',
    name: 'اکیپ نصب ۱',
    dailyCapacityHours: 8,
    createdAt: '2026-11-01',
    updatedAt: '2026-11-01',
  };

  const team2: InstallationTeam = {
    id: 'team-2',
    code: 'TEAM_2',
    name: 'اکیپ نصب ۲',
    dailyCapacityHours: null, // ظرفیت نامشخص
    createdAt: '2026-11-01',
    updatedAt: '2026-11-01',
  };

  const baseProject = (overrides: Partial<Project>): Project => ({
    id: 'p-1',
    code: 'PRJ-101',
    title: 'پروژه اقدسیه',
    customerName: 'مشتری ۱',
    customerPhone: '09121111111',
    address: 'تهران',
    shadePanels: 4,
    curtainPanels: 2,
    scheduledDate: '2026-11-10', // سه شنبه (working day)
    scheduledTime: '09:00',
    status: 'SCHEDULED',
    qcStatus: 'NOT_STARTED',
    proposalImages: [],
    completionPhotos: [],
    assignedTechnicianIds: [],
    toolsRequired: [],
    isFullTools: true,
    createdAt: '2026-11-01',
    updatedAt: '2026-11-01',
    ...overrides,
  });

  describe('getTeamDailyCapacity (Configurable Capacity Engine)', () => {
    it('returns UNCONFIGURED when neither team nor system settings have capacity configured', () => {
      const cap = getTeamDailyCapacity(team2, unconfiguredSettings);
      expect(cap.configured).toBe(false);
      expect(cap.capacityHours).toBeNull();
      expect(cap.source).toBe('UNCONFIGURED');
    });

    it('falls back to SystemSettings default when team capacity is unconfigured', () => {
      const cap = getTeamDailyCapacity(team2, defaultSettings);
      expect(cap.configured).toBe(true);
      expect(cap.capacityHours).toBe(8);
      expect(cap.source).toBe('SYSTEM');
    });

    it('prioritizes team-specific dailyCapacityHours over SystemSettings default', () => {
      const teamWithCustomCap: InstallationTeam = {
        ...team1,
        dailyCapacityHours: 6.5,
      };
      const cap = getTeamDailyCapacity(teamWithCustomCap, defaultSettings);
      expect(cap.configured).toBe(true);
      expect(cap.capacityHours).toBe(6.5);
      expect(cap.source).toBe('TEAM');
    });
  });

  describe('checkSimultaneousTimeOverlap (Clock Time Collision)', () => {
    it('detects overlap when clock intervals intersect', () => {
      const p1 = baseProject({
        id: 'p1',
        scheduledTime: '09:00',
        requiredDurationHours: 3, // 09:00 تا 12:00
      });
      const p2 = baseProject({
        id: 'p2',
        scheduledTime: '10:30', // تداخل با 09:00-12:00
        requiredDurationHours: 2,
      });

      const check = checkSimultaneousTimeOverlap(p1, p2);
      expect(check.overlap).toBe(true);
      expect(check.details).toBeDefined();
    });

    it('permits sequential projects on the same day without clock overlap', () => {
      const p1 = baseProject({
        id: 'p1',
        scheduledTime: '08:30',
        requiredDurationHours: 2.5, // 08:30 تا 11:00
      });
      const p2 = baseProject({
        id: 'p2',
        scheduledTime: '11:30', // شروع بعد از اتمام پروژه اول
        requiredDurationHours: 2,
      });

      const check = checkSimultaneousTimeOverlap(p1, p2);
      expect(check.overlap).toBe(false);
    });

    it('returns false when either project lacks a specific clock start time', () => {
      const p1 = baseProject({ id: 'p1', scheduledTime: '09:00' });
      const p2 = baseProject({ id: 'p2', scheduledTime: undefined });
      expect(checkSimultaneousTimeOverlap(p1, p2).overlap).toBe(false);
    });
  });

  describe('calculateTeamDayLoad & getProjectDailyDurationHours', () => {
    it('accurately calculates workload for single-day projects with configured capacity', () => {
      const p1 = baseProject({
        id: 'p-1',
        assignedTeamId: 'team-1',
        scheduledDate: '2026-11-10',
        requiredDurationHours: 5,
      });

      const load = calculateTeamDayLoad('team-1', 'اکیپ نصب ۱', '2026-11-10', [p1], team1, defaultSettings);
      expect(load.totalWorkloadHours).toBe(5);
      expect(load.capacityHours).toBe(8);
      expect(load.remainingCapacityHours).toBe(3); // 8 - 5 = 3h
      expect(load.isOverloaded).toBe(false);
      expect(load.isCapacityConfigured).toBe(true);
    });

    it('handles unconfigured capacity gracefully without pretending it is valid', () => {
      const p1 = baseProject({
        id: 'p-1',
        assignedTeamId: 'team-2',
        scheduledDate: '2026-11-10',
        requiredDurationHours: 5,
      });

      const load = calculateTeamDayLoad('team-2', 'اکیپ نصب ۲', '2026-11-10', [p1], team2, unconfiguredSettings);
      expect(load.totalWorkloadHours).toBe(5);
      expect(load.capacityHours).toBeNull();
      expect(load.remainingCapacityHours).toBeNull();
      expect(load.isCapacityConfigured).toBe(false);
      expect(load.capacitySource).toBe('UNCONFIGURED');
    });

    it('spreads multi-day project workload evenly across scheduled working days', () => {
      const multiDay = baseProject({
        id: 'p-multi',
        assignedTeamId: 'team-1',
        scheduledDate: '2026-11-10', // Tue
        endDate: '2026-11-12', // Thu (3 days: 10th, 11th, 12th)
        requiredDurationHours: 15, // 15h total -> 5h per day
      });

      const day1 = calculateTeamDayLoad('team-1', 'اکیپ نصب ۱', '2026-11-10', [multiDay], team1, defaultSettings);
      expect(day1.totalWorkloadHours).toBe(5);

      const day2 = calculateTeamDayLoad('team-1', 'اکیپ نصب ۱', '2026-11-11', [multiDay], team1, defaultSettings);
      expect(day2.totalWorkloadHours).toBe(5);

      const day3 = calculateTeamDayLoad('team-1', 'اکیپ نصب ۱', '2026-11-12', [multiDay], team1, defaultSettings);
      expect(day3.totalWorkloadHours).toBe(5);

      const day4 = calculateTeamDayLoad('team-1', 'اکیپ نصب ۱', '2026-11-13', [multiDay], team1, defaultSettings);
      expect(day4.totalWorkloadHours).toBe(0);
    });

    it('deducts past logged work session hours before distributing remaining workload', () => {
      const multiDayWithLogs = baseProject({
        id: 'p-multi-logs',
        assignedTeamId: 'team-1',
        scheduledDate: '2026-11-10',
        endDate: '2026-11-12',
        requiredDurationHours: 12,
        workSessions: [
          {
            date: '2026-11-10',
            startedAt: '2026-11-10T09:00:00Z',
            endedAt: '2026-11-10T15:00:00Z', // 6 hours completed on day 1
            byUserId: 'u-1',
            byUserName: 'تکنسین ۱',
          },
        ],
      });

      // On day 2 (2026-11-11), remaining hours = 12 - 6 = 6 hours spread over 2 remaining days = 3h/day
      const day2Hours = getProjectDailyDurationHours(multiDayWithLogs, '2026-11-11', defaultSettings);
      expect(day2Hours).toBe(3);

      const day3Hours = getProjectDailyDurationHours(multiDayWithLogs, '2026-11-12', defaultSettings);
      expect(day3Hours).toBe(3);
    });
  });

  describe('detectScheduleConflicts (Capacity, Multiple Missions, and Warnings)', () => {
    it('permits multiple small projects on the same day within capacity without false alarms', () => {
      const p1 = baseProject({
        id: 'p-1',
        code: 'PRJ-1',
        assignedTeamId: 'team-1',
        scheduledDate: '2026-11-10',
        scheduledTime: '08:30',
        requiredDurationHours: 2,
      });
      const p2 = baseProject({
        id: 'p-2',
        code: 'PRJ-2',
        assignedTeamId: 'team-1',
        scheduledDate: '2026-11-10',
        scheduledTime: '11:00',
        requiredDurationHours: 3,
      });
      const p3 = baseProject({
        id: 'p-3',
        code: 'PRJ-3',
        assignedTeamId: 'team-1',
        scheduledDate: '2026-11-10',
        scheduledTime: '15:00',
        requiredDurationHours: 2,
      });
      // مجموع: 2 + 3 + 2 = 7 ساعت <= 8 ساعت سقف مجاز، بدون تداخل ساعت شروع

      const conflicts = detectScheduleConflicts([p1, p2, p3], [team1], defaultSettings);
      const errors = conflicts.filter((c) => c.severity === 'ERROR');
      expect(errors.length).toBe(0);
      expect(conflicts.find((c) => c.type === 'OVER_CAPACITY')).toBeUndefined();
      expect(conflicts.find((c) => c.type === 'SIMULTANEOUS_TIME_CONFLICT')).toBeUndefined();
    });

    it('detects OVER_CAPACITY when sum of daily project hours exceeds team daily capacity', () => {
      const p1 = baseProject({
        id: 'p-1',
        code: 'T-101',
        assignedTeamId: 'team-1',
        scheduledDate: '2026-11-10',
        scheduledTime: '08:00',
        requiredDurationHours: 5,
      });
      const p2 = baseProject({
        id: 'p-2',
        code: 'T-102',
        assignedTeamId: 'team-1',
        scheduledDate: '2026-11-10',
        scheduledTime: '14:00',
        requiredDurationHours: 5,
      });
      // 5 + 5 = 10 ساعت > 8 ساعت سقف

      const conflicts = detectScheduleConflicts([p1, p2], [team1], defaultSettings);
      const overCap = conflicts.find((c) => c.type === 'OVER_CAPACITY');
      expect(overCap).toBeDefined();
      expect(overCap?.severity).toBe('ERROR');
      expect(overCap?.message).toContain('10');
      expect(overCap?.message).toContain('8 ساعت');
    });

    it('detects SIMULTANEOUS_TIME_CONFLICT when distinct projects have overlapping clock windows', () => {
      const p1 = baseProject({
        id: 'p-1',
        code: 'PRJ-A',
        assignedTeamId: 'team-1',
        scheduledDate: '2026-11-10',
        scheduledTime: '09:00',
        requiredDurationHours: 3, // 09:00 تا 12:00
      });
      const p2 = baseProject({
        id: 'p-2',
        code: 'PRJ-B',
        assignedTeamId: 'team-1',
        scheduledDate: '2026-11-10',
        scheduledTime: '10:00', // تداخل مستقیم با بازه 09:00-12:00
        requiredDurationHours: 2,
      });

      const conflicts = detectScheduleConflicts([p1, p2], [team1], defaultSettings);
      const timeConflict = conflicts.find((c) => c.type === 'SIMULTANEOUS_TIME_CONFLICT');
      expect(timeConflict).toBeDefined();
      expect(timeConflict?.severity).toBe('ERROR');
      expect(timeConflict?.message).toContain('PRJ-A و PRJ-B');
    });

    it('flags UNCONFIGURED_CAPACITY warning when capacity has not been set', () => {
      const p1 = baseProject({
        id: 'p-1',
        assignedTeamId: 'team-2',
        scheduledDate: '2026-11-10',
        requiredDurationHours: 4,
      });

      const conflicts = detectScheduleConflicts([p1], [team2], unconfiguredSettings);
      const unconf = conflicts.find((c) => c.type === 'UNCONFIGURED_CAPACITY');
      expect(unconf).toBeDefined();
      expect(unconf?.severity).toBe('WARNING');
      expect(unconf?.message).toContain('سقف ظرفیت کاری روزانه برای اکیپ نصب ۲ یا سیستم تعیین نشده است');
    });

    it('detects MISSING_WORKLOAD_ESTIMATE for projects scheduled without duration', () => {
      const p = baseProject({
        id: 'p-nodur',
        code: 'T-NODUR',
        assignedTeamId: 'team-1',
        scheduledDate: '2026-11-10',
        requiredDurationHours: undefined,
      });

      const conflicts = detectScheduleConflicts([p], [team1], defaultSettings);
      const missingEstimate = conflicts.find((c) => c.type === 'MISSING_WORKLOAD_ESTIMATE');
      expect(missingEstimate).toBeDefined();
      expect(missingEstimate?.severity).toBe('WARNING');
    });

    it('detects MULTI_DAY_INCONSISTENT when endDate is before scheduledDate', () => {
      const p = baseProject({
        id: 'p-inv',
        code: 'T-INV',
        scheduledDate: '2026-11-15',
        endDate: '2026-11-10',
        requiredDurationHours: 10,
      });

      const conflicts = detectScheduleConflicts([p], [team1], defaultSettings);
      const inv = conflicts.find((c) => c.type === 'MULTI_DAY_INCONSISTENT');
      expect(inv).toBeDefined();
      expect(inv?.severity).toBe('ERROR');
    });

    it('detects UNASSIGNED_TEAM when a scheduled project has no team assigned', () => {
      const p = baseProject({
        id: 'p-noteam',
        code: 'T-NOTEAM',
        assignedTeamId: undefined,
        scheduledDate: '2026-11-10',
        requiredDurationHours: 4,
      });

      const conflicts = detectScheduleConflicts([p], [team1], defaultSettings);
      const unassigned = conflicts.find((c) => c.type === 'UNASSIGNED_TEAM');
      expect(unassigned).toBeDefined();
      expect(unassigned?.severity).toBe('WARNING');
    });
  });

  describe('buildTeamOperationalStatuses operational overview', () => {
    it('accurately builds live operational status with configured capacity', () => {
      const teamsWithMembers: InstallationTeamWithMembers[] = [
        {
          ...team1,
          supervisor: { id: 'u-1', name: 'سرپرست ۱', role: 'LEAD_TECHNICIAN', phone: '0912', active: true },
          technicians: [{ id: 'u-2', name: 'تکنسین ۱', role: 'TECHNICIAN', phone: '0912', active: true }],
          totalMembers: 2,
        },
      ];

      const activeProject = baseProject({
        id: 'p-active',
        assignedTeamId: 'team-1',
        scheduledDate: '2026-11-10',
        status: 'IN_PROGRESS',
        requiredDurationHours: 6,
      });

      const statuses = buildTeamOperationalStatuses(teamsWithMembers, [activeProject], '2026-11-10', defaultSettings);
      expect(statuses.length).toBe(1);
      expect(statuses[0].status).toBe('ON_MISSION');
      expect(statuses[0].currentWorkloadHours).toBe(6);
      expect(statuses[0].maxCapacityHours).toBe(8);
      expect(statuses[0].remainingCapacityHours).toBe(2);
      expect(statuses[0].isCapacityConfigured).toBe(true);
      expect(statuses[0].currentMission?.projectCode).toBe(activeProject.code);
    });

    it('sets UNCONFIGURED status when team has active missions but capacity is unconfigured', () => {
      const teamsWithMembers: InstallationTeamWithMembers[] = [
        {
          ...team2, // unconfigured capacity
          supervisor: { id: 'u-20', name: 'سرپرست ۲', role: 'LEAD_TECHNICIAN', phone: '0912', active: true },
          technicians: [],
          totalMembers: 1,
        },
      ];

      const activeProject = baseProject({
        id: 'p-active-2',
        assignedTeamId: 'team-2',
        scheduledDate: '2026-11-10',
        status: 'SCHEDULED',
        requiredDurationHours: 4,
      });

      const statuses = buildTeamOperationalStatuses(teamsWithMembers, [activeProject], '2026-11-10', unconfiguredSettings);
      expect(statuses[0].status).toBe('UNCONFIGURED');
      expect(statuses[0].isCapacityConfigured).toBe(false);
      expect(statuses[0].maxCapacityHours).toBeNull();
      expect(statuses[0].remainingCapacityHours).toBeNull();
    });

    it('identifies OVERLOADED teams when workload exceeds configured capacity', () => {
      const teamsWithMembers: InstallationTeamWithMembers[] = [
        {
          ...team1,
          technicians: [],
          totalMembers: 1,
        },
      ];

      const overloadedProject = baseProject({
        id: 'p-over',
        assignedTeamId: 'team-1',
        scheduledDate: '2026-11-10',
        status: 'SCHEDULED',
        requiredDurationHours: 10, // 10h > 8h
      });

      const statuses = buildTeamOperationalStatuses(teamsWithMembers, [overloadedProject], '2026-11-10', defaultSettings);
      expect(statuses[0].status).toBe('OVERLOADED');
      expect(statuses[0].currentWorkloadHours).toBe(10);
      expect(statuses[0].remainingCapacityHours).toBe(0);
    });
  });
});
