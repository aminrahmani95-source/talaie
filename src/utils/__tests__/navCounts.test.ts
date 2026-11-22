import { describe, it, expect } from 'vitest';
import { computeNavCounts, isStuckOpen } from '../navCounts';

const p = (over: any) => ({ id: Math.random().toString(), status: 'SCHEDULED', qcStatus: 'NOT_STARTED', ...over });

describe('computeNavCounts', () => {
  it('counts open tickets, stuck projects, warehouse work and QC queue', () => {
    const projects: any[] = [
      p({ status: 'STUCK' }),
      p({ status: 'IN_PROGRESS', stuckIncidents: [{ resolutionStatus: 'RESOLVED' }] }),
      p({ status: 'IN_PROGRESS', stuckIncidents: [{ resolutionStatus: 'RESOLVED' }, { resolutionStatus: 'OPEN' }] }),
    ];
    const tickets: any[] = [
      { status: 'OPEN', assignedRole: 'WAREHOUSE' },
      { status: 'OPEN' },
      { status: 'RESOLVED', assignedRole: 'WAREHOUSE' },
    ];
    const materials: any[] = [{ status: 'SUBMITTED' }, { status: 'DELIVERED_CONFIRMED' }];
    const c = computeNavCounts(projects, tickets, materials);
    expect(c.openTicketCount).toBe(2);
    expect(c.openStuckCount).toBe(2);
    expect(c.pendingMaterialCount).toBe(2); // 1 material + 1 open warehouse ticket
  });

  it('treats a project whose latest stoppage is resolved as not stuck', () => {
    expect(isStuckOpen(p({ status: 'IN_PROGRESS', stuckIncident: { resolutionStatus: 'RESOLVED' } }) as any)).toBe(false);
  });
});
