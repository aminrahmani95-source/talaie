import { describe, expect, it } from 'vitest';
import { computeNotificationEvents, type NotifySnapshot } from './notificationRules';
import type { MaterialRequest, Project, Ticket, User } from '../types';

const empty: NotifySnapshot = { projects: [], tickets: [], materialRequests: [], scheduleChangeRequests: [] };
const snap = (s: Partial<NotifySnapshot>): NotifySnapshot => ({ ...empty, ...s });
const proj = (id: string, extra: Partial<Project> = {}) =>
  ({ id, code: id, title: `t-${id}`, status: 'SCHEDULED', scheduledDate: '2026-12-01', ...extra }) as Project;
const tech = { id: 'u1', role: 'LEAD_TECHNICIAN', teamId: 'TEAM_1' } as Pick<User, 'id' | 'role' | 'teamId'>;
const qc = { id: 'q1', role: 'QC_MANAGER' } as Pick<User, 'id' | 'role' | 'teamId'>;
const wh = { id: 'w1', role: 'WAREHOUSE' } as Pick<User, 'id' | 'role' | 'teamId'>;
const titles = (e: { title: string }[]) => e.map((x) => x.title);

describe('notification rules', () => {
  it('tells a team about a new mission, a date change and a QC rejection', () => {
    const before = snap({ projects: [proj('P1')] });
    const assigned = snap({ projects: [proj('P1', { assignedTeamId: 'TEAM_1' })] });
    expect(titles(computeNotificationEvents(before, assigned, tech))).toEqual(['مأموریت جدید']);

    const moved = snap({ projects: [proj('P1', { assignedTeamId: 'TEAM_1', scheduledDate: '2026-12-03' })] });
    expect(titles(computeNotificationEvents(assigned, moved, tech))).toEqual(['تغییر تاریخ مأموریت']);

    const done = snap({ projects: [proj('P1', { assignedTeamId: 'TEAM_1', status: 'COMPLETED', qcStatus: 'PENDING' } as Partial<Project>)] });
    const rejected = snap({ projects: [proj('P1', { assignedTeamId: 'TEAM_1', status: 'COMPLETED', qcStatus: 'REJECTED' } as Partial<Project>)] });
    expect(titles(computeNotificationEvents(done, rejected, tech))).toEqual(['کار شما در QC رد شد']);
  });

  it('ignores other teams’ missions', () => {
    const before = snap({ projects: [proj('P1')] });
    const other = snap({ projects: [proj('P1', { assignedTeamId: 'TEAM_2' })] });
    expect(computeNotificationEvents(before, other, tech)).toEqual([]);
  });

  it('tells the QC manager about stopped work, finished jobs and new tickets', () => {
    const running = snap({ projects: [proj('P1', { status: 'IN_PROGRESS' })] });
    const stuck = snap({ projects: [proj('P1', { status: 'STUCK' })] });
    expect(titles(computeNotificationEvents(running, stuck, qc))).toEqual(['توقف کار سر پروژه']);

    const finished = snap({ projects: [proj('P1', { status: 'COMPLETED', qcStatus: 'PENDING' } as Partial<Project>)] });
    expect(titles(computeNotificationEvents(running, finished, qc))).toEqual(['کار تمام شد — منتظر QC']);

    const t = { id: 'T1', projectId: 'P1', projectCode: 'P1', status: 'OPEN', description: 'x', isBlocking: true } as Ticket;
    expect(titles(computeNotificationEvents(running, { ...running, tickets: [t] }, qc))).toEqual(['تیکت مسدودکننده']);
  });

  it('tells the warehouse about material requests and referrals', () => {
    const m = { id: 'M1', projectId: 'P1', projectCode: 'P1', status: 'SUBMITTED', urgency: 'URGENT', items: [{ title: 'براکت' }] } as unknown as MaterialRequest;
    expect(titles(computeNotificationEvents(empty, snap({ materialRequests: [m] }), wh))).toEqual(['درخواست متریال جدید']);

    const t = { id: 'T1', projectId: 'P1', projectCode: 'P1', status: 'OPEN', description: 'x' } as Ticket;
    const referred = { ...t, assignedRole: 'WAREHOUSE', referralNote: 'ارسال کن' } as Ticket;
    expect(titles(computeNotificationEvents(snap({ tickets: [t] }), snap({ tickets: [referred] }), wh))).toEqual(['ارجاع فوری به انبار']);
  });

  it('gives each change a stable id so it is announced only once', () => {
    const a = computeNotificationEvents(snap({ projects: [proj('P1')] }), snap({ projects: [proj('P1', { assignedTeamId: 'TEAM_1' })] }), tech);
    const b = computeNotificationEvents(snap({ projects: [proj('P1')] }), snap({ projects: [proj('P1', { assignedTeamId: 'TEAM_1' })] }), tech);
    expect(a[0].id).toBe(b[0].id);
  });

  it('passes work along between roles: goods in, measurement, bookings, schedule answers', () => {
    const waiting = snap({ projects: [proj('P1', { status: 'MEASUREMENT_PENDING', assignedTeamId: undefined, technicalHandover: { isHandoverComplete: false, warehouseConfirmation: { confirmed: false } } } as Partial<Project>)] });
    const goodsIn = snap({ projects: [proj('P1', { status: 'MEASUREMENT_PENDING', assignedTeamId: undefined, technicalHandover: { isHandoverComplete: true, warehouseConfirmation: { confirmed: true } } } as Partial<Project>)] });
    expect(titles(computeNotificationEvents(waiting, goodsIn, qc))).toEqual(['کالا به انبار رسید']);

    const measurer = { id: 'm1', role: 'MEASUREMENT_LEAD' } as Pick<User, 'id' | 'role' | 'teamId'>;
    expect(titles(computeNotificationEvents(empty, waiting, measurer))).toEqual(['بازدید اندازه‌گیری جدید']);
    expect(titles(computeNotificationEvents(empty, waiting, wh))).toEqual(['پروژه‌ی جدید — منتظر ورود کالا']);

    const booking = { id: 'B1', customerName: 'c', lathsCount: 8, jalaliDate: '1405/09/14', salesRepId: 's1', salesRepName: 'S', createdAt: new Date().toISOString() } as never;
    const withBooking = snap({ salesBookings: [booking] });
    expect(titles(computeNotificationEvents(snap({ salesBookings: [] }), withBooking, qc))).toEqual(['رزرو فروش جدید']);
    const rep = { id: 's1', role: 'SALES_REP' } as Pick<User, 'id' | 'role' | 'teamId'>;
    const converted = snap({ salesBookings: [{ ...(booking as object), convertedToProjectId: 'P1' } as never] });
    expect(titles(computeNotificationEvents(withBooking, converted, rep))).toEqual(['رزرو شما وارد برنامه‌ی نصب شد']);

    const req = { id: 'R1', projectCode: 'P1', requestedByUserId: 'c1', status: 'PENDING' } as never;
    const coord = { id: 'c1', role: 'SCHEDULING_COORDINATOR' } as Pick<User, 'id' | 'role' | 'teamId'>;
    const answered = snap({ scheduleChangeRequests: [{ ...(req as object), status: 'APPROVED' } as never] });
    expect(titles(computeNotificationEvents(snap({ scheduleChangeRequests: [req] }), answered, coord))).toEqual(['درخواست تغییر برنامه تایید شد']);
  });
});
