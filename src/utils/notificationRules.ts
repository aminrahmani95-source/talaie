import type { MaterialRequest, Project, ScheduleChangeRequest, Ticket, User } from '../types';
import { isAwaitingQc } from './qcWorkflow';
import { formatJalali } from './jalali';

/**
 * Which changes deserve a phone notification, per role.
 * Pure: compares the previous and the new snapshot of the data and returns the events.
 * Changes this device made itself are filtered out by the caller (see notifications.ts).
 */

export interface NotifySnapshot {
  projects: Project[];
  tickets: Ticket[];
  materialRequests: MaterialRequest[];
  scheduleChangeRequests: ScheduleChangeRequest[];
}

export interface NotificationEvent {
  /** stable id: the same change never notifies twice */
  id: string;
  /** entity the event is about (used to skip this device's own edits) */
  entityKey: string;
  title: string;
  body: string;
  /** the tab to open when tapped (manager roles) */
  tab?: string;
  urgent?: boolean;
}

const MANAGER_ROLES = new Set(['QC_MANAGER', 'SCHEDULING_COORDINATOR']);
const FIELD_ROLES = new Set(['TECHNICIAN', 'LEAD_TECHNICIAN']);

export function isProjectMine(p: Project, user: Pick<User, 'id' | 'teamId'>): boolean {
  if ((p.assignedTechnicianIds || []).includes(user.id)) return true;
  if (p.leadTechnicianId === user.id) return true;
  return Boolean(
    user.teamId && p.assignedTeamId && p.assignedTeamId.toUpperCase() === String(user.teamId).toUpperCase(),
  );
}

const label = (p: Pick<Project, 'code' | 'title' | 'customerName'>) =>
  `${p.code ? `${p.code} · ` : ''}${p.title || p.customerName || ''}`;

const isWarehouseTicket = (t: Ticket) => t.assignedRole === 'WAREHOUSE' || Boolean(t.referralNote);

