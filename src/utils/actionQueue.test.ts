import { describe, expect, it } from 'vitest';
import { buildActionQueue } from './actionQueue';
import type { Project, Ticket } from '../types';

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
      ({ id, customerName: id, lathsCount: 10, requestedDate: '2026-12-05', jalaliDate: '1405/09/14', ...extra }) as never;
    const q = buildActionQueue(
      [proj('NEW', { assignedTeamId: undefined })],
      [],
      [booking('B-WAIT'), booking('B-DONE', { convertedToProjectId: 'NEW' }), booking('B-GONE', { convertedToProjectId: 'DELETED' })],
    );
    expect(q.map((i) => i.key)).toEqual(['in-NEW', 'booking-B-WAIT', 'booking-B-GONE']);
  });
});
