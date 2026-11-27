import type { InstallationTeam, MaterialRequest, Project, Ticket, User } from '../types';

/**
 * هماهنگ‌کننده‌ی جدا (SCHEDULING_COORDINATOR) فقط با اکیپ‌های خودش کار می‌کند.
 *
 * - کدام اکیپ مال کیست: `InstallationTeam.coordinatorId` (مدیر QC در تنظیمات تعیین می‌کند).
 * - هماهنگ‌کننده فقط پروژه‌هایی را می‌بیند که `assignedTeamId` آن‌ها یکی از اکیپ‌های خودش است،
 *   و فقط تیکت‌ها و درخواست‌های متریال همان پروژه‌ها را.
 * - صفحه‌ها: پیشخوان، تقویم، QC، موانع، وضعیت انبار (فقط دیدن)، رزروهای فروش (دیدن).
 *
 * سرور همین قاعده را اجرا می‌کند (مایگریشن ۰۲۸)؛ این‌جا فقط نمایش و جلوگیری زودهنگام است.
 */

export const isCoordinatorRole = (user?: Pick<User, 'role'> | null): boolean =>
  user?.role === 'SCHEDULING_COORDINATOR';

/** صفحه‌هایی که هماهنگ‌کننده دارد */
export const COORDINATOR_TABS = ['control', 'planner', 'qc', 'issues', 'materials', 'sales'] as const;

export function isTabAllowedForCoordinator(tab: string): boolean {
  return (COORDINATOR_TABS as readonly string[]).includes(tab) || tab === 'stuck' || tab === 'tickets';
}

/** اکیپ فعال است مگر صریحاً غیرفعال شده باشد */
export const isTeamActive = (team: Pick<InstallationTeam, 'active'>): boolean => team.active !== false;

/** شناسه‌ی اکیپ‌های هماهنگ‌کننده؛ برای بقیه‌ی نقش‌ها null (یعنی محدودیتی نیست) */
export function coordinatorTeamIds(
  user: Pick<User, 'id' | 'role'> | null | undefined,
  teams: Array<Pick<InstallationTeam, 'id' | 'coordinatorId'>>
): Set<string> | null {
  if (!isCoordinatorRole(user)) return null;
  return new Set(teams.filter((t) => t.coordinatorId && t.coordinatorId === user!.id).map((t) => t.id));
}

export function isProjectInScope(project: Pick<Project, 'assignedTeamId'> | null | undefined, ids: Set<string> | null): boolean {
  if (!ids) return true;
  return Boolean(project?.assignedTeamId && ids.has(project.assignedTeamId));
}

export function scopeProjects<T extends Pick<Project, 'assignedTeamId'>>(projects: T[], ids: Set<string> | null): T[] {
  if (!ids) return projects;
  return projects.filter((p) => isProjectInScope(p, ids));
}

export function scopeByProject<T extends { projectId?: string }>(items: T[], visibleProjectIds: Set<string> | null): T[] {
  if (!visibleProjectIds) return items;
  return items.filter((i) => Boolean(i.projectId && visibleProjectIds.has(i.projectId)));
}

export const scopeTickets = (tickets: Ticket[], ids: Set<string> | null) => scopeByProject(tickets, ids);
export const scopeMaterialRequests = (reqs: MaterialRequest[], ids: Set<string> | null) => scopeByProject(reqs, ids);

/** پیام‌های یکسان برای رد کار خارج از محدوده */
export const COORDINATOR_SCOPE_MESSAGE = 'این پروژه به اکیپ‌های شما سپرده نشده است؛ فقط پروژه‌های اکیپ‌های خودتان را می‌توانید تغییر دهید.';
export const COORDINATOR_TEAM_REQUIRED_MESSAGE = 'پروژه باید به یکی از اکیپ‌های خودتان سپرده شود.';
export const COORDINATOR_READONLY_MESSAGE = 'این بخش برای شما فقط قابل دیدن است.';
