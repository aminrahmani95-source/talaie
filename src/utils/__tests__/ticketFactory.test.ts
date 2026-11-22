import { describe, it, expect } from 'vitest';
import { buildWarehouseReferralTicket } from '../ticketFactory';

describe('buildWarehouseReferralTicket', () => {
  it('produces a complete, valid warehouse ticket', () => {
    const t = buildWarehouseReferralTicket({
      projectId: 'p1',
      project: { code: 'PRJ-1', title: 'پروژه' },
      description: 'کسری براکت',
      blockingReason: 'r',
      referralNote: 'n',
      historyNote: 'h',
      reporter: { id: 'u1', name: 'رضا کریمی' },
      warehouseAssignee: { id: 'w1', name: 'سعید احمدی' },
      now: new Date('2026-11-22T10:00:00Z'),
    });
    expect(t).toMatchObject({
      projectId: 'p1', projectCode: 'PRJ-1', authorId: 'u1', type: 'DAMAGED_HARDWARE',
      category: 'EQUIPMENT_DEFECT', photos: [], status: 'OPEN', assignedRole: 'WAREHOUSE',
      assignedUserId: 'w1', isBlocking: true,
    });
    expect(t.actionHistory?.[0].action).toBe('REFERRED_TO_WAREHOUSE');
  });

  it('falls back to role-only assignment when no warehouse user exists', () => {
    const t = buildWarehouseReferralTicket({
      projectId: 'p1', description: 'd', blockingReason: 'r', referralNote: 'n', historyNote: 'h',
      reporter: { id: 'u1', name: 'x' }, warehouseAssignee: null,
    });
    expect(t.assignedUserId).toBeUndefined();
    expect(t.assignedUserName).toBe('مسئول انبار');
    expect(t.projectCode).toBe('بدون کد');
  });
});
