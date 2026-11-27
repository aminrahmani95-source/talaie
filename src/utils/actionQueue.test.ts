import { describe, expect, it } from 'vitest';
import { buildActionQueue, isBookingAwaitingAssignment } from './actionQueue';
import type { Project, SalesProjectBooking, Ticket } from '../types';

const proj = (id: string, extra: Partial<Project> = {}) =>
  ({ id, code: id, title: id, status: 'SCHEDULED', assignedTeamId: 'T1', scheduledDate: '2026-12-01', ...extra }) as Project;
const ticket = (id: string, projectId: string, extra: Partial<Ticket> = {}) =>
  ({ id, projectId, projectCode: projectId, status: 'OPEN', description: id, ...extra }) as Ticket;

describe('buildActionQueue', () => {
  it('shows a stuck project and its tickets as a single row', () => {
    const q = buildActionQueue(
      [proj('P1', { status: 'STUCK' })],
      [ticket('t1', 'P1', { isBlocking: true }), ticket('t2', 'P1')],
    );
    expect(q).toHaveLength(1);
    expect(q[0].kind).toBe('STUCK');
    expect(q[0].tickets.map((t) => t.id)).toEqual(['t1', 't2']);
  });

  it('groups tickets of a running project and orders by urgency', () => {
    const q = buildActionQueue(
      [
        proj('NEW', { assignedTeamId: undefined }),
        proj('QC', { status: 'COMPLETED', qcStatus: 'PENDING' } as Partial<Project>),
        proj('RUN', { status: 'IN_PROGRESS' }),
        proj('STK', { status: 'STUCK' }),
      ],
      [ticket('a', 'RUN'), ticket('b', 'RUN'), ticket('closed', 'NEW', { status: 'RESOLVED' } as Partial<Ticket>)],
    );
    expect(q.map((i) => i.kind)).toEqual(['STUCK', 'TICKET', 'QC', 'INCOMING']);
    expect(q[1].tickets).toHaveLength(2);
  });

  it('does not list a stuck job again as a new job needing scheduling', () => {
    const q = buildActionQueue([proj('S', { status: 'STUCK', assignedTeamId: undefined })], []);
    expect(q.map((i) => i.kind)).toEqual(['STUCK']);
  });

  it('lists sales bookings that are not yet a project, after the jobs', () => {
    const booking = (id: string, extra: Record<string, unknown> = {}) =>
      ({ id, customerName: id, lathsCount: 10, requestedDate: today, jalaliDate: '1405/09/14', ...extra }) as never;
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const q = buildActionQueue(
      [proj('NEW', { assignedTeamId: undefined })],
      [],
      [
        booking('B-WAIT'),
        booking('B-DONE', { convertedToProjectId: 'NEW' }),
        booking('B-GONE', { convertedToProjectId: 'DELETED' }),
        booking('B-LATER', { requestedDate: '2999-01-01' }), // weeks away: summed up, not listed
      ],
    );
    expect(q.map((i) => i.key)).toEqual(['in-NEW', 'booking-B-WAIT', 'booking-B-GONE']);
  });
});

import { computeProjectDiff } from './offlineQueue';
import { isOverdueUnstarted } from './actionQueue';

describe('dashboard audit fixes', () => {
  it('lists each project only once and drops tickets of deleted projects', () => {
    const q = buildActionQueue(
      [
        proj('T+NEW', { assignedTeamId: undefined }),
        proj('T+QC', { status: 'COMPLETED', qcStatus: 'PENDING' } as Partial<Project>),
        proj('DONE-STUCK', { status: 'COMPLETED', qcStatus: 'PENDING', stuckIncidents: [{ id: 's', resolutionStatus: 'OPEN' }] } as any),
      ],
      [ticket('a', 'T+NEW'), ticket('b', 'T+QC'), ticket('orphan', 'GONE')],
    );
    expect(q.map((i) => `${i.kind}:${i.project?.id}`)).toEqual(['TICKET:T+NEW', 'TICKET:T+QC', 'QC:DONE-STUCK']);
  });

  it('flags scheduled jobs whose date passed without starting', () => {
    expect(isOverdueUnstarted(proj('L', { scheduledDate: '2026-11-01' }), '2026-11-26')).toBe(true);
    expect(isOverdueUnstarted(proj('M', { scheduledDate: '2026-11-20', endDate: '2026-11-30' }), '2026-11-26')).toBe(false);
    expect(isOverdueUnstarted(proj('R', { scheduledDate: '2026-11-01', status: 'IN_PROGRESS' }), '2026-11-26')).toBe(false);
  });

  it('sends null for cleared fields so the server clears them too', () => {
    const orig = proj('P', { endDate: '2026-12-03', customerPhone: '0912' } as Partial<Project>);
    const diff = computeProjectDiff(orig, { endDate: undefined, customerPhone: '', address: '' } as Partial<Project>);
    expect(diff).toEqual({ endDate: null, customerPhone: null });
  });
});

describe('sales bookings already placed by another manager', () => {
  const booking = (id: string, extra: Partial<SalesProjectBooking> = {}) =>
    ({ id, customerName: id, requestedDate: '2000-01-01', createdAt: '2026-11-01', ...extra }) as SalesProjectBooking;
  const linked = booking('B1', { convertedToProjectId: 'P-QC-TEAM' });
  const free = booking('B2');

  it('the QC manager (sees every project) gets a booking back only when its project is gone', () => {
    expect(isBookingAwaitingAssignment(linked, [proj('P-QC-TEAM')])).toBe(false);
    expect(isBookingAwaitingAssignment(linked, [])).toBe(true);
    expect(isBookingAwaitingAssignment(free, [])).toBe(true);
  });

  it('the coordinator does not see a booking placed with a team outside his list as unscheduled', () => {
    // his project list holds only his own teams' jobs, so P-QC-TEAM is not in it
    expect(isBookingAwaitingAssignment(linked, [], false)).toBe(false);
    expect(isBookingAwaitingAssignment(free, [], false)).toBe(true);
    const q = buildActionQueue([], [], [linked, free], false);
    expect(q.filter((i) => i.kind === 'BOOKING').map((i) => i.booking?.id)).toEqual(['B2']);
  });
});
