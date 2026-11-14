import {
  Project,
  InstallationTeam,
  InstallationTeamWithMembers,
  TeamOperationalStatus,
  SystemSettings,
} from '../types';
import {
  isProjectScheduledOnDate,
  isProjectMultiDay,
  getMultiDayDateRange,
} from './multiDay';

// Aliases for readability
export const isProjectOnDate = isProjectScheduledOnDate;
export const isMultiDayProject = isProjectMultiDay;

export interface TeamCapacityConfig {
  configured: boolean;
  capacityHours: number | null;
  source: 'TEAM' | 'SYSTEM' | 'UNCONFIGURED';
}

/**
 * Determines effective daily capacity for an installation team.
 * Never silently assumes 8 hours.
 * Priority:
 * 1. Team-specific dailyCapacityHours
 * 2. SystemSettings defaultTeamDailyCapacityHours
 * 3. Unconfigured (marked explicitly)
 */
export function getTeamDailyCapacity(
  team?: InstallationTeam | null,
  settings?: SystemSettings | null
): TeamCapacityConfig {
  if (team && typeof team.dailyCapacityHours === 'number' && team.dailyCapacityHours > 0) {
    return {
      configured: true,
      capacityHours: Number(team.dailyCapacityHours.toFixed(1)),
      source: 'TEAM',
    };
  }

  if (
    settings &&
    typeof settings.defaultTeamDailyCapacityHours === 'number' &&
    settings.defaultTeamDailyCapacityHours > 0
  ) {
    return {
      configured: true,
      capacityHours: Number(settings.defaultTeamDailyCapacityHours.toFixed(1)),
      source: 'SYSTEM',
    };
  }

  return {
    configured: false,
    capacityHours: null,
    source: 'UNCONFIGURED',
  };
}

export interface ScheduleConflict {
  id: string;
  type:
    | 'SIMULTANEOUS_TIME_CONFLICT'
    | 'OVER_CAPACITY'
    | 'UNCONFIGURED_CAPACITY'
    | 'MISSING_WORKLOAD_ESTIMATE'
    | 'MULTI_DAY_INCONSISTENT'
    | 'UNASSIGNED_TEAM';
  severity: 'ERROR' | 'WARNING';
  projectId: string;
  projectCode: string;
  projectTitle: string;
  teamId?: string;
  teamName?: string;
  dateKey: string;
  message: string;
}

export interface DayTeamLoad {
  teamId: string;
  teamName: string;
  dateKey: string;
  assignedProjects: Project[];
  totalWorkloadHours: number;
  capacityHours: number | null;
  remainingCapacityHours: number | null;
  isOverloaded: boolean;
  isCapacityConfigured: boolean;
  capacitySource: 'TEAM' | 'SYSTEM' | 'UNCONFIGURED';
}

/**
 * Helper to parse "HH:MM" into minutes from 00:00.
 */
