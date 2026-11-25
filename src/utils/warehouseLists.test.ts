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

import { needsWarehouseReceipt, relativeDayLabel } from './warehouseLists';

describe('warehouse receipt queue', () => {
  const base = { id: 'x', scheduledDate: '2026-12-01' } as unknown as Project;
  it('only jobs that still wait for goods, not legacy or on-site ones', () => {
    expect(needsWarehouseReceipt({ ...base, status: 'SCHEDULED', technicalHandover: { warehouseConfirmation: { confirmed: false } } } as never)).toBe(true);
    expect(needsWarehouseReceipt({ ...base, status: 'SCHEDULED', technicalHandover: { warehouseConfirmation: { confirmed: true } } } as never)).toBe(false);
    expect(needsWarehouseReceipt({ ...base, status: 'SCHEDULED' } as never)).toBe(false);
    expect(needsWarehouseReceipt({ ...base, status: 'IN_PROGRESS', technicalHandover: {} } as never)).toBe(false);
    expect(needsWarehouseReceipt({ ...base, status: 'MEASUREMENT_PENDING' } as never)).toBe(true);
  });
  it('dispatch horizon keeps today..+2 only', () => {
    const list = getUpcomingDispatchProjects(
      [p('a', 'SCHEDULED', '2026-12-01'), p('b', 'SCHEDULED', '2026-12-03'), p('c', 'SCHEDULED', '2026-12-04')],
      '2026-12-01',
      3,
    );
    expect(list.map((x) => x.id)).toEqual(['a', 'b']);
  });
  it('relative day labels', () => {
    expect(relativeDayLabel('2026-12-02', '2026-12-01').text).toBe('فردا');
    expect(relativeDayLabel('2026-11-30', '2026-12-01').tone).toBe('late');
  });
});
