import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  Outbox,
  OutboxMutation,
  OutboxMutationType,
  OutboxOperation,
  resetProcessingStateForTesting,
  openDb,
  isKeyInFlight,
  getActiveLeasesCount,
  abortActiveProcessing,
  isOperationRetrySafe,
  closeDb,
  performStartupRecovery,
} from '../offlineQueue';

// In Node environment, polyfill window EventTarget if not present
if (typeof (globalThis as any).window === 'undefined') {
  const listeners = new Map<string, Set<(e: any) => void>>();
  (globalThis as any).window = {
    indexedDB: (globalThis as any).indexedDB,
    addEventListener: (type: string, listener: any) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(listener);
    },
    removeEventListener: (type: string, listener: any) => {
      listeners.get(type)?.delete(listener);
    },
    dispatchEvent: (event: any) => {
      const set = listeners.get(event.type);
      if (set) {
        for (const fn of set) {
          fn(event);
        }
      }
      return true;
    },
  };
} else if (!(globalThis as any).window.indexedDB) {
  (globalThis as any).window.indexedDB = (globalThis as any).indexedDB;
}

if (typeof (globalThis as any).CustomEvent === 'undefined') {
  (globalThis as any).CustomEvent = class CustomEvent {
    type: string;
    detail: any;
    constructor(type: string, params: any = {}) {
      this.type = type;
      this.detail = params.detail;
    }
  };
}

