import {
  Project,
  PlanActivityItem,
  PlanActivityCategory,
  InstallationPlan,
  PlanAmendment,
  User,
} from '../types';

export interface ActivityProgressSummary {
  activityId: string;
  title: string;
  category?: PlanActivityCategory;
  unit: string;
  technicalDetails?: string;
  baselineQuantity: number;
  amendmentDelta: number;
  effectivePlannedQuantity: number;
  previouslyCompletedQuantity: number;
  todayCompletedQuantity: number;
  totalCompletedQuantity: number;
  remainingQuantity: number;
  isOverCompleted: boolean;
  overCompletedQuantity: number;
  progressPercent: number;
}

export interface IncompleteActivitiesReport {
  hasIncomplete: boolean;
  totalRemainingUnits: number;
  remainingItems: {
    activityId: string;
    title: string;
    remainingQuantity: number;
    unit: string;
  }[];
}

/**
 * Returns the structured activity items for a project.
 * If project.originalPlan exists with activities, returns them directly.
 * If legacy project without originalPlan, generates a backward-compatible
 * adapter from shadePanels, curtainPanels, and mechanismType without double-counting.
 */
export function getEffectiveProjectPlan(project: Project): PlanActivityItem[] {
  if (project.originalPlan?.activities && project.originalPlan.activities.length > 0) {
    return project.originalPlan.activities.map((a) => ({ ...a }));
  }

  const legacyActivities: PlanActivityItem[] = [];

  if (typeof project.shadePanels === 'number' && project.shadePanels > 0) {
    legacyActivities.push({
      id: 'legacy-act-shades',
      title: 'نصب لت‌های شید',
      category: 'SHADE',
      plannedQuantity: Number(project.shadePanels),
      unit: 'لت',
      technicalDetails: project.mechanismType || undefined,
    });
  }

  if (typeof project.curtainPanels === 'number' && project.curtainPanels > 0) {
    legacyActivities.push({
      id: 'legacy-act-curtains',
      title: 'نصب لت‌های پرده',
      category: 'CURTAIN',
      plannedQuantity: Number(project.curtainPanels),
      unit: 'لت',
    });
  }

  if (typeof project.railCount === 'number' && project.railCount > 0) {
    legacyActivities.push({
      id: 'legacy-act-rails',
      title: 'نصب ریل‌ها',
      category: 'RAIL',
      plannedQuantity: Number(project.railCount),
      unit: 'عدد',
    });
  }

  if (legacyActivities.length === 0 && typeof project.estimatedWorkload === 'number' && project.estimatedWorkload > 0) {
    legacyActivities.push({
      id: 'legacy-act-workload',
      title: 'کل حجم کار نصب',
      category: 'CUSTOM',
      plannedQuantity: Number(project.estimatedWorkload),
      unit: 'لت',
    });
  }

  return legacyActivities;
}

/**
 * Calculates effective planned quantity for an activity taking into account
 * the original baseline and all approved amendments (ordered chronologically).
 * Effective Planned = Original Baseline + Approved Amendments
 */
export function getEffectivePlannedQuantity(
  activity: PlanActivityItem,
  amendments?: PlanAmendment[]
): { effectivePlannedQuantity: number; amendmentDelta: number } {
  if (!amendments || amendments.length === 0) {
    return {
      effectivePlannedQuantity: activity.plannedQuantity,
      amendmentDelta: 0,
    };
  }

  // Filter approved amendments for this specific activity and sort chronologically by approval/request time
  const approvedForActivity = amendments
    .filter((a) => a.activityId === activity.id && a.status === 'APPROVED')
    .sort((a, b) => {
      const timeA = new Date(a.reviewedAt || a.requestedAt).getTime();
      const timeB = new Date(b.reviewedAt || b.requestedAt).getTime();
      return timeA - timeB;
    });

  if (approvedForActivity.length === 0) {
    return {
      effectivePlannedQuantity: activity.plannedQuantity,
      amendmentDelta: 0,
    };
  }

  // The latest approved amendment reflects the authoritative new quantity
  const latestApproved = approvedForActivity[approvedForActivity.length - 1];
  const effectivePlannedQuantity = Number(latestApproved.newQuantity);
  const amendmentDelta = Number((effectivePlannedQuantity - activity.plannedQuantity).toFixed(2));

  return {
    effectivePlannedQuantity,
    amendmentDelta,
  };
}

