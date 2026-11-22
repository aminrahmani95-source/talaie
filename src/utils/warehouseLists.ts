import type { Project } from '../types';

/**
 * Jobs whose load the warehouse still has to pack: scheduled ones, plus multi-day
 * jobs in progress that continue today or later. Soonest first.
 * Shared by the warehouse desk list and the material-center badge so both show the same number.
 */
export function getUpcomingDispatchProjects(projects: Project[], todayKey: string): Project[] {
  return projects
    .filter(
      (p) =>
        p.status === 'SCHEDULED' ||
        (p.status === 'IN_PROGRESS' && Boolean(p.endDate) && String(p.endDate) >= todayKey),
    )
    .sort((a, b) => String(a.scheduledDate || '').localeCompare(String(b.scheduledDate || '')));
}