describe('M1-B1 Outbox Engine Hardening Tests', () => {
  beforeEach(async () => {
    vi.useRealTimers();
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

  afterEach(() => {
    vi.useRealTimers();
    resetProcessingStateForTesting();
    vi.restoreAllMocks();
  });

  // --------------------------------------------------------------------------
  // Scenario 1: Strict Operation Ownership Isolation
  // --------------------------------------------------------------------------
  it('1. foreign-user operations remain dormant and are never dispatched with current user session', async () => {
    const executedMutations: any[] = [];

    // User A commits an operation
    const mutationA: OutboxMutation = {
      type: 'CREATE_PROJECT',
      orderingKey: 'project:p-user-a',
      payload: { id: 'p-user-a', title: 'پروژه کاربر الف', status: 'SCHEDULED' },
    };
    await Outbox.commit(mutationA, 'user-a');

    expect(await Outbox.getPendingCount('user-a')).toBe(1);
    expect(await Outbox.getPendingCount('user-b')).toBe(0);

    // User B is logged in and triggers queue processing
    await Outbox.processQueue({
      currentUserId: 'user-b',
      uploadBlob: async () => 'https://mock.storage/blob.jpg',
      executeMutation: async (op) => {
        executedMutations.push(op);
      },
    });

    // Foreign operation must NOT be dispatched
    expect(executedMutations.length).toBe(0);

    // Operation must remain intact in STORE_PENDING
    const db = await openDb();
    const pendingOps: any[] = await new Promise((resolve, reject) => {
      const tx = db.transaction('pending_operations', 'readonly');
      const req = tx.objectStore('pending_operations').getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    expect(pendingOps.length).toBe(1);
    expect(pendingOps[0].userId).toBe('user-a');
    expect(pendingOps[0].executionState).toBe('QUEUED');

    // When User A logs back in, operation is dispatched
    await Outbox.processQueue({
      currentUserId: 'user-a',
      uploadBlob: async () => 'https://mock.storage/blob.jpg',
      executeMutation: async (op) => {
        executedMutations.push(op);
      },
    });

    expect(executedMutations.length).toBe(1);
    expect(executedMutations[0].id).toBe(pendingOps[0].id);
    expect(await Outbox.getPendingCount('user-a')).toBe(0);
  });

  // --------------------------------------------------------------------------
  // Scenario 2: In-Flight Concurrency Lease (Duplicate Dispatch Prevention)
  // --------------------------------------------------------------------------
  it('2. holds in-flight lease and prevents concurrent duplicate dispatch on same ordering key', async () => {
    let dispatchCount = 0;
    let resolveFirstMutation: () => void = () => {};
    const mutationPromise = new Promise<void>((res) => {
      resolveFirstMutation = res;
    });

    const mutation: OutboxMutation = {
      type: 'PATCH_PROJECT',
      orderingKey: 'project:p-lease-test',
      payload: { id: 'p-lease-test', patch: { status: 'IN_PROGRESS' } },
    };
    await Outbox.commit(mutation, 'user-tech-1');

    // First queue processor run starts mutation (slow network)
    const run1 = Outbox.processQueue({
      currentUserId: 'user-tech-1',
      uploadBlob: async () => 'mock-url',
      executeMutation: async () => {
        dispatchCount++;
        await mutationPromise;
      },
    });

    // Give microtasks time to start processing, acquire lease, and enter dispatch
    for (let i = 0; i < 50 && (!isKeyInFlight('project:p-lease-test') || dispatchCount === 0); i++) {
      await new Promise((r) => setTimeout(r, 10));
    }

    // Verify lease is held
    expect(isKeyInFlight('project:p-lease-test')).toBe(true);
    expect(getActiveLeasesCount()).toBe(1);

    // Concurrent second queue processor run triggered (e.g. online event or duplicate trigger)
    const run2 = Outbox.processQueue({
      currentUserId: 'user-tech-1',
      uploadBlob: async () => 'mock-url',
      executeMutation: async () => {
        dispatchCount++;
      },
    });

    await run2;

    // Second run must NOT have dispatched duplicate request
    expect(dispatchCount).toBe(1);

    // Now complete the in-flight network call
    resolveFirstMutation();
    await run1;

    // Verify lease is released in finally
    expect(isKeyInFlight('project:p-lease-test')).toBe(false);
    expect(getActiveLeasesCount()).toBe(0);
    expect(dispatchCount).toBe(1);
  });

  // --------------------------------------------------------------------------
  // Scenario 3: 45-Second Watchdog Does NOT Release Lease or Authorize Retries
  // --------------------------------------------------------------------------
  it('3. 45-second diagnostic watchdog raises alert without releasing lease or authorizing retry', async () => {
    let watchdogAlertFired = false;
    let alertDetails: any = null;

    const handleWatchdog = (event: Event) => {
      watchdogAlertFired = true;
      alertDetails = (event as CustomEvent).detail;
    };
    window.addEventListener('talaie-sync-watchdog-alert', handleWatchdog);

    let resolvePromise: () => void = () => {};
    const longRunningMutation = new Promise<void>((res) => {
      resolvePromise = res;
    });

    const mutation: OutboxMutation = {
      type: 'PATCH_PROJECT',
      orderingKey: 'project:p-watchdog',
      payload: { id: 'p-watchdog', patch: { status: 'IN_PROGRESS' } },
    };
    await Outbox.commit(mutation, 'user-tech-1');

    vi.useFakeTimers();

    try {
      const queuePromise = Outbox.processQueue({
        currentUserId: 'user-tech-1',
        uploadBlob: async () => 'mock-url',
        executeMutation: async () => {
          await longRunningMutation;
        },
      });

      // Advance initial ticks so indexedDB queries resolve and lease is claimed
      await vi.advanceTimersByTimeAsync(50);
      expect(isKeyInFlight('project:p-watchdog')).toBe(true);

      // Now advance past 45 seconds (45,000ms)
      await vi.advanceTimersByTimeAsync(45000);

      // Diagnostic alert must have fired
      expect(watchdogAlertFired).toBe(true);
      expect(alertDetails.orderingKey).toBe('project:p-watchdog');

      // CRITICAL SAFETY CHECK: Lease must STILL be held! Watchdog must NOT release lease!
      expect(isKeyInFlight('project:p-watchdog')).toBe(true);

      // Resolve promise and let queue finish
      resolvePromise();
      await vi.advanceTimersByTimeAsync(50);
      await queuePromise;

      // Lease released only after promise settled
      expect(isKeyInFlight('project:p-watchdog')).toBe(false);
    } finally {
      vi.useRealTimers();
      window.removeEventListener('talaie-sync-watchdog-alert', handleWatchdog);
    }
  });

  // --------------------------------------------------------------------------
  // Scenario 4: Delayed Server Success Acknowledged in IndexedDB After Logout
  // --------------------------------------------------------------------------
  it('4. confirms and deletes operation in IndexedDB when server commits after logout, dropping UI callbacks', async () => {
    let sessionEpoch = 1;
    let resolveServerCommit: () => void = () => {};
    const serverCommitPromise = new Promise<void>((res) => {
      resolveServerCommit = res;
    });

    const mutation: OutboxMutation = {
      type: 'PATCH_PROJECT',
      orderingKey: 'project:p-session-test',
      payload: { id: 'p-session-test', patch: { status: 'COMPLETED' } },
    };
    await Outbox.commit(mutation, 'user-a');

    const queuePromise = Outbox.processQueue({
      currentUserId: 'user-a',
      getCurrentSessionEpoch: () => sessionEpoch,
      uploadBlob: async () => 'mock-url',
      executeMutation: async () => {
        await serverCommitPromise;
      },
    });

    // Let the mutation start and enter in-flight
    for (let i = 0; i < 25 && !isKeyInFlight('project:p-session-test'); i++) {
      await new Promise((r) => setTimeout(r, 10));
    }
    expect(isKeyInFlight('project:p-session-test')).toBe(true);

    // User logs out while request is traveling through PostgreSQL commit
    sessionEpoch = 2; // Session epoch incremented
    abortActiveProcessing(); // Active queue processing aborted

    // Server successfully commits the transaction (200 OK)
    resolveServerCommit();
    await queuePromise;

    // Verify operation is deleted from IndexedDB STORE_PENDING (server success acknowledged!)
    const db = await openDb();
    const pendingOps: any[] = await new Promise((resolve, reject) => {
      const tx = db.transaction('pending_operations', 'readonly');
      const req = tx.objectStore('pending_operations').getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    // Must be completely deleted to prevent duplicate execution on next login
    expect(pendingOps.length).toBe(0);
    expect(isKeyInFlight('project:p-session-test')).toBe(false);
  });

  // --------------------------------------------------------------------------
  // Scenario 5: Binary Photo Blob Preservation on Error / Unknown Outcome
  // --------------------------------------------------------------------------
  it('5. preserves binary photo blobs in STORE_UPLOADS when operations fail or encounter unknown outcome', async () => {
    const base64Data =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    const mutation: OutboxMutation = {
      type: 'PATCH_PROJECT',
      orderingKey: 'project:p-photo-test',
      payload: {
        id: 'p-photo-test',
        patch: { completionPhotos: [base64Data] },
      },
    };
    await Outbox.commit(mutation, 'user-tech-1');

    // Confirm photo blob is saved in STORE_UPLOADS
    const db = await openDb();
    let uploads: any[] = await new Promise((resolve, reject) => {
      const tx = db.transaction('pending_uploads', 'readonly');
      const req = tx.objectStore('pending_uploads').getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    expect(uploads.length).toBe(1);

    // Simulation 5A: Transient error (network drops during upload)
    await Outbox.processQueue({
      currentUserId: 'user-tech-1',
      uploadBlob: async () => {
        throw new Error('Failed to fetch'); // Network drop
      },
      executeMutation: async () => {},
    });

    // Check operation executionState
    let pendingOps: any[] = await new Promise((resolve, reject) => {
      const tx = db.transaction('pending_operations', 'readonly');
      const req = tx.objectStore('pending_operations').getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    expect(pendingOps[0].executionState).toBe('UNKNOWN_OUTCOME');
    expect(pendingOps[0].unknownReason).toBe('NON_IDEMPOTENT_OPERATION_HELD');
    expect(pendingOps[0].lastError).toContain('Failed to fetch');

    // CRITICAL CHECK: Upload blob must STILL be preserved in STORE_UPLOADS
    uploads = await new Promise((resolve, reject) => {
      const tx = db.transaction('pending_uploads', 'readonly');
      const req = tx.objectStore('pending_uploads').getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    expect(uploads.length).toBe(1);

    // Reset backoff delay so we can attempt retry immediately
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('pending_operations', 'readwrite');
      const store = tx.objectStore('pending_operations');
      pendingOps[0].executionState = 'QUEUED';
      pendingOps[0].nextRetryAt = 0;
      const req = store.put(pendingOps[0]);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });

    // Simulation 5B: Permanent failure (400 Bad Request)
    await Outbox.processQueue({
      currentUserId: 'user-tech-1',
      uploadBlob: async () => {
        const err: any = new Error('Permanent schema validation failure');
        err.status = 400;
        throw err;
      },
      executeMutation: async () => {},
    });

    // Moved to STORE_FAILED
    const failedOps: any[] = await new Promise((resolve, reject) => {
      const tx = db.transaction('failed_operations', 'readonly');
      const req = tx.objectStore('failed_operations').getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    expect(failedOps.length).toBe(1);

    // CRITICAL CHECK: Upload blob is NEVER destroyed even on permanent failure
    uploads = await new Promise((resolve, reject) => {
      const tx = db.transaction('pending_uploads', 'readonly');
      const req = tx.objectStore('pending_uploads').getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    expect(uploads.length).toBe(1);
  });

  // --------------------------------------------------------------------------
  // Scenario 6: Baseline Snapshot Lifecycle Conflict Detection (CONFLICT_HOLD)
  // --------------------------------------------------------------------------
  it('6. detects lifecycle contradiction against server snapshot and transitions to CONFLICT_HOLD without dispatching', async () => {
    let mutationDispatched = false;

    const mutation: OutboxMutation = {
      type: 'PATCH_PROJECT',
      orderingKey: 'project:p-lifecycle-conflict',
      payload: {
        id: 'p-lifecycle-conflict',
        patch: { status: 'PAUSED' },
      },
      baselineSnapshot: {
        projectId: 'p-lifecycle-conflict',
        status: 'IN_PROGRESS',
        updatedAt: '2026-11-14T08:00:00Z',
      },
    };
    await Outbox.commit(mutation, 'user-tech-1');

    await Outbox.processQueue({
      currentUserId: 'user-tech-1',
      uploadBlob: async () => 'mock-url',
      // Server preflight snapshot returns that project was already COMPLETED by another supervisor
      fetchProjectSnapshot: async () => ({
        status: 'COMPLETED',
        updatedAt: '2026-11-14T10:00:00Z',
      }),
      executeMutation: async () => {
        mutationDispatched = true;
      },
    });

    // Must NOT dispatch conflicting patch
    expect(mutationDispatched).toBe(false);

    // Inspect operation in IndexedDB
    const db = await openDb();
    const pendingOps: any[] = await new Promise((resolve, reject) => {
      const tx = db.transaction('pending_operations', 'readonly');
      const req = tx.objectStore('pending_operations').getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    expect(pendingOps.length).toBe(1);
    expect(pendingOps[0].executionState).toBe('CONFLICT_HOLD');
    expect(pendingOps[0].conflictDetails.serverStatus).toBe('COMPLETED');
    expect(pendingOps[0].conflictDetails.clientStatus).toBe('PAUSED');

    // On subsequent queue execution, CONFLICT_HOLD operation stops processing for that key
    await Outbox.processQueue({
      currentUserId: 'user-tech-1',
      uploadBlob: async () => 'mock-url',
      executeMutation: async () => {
        mutationDispatched = true;
      },
    });
    expect(mutationDispatched).toBe(false);
  });

  // --------------------------------------------------------------------------
  // Scenario 7: Lease Release Dispatches Queue Awakening Event
  // --------------------------------------------------------------------------
  it('7. dispatches talaie-queue-lease-released event upon settling lease', async () => {
    let leaseReleasedEventFired = false;
    let releasedEventDetail: any = null;

    const handleLeaseReleased = (event: Event) => {
      leaseReleasedEventFired = true;
      releasedEventDetail = (event as CustomEvent).detail;
    };
    window.addEventListener('talaie-queue-lease-released', handleLeaseReleased);

    const mutation: OutboxMutation = {
      type: 'PATCH_PROJECT',
      orderingKey: 'project:p-awaken-test',
      payload: { id: 'p-awaken-test', patch: { status: 'IN_PROGRESS' } },
    };
    await Outbox.commit(mutation, 'user-tech-1');

    await Outbox.processQueue({
      currentUserId: 'user-tech-1',
      uploadBlob: async () => 'mock-url',
      executeMutation: async () => {},
    });

    expect(leaseReleasedEventFired).toBe(true);
    expect(releasedEventDetail.orderingKey).toBe('project:p-awaken-test');

    window.removeEventListener('talaie-queue-lease-released', handleLeaseReleased);
  });

  // --------------------------------------------------------------------------
  // Scenario 8: Session Switch Race During Snapshot Preflight
  // --------------------------------------------------------------------------
  it('8. halts User A operation when session changes during fetchProjectSnapshot and never executes under User B', async () => {
    let currentEpoch = 1;
    let activeUser = 'user-a';
    let mutationDispatchedWithUser: string | null = null;

    let resolveSnapshot: (val: any) => void = () => {};
    const snapshotPromise = new Promise<{ status: string; updatedAt: string }>((res) => {
      resolveSnapshot = res;
    });

    const mutation: OutboxMutation = {
      type: 'PATCH_PROJECT',
      orderingKey: 'project:p-race-test',
      payload: { id: 'p-race-test', patch: { status: 'IN_PROGRESS' } },
      baselineSnapshot: { projectId: 'p-race-test', status: 'SCHEDULED' },
    };
    await Outbox.commit(mutation, 'user-a');

    // 1. Start User A's queue processor
    const queuePromiseA = Outbox.processQueue({
      currentUserId: 'user-a',
      getCurrentSessionEpoch: () => currentEpoch,
      fetchProjectSnapshot: async () => {
        // 2. Delays fetchProjectSnapshot
        return await snapshotPromise;
      },
      uploadBlob: async () => 'mock-url',
      executeMutation: async () => {
        mutationDispatchedWithUser = activeUser;
      },
    });

    // Wait slightly so queue processing starts and enters fetchProjectSnapshot
    await new Promise((r) => setTimeout(r, 15));

    // 3. Changes session to User B and calls abortActiveProcessing
    currentEpoch = 2;
    activeUser = 'user-b';
    abortActiveProcessing();

    // 4. Resolves the delayed snapshot
    resolveSnapshot({ status: 'SCHEDULED', updatedAt: new Date().toISOString() });
    await queuePromiseA;

    // 5. Verifies that User A's operation was NEVER dispatched using User B's session
    expect(mutationDispatchedWithUser).toBeNull();

    // User B runs queue processor; User A's operation must remain dormant in STORE_PENDING
    await Outbox.processQueue({
      currentUserId: 'user-b',
      getCurrentSessionEpoch: () => currentEpoch,
      uploadBlob: async () => 'mock-url',
      executeMutation: async () => {
        mutationDispatchedWithUser = 'user-b';
      },
    });

    expect(mutationDispatchedWithUser).toBeNull();

    // Operation must remain intact in STORE_PENDING for User A
    const db = await openDb();
    const pendingOps: any[] = await new Promise((resolve, reject) => {
      const tx = db.transaction('pending_operations', 'readonly');
      const req = tx.objectStore('pending_operations').getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    expect(pendingOps.length).toBe(1);
    expect(pendingOps[0].userId).toBe('user-a');
  });

  // --------------------------------------------------------------------------
  // Scenario 9: UNKNOWN_OUTCOME Holds Non-Idempotent Operations (APPEND_PROJECT_EVALUATION)
  // --------------------------------------------------------------------------
  it('9. never automatically retries APPEND_PROJECT_EVALUATION after UNKNOWN_OUTCOME and blocks ordering key', async () => {
    let dispatchAttempts = 0;

    const evalMutation: OutboxMutation = {
      type: 'APPEND_PROJECT_EVALUATION',
      orderingKey: 'project:p-eval-test',
      payload: {
        id: 'p-eval-test',
        evaluation: {
          id: 'eval-1',
          technicianId: 'tech-1',
          score: 5,
          createdAt: new Date().toISOString(),
        },
      },
    };
    await Outbox.commit(evalMutation, 'user-qc-1');

    // First run fails with a transient network drop (UNKNOWN_OUTCOME)
    await Outbox.processQueue({
      currentUserId: 'user-qc-1',
      uploadBlob: async () => 'mock-url',
      executeMutation: async () => {
        dispatchAttempts++;
        throw new Error('Connection reset by peer');
      },
    });

    expect(dispatchAttempts).toBe(1);

    // Verify operation executionState in IndexedDB is UNKNOWN_OUTCOME with non-retryable reason
    const db = await openDb();
    let pendingOps: any[] = await new Promise((resolve, reject) => {
      const tx = db.transaction('pending_operations', 'readonly');
      const req = tx.objectStore('pending_operations').getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    expect(pendingOps.length).toBe(1);
    expect(pendingOps[0].executionState).toBe('UNKNOWN_OUTCOME');
    expect(pendingOps[0].unknownReason).toBe('NON_IDEMPOTENT_OPERATION_HELD');
    expect(pendingOps[0].nextRetryAt).toBe(0);

    // Commit a subsequent mutation on the same ordering key
    const nextMutation: OutboxMutation = {
      type: 'PATCH_PROJECT',
      orderingKey: 'project:p-eval-test',
      payload: { id: 'p-eval-test', patch: { notes: 'second op' } },
    };
    await Outbox.commit(nextMutation, 'user-qc-1');

    // App restart simulation: reset processing state, close db, trigger queue again
    resetProcessingStateForTesting();

    await Outbox.processQueue({
      currentUserId: 'user-qc-1',
      uploadBlob: async () => 'mock-url',
      executeMutation: async () => {
        dispatchAttempts++;
      },
    });

    // CRITICAL: APPEND_PROJECT_EVALUATION must NOT be retried, and subsequent op on same key must remain blocked!
    expect(dispatchAttempts).toBe(1);

    const recheckDb = await openDb();
    pendingOps = await new Promise((resolve, reject) => {
      const tx = recheckDb.transaction('pending_operations', 'readonly');
      const req = tx.objectStore('pending_operations').getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    expect(pendingOps.length).toBe(2);
    const evalOp = pendingOps.find((o) => o.type === 'APPEND_PROJECT_EVALUATION');
    expect(evalOp).toBeDefined();
    expect(evalOp.executionState).toBe('UNKNOWN_OUTCOME');
  });

  // --------------------------------------------------------------------------
  // Scenario 10: Snapshot Preflight Must Not Fail Open
  // --------------------------------------------------------------------------
  it('10. transitions to CONFLICT_HOLD without dispatching when snapshot fetch fails or returns null', async () => {
    let dispatchCalled = false;

    // Test 10A: Snapshot fetch throws an error (e.g. server probe failure)
    const mutationA: OutboxMutation = {
      type: 'PATCH_PROJECT',
      orderingKey: 'project:p-fail-closed-err',
      payload: { id: 'p-fail-closed-err', patch: { status: 'COMPLETED' } },
      baselineSnapshot: { projectId: 'p-fail-closed-err', status: 'IN_PROGRESS' },
    };
    await Outbox.commit(mutationA, 'user-tech-1');

    await Outbox.processQueue({
      currentUserId: 'user-tech-1',
      uploadBlob: async () => 'mock-url',
      fetchProjectSnapshot: async () => {
        throw new Error('Supabase gateway timeout (504)');
      },
      executeMutation: async () => {
        dispatchCalled = true;
      },
    });

    // Must NOT fail open or dispatch!
    expect(dispatchCalled).toBe(false);

    const db = await openDb();
    let pendingOps: any[] = await new Promise((resolve, reject) => {
      const tx = db.transaction('pending_operations', 'readonly');
      const req = tx.objectStore('pending_operations').getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    const opA = pendingOps.find((o) => o.orderingKey === 'project:p-fail-closed-err');
    expect(opA.executionState).toBe('CONFLICT_HOLD');
    expect(opA.conflictDetails.reason).toContain('Supabase gateway timeout');

    // Test 10B: Snapshot fetch returns null (server project snapshot missing/unreachable)
    const mutationB: OutboxMutation = {
      type: 'PATCH_PROJECT',
      orderingKey: 'project:p-fail-closed-null',
      payload: { id: 'p-fail-closed-null', patch: { status: 'COMPLETED' } },
      baselineSnapshot: { projectId: 'p-fail-closed-null', status: 'IN_PROGRESS' },
    };
    await Outbox.commit(mutationB, 'user-tech-1');

    await Outbox.processQueue({
      currentUserId: 'user-tech-1',
      uploadBlob: async () => 'mock-url',
      fetchProjectSnapshot: async () => null,
      executeMutation: async () => {
        dispatchCalled = true;
      },
    });

    // Must NOT fail open or dispatch!
    expect(dispatchCalled).toBe(false);

    pendingOps = await new Promise((resolve, reject) => {
      const tx = db.transaction('pending_operations', 'readonly');
      const req = tx.objectStore('pending_operations').getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    const opB = pendingOps.find((o) => o.orderingKey === 'project:p-fail-closed-null');
    expect(opB.executionState).toBe('CONFLICT_HOLD');
    expect(opB.conflictDetails.reason).toContain('SERVER_SNAPSHOT_UNAVAILABLE');

    // Test 10C: Missing snapshot preflight handler must genuinely fail-closed
    dispatchCalled = false;
    const mutationC: OutboxMutation = {
      type: 'PATCH_PROJECT',
      orderingKey: 'project:p-fail-closed-nohandler',
      payload: { id: 'p-fail-closed-nohandler', patch: { status: 'COMPLETED' } },
      baselineSnapshot: { projectId: 'p-fail-closed-nohandler', status: 'IN_PROGRESS' },
    };
    await Outbox.commit(mutationC, 'user-tech-1');

    await Outbox.processQueue({
      currentUserId: 'user-tech-1',
      uploadBlob: async () => 'mock-url',
      // fetchProjectSnapshot handler is intentionally undefined/omitted
      executeMutation: async () => {
        dispatchCalled = true;
      },
    });

    // Must NOT fail open or dispatch!
    expect(dispatchCalled).toBe(false);

    pendingOps = await new Promise((resolve, reject) => {
      const tx = db.transaction('pending_operations', 'readonly');
      const req = tx.objectStore('pending_operations').getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    const opC = pendingOps.find((o) => o.orderingKey === 'project:p-fail-closed-nohandler');
    expect(opC.executionState).toBe('CONFLICT_HOLD');
    expect(opC.conflictDetails.reason).toContain('SNAPSHOT_HANDLER_UNAVAILABLE');
    expect(opC.payload.patch.status).toBe('COMPLETED');

    // Verify it blocks subsequent operations on that ordering key
    let subsequentDispatched = false;
    const mutationC2: OutboxMutation = {
      type: 'PATCH_PROJECT',
      orderingKey: 'project:p-fail-closed-nohandler',
      payload: { id: 'p-fail-closed-nohandler', patch: { notes: 'blocked sub-op' } },
    };
    await Outbox.commit(mutationC2, 'user-tech-1');

    await Outbox.processQueue({
      currentUserId: 'user-tech-1',
      uploadBlob: async () => 'mock-url',
      executeMutation: async () => {
        subsequentDispatched = true;
      },
    });

    expect(subsequentDispatched).toBe(false);
  });

  // --------------------------------------------------------------------------
  // Scenario 11: Retry-Safe Operations (DELETE_MATERIAL_REQUEST) Schedule Exponential Backoff and Retry
  // --------------------------------------------------------------------------
  it('11. retry-safe operations (DELETE_MATERIAL_REQUEST) schedule exponential backoff retry and succeed on subsequent attempt', async () => {
    let dispatchAttempts = 0;

    const mrMutation: OutboxMutation = {
      type: 'DELETE_MATERIAL_REQUEST',
      orderingKey: 'material_request:mr-retry-safe-1',
      payload: {
        id: 'mr-retry-safe-1',
      },
    };
    await Outbox.commit(mrMutation, 'user-tech-1');

    // First attempt fails with transient network error
    await Outbox.processQueue({
      currentUserId: 'user-tech-1',
      uploadBlob: async () => 'mock-url',
      executeMutation: async () => {
        dispatchAttempts++;
        throw new Error('Network timeout (transient)');
      },
    });

    expect(dispatchAttempts).toBe(1);

    const db = await openDb();
    let pendingOps: any[] = await new Promise((resolve, reject) => {
      const tx = db.transaction('pending_operations', 'readonly');
      const req = tx.objectStore('pending_operations').getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    expect(pendingOps.length).toBe(1);
    expect(pendingOps[0].executionState).toBe('UNKNOWN_OUTCOME');
    expect(pendingOps[0].retryCount).toBe(1);
    expect(pendingOps[0].nextRetryAt).toBeGreaterThan(Date.now());
    expect(pendingOps[0].unknownReason).toContain('Network timeout');

    // Simulate backoff timer expiration by setting nextRetryAt into the past
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('pending_operations', 'readwrite');
      const store = tx.objectStore('pending_operations');
      pendingOps[0].nextRetryAt = Date.now() - 1000;
      const req = store.put(pendingOps[0]);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });

    // Second attempt succeeds
    await Outbox.processQueue({
      currentUserId: 'user-tech-1',
      uploadBlob: async () => 'mock-url',
      executeMutation: async () => {
        dispatchAttempts++;
      },
    });

    expect(dispatchAttempts).toBe(2);

    // Confirmed and removed from pending
    pendingOps = await new Promise((resolve, reject) => {
      const tx = db.transaction('pending_operations', 'readonly');
      const req = tx.objectStore('pending_operations').getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    expect(pendingOps.length).toBe(0);
  });

  // --------------------------------------------------------------------------
  // Scenario 12: Retry-Safety Function Verification for All 11 Types
  // --------------------------------------------------------------------------
  it('12. isOperationRetrySafe strictly classifies all 11 mutation types', () => {
    // Proven retry-safe (idempotent repeat & concurrent-write safe)
    expect(isOperationRetrySafe('DELETE_TICKET')).toBe(true);
    expect(isOperationRetrySafe('DELETE_MATERIAL_REQUEST')).toBe(true);

    // Proven NOT retry-safe (non-idempotent, clobbers concurrent changes, or repeating throws)
    expect(isOperationRetrySafe('CREATE_MATERIAL_REQUEST')).toBe(false);
    expect(isOperationRetrySafe('CREATE_PROJECT')).toBe(false);
    expect(isOperationRetrySafe('PATCH_PROJECT')).toBe(false);
    expect(isOperationRetrySafe('APPEND_PROJECT_EVALUATION')).toBe(false);
    expect(isOperationRetrySafe('DELETE_PROJECT')).toBe(false);
    expect(isOperationRetrySafe('CREATE_TICKET')).toBe(false);
    expect(isOperationRetrySafe('PATCH_TICKET')).toBe(false);
    expect(isOperationRetrySafe('UPDATE_SETTINGS')).toBe(false);
    expect(isOperationRetrySafe('PATCH_MATERIAL_REQUEST')).toBe(false);
  });

  // --------------------------------------------------------------------------
  // Scenario 13: EVERY Non-Retry-Safe Operation Transitions to UNKNOWN_OUTCOME,
  // Never Automatically Retries (nextRetryAt=0), Preserves Payload, and Blocks Key
  // --------------------------------------------------------------------------
  describe('13. every non-retry-safe mutation type is safely held on unknown outcome', () => {
    const nonRetrySafeCases: { type: OutboxMutationType; orderingKey: string; payload: any }[] = [
      {
        type: 'CREATE_PROJECT',
        orderingKey: 'project:p-test-create-nr',
        payload: { id: 'p-test-create-nr', title: 'پروژه تست عدم تکرار', status: 'SCHEDULED' },
      },
      {
        type: 'PATCH_PROJECT',
        orderingKey: 'project:p-test-patch-nr',
        payload: { id: 'p-test-patch-nr', patch: { status: 'IN_PROGRESS' } },
      },
      {
        type: 'APPEND_PROJECT_EVALUATION',
        orderingKey: 'project:p-test-eval-nr',
        payload: { id: 'p-test-eval-nr', evaluation: { id: 'eval-nr-1', score: 4 } },
      },
      {
        type: 'DELETE_PROJECT',
        orderingKey: 'project:p-test-delete-nr',
        payload: { id: 'p-test-delete-nr', reason: 'لغو پروژه' },
      },
      {
        type: 'CREATE_TICKET',
        orderingKey: 'ticket:t-test-create-nr',
        payload: { ticket: { id: 't-test-create-nr', title: 'تیکت تستی عدم تکرار' } },
      },
      {
        type: 'PATCH_TICKET',
        orderingKey: 'ticket:t-test-patch-nr',
        payload: { id: 't-test-patch-nr', patch: { status: 'CLOSED' } },
      },
      {
        type: 'UPDATE_SETTINGS',
        orderingKey: 'settings',
        payload: { settings: { defaultSlaHours: 72 } },
      },
      {
        type: 'PATCH_MATERIAL_REQUEST',
        orderingKey: 'material_request:mr-test-patch-nr',
        payload: { id: 'mr-test-patch-nr', patch: { status: 'DELIVERED_CONFIRMED' } },
      },
      {
        type: 'CREATE_MATERIAL_REQUEST',
        orderingKey: 'material_request:mr-test-create-nr',
        payload: { id: 'mr-test-create-nr', projectId: 'p-1', items: [] },
      },
    ];

    for (const testCase of nonRetrySafeCases) {
      it(`holds non-retry-safe ${testCase.type} in UNKNOWN_OUTCOME with nextRetryAt=0 and preserves payload`, async () => {
        let dispatchCount = 0;

        await Outbox.commit(
          {
            type: testCase.type,
            orderingKey: testCase.orderingKey,
            payload: testCase.payload,
          },
          'user-tech-1'
        );

        // Attempt 1: Network drop causing unknown outcome
        await Outbox.processQueue({
          currentUserId: 'user-tech-1',
          uploadBlob: async () => 'mock-url',
          executeMutation: async () => {
            dispatchCount++;
            throw new Error('ETIMEDOUT: Connection reset');
          },
        });

        expect(dispatchCount).toBe(1);

        const db = await openDb();
        let pendingOps: any[] = await new Promise((resolve, reject) => {
          const tx = db.transaction('pending_operations', 'readonly');
          const req = tx.objectStore('pending_operations').getAll();
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        });

        const targetOp = pendingOps.find((o) => o.orderingKey === testCase.orderingKey);
        expect(targetOp).toBeDefined();
        // 1. Must remain in STORE_PENDING
        // 2. Must transition to UNKNOWN_OUTCOME
        expect(targetOp.executionState).toBe('UNKNOWN_OUTCOME');
        // 3. Must NEVER automatically retry: nextRetryAt = 0
        expect(targetOp.nextRetryAt).toBe(0);
        expect(targetOp.unknownReason).toBe('NON_IDEMPOTENT_OPERATION_HELD');
        // 4. Must preserve original payload
        expect(targetOp.payload).toEqual(testCase.payload);

        // Commit a subsequent operation on the same ordering key
        await Outbox.commit(
          {
            type: 'DELETE_TICKET',
            orderingKey: testCase.orderingKey,
            payload: { id: `t-blocked-${testCase.type}` },
          },
          'user-tech-1'
        );

        // Attempt 2: Network is restored; subsequent queue execution must NOT retry held op
        // and must NOT execute subsequent op on the same blocked key
        await Outbox.processQueue({
          currentUserId: 'user-tech-1',
          uploadBlob: async () => 'mock-url',
          executeMutation: async () => {
            dispatchCount++;
          },
        });

        // 5. Must remain blocked, dispatch count unchanged
        expect(dispatchCount).toBe(1);
      });
    }
  });

  // --------------------------------------------------------------------------
  // Scenario 14 (P0-2 A): Confirmed Server Success + IndexedDB Delete Failure
  // Durably Persists COMMITTED_LOCAL_ACK_PENDING, Dispatches Once, and Never Re-dispatches
  // --------------------------------------------------------------------------
  it('14. (P0-2 A) persists COMMITTED_LOCAL_ACK_PENDING when server mutation succeeds but IndexedDB delete fails', async () => {
    let dispatchCount = 0;

    await Outbox.commit(
      {
        type: 'PATCH_PROJECT',
        orderingKey: 'project:p-ack-fail-1',
        payload: { id: 'p-ack-fail-1', patch: { status: 'IN_PROGRESS' } },
      },
      'user-tech-1'
    );

    const db = await openDb();
    const originalTransaction = db.transaction.bind(db);
    let failDelete = true;

    vi.spyOn(db, 'transaction').mockImplementation((storeNames: any, mode: any) => {
      const tx = originalTransaction(storeNames, mode);
      if (mode === 'readwrite') {
        const originalObjectStore = tx.objectStore.bind(tx);
        tx.objectStore = (name: string) => {
          const store = originalObjectStore(name);
          if (name === 'pending_operations') {
            const originalDelete = store.delete.bind(store);
            store.delete = (query: any) => {
              if (failDelete) {
                const fakeReq: any = {
                  error: new DOMException('Simulated IndexedDB delete failure', 'QuotaExceededError'),
                  onsuccess: null,
                  onerror: null,
                };
                setTimeout(() => {
                  if (fakeReq.onerror) {
                    fakeReq.onerror(new Event('error'));
                  }
                }, 0);
                return fakeReq;
              }
              return originalDelete(query);
            };
          }
          return store;
        };
      }
      return tx;
    });

    // Run queue: server mutation succeeds
    await Outbox.processQueue({
      currentUserId: 'user-tech-1',
      uploadBlob: async () => 'mock-url',
      executeMutation: async () => {
        dispatchCount++;
      },
    });

    expect(dispatchCount).toBe(1);

    // Verify operation is in COMMITTED_LOCAL_ACK_PENDING state in IndexedDB
    const pendingOps: any[] = await new Promise((resolve, reject) => {
      const tx = originalTransaction('pending_operations', 'readonly');
      const req = tx.objectStore('pending_operations').getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    expect(pendingOps.length).toBe(1);
    expect(pendingOps[0].executionState).toBe('COMMITTED_LOCAL_ACK_PENDING');
    expect(pendingOps[0].lastError).toContain('LOCAL_ACK_DELETE_FAILED');
    // Critical safety invariant: must NEVER be converted to UNKNOWN_OUTCOME!
    expect(pendingOps[0].executionState).not.toBe('UNKNOWN_OUTCOME');

    // Run queue AGAIN while delete is still failing: server mutation must NOT be re-dispatched!
    await Outbox.processQueue({
      currentUserId: 'user-tech-1',
      uploadBlob: async () => 'mock-url',
      executeMutation: async () => {
        dispatchCount++;
      },
    });

    expect(dispatchCount).toBe(1);

    // Now restore delete to succeed and run queue again
    failDelete = false;
    await Outbox.processQueue({
      currentUserId: 'user-tech-1',
      uploadBlob: async () => 'mock-url',
      executeMutation: async () => {
        dispatchCount++;
      },
    });

    // Still exactly 1 dispatch
    expect(dispatchCount).toBe(1);

    // Operation must now be successfully deleted from IndexedDB
    const remainingOps: any[] = await new Promise((resolve, reject) => {
      const tx = originalTransaction('pending_operations', 'readonly');
      const req = tx.objectStore('pending_operations').getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    expect(remainingOps.length).toBe(0);
    vi.restoreAllMocks();
  });

  // --------------------------------------------------------------------------
  // Scenario 15 (P0-2 B): Reload/Reinitialization Recognizes COMMITTED_LOCAL_ACK_PENDING
  // and Performs Local Acknowledgment Only Without Server Dispatch
  // --------------------------------------------------------------------------
  it('15. (P0-2 B) reload/reinitialization recognizes COMMITTED_LOCAL_ACK_PENDING and performs local acknowledgment only without server dispatch', async () => {
    let dispatchCount = 0;
    const db = await openDb();

    // Directly put a COMMITTED_LOCAL_ACK_PENDING operation into IndexedDB
    const committedOp: OutboxOperation = {
      id: 'op-reload-ack-1',
      orderingKey: 'project:p-reload-1',
      userId: 'user-tech-1',
      type: 'PATCH_PROJECT',
      payload: { id: 'p-reload-1', patch: { status: 'IN_PROGRESS' } },
      createdAt: Date.now() - 5000,
      retryCount: 0,
      nextRetryAt: 0,
      executionState: 'COMMITTED_LOCAL_ACK_PENDING',
      lastAttemptedAt: Date.now() - 1000,
    };

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('pending_operations', 'readwrite');
      const store = tx.objectStore('pending_operations');
      const req = store.put(committedOp);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });

    // Close DB instance to simulate fresh restart/reload
    closeDb();

    // Reinitialize and process queue
    await Outbox.processQueue({
      currentUserId: 'user-tech-1',
      uploadBlob: async () => 'mock-url',
      executeMutation: async () => {
        dispatchCount++;
      },
    });

    // Server mutation must NEVER be dispatched
    expect(dispatchCount).toBe(0);

    // Local acknowledgment must have deleted the record from pending_operations
    const recheckDb = await openDb();
    const remainingOps: any[] = await new Promise((resolve, reject) => {
      const tx = recheckDb.transaction('pending_operations', 'readonly');
      const req = tx.objectStore('pending_operations').getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    expect(remainingOps.length).toBe(0);
  });

  // --------------------------------------------------------------------------
  // Scenario 16 (P0-2 C): Repeated Local Acknowledgment Failures
  // Preserves COMMITTED_LOCAL_ACK_PENDING, Never Becomes UNKNOWN_OUTCOME, Never Dispatches
  // --------------------------------------------------------------------------
  it('16. (P0-2 C) repeated local acknowledgment failures preserve COMMITTED_LOCAL_ACK_PENDING, never become UNKNOWN_OUTCOME, and never dispatch', async () => {
    let dispatchCount = 0;
    const db = await openDb();

    const committedOp: OutboxOperation = {
      id: 'op-repeated-fail-1',
      orderingKey: 'project:p-repeated-1',
      userId: 'user-tech-1',
      type: 'PATCH_PROJECT',
      payload: { id: 'p-repeated-1', patch: { status: 'IN_PROGRESS' } },
      createdAt: Date.now() - 5000,
      retryCount: 0,
      nextRetryAt: 0,
      executionState: 'COMMITTED_LOCAL_ACK_PENDING',
      lastAttemptedAt: Date.now() - 1000,
    };

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('pending_operations', 'readwrite');
      const store = tx.objectStore('pending_operations');
      const req = store.put(committedOp);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });

    const originalTransaction = db.transaction.bind(db);
    vi.spyOn(db, 'transaction').mockImplementation((storeNames: any, mode: any) => {
      const tx = originalTransaction(storeNames, mode);
      if (mode === 'readwrite') {
        const originalObjectStore = tx.objectStore.bind(tx);
        tx.objectStore = (name: string) => {
          const store = originalObjectStore(name);
          if (name === 'pending_operations') {
            store.delete = () => {
              const fakeReq: any = {
                error: new DOMException('Repeated delete failure', 'AbortError'),
                onsuccess: null,
                onerror: null,
              };
              setTimeout(() => {
                if (fakeReq.onerror) fakeReq.onerror(new Event('error'));
              }, 0);
              return fakeReq;
            };
          }
          return store;
        };
      }
      return tx;
    });

    // Run queue across 3 consecutive cycles
    for (let cycle = 1; cycle <= 3; cycle++) {
      await Outbox.processQueue({
        currentUserId: 'user-tech-1',
        uploadBlob: async () => 'mock-url',
        executeMutation: async () => {
          dispatchCount++;
        },
      });
    }

    // Zero server mutations dispatched
    expect(dispatchCount).toBe(0);

    // Verify still in COMMITTED_LOCAL_ACK_PENDING and never UNKNOWN_OUTCOME
    const ops: any[] = await new Promise((resolve, reject) => {
      const tx = originalTransaction('pending_operations', 'readonly');
      const req = tx.objectStore('pending_operations').getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    expect(ops.length).toBe(1);
    expect(ops[0].executionState).toBe('COMMITTED_LOCAL_ACK_PENDING');
    expect(ops[0].executionState).not.toBe('UNKNOWN_OUTCOME');
    expect(ops[0].lastError).toContain('LOCAL_ACK_RETRY_FAILED');

    vi.restoreAllMocks();
  });

  // --------------------------------------------------------------------------
  // Scenario 17 (P0-2 D): Successful Local Acknowledgment
  // Safely Cleans Up Pending Operation and Associated Blobs
  // --------------------------------------------------------------------------
  it('17. (P0-2 D) successful local acknowledgment completely removes pending operation and associated blobs', async () => {
    let dispatchCount = 0;

    await Outbox.commit(
      {
        type: 'PATCH_PROJECT',
        orderingKey: 'project:p-clean-ack',
        payload: {
          id: 'p-clean-ack',
          photos: [{ id: 'ph-1', uri: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==' }],
        },
      },
      'user-tech-1'
    );

    // Both uploadBlob and executeMutation succeed
    await Outbox.processQueue({
      currentUserId: 'user-tech-1',
      uploadBlob: async () => 'storage/path/photo-1.jpg',
      executeMutation: async () => {
        dispatchCount++;
      },
    });

    expect(dispatchCount).toBe(1);

    const db = await openDb();
    const [pendingOps, pendingUploads] = await Promise.all([
      new Promise<any[]>((resolve, reject) => {
        const tx = db.transaction('pending_operations', 'readonly');
        const req = tx.objectStore('pending_operations').getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
      new Promise<any[]>((resolve, reject) => {
        const tx = db.transaction('pending_uploads', 'readonly');
        const req = tx.objectStore('pending_uploads').getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
    ]);

    expect(pendingOps.length).toBe(0);
    expect(pendingUploads.length).toBe(0);
  });

  // --------------------------------------------------------------------------
  // Scenario 18 (P0-2 E): Ordering
  // Later Operations on the Same orderingKey Remain Blocked Until Local Acknowledgment Succeeds
  // --------------------------------------------------------------------------
  it('18. (P0-2 E) later operations on the same orderingKey remain blocked until local acknowledgment succeeds', async () => {
    let op2Dispatched = false;
    const db = await openDb();

    // 1. Put op1 in COMMITTED_LOCAL_ACK_PENDING
    const op1: OutboxOperation = {
      id: 'op-ord-1',
      orderingKey: 'project:p-order-lock',
      userId: 'user-tech-1',
      type: 'PATCH_PROJECT',
      payload: { id: 'p-order-lock', patch: { notes: 'First op committed' } },
      createdAt: 1000,
      retryCount: 0,
      nextRetryAt: 0,
      executionState: 'COMMITTED_LOCAL_ACK_PENDING',
    };

    // 2. Put op2 in QUEUED on the same orderingKey
    const op2: OutboxOperation = {
      id: 'op-ord-2',
      orderingKey: 'project:p-order-lock',
      userId: 'user-tech-1',
      type: 'PATCH_PROJECT',
      payload: { id: 'p-order-lock', patch: { notes: 'Second op queued' } },
      createdAt: 2000,
      retryCount: 0,
      nextRetryAt: 0,
      executionState: 'QUEUED',
    };

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('pending_operations', 'readwrite');
      const store = tx.objectStore('pending_operations');
      store.put(op1);
      store.put(op2);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    // Mock delete to fail on op1
    const originalTransaction = db.transaction.bind(db);
    let shouldFailDelete = true;
    vi.spyOn(db, 'transaction').mockImplementation((storeNames: any, mode: any) => {
      const tx = originalTransaction(storeNames, mode);
      if (mode === 'readwrite' && shouldFailDelete) {
        const originalObjectStore = tx.objectStore.bind(tx);
        tx.objectStore = (name: string) => {
          const store = originalObjectStore(name);
          if (name === 'pending_operations') {
            store.delete = () => {
              const fakeReq: any = {
                error: new DOMException('Simulated ack failure', 'AbortError'),
                onsuccess: null,
                onerror: null,
              };
              setTimeout(() => {
                if (fakeReq.onerror) fakeReq.onerror(new Event('error'));
              }, 0);
              return fakeReq;
            };
          }
          return store;
        };
      }
      return tx;
    });

    // Run queue: op1 fails local ack retry, op2 MUST NOT be dispatched
    await Outbox.processQueue({
      currentUserId: 'user-tech-1',
      uploadBlob: async () => 'mock-url',
      executeMutation: async (op) => {
        if (op.id === 'op-ord-2') op2Dispatched = true;
      },
    });

    expect(op2Dispatched).toBe(false);

    // Now restore delete so op1 can be acknowledged
    shouldFailDelete = false;

    await Outbox.processQueue({
      currentUserId: 'user-tech-1',
      uploadBlob: async () => 'mock-url',
      executeMutation: async (op) => {
        if (op.id === 'op-ord-2') op2Dispatched = true;
      },
    });

    // op2 is now unblocked and dispatched
    expect(op2Dispatched).toBe(true);

    vi.restoreAllMocks();
  });

  // --------------------------------------------------------------------------
  // Scenario 19: Durable Pre-Dispatch IN_FLIGHT Persistence Failure
  // Prevents Server Mutation Dispatch and Halts Ordering Key
  // --------------------------------------------------------------------------
  it('19. (Fail-Closed) IN_FLIGHT persistence failure prevents server mutation dispatch and halts ordering key', async () => {
    let dispatchCount = 0;
    const db = await openDb();

    // Commit two operations on the same ordering key
    await Outbox.commit(
      {
        type: 'PATCH_PROJECT',
        orderingKey: 'project:p-inflight-fail',
        payload: { id: 'p-inflight-fail', patch: { notes: 'first op' } },
      },
      'user-tech-1'
    );
    await Outbox.commit(
      {
        type: 'PATCH_PROJECT',
        orderingKey: 'project:p-inflight-fail',
        payload: { id: 'p-inflight-fail', patch: { notes: 'second op' } },
      },
      'user-tech-1'
    );

    // Mock db.transaction to fail specifically when writing executionState === 'IN_FLIGHT'
    const originalTransaction = db.transaction.bind(db);
    let shouldFailInFlightPut = true;

    vi.spyOn(db, 'transaction').mockImplementation((storeNames: any, mode: any) => {
      const tx = originalTransaction(storeNames, mode);
      if (mode === 'readwrite') {
        const originalObjectStore = tx.objectStore.bind(tx);
        tx.objectStore = (name: string) => {
          const store = originalObjectStore(name);
          if (name === 'pending_operations') {
            const originalPut = store.put.bind(store);
            store.put = (item: any) => {
              if (shouldFailInFlightPut && item.executionState === 'IN_FLIGHT') {
                shouldFailInFlightPut = false;
                const fakeReq: any = {
                  error: new DOMException('Simulated IN_FLIGHT persistence abort', 'AbortError'),
                  onsuccess: null,
                  onerror: null,
                };
                setTimeout(() => {
                  if (fakeReq.onerror) fakeReq.onerror(new Event('error'));
                }, 0);
                return fakeReq;
              }
              return originalPut(item);
            };
          }
          return store;
        };
      }
      return tx;
    });

    // Run queue processing
    await Outbox.processQueue({
      currentUserId: 'user-tech-1',
      uploadBlob: async () => 'mock-url',
      executeMutation: async () => {
        dispatchCount++;
      },
    });

    // CRITICAL INVARIANT: Server mutation must NEVER be dispatched!
    expect(dispatchCount).toBe(0);

    // Verify first operation halted with IN_FLIGHT_PERSIST_FAILED error
    const pendingOps: any[] = await new Promise((resolve, reject) => {
      const tx = originalTransaction('pending_operations', 'readonly');
      const req = tx.objectStore('pending_operations').getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    expect(pendingOps.length).toBe(2);
    const failedOp = pendingOps.find((op: any) => op.payload?.patch?.notes === 'first op') || pendingOps[0];
    expect(failedOp.lastError).toContain('IN_FLIGHT_PERSIST_FAILED');

    vi.restoreAllMocks();
  });

  // --------------------------------------------------------------------------
  // Scenario 20: Transaction Abort After Server Success
  // Retains COMMITTED_LOCAL_ACK_PENDING, Never Converts to UNKNOWN_OUTCOME, Never Redispatches
  // --------------------------------------------------------------------------
  it('20. (Fail-Closed) transaction abort during acknowledgment retains COMMITTED_LOCAL_ACK_PENDING and never redispatches', async () => {
    let dispatchCount = 0;
    const db = await openDb();

    await Outbox.commit(
      {
        type: 'PATCH_PROJECT',
        orderingKey: 'project:p-abort-ack',
        payload: { id: 'p-abort-ack', patch: { notes: 'commit test' } },
      },
      'user-tech-1'
    );

    // Mock delete to abort transaction during local acknowledgment
    const originalTransaction = db.transaction.bind(db);
    let shouldAbortDelete = true;

    vi.spyOn(db, 'transaction').mockImplementation((storeNames: any, mode: any) => {
      const tx = originalTransaction(storeNames, mode);
      if (mode === 'readwrite') {
        const originalObjectStore = tx.objectStore.bind(tx);
        tx.objectStore = (name: string) => {
          const store = originalObjectStore(name);
          if (name === 'pending_operations') {
            const originalDelete = store.delete.bind(store);
            store.delete = (query: any) => {
              if (shouldAbortDelete) {
                const fakeReq: any = {
                  error: new DOMException('Simulated transaction abort', 'AbortError'),
                  onsuccess: null,
                  onerror: null,
                };
                setTimeout(() => {
                  if (fakeReq.onerror) fakeReq.onerror(new Event('error'));
                }, 0);
                return fakeReq;
              }
              return originalDelete(query);
            };
          }
          return store;
        };
      }
      return tx;
    });

    // First run: server mutation succeeds, but local delete aborts
    await Outbox.processQueue({
      currentUserId: 'user-tech-1',
      uploadBlob: async () => 'mock-url',
      executeMutation: async () => {
        dispatchCount++;
      },
    });

    expect(dispatchCount).toBe(1);

    const pendingOps: any[] = await new Promise((resolve, reject) => {
      const tx = originalTransaction('pending_operations', 'readonly');
      const req = tx.objectStore('pending_operations').getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    expect(pendingOps.length).toBe(1);
    expect(pendingOps[0].executionState).toBe('COMMITTED_LOCAL_ACK_PENDING');
    expect(pendingOps[0].executionState).not.toBe('UNKNOWN_OUTCOME');

    // Second run: server mutation MUST NOT be redispatched!
    await Outbox.processQueue({
      currentUserId: 'user-tech-1',
      uploadBlob: async () => 'mock-url',
      executeMutation: async () => {
        dispatchCount++;
      },
    });

    expect(dispatchCount).toBe(1);

    vi.restoreAllMocks();
  });

  // --------------------------------------------------------------------------
  // Scenario 21: Startup Recovery of Abandoned IN_FLIGHT (Non-Retry-Safe)
  // Transitions to UNKNOWN_OUTCOME with nextRetryAt === 0 (Held)
  // --------------------------------------------------------------------------
  it('21. (Startup Recovery) abandoned IN_FLIGHT non-retry-safe operations become UNKNOWN_OUTCOME held', async () => {
    let dispatchCount = 0;
    const db = await openDb();

    const abandonedOp: OutboxOperation = {
      id: 'op-abandoned-non-safe',
      orderingKey: 'project:p-abandoned-1',
      userId: 'user-tech-1',
      type: 'PATCH_PROJECT', // non-retry-safe
      payload: { id: 'p-abandoned-1', patch: { notes: 'crash test' } },
      createdAt: 1000,
      retryCount: 0,
      nextRetryAt: 0,
      executionState: 'IN_FLIGHT',
      lastAttemptedAt: 1050,
    };

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('pending_operations', 'readwrite');
      tx.objectStore('pending_operations').put(abandonedOp);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    // Run startup recovery
    await performStartupRecovery(db, 'user-tech-1');

    const ops: any[] = await new Promise((resolve, reject) => {
      const tx = db.transaction('pending_operations', 'readonly');
      const req = tx.objectStore('pending_operations').getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    expect(ops.length).toBe(1);
    expect(ops[0].executionState).toBe('UNKNOWN_OUTCOME');
    expect(ops[0].unknownReason).toBe('ABANDONED_IN_FLIGHT_ON_RESTART');
    expect(ops[0].nextRetryAt).toBe(0);

    // Queue processing must NOT automatically redispatch held operation
    await Outbox.processQueue({
      currentUserId: 'user-tech-1',
      uploadBlob: async () => 'mock-url',
      executeMutation: async () => {
        dispatchCount++;
      },
    });

    expect(dispatchCount).toBe(0);
  });

  // --------------------------------------------------------------------------
  // Scenario 22: Startup Recovery of Abandoned IN_FLIGHT (Retry-Safe)
  // Schedules Backoff Retry
  // --------------------------------------------------------------------------
  it('22. (Startup Recovery) abandoned IN_FLIGHT retry-safe operations schedule backoff retry', async () => {
    const db = await openDb();

    const abandonedSafeOp: OutboxOperation = {
      id: 'op-abandoned-safe',
      orderingKey: 'ticket:t-abandoned-1',
      userId: 'user-tech-1',
      type: 'DELETE_TICKET', // retry-safe
      payload: { id: 't-abandoned-1' },
      createdAt: 1000,
      retryCount: 0,
      nextRetryAt: 0,
      executionState: 'IN_FLIGHT',
      lastAttemptedAt: 1050,
    };

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('pending_operations', 'readwrite');
      tx.objectStore('pending_operations').put(abandonedSafeOp);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    await performStartupRecovery(db, 'user-tech-1');

    const ops: any[] = await new Promise((resolve, reject) => {
      const tx = db.transaction('pending_operations', 'readonly');
      const req = tx.objectStore('pending_operations').getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    expect(ops.length).toBe(1);
    expect(ops[0].executionState).toBe('QUEUED');
    expect(ops[0].retryCount).toBe(1);
    expect(ops[0].nextRetryAt).toBeGreaterThan(Date.now());
  });

  // --------------------------------------------------------------------------
  // Scenario 23: Startup Recovery of Legacy Records Without executionState
  // Correctly Classifies retryCount === 0 as QUEUED, and retryCount > 0 as Held or Backoff
  // --------------------------------------------------------------------------
  it('23. (Startup Recovery) legacy records without executionState are correctly classified and held if non-retry-safe', async () => {
    const db = await openDb();

    // 1. Legacy unattempted (retryCount === 0)
    const opUnattempted: any = {
      id: 'op-leg-unattempted',
      orderingKey: 'project:p-leg-1',
      userId: 'user-tech-1',
      type: 'CREATE_PROJECT',
      payload: { id: 'p-leg-1', title: 'Legacy Project' },
      createdAt: 1000,
      retryCount: 0,
      nextRetryAt: 0,
    };

    // 2. Legacy attempted non-safe (retryCount > 0)
    const opAttemptedNonSafe: any = {
      id: 'op-leg-attempted-non-safe',
      orderingKey: 'project:p-leg-2',
      userId: 'user-tech-1',
      type: 'PATCH_PROJECT',
      payload: { id: 'p-leg-2', patch: { notes: 'Legacy Patch' } },
      createdAt: 1100,
      retryCount: 1,
      nextRetryAt: 0,
    };

    // 3. Legacy attempted retry-safe (retryCount > 0)
    const opAttemptedSafe: any = {
      id: 'op-leg-attempted-safe',
      orderingKey: 'material:m-leg-3',
      userId: 'user-tech-1',
      type: 'DELETE_MATERIAL_REQUEST',
      payload: { id: 'm-leg-3' },
      createdAt: 1200,
      retryCount: 1,
      nextRetryAt: 0,
    };

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('pending_operations', 'readwrite');
      const store = tx.objectStore('pending_operations');
      store.put(opUnattempted);
      store.put(opAttemptedNonSafe);
      store.put(opAttemptedSafe);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    await performStartupRecovery(db, 'user-tech-1');

    const ops: any[] = await new Promise((resolve, reject) => {
      const tx = db.transaction('pending_operations', 'readonly');
      const req = tx.objectStore('pending_operations').getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    const m = new Map(ops.map((o) => [o.id, o]));

    // opUnattempted: QUEUED
    expect(m.get('op-leg-unattempted').executionState).toBe('QUEUED');

    // opAttemptedNonSafe: held as UNKNOWN_OUTCOME with nextRetryAt === 0
    expect(m.get('op-leg-attempted-non-safe').executionState).toBe('UNKNOWN_OUTCOME');
    expect(m.get('op-leg-attempted-non-safe').unknownReason).toBe('LEGACY_UNCONFIRMED_ATTEMPT');
    expect(m.get('op-leg-attempted-non-safe').nextRetryAt).toBe(0);

    // opAttemptedSafe: QUEUED with backoff
    expect(m.get('op-leg-attempted-safe').executionState).toBe('QUEUED');
    expect(m.get('op-leg-attempted-safe').nextRetryAt).toBeGreaterThan(Date.now());
  });

  // --------------------------------------------------------------------------
  // Scenario 24: Startup Recovery of COMMITTED_LOCAL_ACK_PENDING
  // Performs Local Cleanup Only and Never Dispatches
  // --------------------------------------------------------------------------
  it('24. (Startup Recovery) COMMITTED_LOCAL_ACK_PENDING cleans up locally and never dispatches to server', async () => {
    let dispatchCount = 0;
    const db = await openDb();

    const opCommitted: OutboxOperation = {
      id: 'op-startup-ack-1',
      orderingKey: 'project:p-startup-ack',
      userId: 'user-tech-1',
      type: 'PATCH_PROJECT',
      payload: { id: 'p-startup-ack', patch: { notes: 'already done on server' } },
      createdAt: 1000,
      retryCount: 0,
      nextRetryAt: 0,
      executionState: 'COMMITTED_LOCAL_ACK_PENDING',
    };

    const uploadRecord = {
      id: 'op-startup-ack-1-upload-0',
      operationId: 'op-startup-ack-1',
      orderingKey: 'project:p-startup-ack',
      blob: new Blob(['test'], { type: 'image/jpeg' }),
      fileName: 'photo.jpg',
      mimeType: 'image/jpeg',
      targets: [{ path: ['photos', 0, 'uri'] }],
      createdAt: 1000,
    };

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(['pending_operations', 'pending_uploads'], 'readwrite');
      tx.objectStore('pending_operations').put(opCommitted);
      tx.objectStore('pending_uploads').put(uploadRecord);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    // Run startup recovery
    await performStartupRecovery(db, 'user-tech-1');

    // Both pending_operations and pending_uploads must be cleaned up
    const [pendingOps, pendingUploads] = await Promise.all([
      new Promise<any[]>((resolve, reject) => {
        const tx = db.transaction('pending_operations', 'readonly');
        const req = tx.objectStore('pending_operations').getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
      new Promise<any[]>((resolve, reject) => {
        const tx = db.transaction('pending_uploads', 'readonly');
        const req = tx.objectStore('pending_uploads').getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
    ]);

    expect(pendingOps.length).toBe(0);
    expect(pendingUploads.length).toBe(0);

    // Queue processing has nothing to do and dispatches 0 mutations
    await Outbox.processQueue({
      currentUserId: 'user-tech-1',
      uploadBlob: async () => 'mock-url',
      executeMutation: async () => {
        dispatchCount++;
      },
    });

    expect(dispatchCount).toBe(0);
  });

  // --------------------------------------------------------------------------
  // Scenario 25: Multi-Tab Master Web Lock Coordination
  // Prevents Simultaneous Processing When Another Tab Holds the Lock
  // --------------------------------------------------------------------------
  it('25. (Multi-Tab) exclusive master Web Lock prevents concurrent queue processing across tabs', async () => {
    let dispatchCount = 0;

    await Outbox.commit(
      {
        type: 'PATCH_PROJECT',
        orderingKey: 'project:p-tab-lock',
        payload: { id: 'p-tab-lock', patch: { notes: 'tab lock test' } },
      },
      'user-tech-1'
    );

    // Simulate Tab 1 acquiring and holding 'talaie_outbox_master_lock'
    let releaseTab1: () => void = () => {};
    let tab1Acquired = false;

    const tab1HoldingPromise = new Promise<void>((acquired) => {
      navigator.locks.request('talaie_outbox_master_lock', async () => {
        tab1Acquired = true;
        acquired();
        await new Promise<void>((res) => {
          releaseTab1 = res;
        });
      });
    });

    await tab1HoldingPromise;
    expect(tab1Acquired).toBe(true);

    // Simulate Tab 2 attempting processQueue while Tab 1 holds the lock
    await Outbox.processQueue({
      currentUserId: 'user-tech-1',
      uploadBlob: async () => 'mock-url',
      executeMutation: async () => {
        dispatchCount++;
      },
    });

    // Tab 2 must yield immediately without dispatching any mutations
    expect(dispatchCount).toBe(0);

    // Release Tab 1 lock
    releaseTab1();
    await new Promise((r) => setTimeout(r, 20));

    // Now Tab 2 runs processQueue and successfully dispatches
    await Outbox.processQueue({
      currentUserId: 'user-tech-1',
      uploadBlob: async () => 'mock-url',
      executeMutation: async () => {
        dispatchCount++;
      },
    });

    expect(dispatchCount).toBe(1);
  });

  // --------------------------------------------------------------------------
  // Scenario 26: Atomic Blob & Acknowledgment Durability
  // Awaits tx.oncomplete on [STORE_PENDING, STORE_UPLOADS]
  // --------------------------------------------------------------------------
  it('26. (Durability) post-commit atomic acknowledgment awaits tx.oncomplete on [STORE_PENDING, STORE_UPLOADS]', async () => {
    let dispatchCount = 0;
    let atomicTxCompleted = false;
    const db = await openDb();

    await Outbox.commit(
      {
        type: 'PATCH_PROJECT',
        orderingKey: 'project:p-durability-test',
        payload: {
          id: 'p-durability-test',
          photos: [{ id: 'ph-dur-1', uri: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==' }],
        },
      },
      'user-tech-1'
    );

    const originalTransaction = db.transaction.bind(db);
    vi.spyOn(db, 'transaction').mockImplementation((storeNames: any, mode: any) => {
      const tx = originalTransaction(storeNames, mode);
      const isMultiStore =
        Array.isArray(storeNames) &&
        storeNames.includes('pending_operations') &&
        storeNames.includes('pending_uploads') &&
        mode === 'readwrite';

      if (isMultiStore) {
        tx.addEventListener('complete', () => {
          atomicTxCompleted = true;
        });
      }
      return tx;
    });

    await Outbox.processQueue({
      currentUserId: 'user-tech-1',
      uploadBlob: async () => 'storage/path/photo.jpg',
      executeMutation: async () => {
        dispatchCount++;
      },
    });

    expect(dispatchCount).toBe(1);
    expect(atomicTxCompleted).toBe(true);

    // Verify stores are cleanly deleted after tx.oncomplete
    const pendingOps: any[] = await new Promise((resolve, reject) => {
      const tx = originalTransaction('pending_operations', 'readonly');
      const req = tx.objectStore('pending_operations').getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    expect(pendingOps.length).toBe(0);

    vi.restoreAllMocks();
  });

  // --------------------------------------------------------------------------
  // Scenario 27: Web Locks Unavailable (Fail-Closed)
  // ProcessQueue Fails Closed Without Dispatching
  // --------------------------------------------------------------------------
  it('27. (Fail-Closed) processQueue halts without dispatching when Web Locks API is unavailable', async () => {
    let dispatchCount = 0;
    const originalLocks = (navigator as any).locks;

    await Outbox.commit(
      {
        type: 'PATCH_PROJECT',
        orderingKey: 'project:p-no-locks',
        payload: { id: 'p-no-locks', patch: { notes: 'no locks' } },
      },
      'user-tech-1'
    );

    try {
      // Temporarily simulate browser without Web Locks API
      Object.defineProperty(navigator, 'locks', {
        value: undefined,
        configurable: true,
        writable: true,
      });

      await Outbox.processQueue({
        currentUserId: 'user-tech-1',
        uploadBlob: async () => 'mock-url',
        executeMutation: async () => {
          dispatchCount++;
        },
      });

      // Must fail closed: no mutations dispatched
      expect(dispatchCount).toBe(0);

      // Operation must remain intact in STORE_PENDING
      const db = await openDb();
      const pendingOps: any[] = await new Promise((resolve, reject) => {
        const tx = db.transaction('pending_operations', 'readonly');
        const req = tx.objectStore('pending_operations').getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });

      expect(pendingOps.length).toBe(1);
      expect(pendingOps[0].executionState).toBe('QUEUED');
    } finally {
      // Restore locks
      Object.defineProperty(navigator, 'locks', {
        value: originalLocks,
        configurable: true,
        writable: true,
      });
    }
  });
});