/**
 * Calculates complete progress breakdown for all activities of a project.
 * Stored separately from the original immutable plan.
 * Remaining = Effective Planned - Total Valid Completed
 */
export function calculateActivityProgress(
  project: Project,
  currentDateKey?: string
): ActivityProgressSummary[] {
  const activities = getEffectiveProjectPlan(project);
  const logs = project.dailyLogs || [];

  return activities.map((activity) => {
    const { effectivePlannedQuantity, amendmentDelta } = getEffectivePlannedQuantity(
      activity,
      project.planAmendments
    );

    let previouslyCompletedQuantity = 0;
    let todayCompletedQuantity = 0;
    let totalCompletedQuantity = 0;

    for (const log of logs) {
      let logQty = 0;

      if (log.activityProgress && Array.isArray(log.activityProgress)) {
        // Itemized progress entry in dailyLog
        const entry = log.activityProgress.find((p) => p.activityId === activity.id);
        if (entry && typeof entry.completedQuantity === 'number') {
          logQty = entry.completedQuantity;
        }
      } else if (typeof log.completedQuantity === 'number' && log.completedQuantity > 0) {
        // Legacy dailyLog compatibility: if single activity, assign to it
        if (activities.length === 1) {
          logQty = log.completedQuantity;
        } else if (activity.id === activities[0].id) {
          // If multiple legacy activities and no itemized breakdown, attribute to primary
          logQty = log.completedQuantity;
        }
      }

      totalCompletedQuantity += logQty;

      if (currentDateKey && log.date === currentDateKey) {
        todayCompletedQuantity += logQty;
      } else if (currentDateKey && log.date < currentDateKey) {
        previouslyCompletedQuantity += logQty;
      } else if (!currentDateKey) {
        previouslyCompletedQuantity += logQty;
      }
    }

    totalCompletedQuantity = Number(totalCompletedQuantity.toFixed(2));
    previouslyCompletedQuantity = Number(previouslyCompletedQuantity.toFixed(2));
    todayCompletedQuantity = Number(todayCompletedQuantity.toFixed(2));

    const remainingQuantity = Number((effectivePlannedQuantity - totalCompletedQuantity).toFixed(2));
    const isOverCompleted = totalCompletedQuantity > effectivePlannedQuantity;
    const overCompletedQuantity = isOverCompleted
      ? Number((totalCompletedQuantity - effectivePlannedQuantity).toFixed(2))
      : 0;

    const progressPercent = effectivePlannedQuantity > 0
      ? Math.min(100, Math.round((totalCompletedQuantity / effectivePlannedQuantity) * 100))
      : totalCompletedQuantity > 0 ? 100 : 0;

    return {
      activityId: activity.id,
      title: activity.title,
      category: activity.category,
      unit: activity.unit,
      technicalDetails: activity.technicalDetails,
      baselineQuantity: activity.plannedQuantity,
      amendmentDelta,
      effectivePlannedQuantity,
      previouslyCompletedQuantity,
      todayCompletedQuantity,
      totalCompletedQuantity,
      remainingQuantity,
      isOverCompleted,
      overCompletedQuantity,
      progressPercent,
    };
  });
}

/**
 * Checks whether any planned activity has remaining work not yet completed.
 * Used for pre-completion verification.
 */
