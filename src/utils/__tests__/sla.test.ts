import { describe, it, expect } from 'vitest';
import {
  getTicketSlaStatus,
  getRemainingSlaHours,
  getElapsedHours,
  computeSlaMetrics,
  SLA_MS_LIMIT,
} from '../sla';
import { Ticket } from '../../types';

describe('72-Hour SLA Management Engine (Task 3 & 8)', () => {
  const baseTime = new Date('2026-11-01T10:00:00Z').getTime();

  const makeTicket = (
    id: string,
    createdAtOffsetHours: number,
    status: 'OPEN' | 'RESOLVED',
    resolvedAtOffsetHours?: number,
    category?: any,
    assignedTeamId?: string
  ): Ticket => {
    const createdMs = baseTime + createdAtOffsetHours * 60 * 60 * 1000;
    const resolvedMs =
      resolvedAtOffsetHours !== undefined
        ? baseTime + resolvedAtOffsetHours * 60 * 60 * 1000
        : undefined;

    return {
      id,
      projectId: 'proj-1',
      projectCode: 'T-100',
      projectTitle: 'پروژه تست',
      authorId: 'u-1',
      authorName: 'تکنسین ۱',
      type: 'WALL_ISSUE',
      category: category || 'WALL_ISSUE',
      description: 'نقص فیزیکی بستر',
      photos: [],
      status,
      assignedTeamId,
      assignedTeamName: assignedTeamId ? `اکیپ ${assignedTeamId}` : undefined,
      createdAt: new Date(createdMs).toISOString(),
      resolvedAt: resolvedMs ? new Date(resolvedMs).toISOString() : undefined,
    };
  };

  it('correctly classifies OPEN ticket within 72 hours as OPEN_IN_SLA', () => {
    // Ticket created 20 hours ago
    const ticket = makeTicket('t-1', -20, 'OPEN');
    const status = getTicketSlaStatus(ticket, baseTime);
    expect(status).toBe('OPEN_IN_SLA');

    const remaining = getRemainingSlaHours(ticket, baseTime);
    expect(remaining).toBe(52); // 72 - 20 = 52 hours
  });

  it('correctly classifies OPEN ticket beyond 72 hours as OPEN_OVERDUE (does not disappear)', () => {
    // Ticket created 80 hours ago
    const ticket = makeTicket('t-2', -80, 'OPEN');
    const status = getTicketSlaStatus(ticket, baseTime);
    expect(status).toBe('OPEN_OVERDUE');

    const remaining = getRemainingSlaHours(ticket, baseTime);
    expect(remaining).toBe(-8); // 8 hours overdue
  });

  it('correctly classifies RESOLVED ticket within 72 hours as RESOLVED_IN_SLA', () => {
    // Created 50 hours ago, resolved 10 hours ago (took 40 hours)
    const ticket = makeTicket('t-3', -50, 'RESOLVED', -10);
    const status = getTicketSlaStatus(ticket, baseTime);
    expect(status).toBe('RESOLVED_IN_SLA');

    const duration = getElapsedHours(ticket, baseTime);
    expect(duration).toBe(40);
  });

  it('correctly classifies RESOLVED ticket after 72 hours as RESOLVED_OVERDUE', () => {
    // Created 100 hours ago, resolved 10 hours ago (took 90 hours)
    const ticket = makeTicket('t-4', -100, 'RESOLVED', -10);
    const status = getTicketSlaStatus(ticket, baseTime);
    expect(status).toBe('RESOLVED_OVERDUE');

    const duration = getElapsedHours(ticket, baseTime);
    expect(duration).toBe(90);
  });

  it('preserves SLA calculations when ticket is reassigned to another team without resetting createdAt', () => {
    const ticket = makeTicket('t-5', -75, 'OPEN', undefined, 'MEASUREMENT_ERROR', 'team-1');
    expect(getTicketSlaStatus(ticket, baseTime)).toBe('OPEN_OVERDUE');

    // Reassigned to team-2 with action history
    const reassignedTicket: Ticket = {
      ...ticket,
      assignedTeamId: 'team-2',
      assignedTeamName: 'اکیپ نصب ۲',
      actionHistory: [
        {
          id: 'act-1',
          timestamp: new Date(baseTime).toISOString(),
          action: 'REASSIGNED',
          byUserId: 'u-mgr',
          byUserName: 'مدیر',
          note: 'ارجاع به اکیپ تخصصی',
        },
      ],
    };

    // SLA must still count from the original createdAt and remain OPEN_OVERDUE
    expect(getTicketSlaStatus(reassignedTicket, baseTime)).toBe('OPEN_OVERDUE');
  });

  it('computes accurate compliance rate including open overdue incidents in the denominator', () => {
    const tickets: Ticket[] = [
      makeTicket('t-1', -10, 'RESOLVED', -2, 'PRODUCTION_DEFECT', 'team-1'), // resolved in SLA (took 8h)
      makeTicket('t-2', -60, 'RESOLVED', -10, 'PRODUCTION_DEFECT', 'team-1'), // resolved in SLA (took 50h)
      makeTicket('t-3', -90, 'RESOLVED', -10, 'SITE_NOT_READY', 'team-2'), // resolved overdue (took 80h)
      makeTicket('t-4', -100, 'OPEN', undefined, 'WAREHOUSE_DELIVERY_ISSUE', 'team-2'), // open overdue (100h)
      makeTicket('t-5', -10, 'OPEN', undefined, 'TRANSIT_DAMAGE', 'team-1'), // open in SLA (not overdue yet)
    ];

    const metrics = computeSlaMetrics(tickets, baseTime);

    expect(metrics.totalTickets).toBe(5);
    expect(metrics.openInSla).toBe(1);
    expect(metrics.openOverdue).toBe(1);
    expect(metrics.resolvedInSla).toBe(2);
    expect(metrics.resolvedOverdue).toBe(1);

    // Accountable total = resolvedInSla (2) + resolvedOverdue (1) + openOverdue (1) = 4
    // Compliance rate = 2 / 4 = 50%
    expect(metrics.onTimeRate).toBe(50);

    // Average resolution hours of resolved tickets: (8 + 50 + 80) / 3 = 46.0
    expect(metrics.averageResolutionHours).toBe(46);

    // Team breakdown
    expect(metrics.breakdownByTeam['team-1'].total).toBe(3);
    expect(metrics.breakdownByTeam['team-1'].overdue).toBe(0);
    expect(metrics.breakdownByTeam['team-1'].onTimeRate).toBe(100);

    expect(metrics.breakdownByTeam['team-2'].total).toBe(2);
    expect(metrics.breakdownByTeam['team-2'].overdue).toBe(2);
    expect(metrics.breakdownByTeam['team-2'].onTimeRate).toBe(0);
  });
});
