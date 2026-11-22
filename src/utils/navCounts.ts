import type { MaterialRequest, Project, Ticket } from '../types';
import { isAwaitingQc } from './qcWorkflow';

export interface NavBadgeCounts {
  openTicketCount: number;
  openStuckCount: number;
  pendingQcCount: number;
  pendingMaterialCount: number;
}

/** پروژه متوقف باز: وضعیت STUCK یا آخرین رویداد توقف هنوز رفع نشده */
export function isStuckOpen(p: Project): boolean {
  if (p.status === 'STUCK') return true;
  const latest =
    p.stuckIncidents && p.stuckIncidents.length > 0
      ? p.stuckIncidents[p.stuckIncidents.length - 1]
      : p.stuckIncident;
  return Boolean(latest && latest.resolutionStatus !== 'RESOLVED');
}

/** شمارنده‌های نشان منو (یک منبع برای سایدبار، نوار پایین و پیشخوان) */
export function computeNavCounts(
  projects: Project[],
  tickets: Ticket[],
  materialRequests: MaterialRequest[]
): NavBadgeCounts {
  const openTickets = tickets.filter((t) => t.status === 'OPEN');
  const openWarehouseTicketCount = openTickets.filter(
    (t) => t.assignedRole === 'WAREHOUSE' || Boolean(t.referralNote)
  ).length;
  const pendingMaterials = materialRequests.filter(
    (r) =>
      r.status === 'SUBMITTED' ||
      r.status === 'IN_PROCUREMENT' ||
      (r.dispatches && r.dispatches.some((d) => !d.receivedAtSiteConfirmed))
  ).length;
  return {
    openTicketCount: openTickets.length,
    openStuckCount: projects.filter(isStuckOpen).length,
    pendingQcCount: projects.filter(isAwaitingQc).length,
    pendingMaterialCount: pendingMaterials + openWarehouseTicketCount,
  };
}
