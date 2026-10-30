import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PostgrestError } from '@supabase/supabase-js';
import {
  Outbox,
  OutboxMutation,
  isTransientError,
  isPermanentError,
  getNextBackoffDelay,
  extractUploadsAndDeduplicate,
  computeProjectDiff,
  resetProcessingStateForTesting,
  openDb,
  PermanentError,
} from '../offlineQueue';
import { Project, Ticket } from '../../types';

describe('Talaei Outbox Writing Layer & Sync Tests', () => {
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

  // --------------------------------------------------------------------------
  // Scenario 1: Offline operations sent after going online
  // --------------------------------------------------------------------------
  it('1. sends offline-committed operations once processed online', async () => {
    const executedMutations: any[] = [];
    const mutation: OutboxMutation = {
      type: 'CREATE_PROJECT',
      orderingKey: 'project:proj-1',
      payload: { id: 'proj-1', title: 'پروژه پنت‌هاوس فرشته', status: 'SCHEDULED' },
    };

    let optimisticCalled = false;
    await Outbox.commit(mutation, 'user-tech-1', () => {
      optimisticCalled = true;
    });

    expect(optimisticCalled).toBe(true);
    expect(await Outbox.getPendingCount()).toBe(1);

    // Run processQueue simulating online execution
    await Outbox.processQueue({
      currentUserId: 'user-tech-1',
      uploadBlob: async () => 'https://storage.supabase.co/mock.jpg',
      executeMutation: async (op) => {
        executedMutations.push(op);
      },
    });

    expect(executedMutations.length).toBe(1);
    expect(executedMutations[0].orderingKey).toBe('project:proj-1');
    expect(executedMutations[0].payload.title).toBe('پروژه پنت‌هاوس فرشته');
    expect(await Outbox.getPendingCount()).toBe(0);
    expect(await Outbox.getFailedCount()).toBe(0);
  });

  // --------------------------------------------------------------------------
  // Scenario 2: Permanent failure stops only that key; other keys continue
  // --------------------------------------------------------------------------
  it('2. permanent failure blocks only its own key, while other ordering keys continue', async () => {
    const executedOps: string[] = [];

    // Op 1 (will permanently fail with PostgrestError without status) on key A
    await Outbox.commit(
      {
        type: 'PATCH_PROJECT',
        orderingKey: 'project:key-a',
        payload: { id: 'key-a', patch: { notes: 'Corrupt 1' } },
      },
      'user-qc-1'
    );

    // Op 2 (subsequent on same key A)
    await Outbox.commit(
      {
        type: 'PATCH_PROJECT',
        orderingKey: 'project:key-a',
        payload: { id: 'key-a', patch: { notes: 'Corrupt 2' } },
      },
      'user-qc-1'
    );

    // Op 3 (on independent key B)
    await Outbox.commit(
      {
        type: 'PATCH_PROJECT',
        orderingKey: 'project:key-b',
        payload: { id: 'key-b', patch: { notes: 'Valid change' } },
      },
      'user-qc-1'
    );

    expect(await Outbox.getPendingCount()).toBe(3);

    await Outbox.processQueue({
      currentUserId: 'user-qc-1',
      uploadBlob: async () => 'https://storage/mock.jpg',
      executeMutation: async (op) => {
        if (op.orderingKey === 'project:key-a') {
          // Realistic PostgrestError without status property
          throw new PostgrestError({
            message: 'Check constraint violation on column notes',
            code: '23514',
            details: 'Value violates check constraint "projects_notes_check"',
            hint: '',
          });
        }
        executedOps.push(op.orderingKey);
      },
    });

    // Op 3 on key-b must have succeeded!
    expect(executedOps).toContain('project:key-b');

    // Key-a Op 1 moved to failed, while Op 2 stays in pending blocked
    const failedOps = await Outbox.getFailedOperations();
    expect(failedOps.length).toBe(1);
    expect(failedOps[0].orderingKey).toBe('project:key-a');
    expect(failedOps[0].errorReason).toContain('Check constraint violation');

    const pendingOps = await Outbox.getPendingOperations();
    expect(pendingOps.length).toBe(1);
    expect(pendingOps[0].orderingKey).toBe('project:key-a');
    expect(pendingOps[0].payload.patch.notes).toBe('Corrupt 2');
  });

  // --------------------------------------------------------------------------
  // Scenario 3: App closed mid-upload never writes base64 to DB
  // --------------------------------------------------------------------------
  it('3. never writes raw base64 data URLs to Postgres; holds uploads separately', async () => {
    const rawDataUrl = 'data:image/jpeg;base64,' + btoa('mock-photo-content-12345');
    const rawSignature = 'data:image/png;base64,' + btoa('mock-signature-content-67890');

    const mutation: OutboxMutation = {
      type: 'PATCH_PROJECT',
      orderingKey: 'project:photo-test',
      payload: {
        id: 'photo-test',
        patch: {
          completionNotes: 'Installed luxury curtains',
          beforePhotos: [rawDataUrl],
          afterPhotos: [rawDataUrl], // Identical image deduplicated across targets
          customerSignature: rawSignature,
        },
      },
    };

    await Outbox.commit(mutation, 'user-tech-1');

    // 1. Verify pending_operations contains ZERO data URLs
    const pendingOps = await Outbox.getPendingOperations();
    expect(pendingOps.length).toBe(1);
    const storedPatch = pendingOps[0].payload.patch;
    expect(storedPatch.beforePhotos[0]).toBe('');
    expect(storedPatch.afterPhotos[0]).toBe('');
    expect(storedPatch.customerSignature).toBe('');

    // 2. Verify pending_uploads holds the deduplicated blobs
    const db = await openDb();
    const uploads: any[] = await new Promise((resolve) => {
      const tx = db.transaction('pending_uploads', 'readonly');
      const store = tx.objectStore('pending_uploads');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
    });

    // 2 unique files: 1 image (mapped to 2 targets) + 1 signature
    expect(uploads.length).toBe(2);
    const photoUpload = uploads.find((u) => u.mimeType === 'image/jpeg');
    expect(photoUpload.targets.length).toBe(2); // beforePhotos[0] and afterPhotos[0]

    // 3. If upload fails mid-way, executeMutation must NOT be called
    let mutationCalled = false;
    await Outbox.processQueue({
      currentUserId: 'user-tech-1',
      uploadBlob: async () => {
        throw new Error('Connection lost mid-upload');
      },
      executeMutation: async () => {
        mutationCalled = true;
      },
    });

    expect(mutationCalled).toBe(false);
  });

  // --------------------------------------------------------------------------
  // Scenario 4: Older patch never executes after newer patch (FIFO order per key)
  // --------------------------------------------------------------------------
  it('4. strictly preserves FIFO execution order per orderingKey', async () => {
    const executionHistory: number[] = [];

    await Outbox.commit(
      {
        type: 'PATCH_PROJECT',
        orderingKey: 'project:fifo-p',
        payload: { id: 'fifo-p', patch: { step: 1 } },
      },
      'user-1'
    );

    await Outbox.commit(
      {
        type: 'PATCH_PROJECT',
        orderingKey: 'project:fifo-p',
        payload: { id: 'fifo-p', patch: { step: 2 } },
      },
      'user-1'
    );

    await Outbox.processQueue({
      currentUserId: 'user-1',
      uploadBlob: async () => 'https://storage/mock.jpg',
      executeMutation: async (op) => {
        executionHistory.push(op.payload.patch.step);
      },
    });

    expect(executionHistory).toEqual([1, 2]);
  });

  // --------------------------------------------------------------------------
  // Scenario 5: Network error classification & backoff vs permanent errors
  // --------------------------------------------------------------------------
  it('5. classifies real-world PostgrestError, PermanentError, and TypeError correctly', async () => {
    // 1. PermanentError instances must ALWAYS be permanent
    expect(isTransientError(new PermanentError('Client validation: empty signature'))).toBe(false);
    expect(isPermanentError(new PermanentError('Client validation: data URL rejected'))).toBe(true);

    // 2. PostgrestError without status property
    // P0001 (raise exception from PL/pgSQL like patch_project rejection)
    const p0001Err = new PostgrestError({
      message: 'Patch cannot contain base64 data URLs',
      code: 'P0001',
      details: '',
      hint: '',
    });
    expect(isTransientError(p0001Err)).toBe(false);
    expect(isPermanentError(p0001Err)).toBe(true);

    // 23505 (unique_violation)
    const uniqueErr = new PostgrestError({
      message: 'duplicate key value violates unique constraint',
      code: '23505',
      details: 'Key (id)=(proj-1) already exists.',
      hint: '',
    });
    expect(isTransientError(uniqueErr)).toBe(false);

    // 22P02 (invalid_text_representation)
    const syntaxErr = new PostgrestError({
      message: 'invalid input syntax for type integer',
      code: '22P02',
      details: '',
      hint: '',
    });
    expect(isTransientError(syntaxErr)).toBe(false);

    // PGRST116 (JSON query resulted in 0 rows)
    const notFoundErr = new PostgrestError({
      message: 'The result contains 0 rows',
      code: 'PGRST116',
      details: '',
      hint: '',
    });
    expect(isTransientError(notFoundErr)).toBe(false);

    // 42501 (RLS violation) with session -> Permanent
    const rlsWithSession = new PostgrestError({
      message: 'new row violates row-level security policy',
      code: '42501',
      details: '',
      hint: '',
    });
    expect(isTransientError(rlsWithSession, true)).toBe(false);

    // 42501 (RLS violation) without session -> Transient (can refresh session)
    const rlsWithoutSession = new PostgrestError({
      message: 'new row violates row-level security policy',
      code: '42501',
      details: '',
      hint: '',
    });
    expect(isTransientError(rlsWithoutSession, false)).toBe(true);

    // Transient Postgrest codes
    const pgrst000 = new PostgrestError({ message: 'could not connect', code: 'PGRST000', details: '', hint: '' });
    const pgrst001 = new PostgrestError({ message: 'schema cache reload', code: 'PGRST001', details: '', hint: '' });
    const pgrst002 = new PostgrestError({ message: 'timeout connecting', code: 'PGRST002', details: '', hint: '' });
    const pgrst301 = new PostgrestError({ message: 'JWT expired', code: 'PGRST301', details: '', hint: '' });
    expect(isTransientError(pgrst000)).toBe(true);
    expect(isTransientError(pgrst001)).toBe(true);
    expect(isTransientError(pgrst002)).toBe(true);
    expect(isTransientError(pgrst301)).toBe(true);

    // 3. TypeError and AbortError
    expect(isTransientError(new TypeError('Failed to fetch'))).toBe(true);
    const abortErr = new Error('The user aborted a request.');
    abortErr.name = 'AbortError';
    expect(isTransientError(abortErr)).toBe(true);

    // 4. HTTP status codes
    expect(isTransientError({ status: 408 })).toBe(true);
    expect(isTransientError({ status: 429 })).toBe(true);
    expect(isTransientError({ status: 500 })).toBe(true);
    expect(isTransientError({ status: 502 })).toBe(true);
    expect(isTransientError({ status: 503 })).toBe(true);
    expect(isTransientError({ status: 401 })).toBe(true);
    expect(isTransientError({ status: 400 })).toBe(false);
    expect(isTransientError({ status: 422 })).toBe(false);

    // 5. status 0 ONLY when error is NOT a PostgrestError or PermanentError
    expect(isTransientError({ status: 0 })).toBe(true);
    expect(isTransientError({ status: 0, code: 'P0001', name: 'PostgrestError' })).toBe(false);

    // 6. Backoff formula check
    expect(getNextBackoffDelay(0)).toBe(15000);
    expect(getNextBackoffDelay(1)).toBe(30000);
    expect(getNextBackoffDelay(2)).toBe(60000);
    expect(getNextBackoffDelay(3)).toBe(120000);
    expect(getNextBackoffDelay(10)).toBe(900000); // capped at 15 mins

    // 7. Verify transient network error stays in pending queue with backoff and is never sent to failed
    await Outbox.commit(
      {
        type: 'PATCH_PROJECT',
        orderingKey: 'project:transient-test',
        payload: { id: 'transient-test', patch: { title: 'Network test' } },
      },
      'user-1'
    );

    for (let i = 0; i < 5; i++) {
      const ops = await Outbox.getPendingOperations();
      if (ops.length > 0) {
        ops[0].nextRetryAt = 0;
        const db = await openDb();
        await new Promise<void>((res) => {
          const tx = db.transaction('pending_operations', 'readwrite');
          tx.objectStore('pending_operations').put(ops[0]);
          tx.oncomplete = () => res();
        });
      }

      await Outbox.processQueue({
        currentUserId: 'user-1',
        uploadBlob: async () => 'https://storage/mock.jpg',
        executeMutation: async () => {
          throw new TypeError('Failed to fetch');
        },
      });
    }

    const pendingOps = await Outbox.getPendingOperations();
    expect(pendingOps.length).toBe(1);
    expect(pendingOps[0].retryCount).toBe(5);
    expect(pendingOps[0].nextRetryAt).toBeGreaterThan(Date.now());

    const failedOps = await Outbox.getFailedOperations();
    expect(failedOps.length).toBe(0);
  });

  // --------------------------------------------------------------------------
  // Scenario 6: User B does not send User A's operations
  // --------------------------------------------------------------------------
  it('6. user B does not process operations owned by User A', async () => {
    let executed = false;

    // User A commits an operation
    await Outbox.commit(
      {
        type: 'CREATE_TICKET',
        orderingKey: 'ticket:t-100',
        payload: { id: 't-100', description: 'User A emergency ticket' },
      },
      'user-a'
    );

    // User B attempts to run processQueue
    await Outbox.processQueue({
      currentUserId: 'user-b',
      uploadBlob: async () => 'https://storage/mock.jpg',
      executeMutation: async () => {
        executed = true;
      },
    });

    // Must NOT have executed
    expect(executed).toBe(false);
    expect(await Outbox.getPendingCount()).toBe(1);

    // User A runs processQueue
    await Outbox.processQueue({
      currentUserId: 'user-a',
      uploadBlob: async () => 'https://storage/mock.jpg',
      executeMutation: async () => {
        executed = true;
      },
    });

    expect(executed).toBe(true);
    expect(await Outbox.getPendingCount()).toBe(0);
  });

  // --------------------------------------------------------------------------
  // Scenario 7: Refetch does not wipe in-queue changes from screen (applyPendingToProjects)
  // --------------------------------------------------------------------------
  it('7. applyPendingToProjects merges in-flight outbox mutations on top of stale cloud data', async () => {
    const cloudProjects: Project[] = [
      {
        id: 'p-cloud-1',
        code: 'TAL-101',
        title: 'عنوان سرور قدیمی',
        customerName: 'آقای رضایی',
        customerPhone: '09121111111',
        address: 'الهیه',
        status: 'SCHEDULED',
        shadePanels: 4,
        curtainPanels: 2,
        assignedTechnicianIds: ['u1'],
        leadTechnicianId: 'u1',
        toolsRequired: ['تراز لیزری'],
        proposalImages: [],
        scheduledDate: '1405-08-10',
        scheduledTime: '10:00',
        isFullTools: false,
        evaluations: [],
      } as any,
    ];

    // Commit an in-flight patch not yet synced to cloud
    await Outbox.commit(
      {
        type: 'PATCH_PROJECT',
        orderingKey: 'project:p-cloud-1',
        payload: {
          id: 'p-cloud-1',
          patch: {
            title: 'عنوان تغییر یافته تکنسین سر پروژه',
            status: 'IN_PROGRESS',
          },
        },
      },
      'user-1'
    );

    // Commit an atomic evaluation append
    await Outbox.commit(
      {
        type: 'APPEND_PROJECT_EVALUATION',
        orderingKey: 'project:p-cloud-1',
        payload: {
          id: 'p-cloud-1',
          evaluation: {
            id: 'eval-1',
            userId: 'u1',
            userName: 'علی حسینی',
            role: 'LEAD_INSTALLER',
            technicalScore: 5,
            behavioralScore: 5,
            cleanlinessScore: 5,
            evaluatedBy: 'مدیر QC',
            evaluatedAt: '1405-08-10',
          },
        },
      },
      'user-1'
    );

    // Refetch server data and apply in-flight pending operations
    const merged = await Outbox.applyPendingToProjects(cloudProjects);

    expect(merged.length).toBe(1);
    expect(merged[0].title).toBe('عنوان تغییر یافته تکنسین سر پروژه');
    expect(merged[0].status).toBe('IN_PROGRESS');
    expect(merged[0].evaluations?.length).toBe(1);
    expect(merged[0].evaluations?.[0].technicalScore).toBe(5);
  });

  // --------------------------------------------------------------------------
  // Scenario 8: End-to-end rejection by patch_project with P0001 moves to failed_operations
  // --------------------------------------------------------------------------
  it('8. end-to-end: patch_project rejected by database with P0001 moves to failed_operations', async () => {
    await Outbox.commit(
      {
        type: 'PATCH_PROJECT',
        orderingKey: 'project:p-p0001',
        payload: {
          id: 'p-p0001',
          patch: { completionNotes: 'Invalid update rejected by SQL' },
        },
      },
      'user-tech-1'
    );

    expect(await Outbox.getPendingCount()).toBe(1);
    expect(await Outbox.getFailedCount()).toBe(0);

    // Simulate executeMutation executing Supabase rpc which throws PostgrestError with code P0001 and NO status
    await Outbox.processQueue({
      currentUserId: 'user-tech-1',
      uploadBlob: async () => 'https://storage/mock.jpg',
      executeMutation: async () => {
        throw new PostgrestError({
          message: 'Patch cannot contain base64 data URLs',
          code: 'P0001',
          details: 'Failing constraint inside patch_project PL/pgSQL function',
          hint: 'Ensure all images are uploaded first',
        });
      },
    });

    // Operation must be in failed_operations, removed from pending_operations
    expect(await Outbox.getPendingCount()).toBe(0);
    expect(await Outbox.getFailedCount()).toBe(1);

    const failedOps = await Outbox.getFailedOperations();
    expect(failedOps.length).toBe(1);
    expect(failedOps[0].orderingKey).toBe('project:p-p0001');
    expect(failedOps[0].errorReason).toContain('Patch cannot contain base64 data URLs');
  });
});
