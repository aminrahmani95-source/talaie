import type { Project, StuckIncident } from '../types';
import { stuckIncidentsOf } from './projectsReport';

/**
 * وقتی مدیر وضعیت پروژه‌ی متوقف را از جای دیگری (برگه‌ی مدیریت، تغییر دستی، تأیید QC) عوض می‌کند،
 * آخرین توقف باز هم بسته شود؛ وگرنه نشان «متوقف» و ردیف پیشخوان می‌ماند.
 * اگر توقف بازی نیست یا وضعیت جدید هنوز STUCK است، چیزی برنمی‌گرداند.
 */
export function autoResolveStuckPatch(
  project: Project,
  newStatus: string | undefined,
  resolvedBy: string,
  note: string,
  nowIso: string = new Date().toISOString()
): Partial<Project> | null {
  if (!newStatus || newStatus === 'STUCK') return null;
  const list = stuckIncidentsOf(project);
  const last = list[list.length - 1];
  if (!last || last.resolutionStatus === 'RESOLVED') return null;
  const resolved: StuckIncident = {
    ...last,
    resolutionStatus: 'RESOLVED',
    resolvedAt: nowIso,
    resolvedBy,
    resolutionNote: note,
  };
  return {
    stuckIncident: resolved,
    stuckIncidents: list.map((inc, i) => (i === list.length - 1 ? resolved : inc)),
  };
}
