import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  Outbox,
  openDb,
  resetProcessingStateForTesting,
  OutboxOperation,
  FailedOperation,
} from '../offlineQueue';

describe('Outbox Safe Recovery Layer (Phase P2.3-R2)', () => {
  beforeEach(async () => {
    resetProcessingStateForTesting();
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(
        ['pending_operations', 'pending_uploads', 'failed_operations'],
        'readwrite'
      );
      tx.objectStore('pending_operations').clear();
      tx.objectStore('pending_uploads').clear();
      tx.objectStore('failed_operations').clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  });

  it('safely re-queues material operations that failed due to FEATURE_NOT_IMPLEMENTED_ON_SERVER', async () => {
    const db = await openDb();

    // Seed STORE_FAILED with:
    // 1. A material create operation that failed due to missing server implementation
    // 2. A material patch operation that failed due to missing server implementation
    // 3. An unrelated project operation that failed due to "پروژه یافت نشد"
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(['failed_operations'], 'readwrite');
      const store = tx.objectStore('failed_operations');

      const matOp1: FailedOperation = {
        id: 'mat-op-1',
        orderingKey: 'material:req-101',
        userId: 'user-tech-1',
        type: 'CREATE_MATERIAL_REQUEST',
        payload: { id: 'req-101', title: 'درخواست کسری متریال' },
        errorReason: 'همگام‌سازی ابری متریال هنوز در سرور فعال نشده است (جدول سمت سرور در انتظار مایگریشن). تغییرات در صف و حافظه محلی نگهداری می‌شوند.',
        failedAt: Date.now() + 100,
        retryCount: 1,
        originalCreatedAt: 1000,
      };

      const matOp2: FailedOperation = {
        id: 'mat-op-2',
        orderingKey: 'material:req-101',
        userId: 'user-tech-1',
        type: 'PATCH_MATERIAL_REQUEST',
        payload: { id: 'req-101', patch: { status: 'DISPATCHED' } },
        errorReason: 'FEATURE_NOT_IMPLEMENTED_ON_SERVER: جدول سمت سرور در انتظار مایگریشن',
        failedAt: Date.now() + 200,
        retryCount: 1,
        originalCreatedAt: 2000,
      };

      const unrelatedOp: FailedOperation = {
        id: 'proj-op-99',
        orderingKey: 'project:prj-999',
        userId: 'user-tech-1',
        type: 'PATCH_PROJECT',
        payload: { id: 'prj-999', patch: { status: 'CANCELLED' } },
        errorReason: 'این پروژه توسط مدیر تغییر کرده یا حذف شده است',
        failedAt: Date.now() + 300,
        retryCount: 5,
        originalCreatedAt: 500,
      };

      store.put(matOp1);
      store.put(matOp2);
      store.put(unrelatedOp);

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    expect(await Outbox.getFailedCount()).toBe(3);
    expect(await Outbox.getPendingCount()).toBe(0);

    // Run safe requeue with mandatory targetUserId
    const result = await Outbox.requeueUnsupportedMaterialOperations('user-tech-1');
    expect(result.requeuedCount).toBe(2);
    expect(result.requeuedIds).toEqual(['mat-op-1', 'mat-op-2']);

    // STORE_PENDING must now have the 2 material operations
    const pendingOps = await Outbox.getPendingOperations();
    expect(pendingOps).toHaveLength(2);
    expect(pendingOps.map((p) => p.id)).toEqual(['mat-op-1', 'mat-op-2']);

    // STORE_FAILED must still retain the unrelated failed operation!
    const failedOps = await Outbox.getFailedOperations();
    expect(failedOps).toHaveLength(1);
    expect(failedOps[0].id).toBe('proj-op-99');
    expect(failedOps[0].errorReason).toContain('این پروژه توسط مدیر تغییر کرده یا حذف شده است');
  });

  it('preserves exact FIFO ordering by retaining originalCreatedAt on restored operations', async () => {
    const db = await openDb();

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(['failed_operations'], 'readwrite');
      const store = tx.objectStore('failed_operations');

      // Create dispatches and requests with strictly ordered originalCreatedAt timestamps
      const opCreate: FailedOperation = {
        id: 'op-create',
        orderingKey: 'material:req-fifo',
        userId: 'usr-1',
        type: 'CREATE_MATERIAL_REQUEST',
        payload: { id: 'req-fifo' },
        errorReason: 'همگام‌سازی ابری متریال هنوز در سرور فعال نشده است',
        failedAt: Date.now() + 500,
        retryCount: 1,
        originalCreatedAt: 1000000,
      };

      const opDispatch: FailedOperation = {
        id: 'op-dispatch',
        orderingKey: 'material:req-fifo',
        userId: 'usr-1',
        type: 'PATCH_MATERIAL_REQUEST',
        payload: { id: 'req-fifo', patch: { status: 'PARTIALLY_DISPATCHED' } },
        errorReason: 'FEATURE_NOT_IMPLEMENTED_ON_SERVER',
        failedAt: Date.now() + 600,
        retryCount: 1,
        originalCreatedAt: 2000000,
      };

      const opReceipt: FailedOperation = {
        id: 'op-receipt',
        orderingKey: 'material:req-fifo',
        userId: 'usr-1',
        type: 'PATCH_MATERIAL_REQUEST',
        payload: { id: 'req-fifo', patch: { status: 'DELIVERED_CONFIRMED' } },
        errorReason: 'همگام‌سازی ابری متریال هنوز در سرور فعال نشده است',
        failedAt: Date.now() + 700,
        retryCount: 1,
        originalCreatedAt: 3000000,
      };

      store.put(opReceipt);
      store.put(opCreate);
      store.put(opDispatch);

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    await Outbox.requeueUnsupportedMaterialOperations('usr-1');

    const pendingOps = await Outbox.getPendingOperations();
    // Sort chronologically as processQueue does
    pendingOps.sort((a, b) => a.createdAt - b.createdAt);

    expect(pendingOps[0].id).toBe('op-create');
    expect(pendingOps[0].createdAt).toBe(1000000);

    expect(pendingOps[1].id).toBe('op-dispatch');
    expect(pendingOps[1].createdAt).toBe(2000000);

    expect(pendingOps[2].id).toBe('op-receipt');
    expect(pendingOps[2].createdAt).toBe(3000000);
  });

  it('prevents duplicate requeuing if an operation is already in pending queue', async () => {
    const db = await openDb();

    // Already exists in pending
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(['pending_operations', 'failed_operations'], 'readwrite');
      const pStore = tx.objectStore('pending_operations');
      const fStore = tx.objectStore('failed_operations');

      const existingPending: OutboxOperation = {
        id: 'dup-mat-op',
        orderingKey: 'material:req-dup',
        userId: 'usr-1',
        type: 'CREATE_MATERIAL_REQUEST',
        payload: { id: 'req-dup' },
        createdAt: 1000,
        retryCount: 0,
        nextRetryAt: 0,
      };

      const duplicateFailed: FailedOperation = {
        id: 'dup-mat-op',
        orderingKey: 'material:req-dup',
        userId: 'usr-1',
        type: 'CREATE_MATERIAL_REQUEST',
        payload: { id: 'req-dup' },
        errorReason: 'FEATURE_NOT_IMPLEMENTED_ON_SERVER',
        failedAt: Date.now(),
        retryCount: 1,
        originalCreatedAt: 1000,
      };

      pStore.put(existingPending);
      fStore.put(duplicateFailed);

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    const result = await Outbox.requeueUnsupportedMaterialOperations('usr-1');
    expect(result.requeuedCount).toBe(0);

    const pendingOps = await Outbox.getPendingOperations();
    expect(pendingOps).toHaveLength(1);
    expect(pendingOps[0].id).toBe('dup-mat-op');
  });

  it('never requeues unrelated permanent failures (e.g. 404, RLS, schema errors)', async () => {
    const db = await openDb();

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(['failed_operations'], 'readwrite');
      const store = tx.objectStore('failed_operations');

      const failedProject404: FailedOperation = {
        id: 'proj-fail-404',
        orderingKey: 'project:p-404',
        userId: 'usr-1',
        type: 'PATCH_PROJECT',
        payload: { id: 'p-404' },
        errorReason: 'PGRST116: Results contain 0 rows (Not Found)',
        failedAt: Date.now(),
        retryCount: 1,
        originalCreatedAt: 1000,
      };

      const failedTicketRLS: FailedOperation = {
        id: 'ticket-fail-rls',
        orderingKey: 'ticket:t-1',
        userId: 'usr-tech-2',
        type: 'CREATE_TICKET',
        payload: { id: 't-1' },
        errorReason: '42501: new row violates row-level security policy for table tickets',
        failedAt: Date.now(),
        retryCount: 1,
        originalCreatedAt: 2000,
      };

      store.put(failedProject404);
      store.put(failedTicketRLS);

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    const result = await Outbox.requeueUnsupportedMaterialOperations('usr-1');
    expect(result.requeuedCount).toBe(0);
    expect(result.requeuedIds).toEqual([]);

    expect(await Outbox.getPendingCount()).toBe(0);
    expect(await Outbox.getFailedCount()).toBe(2);
  });

  it('can be invoked safely via SupabaseSyncService.recoverPendingMaterialOperations without infinite loops', async () => {
    const { SupabaseSyncService } = await import('../supabase');
    const db = await openDb();

    // Seed one material failure
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(['failed_operations'], 'readwrite');
      const store = tx.objectStore('failed_operations');
      store.put({
        id: 'svc-mat-op-1',
        orderingKey: 'material:req-svc',
        userId: 'usr-1',
        type: 'CREATE_MATERIAL_REQUEST',
        payload: { id: 'req-svc' },
        errorReason: 'FEATURE_NOT_IMPLEMENTED_ON_SERVER: جدول متریال در سرور پیاده‌سازی نشده است',
        failedAt: Date.now(),
        retryCount: 1,
        originalCreatedAt: 5000,
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    // 1. Invocation returns exact count and IDs
    const recoveryResult = await SupabaseSyncService.recoverPendingMaterialOperations('usr-1');
    expect(recoveryResult.requeuedCount).toBe(1);
    expect(recoveryResult.requeuedIds).toEqual(['svc-mat-op-1']);

    // 2. Calling it a second time does NOT create duplicates or loop
    const secondCallResult = await SupabaseSyncService.recoverPendingMaterialOperations('usr-1');
    expect(secondCallResult.requeuedCount).toBe(0);
    expect(secondCallResult.requeuedIds).toEqual([]);

    expect(await Outbox.getPendingCount()).toBe(1);
    expect(await Outbox.getFailedCount()).toBe(0);
  });

  it('preserves multi-dispatch, receipt confirmation, and interleaved operations dependency ordering', async () => {
    const db = await openDb();

    // Simulate complex real-world lifecycle:
    // T100: Create Material Request
    // T200: Manager Dispatch 1 (Partial)
    // T250: Interleaved Project Progress Update (Unrelated key)
    // T300: Manager Dispatch 2 (Second partial dispatch)
    // T400: Technician Receipt Confirmation of Dispatch 1
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(['failed_operations'], 'readwrite');
      const store = tx.objectStore('failed_operations');

      const opCreate: FailedOperation = {
        id: 'dep-create',
        orderingKey: 'material:req-dep',
        userId: 'usr-mgr-1',
        type: 'CREATE_MATERIAL_REQUEST',
        payload: { id: 'req-dep', title: 'درخواست پروفیل آلومینیوم' },
        errorReason: 'همگام‌سازی ابری متریال هنوز در سرور فعال نشده است',
        failedAt: Date.now() + 10,
        retryCount: 1,
        originalCreatedAt: 100,
      };

      const opDispatch1: FailedOperation = {
        id: 'dep-dispatch-1',
        orderingKey: 'material:req-dep',
        userId: 'usr-mgr-1',
        type: 'PATCH_MATERIAL_REQUEST',
        payload: {
          id: 'req-dep',
          patch: {
            status: 'PARTIALLY_DISPATCHED',
            dispatches: [{ id: 'disp-1', courier: 'پیک ۱', qty: 2 }],
          },
        },
        errorReason: 'FEATURE_NOT_IMPLEMENTED_ON_SERVER',
        failedAt: Date.now() + 20,
        retryCount: 1,
        originalCreatedAt: 200,
      };

      const opDispatch2: FailedOperation = {
        id: 'dep-dispatch-2',
        orderingKey: 'material:req-dep',
        userId: 'usr-mgr-1',
        type: 'PATCH_MATERIAL_REQUEST',
        payload: {
          id: 'req-dep',
          patch: {
            status: 'DISPATCHED',
            dispatches: [
              { id: 'disp-1', courier: 'پیک ۱', qty: 2 },
              { id: 'disp-2', courier: 'پیک ۲', qty: 3 },
            ],
          },
        },
        errorReason: 'FEATURE_NOT_IMPLEMENTED_ON_SERVER',
        failedAt: Date.now() + 30,
        retryCount: 1,
        originalCreatedAt: 300,
      };

      const opReceipt: FailedOperation = {
        id: 'dep-receipt-1',
        orderingKey: 'material:req-dep',
        userId: 'usr-mgr-1',
        type: 'PATCH_MATERIAL_REQUEST',
        payload: {
          id: 'req-dep',
          patch: {
            status: 'PARTIALLY_DELIVERED',
            dispatches: [
              { id: 'disp-1', courier: 'پیک ۱', qty: 2, receivedConfirmedAt: '2026-11-14T02:00:00Z' },
              { id: 'disp-2', courier: 'پیک ۲', qty: 3 },
            ],
          },
        },
        errorReason: 'FEATURE_NOT_IMPLEMENTED_ON_SERVER',
        failedAt: Date.now() + 40,
        retryCount: 1,
        originalCreatedAt: 400,
      };

      // Unrelated interleaved project operation
      const opProject: FailedOperation = {
        id: 'dep-proj-interleaved',
        orderingKey: 'project:prj-interleaved',
        userId: 'usr-mgr-1',
        type: 'PATCH_PROJECT',
        payload: { id: 'prj-interleaved', patch: { status: 'IN_PROGRESS' } },
        errorReason: 'این پروژه توسط مدیر تغییر کرده یا حذف شده است',
        failedAt: Date.now() + 25,
        retryCount: 5,
        originalCreatedAt: 250,
      };

      // Insert in shuffled order to verify sorting is resilient
      store.put(opReceipt);
      store.put(opDispatch2);
      store.put(opProject);
      store.put(opCreate);
      store.put(opDispatch1);

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    // Execute recovery
    const res = await Outbox.requeueUnsupportedMaterialOperations('usr-mgr-1');
    expect(res.requeuedCount).toBe(4);
    expect(res.requeuedIds).toEqual(
      expect.arrayContaining(['dep-create', 'dep-dispatch-1', 'dep-dispatch-2', 'dep-receipt-1'])
    );

    // Verify orderingKey 'material:req-dep' operations are in strict sequential order
    const pendingOps = await Outbox.getPendingOperations();
    const materialSequence = pendingOps
      .filter((op) => op.orderingKey === 'material:req-dep')
      .sort((a, b) => a.createdAt - b.createdAt);

    expect(materialSequence).toHaveLength(4);
    expect(materialSequence[0].id).toBe('dep-create');
    expect(materialSequence[0].createdAt).toBe(100);

    expect(materialSequence[1].id).toBe('dep-dispatch-1');
    expect(materialSequence[1].createdAt).toBe(200);

    expect(materialSequence[2].id).toBe('dep-dispatch-2');
    expect(materialSequence[2].createdAt).toBe(300);

    expect(materialSequence[3].id).toBe('dep-receipt-1');
    expect(materialSequence[3].createdAt).toBe(400);

    // Unrelated project operation remains untouched in STORE_FAILED
    const failedOps = await Outbox.getFailedOperations();
    expect(failedOps).toHaveLength(1);
    expect(failedOps[0].id).toBe('dep-proj-interleaved');
  });

  it('destructively purges all stores on purgeAll so stale queued operations cannot recreate data after reset', async () => {
    const db = await openDb();

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(
        ['pending_operations', 'failed_operations', 'pending_uploads'],
        'readwrite'
      );
      tx.objectStore('pending_operations').put({
        id: 'stale-pending',
        orderingKey: 'project:p-stale',
        userId: 'usr-1',
        type: 'PATCH_PROJECT',
        payload: { id: 'p-stale', patch: { title: 'Ghost Project' } },
        createdAt: 100,
        retryCount: 0,
        nextRetryAt: 0,
      });
      tx.objectStore('failed_operations').put({
        id: 'stale-failed',
        orderingKey: 'material:req-stale',
        userId: 'usr-1',
        type: 'CREATE_MATERIAL_REQUEST',
        payload: { id: 'req-stale' },
        errorReason: 'stale',
        failedAt: Date.now(),
        retryCount: 1,
        originalCreatedAt: 50,
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    expect(await Outbox.getPendingCount()).toBe(1);
    expect(await Outbox.getFailedCount()).toBe(1);

    // Perform confirmed application destructive reset purge
    await Outbox.purgeAll();

    expect(await Outbox.getPendingCount()).toBe(0);
    expect(await Outbox.getFailedCount()).toBe(0);

    const pendingAfter = await Outbox.getPendingOperations();
    const failedAfter = await Outbox.getFailedOperations();
    expect(pendingAfter).toHaveLength(0);
    expect(failedAfter).toHaveLength(0);
  });

  it('Scenario: requeueUnsupportedMaterialOperations filters by targetUserId when requested', async () => {
    const db = await openDb();

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(['failed_operations'], 'readwrite');
      const store = tx.objectStore('failed_operations');

      store.put({
        id: 'user1-mat',
        orderingKey: 'material:req-u1',
        userId: 'usr-target-1',
        type: 'CREATE_MATERIAL_REQUEST',
        payload: { id: 'req-u1' },
        errorReason: 'FEATURE_NOT_IMPLEMENTED_ON_SERVER',
        failedAt: Date.now(),
        retryCount: 1,
        originalCreatedAt: 1000,
      });

      store.put({
        id: 'user2-mat',
        orderingKey: 'material:req-u2',
        userId: 'usr-target-2',
        type: 'CREATE_MATERIAL_REQUEST',
        payload: { id: 'req-u2' },
        errorReason: 'FEATURE_NOT_IMPLEMENTED_ON_SERVER',
        failedAt: Date.now(),
        retryCount: 1,
        originalCreatedAt: 2000,
      });

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    // Requeue only for usr-target-1
    const res = await Outbox.requeueUnsupportedMaterialOperations('usr-target-1');
    expect(res.requeuedCount).toBe(1);
    expect(res.requeuedIds).toEqual(['user1-mat']);

    // usr-target-2 must remain in failed store
    const failed = await Outbox.getFailedOperations();
    expect(failed).toHaveLength(1);
    expect(failed[0].id).toBe('user2-mat');

    const pending = await Outbox.getPendingOperations();
    expect(pending).toHaveLength(1);
    expect(pending[0].id).toBe('user1-mat');
    expect(pending[0].userId).toBe('usr-target-1');
  });

  it('Scenario: Queue worker halts execution of child operations on same key when parent operation fails', async () => {
    const db = await openDb();

    // 1. Queue a parent CREATE_MATERIAL_REQUEST, followed by a child DISPATCH and RECEIPT
    // Plus an unrelated project operation
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(['pending_operations'], 'readwrite');
      const store = tx.objectStore('pending_operations');

      const parentReq: OutboxOperation = {
        id: 'dep-parent-create',
        orderingKey: 'material:req-cascade',
        userId: 'usr-lead',
        type: 'CREATE_MATERIAL_REQUEST',
        payload: { id: 'req-cascade' },
        createdAt: 100,
        retryCount: 0,
        nextRetryAt: 0,
      };

      const childDispatch1: OutboxOperation = {
        id: 'dep-child-disp1',
        orderingKey: 'material:req-cascade',
        userId: 'usr-lead',
        type: 'PATCH_MATERIAL_REQUEST',
        payload: { id: 'req-cascade', patch: { dispatches: [{ id: 'd-1' }] } },
        createdAt: 200,
        retryCount: 0,
        nextRetryAt: 0,
      };

      const childDispatch2: OutboxOperation = {
        id: 'dep-child-disp2',
        orderingKey: 'material:req-cascade',
        userId: 'usr-lead',
        type: 'PATCH_MATERIAL_REQUEST',
        payload: { id: 'req-cascade', patch: { dispatches: [{ id: 'd-1' }, { id: 'd-2' }] } },
        createdAt: 300,
        retryCount: 0,
        nextRetryAt: 0,
      };

      const childReceipt: OutboxOperation = {
        id: 'dep-child-receipt',
        orderingKey: 'material:req-cascade',
        userId: 'usr-lead',
        type: 'PATCH_MATERIAL_REQUEST',
        payload: { id: 'req-cascade', patch: { status: 'DELIVERED_CONFIRMED' } },
        createdAt: 400,
        retryCount: 0,
        nextRetryAt: 0,
      };

      const unrelatedProject: OutboxOperation = {
        id: 'unrelated-proj-op',
        orderingKey: 'project:prj-safe',
        userId: 'usr-lead',
        type: 'PATCH_PROJECT',
        payload: { id: 'prj-safe' },
        createdAt: 250,
        retryCount: 0,
        nextRetryAt: 0,
      };

      store.put(parentReq);
      store.put(childDispatch1);
      store.put(childDispatch2);
      store.put(childReceipt);
      store.put(unrelatedProject);

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    const executedIds: string[] = [];
    await Outbox.processQueue({
      currentUserId: 'usr-lead',
      uploadBlob: async () => 'path',
      executeMutation: async (op) => {
        executedIds.push(op.id);
        if (op.id === 'dep-parent-create') {
          // Parent fails with permanent Postgrest error code
          const err = new Error('PGRST116: parent entity creation rejected');
          (err as any).code = 'PGRST116';
          throw err;
        }
      },
    });

    // Parent was attempted, and unrelated project succeeded.
    // CRITICAL: None of the child operations (disp1, disp2, receipt) were executed!
    expect(executedIds).toContain('dep-parent-create');
    expect(executedIds).toContain('unrelated-proj-op');
    expect(executedIds).not.toContain('dep-child-disp1');
    expect(executedIds).not.toContain('dep-child-disp2');
    expect(executedIds).not.toContain('dep-child-receipt');

    // In failed store: only parent is failed
    const failedOps = await Outbox.getFailedOperations();
    expect(failedOps.some((f) => f.id === 'dep-parent-create')).toBe(true);

    // In pending store: child operations remain safely queued behind parent
    const pendingOps = await Outbox.getPendingOperations();
    expect(pendingOps.some((p) => p.id === 'dep-child-disp1')).toBe(true);
    expect(pendingOps.some((p) => p.id === 'dep-child-disp2')).toBe(true);
    expect(pendingOps.some((p) => p.id === 'dep-child-receipt')).toBe(true);
  });

  it('Scenario: Durable FIFO blocking persists across worker restart / page reload', async () => {
    const db = await openDb();

    // 1. Simulate existing state on disk:
    // - Parent CREATE_MATERIAL_REQUEST is already in STORE_FAILED from a previous session/crash
    // - Child DISPATCH_1, DISPATCH_2, and RECEIPT are in STORE_PENDING
    // - An unrelated project operation is also in STORE_PENDING
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(['failed_operations', 'pending_operations'], 'readwrite');
      const failedStore = tx.objectStore('failed_operations');
      const pendingStore = tx.objectStore('pending_operations');

      const failedParent: FailedOperation = {
        id: 'restart-parent-create',
        orderingKey: 'material:req-restart-1',
        userId: 'usr-dur',
        type: 'CREATE_MATERIAL_REQUEST',
        payload: { id: 'req-restart-1' },
        errorReason: 'PGRST116: parent entity creation failed',
        failedAt: Date.now() - 5000,
        retryCount: 5,
        originalCreatedAt: 1000,
      };

      const childDisp1: OutboxOperation = {
        id: 'restart-child-disp1',
        orderingKey: 'material:req-restart-1',
        userId: 'usr-dur',
        type: 'PATCH_MATERIAL_REQUEST',
        payload: { id: 'req-restart-1', patch: { dispatches: [{ id: 'd-1' }] } },
        createdAt: 2000,
        retryCount: 0,
        nextRetryAt: 0,
      };

      const childDisp2: OutboxOperation = {
        id: 'restart-child-disp2',
        orderingKey: 'material:req-restart-1',
        userId: 'usr-dur',
        type: 'PATCH_MATERIAL_REQUEST',
        payload: { id: 'req-restart-1', patch: { dispatches: [{ id: 'd-1' }, { id: 'd-2' }] } },
        createdAt: 3000,
        retryCount: 0,
        nextRetryAt: 0,
      };

      const childReceipt: OutboxOperation = {
        id: 'restart-child-receipt',
        orderingKey: 'material:req-restart-1',
        userId: 'usr-dur',
        type: 'PATCH_MATERIAL_REQUEST',
        payload: { id: 'req-restart-1', patch: { status: 'DELIVERED_CONFIRMED' } },
        createdAt: 4000,
        retryCount: 0,
        nextRetryAt: 0,
      };

      const unrelatedOp: OutboxOperation = {
        id: 'restart-unrelated-op',
        orderingKey: 'project:prj-fresh-99',
        userId: 'usr-dur',
        type: 'PATCH_PROJECT',
        payload: { id: 'prj-fresh-99', patch: { notes: 'Safe update' } },
        createdAt: 2500,
        retryCount: 0,
        nextRetryAt: 0,
      };

      failedStore.put(failedParent);
      pendingStore.put(childDisp1);
      pendingStore.put(childDisp2);
      pendingStore.put(childReceipt);
      pendingStore.put(unrelatedOp);

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    // 2. Simulate complete browser restart: clear all in-memory worker state
    resetProcessingStateForTesting();

    // 3. New queue worker starts up after page load
    const executedMutations: string[] = [];
    await Outbox.processQueue({
      currentUserId: 'usr-dur',
      uploadBlob: async () => 'path',
      executeMutation: async (op) => {
        executedMutations.push(op.id);
      },
    });

    // 4. Verify durable isolation:
    // - Unrelated project operation successfully processed and dequeued
    expect(executedMutations).toEqual(['restart-unrelated-op']);

    // - None of the children were executed because STORE_FAILED blocked key 'material:req-restart-1'
    expect(executedMutations).not.toContain('restart-child-disp1');
    expect(executedMutations).not.toContain('restart-child-disp2');
    expect(executedMutations).not.toContain('restart-child-receipt');

    // - Children remain safe in pending_operations
    const remainingPending = await Outbox.getPendingOperations();
    const remainingIds = remainingPending.map((p) => p.id);
    expect(remainingIds).toContain('restart-child-disp1');
    expect(remainingIds).toContain('restart-child-disp2');
    expect(remainingIds).toContain('restart-child-receipt');
    expect(remainingIds).not.toContain('restart-unrelated-op');

    // - Parent remains in failed_operations
    const remainingFailed = await Outbox.getFailedOperations();
    expect(remainingFailed.some((f) => f.id === 'restart-parent-create')).toBe(true);
  });

  it('rejects missing, empty, or whitespace-only targetUserId without performing any IndexedDB mutations', async () => {
    const db = await openDb();

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(['failed_operations'], 'readwrite');
      const store = tx.objectStore('failed_operations');

      store.put({
        id: 'user1-mat-preserve',
        orderingKey: 'material:req-p1',
        userId: 'usr-target-1',
        type: 'CREATE_MATERIAL_REQUEST',
        payload: { id: 'req-p1' },
        errorReason: 'FEATURE_NOT_IMPLEMENTED_ON_SERVER',
        failedAt: Date.now(),
        retryCount: 1,
        originalCreatedAt: 1000,
      });

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    // 1. Missing targetUserId (cast as any)
    const resMissing = await (Outbox.requeueUnsupportedMaterialOperations as any)();
    expect(resMissing.requeuedCount).toBe(0);
    expect(resMissing.requeuedIds).toEqual([]);

    // 2. Empty string targetUserId
    const resEmpty = await Outbox.requeueUnsupportedMaterialOperations('');
    expect(resEmpty.requeuedCount).toBe(0);
    expect(resEmpty.requeuedIds).toEqual([]);

    // 3. Whitespace-only targetUserId
    const resWhitespace = await Outbox.requeueUnsupportedMaterialOperations('   ');
    expect(resWhitespace.requeuedCount).toBe(0);
    expect(resWhitespace.requeuedIds).toEqual([]);

    // 4. Cross-user recovery attempt (User B trying to recover User A's items)
    const resCrossUser = await Outbox.requeueUnsupportedMaterialOperations('usr-attacker');
    expect(resCrossUser.requeuedCount).toBe(0);
    expect(resCrossUser.requeuedIds).toEqual([]);

    // 5. Verify NO IndexedDB mutations occurred: failed store still has the item, pending store is 0
    expect(await Outbox.getFailedCount()).toBe(1);
    expect(await Outbox.getPendingCount()).toBe(0);

    const remainingFailed = await Outbox.getFailedOperations();
    expect(remainingFailed[0].id).toBe('user1-mat-preserve');
  });

  it('strictly verifies recovery invariants: preserves ID, userId, orderingKey, payload, originalCreatedAt and prevents duplicate resurrection', async () => {
    const db = await openDb();

    const originalTimestamp = 1700000000123;
    const testPayload = {
      id: 'mat-inv-1',
      projectCode: 'PRJ-101',
      items: [{ id: 'item-1', title: 'بست ریل', qty: 10 }],
      urgency: 'HIGH',
    };

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(['failed_operations'], 'readwrite');
      const store = tx.objectStore('failed_operations');

      store.put({
        id: 'op-invariant-101',
        orderingKey: 'material:mat-inv-1',
        userId: 'usr-inv-owner',
        type: 'CREATE_MATERIAL_REQUEST',
        payload: testPayload,
        errorReason: 'FEATURE_NOT_IMPLEMENTED_ON_SERVER: pending server migration',
        failedAt: Date.now() + 5000,
        retryCount: 3,
        originalCreatedAt: originalTimestamp,
      });

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    // Run recovery with owner userId
    const res = await Outbox.requeueUnsupportedMaterialOperations('usr-inv-owner');
    expect(res.requeuedCount).toBe(1);
    expect(res.requeuedIds).toEqual(['op-invariant-101']);

    // Inspect pending store to verify exact invariants
    const pendingOps = await Outbox.getPendingOperations('usr-inv-owner');
    expect(pendingOps).toHaveLength(1);
    const restored = pendingOps[0];

    // Invariant 1: Operation ID preserved
    expect(restored.id).toBe('op-invariant-101');
    // Invariant 2: User ID preserved
    expect(restored.userId).toBe('usr-inv-owner');
    // Invariant 3: Ordering key (idempotency grouping) preserved
    expect(restored.orderingKey).toBe('material:mat-inv-1');
    // Invariant 4: Type preserved
    expect(restored.type).toBe('CREATE_MATERIAL_REQUEST');
    // Invariant 5: Deep payload preserved
    expect(restored.payload).toEqual(testPayload);
    // Invariant 6: originalCreatedAt preserved (ensures FIFO ordering)
    expect(restored.createdAt).toBe(originalTimestamp);
    // Invariant 7: Backoff and retry count reset
    expect(restored.retryCount).toBe(0);
    expect(restored.nextRetryAt).toBe(0);

    // Repeated recovery call must be idempotent: returns 0 and does NOT create duplicates
    const resRepeated = await Outbox.requeueUnsupportedMaterialOperations('usr-inv-owner');
    expect(resRepeated.requeuedCount).toBe(0);
    expect(resRepeated.requeuedIds).toEqual([]);

    const pendingAfterRepeated = await Outbox.getPendingOperations('usr-inv-owner');
    expect(pendingAfterRepeated).toHaveLength(1);
    expect(await Outbox.getFailedCount()).toBe(0);
  });
});
