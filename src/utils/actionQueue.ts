import type { Project, SalesProjectBooking, Ticket } from '../types';
import { isAwaitingQc } from './qcWorkflow';
import { isStuckOpen } from './navCounts';

export type ActionKind = 'STUCK' | 'TICKET' | 'INCOMING' | 'QC' | 'BOOKING' | 'OVERDUE';

/** گروه‌های پیشخوان: موانع، QC، برنامه‌ریزی */
export type ActionGroup = 'ISSUES' | 'QC' | 'PLAN';
export const ACTION_GROUP: Record<ActionKind, ActionGroup> = {
  STUCK: 'ISSUES',
  TICKET: 'ISSUES',
  QC: 'QC',
  OVERDUE: 'PLAN',
  INCOMING: 'PLAN',
  BOOKING: 'PLAN',
};

export interface ActionItem {
  kind: ActionKind;
  key: string;
  project?: Project;
  /** a sales booking that is not yet a project (BOOKING items) */
  booking?: SalesProjectBooking;
  /** open tickets of this project (for STUCK and TICKET items) */
  tickets: Ticket[];
}

const isClosed = (p: Project) => p.status === 'COMPLETED' || p.status === 'CANCELLED';

/** a new job that still needs a team or a date (or its second measurement) */
export function needsScheduling(p: Project): boolean {
  if (isAwaitingQc(p) || isClosed(p) || isStuckOpen(p)) return false;
  return p.status === 'MEASUREMENT_PENDING' || !p.assignedTeamId || !p.scheduledDate;
}

/**
 * کاری که تاریخش گذشته ولی اکیپ هیچ‌وقت راه نیفتاده (یا در مسیر مانده): هیچ‌جا دیده نمی‌شد،
 * چون تقویم از امروز شروع می‌شود.
 */
export function isOverdueUnstarted(p: Project, todayKey: string = dayKeyAfter(0)): boolean {
  if (p.status !== 'SCHEDULED' && p.status !== 'EN_ROUTE') return false;
  if (!p.scheduledDate) return false;
  const last = p.endDate && p.endDate > p.scheduledDate ? p.endDate : p.scheduledDate;
  return last < todayKey;
}

/** bookings for the next few days are action items; later ones wait in the calendar */
export const BOOKING_ACTION_DAYS = 3;

function dayKeyAfter(days: number, from: Date = new Date()): string {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + days);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** requested for today, the next couple of days, or already overdue (or no date at all) */
export function isBookingDueSoon(b: SalesProjectBooking, now: Date = new Date()): boolean {
  if (!b.requestedDate) return true;
  return b.requestedDate < dayKeyAfter(BOOKING_ACTION_DAYS, now);
}

/** a sales booking the manager still has to turn into a scheduled project */
export function isBookingAwaitingAssignment(b: SalesProjectBooking, projects: Project[]): boolean {
  if (!b.convertedToProjectId) return true;
  return !projects.some((p) => p.id === b.convertedToProjectId);
}

/**
 * The manager's action queue: one row per project, so a stuck job and the
 * shortage ticket that stopped it no longer show up as two separate cards.
 * Order = urgency: stopped work, open tickets, jobs waiting for QC, new jobs.
 */
export function buildActionQueue(
  projects: Project[],
  tickets: Ticket[],
  bookings: SalesProjectBooking[] = [],
): ActionItem[] {
  const openTickets = tickets.filter((t) => t.status === 'OPEN');
  const ticketsByProject = new Map<string, Ticket[]>();
  for (const t of openTickets) {
    const list = ticketsByProject.get(t.projectId) || [];
    list.push(t);
    ticketsByProject.set(t.projectId, list);
  }
  const sortTickets = (list: Ticket[]) =>
    [...list].sort((a, b) => Number(Boolean(b.isBlocking)) - Number(Boolean(a.isBlocking)));

  const items: ActionItem[] = [];
  const used = new Set<string>();

  for (const p of projects.filter(isStuckOpen)) {
    items.push({ kind: 'STUCK', key: `stuck-${p.id}`, project: p, tickets: sortTickets(ticketsByProject.get(p.id) || []) });
    used.add(p.id);
  }

  const projectById = new Map(projects.map((p) => [p.id, p]));
  // تیکت پروژه‌ی حذف‌شده ردیف بی‌صاحب می‌ساخت؛ فقط تیکت‌های پروژه‌های موجود
  const ticketGroups = [...ticketsByProject.entries()]
    .filter(([projectId]) => !used.has(projectId) && projectById.has(projectId))
    .map(([projectId, list]) => ({ projectId, list: sortTickets(list) }))
    .sort((a, b) => Number(Boolean(b.list[0]?.isBlocking)) - Number(Boolean(a.list[0]?.isBlocking)));
  for (const g of ticketGroups) {
    items.push({ kind: 'TICKET', key: `ticket-${g.projectId}`, project: projectById.get(g.projectId), tickets: g.list });
    used.add(g.projectId);
  }

  // هر پروژه فقط یک ردیف (قبلاً پروژه‌ی دارای تیکت دوباره به‌عنوان QC یا کار جدید هم می‌آمد)
  for (const p of projects.filter((x) => isAwaitingQc(x) && !used.has(x.id))) {
    items.push({ kind: 'QC', key: `qc-${p.id}`, project: p, tickets: [] });
    used.add(p.id);
  }

  const todayKey = dayKeyAfter(0);
  for (const p of projects.filter((x) => !used.has(x.id) && isOverdueUnstarted(x, todayKey))) {
    items.push({ kind: 'OVERDUE', key: `late-${p.id}`, project: p, tickets: [] });
    used.add(p.id);
  }

  for (const p of projects.filter((x) => needsScheduling(x) && !used.has(x.id))) {
    items.push({ kind: 'INCOMING', key: `in-${p.id}`, project: p, tickets: [] });
    used.add(p.id);
  }

  // sold by a sales rep, waiting for the manager to give it a team and a date. Only the ones due
  // in the next few days are listed: with weeks of bookings the queue was all bookings and the
  // real problems (stops, tickets) got lost below them. Later ones are summed up on the dashboard.
  const waiting = bookings
    .filter((b) => isBookingAwaitingAssignment(b, projects) && isBookingDueSoon(b))
    .sort((a, b) => (a.requestedDate || '').localeCompare(b.requestedDate || ''));
  for (const b of waiting) {
    items.push({ kind: 'BOOKING', key: `booking-${b.id}`, booking: b, tickets: [] });
  }

  return items;
}