export function computeNotificationEvents(
  prev: NotifySnapshot,
  next: NotifySnapshot,
  user: Pick<User, 'id' | 'role' | 'teamId'>,
): NotificationEvent[] {
  const events: NotificationEvent[] = [];
  const role = user.role;
  const prevProjects = new Map(prev.projects.map((p) => [p.id, p]));
  const prevTickets = new Map(prev.tickets.map((t) => [t.id, t]));
  const prevMaterials = new Map(prev.materialRequests.map((m) => [m.id, m]));
  const prevSchedule = new Map(prev.scheduleChangeRequests.map((r) => [r.id, r]));

  // ---------------- projects ----------------
  for (const p of next.projects) {
    const before = prevProjects.get(p.id);
    const key = `project:${p.id}`;

    if (FIELD_ROLES.has(role)) {
      const mineNow = isProjectMine(p, user);
      const mineBefore = before ? isProjectMine(before, user) : false;
      const active = p.status !== 'COMPLETED' && p.status !== 'CANCELLED';
      if (mineNow && active && !mineBefore && p.scheduledDate) {
        events.push({
          id: `mission:${p.id}:${p.scheduledDate}`,
          entityKey: key,
          title: 'مأموریت جدید',
          body: `${label(p)} — ${formatJalali(p.scheduledDate)}`,
          urgent: true,
        });
      } else if (mineNow && mineBefore && active && before && before.scheduledDate !== p.scheduledDate && p.scheduledDate) {
        events.push({
          id: `resched:${p.id}:${p.scheduledDate}`,
          entityKey: key,
          title: 'تغییر تاریخ مأموریت',
          body: `${label(p)} — تاریخ جدید: ${formatJalali(p.scheduledDate)}`,
          urgent: true,
        });
      } else if (mineBefore && !mineNow && before && before.status !== 'COMPLETED') {
        events.push({
          id: `unassigned:${p.id}:${p.assignedTeamId || 'none'}`,
          entityKey: key,
          title: 'مأموریت از برنامه‌ی شما خارج شد',
          body: label(p),
        });
      }
      if (mineNow && p.qcStatus === 'REJECTED' && before && before.qcStatus !== 'REJECTED') {
        events.push({
          id: `qc-rejected:${p.id}:${p.updatedAt || ''}`,
          entityKey: key,
          title: 'کار شما در QC رد شد',
          body: `${label(p)} — نیاز به اصلاح دارد`,
          urgent: true,
        });
      }
      if (mineNow && p.status === 'CANCELLED' && before && before.status !== 'CANCELLED') {
        events.push({ id: `cancel:${p.id}`, entityKey: key, title: 'مأموریت لغو شد', body: label(p), urgent: true });
      }
    }

    if (MANAGER_ROLES.has(role)) {
      if (!before) {
        events.push({ id: `new-project:${p.id}`, entityKey: key, title: 'پروژه‌ی جدید ثبت شد', body: label(p), tab: 'control' });
        continue;
      }
      if (p.status === 'STUCK' && before.status !== 'STUCK') {
        const reason = p.stuckIncident?.description || p.stuckIncidents?.[p.stuckIncidents.length - 1]?.description;
        events.push({
          id: `stuck:${p.id}:${p.stuckIncidents?.length || 0}`,
          entityKey: key,
          title: 'توقف کار سر پروژه',
          body: `${label(p)}${reason ? ` — ${reason}` : ''}`,
          tab: 'stuck',
          urgent: true,
        });
      }
      if (isAwaitingQc(p) && !isAwaitingQc(before)) {
        events.push({
          id: `await-qc:${p.id}:${p.completedAt || ''}`,
          entityKey: key,
          title: 'کار تمام شد — منتظر QC',
          body: label(p),
          tab: 'qc',
        });
      }
    }

    if (role === 'WAREHOUSE' && before && p.status === 'SCHEDULED' && before.status !== 'SCHEDULED' && p.scheduledDate) {
      events.push({
        id: `pack:${p.id}:${p.scheduledDate}`,
        entityKey: key,
        title: 'بار جدید برای بسته‌بندی',
        body: `${label(p)} — اعزام ${formatJalali(p.scheduledDate)}`,
      });
    }
  }

  // ---------------- tickets ----------------
  for (const t of next.tickets) {
    if (t.status !== 'OPEN') {
      // ticket closed: tell the field team whose job it was about
      const before = prevTickets.get(t.id);
      if (FIELD_ROLES.has(role) && before && before.status === 'OPEN') {
        const p = next.projects.find((x) => x.id === t.projectId);
        if (p && isProjectMine(p, user)) {
          events.push({
            id: `ticket-done:${t.id}`,
            entityKey: `ticket:${t.id}`,
            title: 'تیکت شما رسیدگی شد',
            body: `${t.projectCode || ''} — ${t.description}`,
          });
        }
      }
      continue;
    }
    const before = prevTickets.get(t.id);
    const key = `ticket:${t.id}`;
    if (MANAGER_ROLES.has(role) && !before) {
      events.push({
        id: `ticket:${t.id}`,
        entityKey: key,
        title: t.isBlocking ? 'تیکت مسدودکننده' : 'تیکت جدید',
        body: `${t.projectCode || ''} — ${t.description}`,
        tab: 'tickets',
        urgent: Boolean(t.isBlocking),
      });
    }
    if (role === 'WAREHOUSE' && isWarehouseTicket(t) && !(before && isWarehouseTicket(before))) {
      events.push({
        id: `wh-ticket:${t.id}`,
        entityKey: key,
        title: 'ارجاع فوری به انبار',
        body: `${t.projectCode || ''} — ${t.referralNote || t.description}`,
        urgent: true,
      });
    }
  }

  // ---------------- material requests ----------------
  for (const m of next.materialRequests) {
    const before = prevMaterials.get(m.id);
    const key = `material:${m.id}`;
    if (!before && m.status === 'SUBMITTED' && (role === 'WAREHOUSE' || MANAGER_ROLES.has(role))) {
      events.push({
        id: `material:${m.id}`,
        entityKey: key,
        title: m.urgency === 'CRITICAL_BLOCKING' ? 'درخواست متریال بحرانی' : 'درخواست متریال جدید',
        body: `${m.projectCode || ''} — ${m.items.map((i) => i.title).join('، ')}`,
        tab: 'materials',
        urgent: m.urgency !== 'NORMAL',
      });
    }
    if (FIELD_ROLES.has(role) && before && (m.dispatches?.length || 0) > (before.dispatches?.length || 0)) {
      const p = next.projects.find((x) => x.id === m.projectId);
      if (m.requestedByUserId === user.id || (p && isProjectMine(p, user))) {
        events.push({
          id: `dispatch:${m.id}:${m.dispatches?.length}`,
          entityKey: key,
          title: 'متریال برای شما ارسال شد',
          body: `${m.projectCode || ''} — ${m.items.map((i) => i.title).join('، ')}`,
        });
      }
    }
  }

  // ---------------- schedule change requests ----------------
  if (MANAGER_ROLES.has(role)) {
    for (const r of next.scheduleChangeRequests) {
      if (!prevSchedule.has(r.id) && r.status === 'PENDING') {
        events.push({
          id: `sched-req:${r.id}`,
          entityKey: `schedule:${r.id}`,
          title: 'درخواست تغییر برنامه',
          body: `${r.projectCode || ''} — ${r.customerName || ''}`,
          tab: 'planner',
        });
      }
    }
  }

  return events;
}
