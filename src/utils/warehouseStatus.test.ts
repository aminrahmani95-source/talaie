import { describe, expect, it } from 'vitest';
import type { Project } from '../types';
import {
  buildWarehousePatch,
  countsChangedSincePacking,
  countsChangedSinceReceipt,
  getWarehouseStage,
  receiptShortages,
  warehouseAlert,
} from './warehouseStatus';

const base = (over: Partial<Project> = {}): Project =>
  ({
    id: 'p1',
    code: 'PRJ-1',
    title: 'تست',
    status: 'SCHEDULED',
    scheduledDate: '2026-11-28',
    shadePanels: 10,
    railCount: 2,
    curtainPanels: 4,
    technicalHandover: { isHandoverComplete: false, warehouseConfirmation: { confirmed: false } },
    ...over,
  }) as Project;

const actor = { id: 'u1', name: 'انباردار' };
const now = '2026-11-26T10:00:00.000Z';
const apply = (p: Project, patch: Partial<Project>): Project => ({ ...p, ...patch }) as Project;

describe('warehouse stage model', () => {
  it('walks awaiting → in stock → packed → handed over', () => {
    let p = base();
    expect(getWarehouseStage(p)).toBe('AWAITING');

    p = apply(p, buildWarehousePatch(p, { kind: 'RECEIPT', receivedCounts: { shade: 10, rail: 2, curtain: 4 } }, actor, 'انباردار', now));
    expect(getWarehouseStage(p)).toBe('IN_STOCK');
    expect(p.technicalHandover?.warehouseConfirmation.confirmedBy).toBe('انباردار');
    expect(p.technicalHandover?.warehouseConfirmation.expectedCounts).toEqual({ shade: 10, rail: 2, curtain: 4 });
    expect(p.technicalHandover?.isHandoverComplete).toBe(true);

    p = apply(p, buildWarehousePatch(p, { kind: 'PACK', notes: '۳ کارتن' }, actor, 'انباردار', now));
    expect(getWarehouseStage(p)).toBe('PACKED');

    p = apply(p, buildWarehousePatch(p, { kind: 'HAND_OVER', via: 'LEAD' }, { id: 'l1', name: 'سرپرست' }, 'سرپرست', now));
    expect(getWarehouseStage(p)).toBe('HANDED_OVER');
    expect(p.warehousePrep?.handedOverToName).toBe('سرپرست');
    expect(p.warehousePrep?.notes).toBe('۳ کارتن');
  });

  it('partial receipt keeps the dispatch gate closed and shows the shortage', () => {
    let p = base();
    p = apply(p, buildWarehousePatch(p, { kind: 'RECEIPT', partial: true, receivedCounts: { shade: 10, rail: 0, curtain: 4 } }, actor, 'انباردار', now));
    expect(getWarehouseStage(p)).toBe('PARTIAL');
    expect(p.technicalHandover?.warehouseConfirmation.confirmed).toBe(false);
    expect(receiptShortages(p).map((d) => d.key)).toEqual(['rail']);
  });

  it('accepting a shortage opens the gate but flags the manager', () => {
    let p = base();
    p = apply(p, buildWarehousePatch(p, { kind: 'RECEIPT', acceptShortage: true, receivedCounts: { shade: 9, rail: 2, curtain: 4 } }, actor, 'انباردار', now));
    expect(getWarehouseStage(p)).toBe('IN_STOCK');
    expect(warehouseAlert(p, '2026-11-20').level).toBe('warn');
  });

  it('revoking a receipt also clears a packed load', () => {
    let p = base();
    p = apply(p, buildWarehousePatch(p, { kind: 'RECEIPT' }, actor, 'انباردار', now));
    p = apply(p, buildWarehousePatch(p, { kind: 'PACK' }, actor, 'انباردار', now));
    const patch = buildWarehousePatch(p, { kind: 'REVOKE_RECEIPT' }, actor, 'انباردار', now);
    expect(patch.warehousePrep?.isPackedAndReady).toBe(false);
    p = apply(p, patch);
    expect(getWarehouseStage(p)).toBe('AWAITING');
  });

  it('detects order counts changed after the warehouse confirmed or packed', () => {
    let p = base();
    p = apply(p, buildWarehousePatch(p, { kind: 'RECEIPT' }, actor, 'انباردار', now));
    p = apply(p, buildWarehousePatch(p, { kind: 'PACK' }, actor, 'انباردار', now));
    expect(countsChangedSinceReceipt(p)).toEqual([]);
    p = apply(p, { railCount: 3 });
    expect(countsChangedSinceReceipt(p).map((d) => d.key)).toEqual(['rail']);
    expect(countsChangedSincePacking(p).map((d) => d.key)).toEqual(['rail']);
    expect(warehouseAlert(p, '2026-11-20').level).toBe('warn');
  });

  it('flags jobs installing within two days whose goods are missing', () => {
    expect(warehouseAlert(base({ scheduledDate: '2026-11-27' }), '2026-11-26').level).toBe('urgent');
    expect(warehouseAlert(base({ scheduledDate: '2026-12-10' }), '2026-11-26').level).toBe(null);
  });

  it('legacy jobs without a handover gate count as in stock; finished jobs have no stage', () => {
    expect(getWarehouseStage(base({ technicalHandover: undefined }))).toBe('IN_STOCK');
    expect(getWarehouseStage(base({ status: 'COMPLETED' }))).toBe('NONE');
    expect(getWarehouseStage(base({ status: 'IN_PROGRESS' }))).toBe('NONE');
  });

  it('never sends the historical-migration flag from the client', () => {
    const p = base({ technicalHandover: { isHandoverComplete: false, warehouseConfirmation: { confirmed: false }, isHistoricalMigration: false } as any });
    const patch = buildWarehousePatch(p, { kind: 'RECEIPT' }, actor, 'انباردار', now);
    expect('isHistoricalMigration' in (patch.technicalHandover as object)).toBe(false);
  });
});

import { validateProjectPatchRoleGuards } from './roleGuards';

describe('warehouse patches pass the client role guards', () => {
  it('a lead may confirm picking up a packed load', () => {
    let p = base({ leadTechnicianId: 'l1', assignedTechnicianIds: ['l1'] });
    p = apply(p, buildWarehousePatch(p, { kind: 'RECEIPT' }, actor, 'انباردار', now));
    p = apply(p, buildWarehousePatch(p, { kind: 'PACK' }, actor, 'انباردار', now));
    const lead = { id: 'l1', name: 'سرپرست', role: 'LEAD_TECHNICIAN', active: true, phone: '' } as any;
    const patch = buildWarehousePatch(p, { kind: 'HAND_OVER', via: 'LEAD' }, lead, 'سرپرست', now);
    expect(() => validateProjectPatchRoleGuards(lead, p, patch as any)).not.toThrow();
  });

  it('the warehouse may write receipt, packing and hand-over', () => {
    const wh = { id: 'w1', name: 'انبار', role: 'WAREHOUSE', active: true, phone: '' } as any;
    let p = base();
    for (const action of [{ kind: 'RECEIPT' }, { kind: 'PACK' }, { kind: 'HAND_OVER', via: 'WAREHOUSE' }] as const) {
      const patch = buildWarehousePatch(p, action as any, wh, 'انبار', now);
      expect(() => validateProjectPatchRoleGuards(wh, p, patch as any)).not.toThrow();
      p = apply(p, patch);
    }
  });
});