function parseTimeToMinutes(timeStr?: string): number | null {
  if (!timeStr || !timeStr.includes(':')) return null;
  const [hStr, mStr] = timeStr.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

/**
 * Checks whether two projects on the same date have physically overlapping clock time windows.
 */
export function checkSimultaneousTimeOverlap(
  p1: Project,
  p2: Project
): { overlap: boolean; details?: string } {
  const t1 = parseTimeToMinutes(p1.scheduledTime);
  const t2 = parseTimeToMinutes(p2.scheduledTime);

  // If either project doesn't have a specific clock start time, they are ordered sequentially during the day
  if (t1 === null || t2 === null) {
    return { overlap: false };
  }

  const dur1Minutes = Math.max(30, Math.round((p1.requiredDurationHours || 2) * 60));
  const dur2Minutes = Math.max(30, Math.round((p2.requiredDurationHours || 2) * 60));

  const p1End = t1 + dur1Minutes;
  const p2End = t2 + dur2Minutes;

  const hasOverlap = Math.max(t1, t2) < Math.min(p1End, p2End);

  if (hasOverlap) {
    return {
      overlap: true,
      details: `تداخل زمانی ساعت ${p1.scheduledTime || 'نامشخص'} تا ${Math.floor(p1End / 60)}:${String(p1End % 60).padStart(2, '0')} با پروژه دیگر (ساعت ${p2.scheduledTime})`,
    };
  }

  return { overlap: false };
}

/**
 * Returns estimated hours for a project on a specific dateKey.
 * Accounts for:
 * 1. Working-day boundaries (skips non-working days if configured)
 * 2. Deducts past work session hours already spent on earlier dates
 * 3. Accurately allocates remaining workload over remaining working days
 */
export function getProjectDailyDurationHours(
  project: Project,
  dateKey: string,
  settings?: SystemSettings | null
): number {
  if (!project.requiredDurationHours || project.requiredDurationHours <= 0) {
    return 0;
  }

  // Single-day project:
  if (!isMultiDayProject(project) || !project.endDate) {
    return project.scheduledDate === dateKey ? project.requiredDurationHours : 0;
  }

  // Multi-day project:
  const range = getMultiDayDateRange(project.scheduledDate, project.endDate);
  if (!range.includes(dateKey)) {
    return 0;
  }

  // Check working day filter: 0=Sunday, 1=Monday, ..., 5=Friday, 6=Saturday
  const allowedDays = settings?.workingDaysPerWeek || [0, 1, 2, 3, 4, 6]; // Default: all except Friday (5)
  const isDateWorking = (dStr: string) => {
    const d = new Date(dStr);
    return allowedDays.includes(d.getDay());
  };

  if (!isDateWorking(dateKey)) {
    return 0;
  }

  const validWorkingDays = range.filter(isDateWorking);
  if (validWorkingDays.length === 0) return 0;

  // Calculate logged hours per date from completed workSessions
  const loggedHoursByDate = new Map<string, number>();
  let totalLoggedHours = 0;

  if (project.workSessions && project.workSessions.length > 0) {
    for (const s of project.workSessions) {
      if (s.date && s.startedAt && s.endedAt) {
        const ms = new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime();
        if (ms > 0) {
          const h = ms / (1000 * 60 * 60);
          loggedHoursByDate.set(s.date, (loggedHoursByDate.get(s.date) || 0) + h);
          totalLoggedHours += h;
        }
      }
    }
  }

  // If this specific date has completed work sessions, return actual logged hours
  if (loggedHoursByDate.has(dateKey)) {
    return Number(loggedHoursByDate.get(dateKey)!.toFixed(1));
  }

  // For unlogged days, distribute remaining hours evenly among unlogged working days
  const unloggedDays = validWorkingDays.filter((d) => !loggedHoursByDate.has(d));
  if (unloggedDays.length === 0) {
    return 0;
  }

  const netRemainingHours = Math.max(0, project.requiredDurationHours - totalLoggedHours);
  return Number((netRemainingHours / unloggedDays.length).toFixed(1));
}

/**
 * Calculates workload metrics for a specific team on a given date.
 */
export function calculateTeamDayLoad(
  teamId: string,
  teamName: string,
  dateKey: string,
  projects: Project[],
  team?: InstallationTeam | null,
  settings?: SystemSettings | null
): DayTeamLoad {
  const activeStatuses = new Set(['SCHEDULED', 'EN_ROUTE', 'IN_PROGRESS', 'PAUSED']);

  const assignedProjects = projects.filter((p) => {
    if (p.assignedTeamId !== teamId) return false;
    if (!activeStatuses.has(p.status)) return false;
    return isProjectOnDate(p, dateKey);
  });

  const totalWorkloadHours = assignedProjects.reduce((sum, p) => {
    return sum + getProjectDailyDurationHours(p, dateKey, settings);
  }, 0);

  const roundedTotal = Number(totalWorkloadHours.toFixed(1));
  const capacityConfig = getTeamDailyCapacity(team, settings);

  if (!capacityConfig.configured || capacityConfig.capacityHours === null) {
    return {
      teamId,
      teamName,
      dateKey,
      assignedProjects,
      totalWorkloadHours: roundedTotal,
      capacityHours: null,
      remainingCapacityHours: null,
      isOverloaded: false,
      isCapacityConfigured: false,
      capacitySource: 'UNCONFIGURED',
    };
  }

  const remaining = Number(Math.max(0, capacityConfig.capacityHours - roundedTotal).toFixed(1));

  return {
    teamId,
    teamName,
    dateKey,
    assignedProjects,
    totalWorkloadHours: roundedTotal,
    capacityHours: capacityConfig.capacityHours,
    remainingCapacityHours: remaining,
    isOverloaded: roundedTotal > capacityConfig.capacityHours,
    isCapacityConfigured: true,
    capacitySource: capacityConfig.source,
  };
}

/**
 * Detects all operational and scheduling conflicts across active projects and installation teams.
 * Supports:
 * - Unconfigured capacity warnings
 * - Multiple small projects per day within capacity (accepted!)
 * - Simultaneous time conflicts (overlapping clock intervals)
 * - Daily workload exceeding capacity (OVER_CAPACITY)
 * - Multi-day continuity and boundary checks
 */
export function detectScheduleConflicts(
  projects: Project[],
  teams: InstallationTeam[],
  settings?: SystemSettings | null
): ScheduleConflict[] {
  const conflicts: ScheduleConflict[] = [];
  const activeStatuses = new Set(['SCHEDULED', 'EN_ROUTE', 'IN_PROGRESS', 'PAUSED']);
  const teamMap = new Map(teams.map((t) => [t.id, t]));

  // Track team assignment by date: `${teamId}_${dateKey}` -> Project[]
  const teamDateAssignments = new Map<string, Project[]>();

  for (const p of projects) {
    if (!activeStatuses.has(p.status)) continue;

    // Check 1: Multi-day date consistency
    if (p.endDate && p.scheduledDate && p.endDate < p.scheduledDate) {
      conflicts.push({
        id: `conf-multiday-${p.id}`,
        type: 'MULTI_DAY_INCONSISTENT',
        severity: 'ERROR',
        projectId: p.id,
        projectCode: p.code,
        projectTitle: p.title,
        dateKey: p.scheduledDate,
        message: `تاریخ پایان پروژه (${p.endDate}) قبل از تاریخ شروع (${p.scheduledDate}) قرار دارد.`,
      });
    }

    // Check 2: Missing estimated duration
    if (
      p.status === 'SCHEDULED' &&
      (!p.requiredDurationHours || p.requiredDurationHours <= 0)
    ) {
      conflicts.push({
        id: `conf-missing-workload-${p.id}`,
        type: 'MISSING_WORKLOAD_ESTIMATE',
        severity: 'WARNING',
        projectId: p.id,
        projectCode: p.code,
        projectTitle: p.title,
        dateKey: p.scheduledDate,
        message: 'پروژه فاقد تخمین ساعات کارکرد است و نیازمند برآورد بار کاری می‌باشد.',
      });
    }

    // Check 3: Scheduled without team assignment
    if (!p.assignedTeamId) {
      conflicts.push({
        id: `conf-unassigned-team-${p.id}`,
        type: 'UNASSIGNED_TEAM',
        severity: 'WARNING',
        projectId: p.id,
        projectCode: p.code,
        projectTitle: p.title,
        dateKey: p.scheduledDate,
        message: 'پروژه در وضعیت زمان‌بندی قرار دارد اما به هیچ اکیپ نصبی تخصیص نیافته است.',
      });
      continue;
    }

    // Populate team assignments across the project dates
    const dateRange = isMultiDayProject(p) && p.endDate
      ? getMultiDayDateRange(p.scheduledDate, p.endDate)
      : [p.scheduledDate];

    for (const d of dateRange) {
      if (!d) continue;
      const key = `${p.assignedTeamId}_${d}`;
      const list = teamDateAssignments.get(key) || [];
      list.push(p);
      teamDateAssignments.set(key, list);
    }
  }

  // Check 4, 5 & 6: Capacity, unconfigured capacity, and simultaneous clock conflicts
  for (const [key, assignedList] of teamDateAssignments.entries()) {
    const [teamId, dateKey] = key.split('_');
    const team = teamMap.get(teamId);
    const teamName = team ? team.name : 'اکیپ نامشخص';

    const capacityConfig = getTeamDailyCapacity(team, settings);
    const totalHours = Number(
      assignedList
        .reduce((sum, p) => sum + getProjectDailyDurationHours(p, dateKey, settings), 0)
        .toFixed(1)
    );

    // If capacity is not configured: flag warning
    if (!capacityConfig.configured || capacityConfig.capacityHours === null) {
      conflicts.push({
        id: `conf-unconfigured-${key}`,
        type: 'UNCONFIGURED_CAPACITY',
        severity: 'WARNING',
        projectId: assignedList[0]?.id || '',
        projectCode: assignedList.map((p) => p.code).join('، '),
        projectTitle: `سقف ظرفیت نامشخص برای ${teamName}`,
        teamId,
        teamName,
        dateKey,
        message: `سقف ظرفیت کاری روزانه برای ${teamName} یا سیستم تعیین نشده است. زمان‌بندی بدون تعیین سقف معتبر نیست.`,
      });
    } else {
      // Over-capacity error
      if (totalHours > capacityConfig.capacityHours) {
        conflicts.push({
          id: `conf-overcapacity-${key}`,
          type: 'OVER_CAPACITY',
          severity: 'ERROR',
          projectId: assignedList[0]?.id || '',
          projectCode: assignedList.map((p) => p.code).join(' و '),
          projectTitle: `تراکم بیش از ظرفیت ${teamName}`,
          teamId,
          teamName,
          dateKey,
          message: `بار کاری اختصاص‌یافته (${totalHours} ساعت) از سقف مجاز روزانه اکیپ (${capacityConfig.capacityHours} ساعت) بیشتر است.`,
        });
      }
    }

    // Check for simultaneous start/clock time conflicts (distinct from total workload)
    if (assignedList.length > 1) {
      for (let i = 0; i < assignedList.length; i++) {
        for (let j = i + 1; j < assignedList.length; j++) {
          const p1 = assignedList[i];
          const p2 = assignedList[j];
          const timeCheck = checkSimultaneousTimeOverlap(p1, p2);
          if (timeCheck.overlap) {
            conflicts.push({
              id: `conf-time-overlap-${p1.id}-${p2.id}`,
              type: 'SIMULTANEOUS_TIME_CONFLICT',
              severity: 'ERROR',
              projectId: p1.id,
              projectCode: `${p1.code} و ${p2.code}`,
              projectTitle: `تداخل زمانی همزمان برای ${teamName}`,
              teamId,
              teamName,
              dateKey,
              message: `تداخل ساعتی مستقیم میان ${p1.code} و ${p2.code}: ${timeCheck.details || 'بازه زمانی شروع یکسان'}`,
            });
          }
        }
      }
    }
  }

  return conflicts;
}

/**
 * Builds real-time operational status for all 4 installation teams.
 * Accurately reflects configured vs unconfigured status.
 */
export function buildTeamOperationalStatuses(
  teamsWithMembers: InstallationTeamWithMembers[],
  projects: Project[],
  todayDateKey: string,
  settings?: SystemSettings | null
): TeamOperationalStatus[] {
  const activeStatuses = new Set(['SCHEDULED', 'EN_ROUTE', 'IN_PROGRESS', 'PAUSED']);

  return teamsWithMembers.map((twm) => {
    const team = twm;
    const supervisor = twm.supervisor;
    const technicians = twm.technicians || [];

    const todayMissions = projects.filter((p) => {
      if (p.assignedTeamId !== team.id) return false;
      if (!activeStatuses.has(p.status)) return false;
      return isProjectOnDate(p, todayDateKey);
    });

    const currentPrimary = todayMissions[0];
    let currentMission: TeamOperationalStatus['currentMission'] = undefined;

    if (currentPrimary) {
      currentMission = {
        projectId: currentPrimary.id,
        projectCode: currentPrimary.code,
        projectTitle: currentPrimary.title,
        status: currentPrimary.status,
        isMultiDay: isMultiDayProject(currentPrimary),
        durationHours: getProjectDailyDurationHours(currentPrimary, todayDateKey, settings),
        customerName: currentPrimary.customerName,
      };
    }

    const currentWorkloadHours = Number(
      todayMissions
        .reduce((sum, p) => sum + getProjectDailyDurationHours(p, todayDateKey, settings), 0)
        .toFixed(1)
    );

    const capConfig = getTeamDailyCapacity(team, settings);
    const maxCapacityHours = capConfig.configured ? capConfig.capacityHours : null;
    const remainingCapacityHours =
      capConfig.configured && capConfig.capacityHours !== null
        ? Number(Math.max(0, capConfig.capacityHours - currentWorkloadHours).toFixed(1))
        : null;

    let status: TeamOperationalStatus['status'] = 'AVAILABLE';
    if (!capConfig.configured && todayMissions.length > 0) {
      status = 'UNCONFIGURED';
    } else if (capConfig.configured && capConfig.capacityHours !== null && currentWorkloadHours > capConfig.capacityHours) {
      status = 'OVERLOADED';
    } else if (todayMissions.some((p) => p.status === 'EN_ROUTE' || p.status === 'IN_PROGRESS')) {
      status = 'ON_MISSION';
    } else if (todayMissions.length > 0) {
      status = 'STANDBY';
    } else {
      status = 'AVAILABLE';
    }

    return {
      team,
      supervisor,
      technicians,
      currentMission,
      currentWorkloadHours,
      maxCapacityHours,
      remainingCapacityHours,
      isCapacityConfigured: capConfig.configured,
      capacitySource: capConfig.source,
      status,
    };
  });
}
