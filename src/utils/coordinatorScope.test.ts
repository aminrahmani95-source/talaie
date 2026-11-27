import { describe, expect, it } from 'vitest';
import {
  coordinatorTeamIds,
  isProjectInScope,
  isTabAllowedForCoordinator,
  isTeamActive,
  scopeProjects,
  scopeTickets,
} from './coordinatorScope';
import { getNavSections } from '../components/navigation/navConfig';
import { validateProjectPatchRoleGuards } from './roleGuards';
import { isQcReviewerRole } from './qcWorkflow';

const coord = { id: 'C', role: 'SCHEDULING_COORDINATOR', name: 'هماهنگ', phone: '', active: true } as any;
const qc = { id: 'Q', role: 'QC_MANAGER', name: 'مدیر', phone: '', active: true } as any;
const teams = [
  { id: 'T1', coordinatorId: null },
  { id: 'T2', coordinatorId: 'C' },
  { id: 'T3', coordinatorId: 'C', active: false },
  { id: 'T4', coordinatorId: 'OTHER' },
] as any[];
const projects = [
  { id: 'p1', assignedTeamId: 'T1' },
  { id: 'p2', assignedTeamId: 'T2' },
  { id: 'p3', assignedTeamId: 'T3' },
  { id: 'p4' },
] as any[];

describe('هماهنگ‌کننده فقط با اکیپ‌های خودش', () => {
  it('knows which teams are theirs; other roles are not limited', () => {
    expect([...coordinatorTeamIds(coord, teams)!]).toEqual(['T2', 'T3']);
    expect(coordinatorTeamIds(qc, teams)).toBeNull();
  });

  it('sees only projects and tickets of their own teams', () => {
    const ids = coordinatorTeamIds(coord, teams);
    expect(scopeProjects(projects, ids).map((p) => p.id)).toEqual(['p2', 'p3']);
    expect(scopeProjects(projects, null)).toHaveLength(4);
    expect(isProjectInScope({ assignedTeamId: undefined } as any, ids)).toBe(false);
    const tickets = [{ id: 't1', projectId: 'p1' }, { id: 't2', projectId: 'p2' }] as any[];
    expect(scopeTickets(tickets, new Set(['p2'])).map((t) => t.id)).toEqual(['t2']);
  });

  it('has only the daily-work, warehouse-status and sales pages', () => {
    const ids = getNavSections('SCHEDULING_COORDINATOR', {}).flatMap((s) => s.items.map((i) => i.id));
    expect(ids).toEqual(['control', 'planner', 'qc', 'issues', 'materials', 'sales']);
    expect(isTabAllowedForCoordinator('settings')).toBe(false);
    expect(isTabAllowedForCoordinator('technicians')).toBe(false);
    expect(isTabAllowedForCoordinator('projects')).toBe(false);
    expect(isTabAllowedForCoordinator('stuck')).toBe(true);
  });

  it('plans and reviews QC of own projects only', () => {
    const scope = { coordinatorTeamIds: coordinatorTeamIds(coord, teams) };
    const own = { id: 'p2', status: 'SCHEDULED', assignedTeamId: 'T2', qcStatus: 'PENDING' } as any;
    const other = { id: 'p1', status: 'SCHEDULED', assignedTeamId: 'T1' } as any;
    expect(() => validateProjectPatchRoleGuards(coord, own, { scheduledDate: '2026-12-01' }, undefined, scope)).not.toThrow();
    expect(() => validateProjectPatchRoleGuards(coord, own, { assignedTeamId: 'T3' }, undefined, scope)).not.toThrow();
    expect(() => validateProjectPatchRoleGuards(coord, own, { assignedTeamId: 'T1' }, undefined, scope)).toThrow();
    expect(() => validateProjectPatchRoleGuards(coord, other, { scheduledDate: '2026-12-01' }, undefined, scope)).toThrow();
    expect(isQcReviewerRole('SCHEDULING_COORDINATOR')).toBe(true);
    expect(isQcReviewerRole('LEAD_TECHNICIAN')).toBe(false);
  });

  it('teams are active unless switched off', () => {
    expect(isTeamActive({} as any)).toBe(true);
    expect(isTeamActive({ active: false } as any)).toBe(false);
  });
});
