import { describe, expect, it } from 'vitest';
import type { Project } from '../types';
import { buildProjectReport, reportToCsv, summarizeReport, toReportRow } from './projectsReport';

const p = (over: Partial<Project>): Project =>
  ({
    id: Math.random().toString(36),
    code: 'PRJ',
    title: 't',
    status: 'SCHEDULED',
    qcStatus: 'NOT_STARTED',
    shadePanels: 4,
    railCount: 2,
    curtainPanels: 0,
    assignedTeamId: 'T1',
    assignedTeamName: 'اکیپ ۱',
    ...over,
  }) as Project;

describe('projects report', () => {
  const done = p({ status: 'COMPLETED', scheduledDate: '2026-11-20', completedAt: '2026-11-20T15:00:00', qcStatus: 'APPROVED', customerSatisfaction: 5 });
  const late = p({ status: 'COMPLETED', scheduledDate: '2026-11-18', endDate: '2026-11-19', completedAt: '2026-11-21T10:00:00', qcStatus: 'REJECTED', assignedTeamId: 'T2', assignedTeamName: 'اکیپ ۲' });
  const stuck = p({
    status: 'STUCK',
    scheduledDate: '2026-11-22',
    stuckIncidents: [{ id: 's', stuckAt: '2026-11-22T10:00:00Z', category: 'FABRIC_SHORTAGE', description: 'پارچه کم' } as any],
  });
  const planned = p({ status: 'SCHEDULED', scheduledDate: '2026-11-28' });
  const old = p({ status: 'COMPLETED', scheduledDate: '2026-10-01', completedAt: '2026-10-01T10:00:00' });
  const noDate = p({ status: 'MEASUREMENT_PENDING', scheduledDate: '' });
  const all = [done, late, stuck, planned, old, noDate];

  it('filters by execution window, group, team and search', () => {
    const rows = buildProjectReport(all, { from: '2026-11-15', to: '2026-11-30' });
    expect(rows.map((r) => r.project)).toEqual([planned, stuck, done, late]);
    expect(buildProjectReport(all, {}).length).toBe(6);
    expect(buildProjectReport(all, { from: '2026-11-15', to: '2026-11-30', group: 'DONE' }).length).toBe(2);
    expect(buildProjectReport(all, { teamKey: 'T2' }).length).toBe(1);
  });

  it('measures on-time completion and late days', () => {
    expect(toReportRow(done).onTime).toBe(true);
    expect(toReportRow(late).onTime).toBe(false);
    expect(toReportRow(late).lateDays).toBe(2);
    expect(toReportRow(planned).onTime).toBe(null);
  });

  it('summarizes groups, QC, products, stuck reasons and teams', () => {
    const s = summarizeReport(buildProjectReport(all, { from: '2026-11-15', to: '2026-11-30' }));
    expect(s.total).toBe(4);
    expect(s.byGroup).toMatchObject({ DONE: 2, STUCK: 1, PLANNED: 1 });
    expect(s.qc).toEqual({ approved: 1, pending: 0, rejected: 1 });
    expect(s.installed).toEqual({ shade: 8, rail: 4, curtain: 0 });
    expect(s.planned).toEqual({ shade: 16, rail: 8, curtain: 0 });
    expect(s.onTime).toBe(1);
    expect(s.measured).toBe(2);
    expect(s.stuckByCategory[0]).toMatchObject({ category: 'FABRIC_SHORTAGE', count: 1 });
    expect(s.avgSatisfaction).toBe(5);
    expect(s.byTeam.find((t) => t.teamKey === 'T1')?.total).toBe(3);
    expect(reportToCsv(buildProjectReport(all, {})).split('\r\n')).toHaveLength(7);
  });
});
