import { describe, expect, it } from 'vitest';
import { getUpcomingDispatchProjects } from './warehouseLists';
import type { Project } from '../types';

const p = (id: string, status: string, scheduledDate: string, endDate?: string) =>
  ({ id, status, scheduledDate, endDate }) as unknown as Project;

describe('getUpcomingDispatchProjects', () => {
  it('keeps scheduled jobs and multi-day jobs still running, soonest first', () => {
    const list = getUpcomingDispatchProjects(
      [
        p('late', 'SCHEDULED', '2026-12-05'),
        p('soon', 'SCHEDULED', '2026-12-01'),
        p('running', 'IN_PROGRESS', '2026-11-30', '2026-12-02'),
        p('ending-yesterday', 'IN_PROGRESS', '2026-11-28', '2026-11-30'),
        p('single-day-running', 'IN_PROGRESS', '2026-12-01'),
        p('done', 'COMPLETED', '2026-12-01'),
      ],
      '2026-12-01',
    );
    expect(list.map((x) => x.id)).toEqual(['running', 'soon', 'late']);
  });
});
