import { describe, expect, it } from 'vitest';
import type { MaterialRequest, Project, Ticket } from '../types';
import { buildWarehousePatch } from './warehouseStatus';
import {
  buildWarehouseHistory,
  filterHistory,
  historyRangeBounds,
  historyToCsv,
  summarizeHistory,
} from './warehouseHistory';

const actor = { id: 'w', name: 'انبار' };
const proj = (over: Partial<Project> = {}): Project =>
  ({
    id: 'p1',
    code: 'PRJ-1',
    title: 'ولنجک',
    status: 'SCHEDULED',
    shadePanels: 10,
    railCount: 2,
    curtainPanels: 0,
    technicalHandover: { isHandoverComplete: false, warehouseConfirmation: { confirmed: false } },
    ...over,
  }) as Project;
const apply = (p: Project, patch: Partial<Project>) => ({ ...p, ...patch }) as Project;

describe('warehouse history', () => {
  it('collects receipt, packing, hand-over, material dispatch and warehouse tickets', () => {
    let p = proj();
    p = apply(p, buildWarehousePatch(p, { kind: 'RECEIPT', receivedCounts: { shade: 10, rail: 1, curtain: 0 }, acceptShortage: true }, actor, 'انبار', '2026-11-20T08:00:00.000Z'));
    p = apply(p, buildWarehousePatch(p, { kind: 'PACK' }, actor, 'انبار', '2026-11-21T08:00:00.000Z'));
    p = apply(p, buildWarehousePatch(p, { kind: 'HAND_OVER', via: 'WAREHOUSE', toName: 'سجاد' }, actor, 'انبار', '2026-11-22T08:00:00.000Z'));
    const req = {
      id: 'm1', projectId: 'p1', projectCode: 'PRJ-1', projectTitle: 'ولنجک', items: [{ id: 'i1', title: 'پیچ', requestedQty: 20, unit: 'عدد' }],
      dispatches: [{ id: 'd1', dispatchedAt: '2026-11-23T08:00:00.000Z', dispatchedByUserName: 'انبار', courierInfo: 'اسنپ', items: [{ itemId: 'i1', dispatchedQty: 20 }], receivedAtSiteConfirmed: false }],
    } as unknown as MaterialRequest;
    const ticket = { id: 't1', projectId: 'p1', projectCode: 'PRJ-1', projectTitle: 'ولنجک', description: 'ریل کم', status: 'RESOLVED', assignedRole: 'WAREHOUSE', resolvedAt: '2026-11-24T08:00:00.000Z', resolutionNote: 'با پیک ارسال شد' } as unknown as Ticket;

    const events = buildWarehouseHistory([p], [req], [ticket]);
    expect(events.map((e) => e.kind)).toEqual(['TICKET_SUPPLY', 'MATERIAL_DISPATCH', 'HANDED_OVER', 'PACKED', 'RECEIPT']);
    expect(events.find((e) => e.kind === 'RECEIPT')?.warn).toBe(true);
    expect(events.find((e) => e.kind === 'MATERIAL_DISPATCH')?.itemsText).toContain('پیچ 20 عدد');
    expect(events.find((e) => e.kind === 'HANDED_OVER')?.recipient).toBe('سجاد');

    const s = summarizeHistory(events);
    expect(s.handedOver).toEqual({ shade: 10, rail: 2, curtain: 0 });
    expect(s.received).toEqual({ shade: 10, rail: 1, curtain: 0 });
    expect(s.materialQty).toBe(20);
    expect(s.materialInTransit).toBe(1);
    expect(s.projects).toBe(1);

    expect(filterHistory(events, { kinds: ['MATERIAL_DISPATCH'] })).toHaveLength(1);
    expect(filterHistory(events, { query: 'اسنپ' })).toHaveLength(1);

    const csv = historyToCsv(events);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv.split('\r\n')).toHaveLength(6);
  });

  it('jalali month ranges cover the whole month', () => {
    // 2026-11-26 = 1405/09/05 (آذر)
    const m = historyRangeBounds('MONTH', '2026-11-26');
    expect(m.from).toBe('2026-11-22');
    expect(m.to).toBe('2026-12-21');
    const prev = historyRangeBounds('PREV_MONTH', '2026-11-26');
    expect(prev.from).toBe('2026-10-23');
    expect(prev.to).toBe('2026-11-21');
    expect(historyRangeBounds('7D', '2026-11-26').from).toBe('2026-11-20');
  });
});