export function getIncompleteActivitiesSummary(project: Project): IncompleteActivitiesReport {
  const progressList = calculateActivityProgress(project);
  const remainingItems = progressList
    .filter((p) => p.remainingQuantity > 0)
    .map((p) => ({
      activityId: p.activityId,
      title: p.title,
      remainingQuantity: p.remainingQuantity,
      unit: p.unit,
    }));

  const totalRemainingUnits = remainingItems.reduce((sum, item) => sum + item.remainingQuantity, 0);

  return {
    hasIncomplete: remainingItems.length > 0,
    totalRemainingUnits: Number(totalRemainingUnits.toFixed(2)),
    remainingItems,
  };
}

/**
 * Creates a plan amendment draft.
 */
export function createPlanAmendment(
  activityId: string,
  activityTitle: string,
  previousQuantity: number,
  newQuantity: number,
  reason: string,
  requestingUser: User,
  initialStatus: 'PENDING' | 'APPROVED' = 'PENDING'
): PlanAmendment {
  return {
    id: `amend-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    activityId,
    activityTitle,
    previousQuantity: Number(previousQuantity),
    newQuantity: Number(newQuantity),
    reason: reason.trim(),
    requestedByUserId: requestingUser.id,
    requestedByUserName: requestingUser.name,
    requestedAt: new Date().toISOString(),
    status: initialStatus,
    ...(initialStatus === 'APPROVED'
      ? {
          reviewedByUserId: requestingUser.id,
          reviewedByUserName: requestingUser.name,
          reviewedAt: new Date().toISOString(),
          reviewNotes: 'تایید مستقیم توسط مدیر QC',
        }
      : {}),
  };
}

/**
 * Reviews a plan amendment (Approved/Rejected by QC Manager).
 * Supports reviewing a single amendment or updating an array of amendments.
 */
export function reviewPlanAmendment(
  amendment: PlanAmendment,
  decision: 'APPROVED' | 'REJECTED',
  reviewer: User,
  notes?: string
): PlanAmendment;
export function reviewPlanAmendment(
  amendments: PlanAmendment[],
  amendmentId: string,
  decision: 'APPROVED' | 'REJECTED',
  reviewer: User,
  notes?: string
): PlanAmendment[];
export function reviewPlanAmendment(
  amendmentsOrSingle: PlanAmendment[] | PlanAmendment,
  decisionOrId: 'APPROVED' | 'REJECTED' | string,
  decisionOrReviewer: 'APPROVED' | 'REJECTED' | User,
  reviewerOrNotes?: User | string,
  optionalNotes?: string
): PlanAmendment | PlanAmendment[] {
  if (Array.isArray(amendmentsOrSingle)) {
    const amendmentId = decisionOrId as string;
    const decision = decisionOrReviewer as 'APPROVED' | 'REJECTED';
    const reviewer = reviewerOrNotes as User;
    const notes = optionalNotes;

    return amendmentsOrSingle.map((a) => {
      if (a.id !== amendmentId) return a;
      return {
        ...a,
        status: decision,
        reviewedByUserId: reviewer?.id,
        reviewedByUserName: reviewer?.name,
        reviewedAt: new Date().toISOString(),
        reviewNotes: notes?.trim() || undefined,
      };
    });
  }

  const amendment = amendmentsOrSingle as PlanAmendment;
  const decision = decisionOrId as 'APPROVED' | 'REJECTED';
  const reviewer = decisionOrReviewer as User;
  const notes = reviewerOrNotes as string | undefined;

  return {
    ...amendment,
    status: decision,
    reviewedByUserId: reviewer?.id,
    reviewedByUserName: reviewer?.name,
    reviewedAt: new Date().toISOString(),
    reviewNotes: notes?.trim() || undefined,
  };
}

/**
 * Builds an explicit InstallationPlan from legacy project data if not present.
 */
export function createLegacyPlanAdapter(project: Project): InstallationPlan {
  if (project.originalPlan) {
    return project.originalPlan;
  }
  const activities = getEffectiveProjectPlan(project);
  return {
    activities,
    lockedAt: project.createdAt || new Date().toISOString(),
    notes: 'طرح اولیه ایجادشده خودکار از اطلاعات ثبت اولیه پروژه',
  };
}
