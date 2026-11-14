import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { StorageService } from '../storage';
import {
  Outbox,
  openDb,
  resetProcessingStateForTesting,
  OutboxOperation,
} from '../offlineQueue';
import { Project, Ticket, MaterialRequest } from '../../types';

// Standard in-memory localStorage mock for isolation tests
const createLocalStorageMock = () => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = String(value);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
  };
};

if (typeof globalThis.localStorage === 'undefined') {
  globalThis.localStorage = createLocalStorageMock() as any;
}

describe('Local User-Data & Outbox Isolation (P2.3-R2)', () => {
  beforeEach(async () => {
    localStorage.clear();
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

  const mockProjectA: Project = {
    id: 'prj-ali-1',
    code: 'PRJ-ALI',
    title: 'پروژه اختصاصی تکنسین علی',
    customerName: 'مشتری الف',
    customerPhone: '09121111111',
    address: 'تهران، فرمانیه',
    shadePanels: 3,
    curtainPanels: 1,
    proposalImages: [],
    scheduledDate: '2026-11-20',
    scheduledTime: '10:00',
    assignedTeamId: 'team-1',
    assignedTeamName: 'اکیپ نصب ۱',
    leadTechnicianId: 'usr-ali',
    assignedTechnicianIds: ['usr-ali'],
    isFullTools: true,
    toolsRequired: [],
    status: 'IN_PROGRESS',
    completionPhotos: [],
    qcStatus: 'NOT_STARTED',
    createdAt: '2026-11-10T08:00:00Z',
    updatedAt: '2026-11-10T08:00:00Z',
  };

  const mockTicketA: Ticket = {
    id: 'tkt-ali-1',
    projectId: 'prj-ali-1',
    projectCode: 'PRJ-ALI',
    projectTitle: 'پروژه اختصاصی تکنسین علی',
    authorId: 'usr-ali',
    authorName: 'علی',
    type: 'DAMAGED_HARDWARE',
    category: 'WAREHOUSE_DELIVERY_ISSUE',
    description: 'نیاز به بست دیواری',
    photos: [],
    status: 'OPEN',
    createdAt: '2026-11-10T09:00:00Z',
  };

  const mockMaterialRequestA: MaterialRequest = {
    id: 'mat-ali-1',
    projectId: 'prj-ali-1',
    projectCode: 'PRJ-ALI',
    projectTitle: 'پروژه اختصاصی تکنسین علی',
    customerName: 'مشتری الف',
    customerAddress: 'تهران، فرمانیه',
    customerPhone: '09121111111',
    requestedByUserId: 'usr-ali',
    requestedByUserName: 'علی',
    assignedTeamId: 'team-1',
    assignedTeamName: 'اکیپ نصب ۱',
    requestedAt: '2026-11-10T08:30:00Z',
    category: 'HARDWARE',
    reason: 'SHORTAGE',
    urgency: 'URGENT',
    items: [{ id: 'it-1', title: 'پیچ ام‌دی‌اف', category: 'HARDWARE', requestedQty: 50, unit: 'عدد' }],
    dispatches: [],
    history: [],
    status: 'SUBMITTED',
    createdAt: '2026-11-10T08:30:00Z',
    updatedAt: '2026-11-10T08:30:00Z',
  };

  it('Scenario 1: User A logout followed by User B login isolates cached business data', () => {
    const userA = 'usr-ali';
    const userB = 'usr-reza';

    // 1. User A works and caches data locally
    StorageService.saveProjects([mockProjectA], userA);
    StorageService.saveTickets([mockTicketA], userA);
    StorageService.saveMaterialRequests([mockMaterialRequestA], userA);

    // 2. User A logs out (in-memory state resets)

    // 3. User B logs in on the same browser / shared device
    const userBProjects = StorageService.getProjects(userB);
    const userBTickets = StorageService.getTickets(userB);
    const userBMaterials = StorageService.getMaterialRequests(userB);

    // User B MUST NOT see or receive any of User A's cached records!
    expect(userBProjects).toHaveLength(0);
    expect(userBTickets).toHaveLength(0);
    expect(userBMaterials).toHaveLength(0);

    // 4. User B operates independently
    const mockProjectB: Project = {
      ...mockProjectA,
      id: 'prj-reza-2',
      title: 'پروژه اختصاصی رضا',
      leadTechnicianId: userB,
      assignedTechnicianIds: [userB],
    };
    StorageService.saveProjects([mockProjectB], userB);
    expect(StorageService.getProjects(userB)).toHaveLength(1);
    expect(StorageService.getProjects(userB)[0].title).toBe('پروژه اختصاصی رضا');

    // 5. User B logs out, and User A returns later
    const userARestoredProjects = StorageService.getProjects(userA);
    const userARestoredTickets = StorageService.getTickets(userA);
    const userARestoredMaterials = StorageService.getMaterialRequests(userA);

    // User A's data was preserved intact and isolated
    expect(userARestoredProjects).toHaveLength(1);
    expect(userARestoredProjects[0].title).toBe('پروژه اختصاصی تکنسین علی');
    expect(userARestoredTickets).toHaveLength(1);
    expect(userARestoredMaterials).toHaveLength(1);
  });

  it('Scenario 2: Switching accounts while pending operations exist prevents User B from viewing or processing User A mutations', async () => {
    const userA = 'usr-ali';
    const userB = 'usr-reza';

    const db = await openDb();

    // 1. User A creates pending operations while offline
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(['pending_operations'], 'readwrite');
      const store = tx.objectStore('pending_operations');

      const opA1: OutboxOperation = {
        id: 'op-ali-proj',
        orderingKey: 'project:prj-ali-1',
        userId: userA,
        type: 'PATCH_PROJECT',
        payload: { id: 'prj-ali-1', patch: { status: 'COMPLETED' } },
        createdAt: 1000,
        retryCount: 0,
        nextRetryAt: 0,
      };

      const opA2: OutboxOperation = {
        id: 'op-ali-mat',
        orderingKey: 'material:mat-ali-1',
        userId: userA,
        type: 'CREATE_MATERIAL_REQUEST',
        payload: { id: 'mat-ali-1', title: 'درخواست پیچ' },
        createdAt: 2000,
        retryCount: 0,
        nextRetryAt: 0,
      };

      store.put(opA1);
      store.put(opA2);

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    // 2. User A logs out with pending operations.
    // User B logs in. Check counts and lists for User B:
    expect(await Outbox.getPendingCount(userB)).toBe(0);
    expect(await Outbox.getPendingOperations(userB)).toHaveLength(0);

    // 3. User B views server projects: User A's pending mutation must NOT be applied to User B's view!
    const serverProjects: Project[] = [
      { ...mockProjectA, id: 'prj-ali-1', status: 'IN_PROGRESS' },
    ];
    const userBMergedProjects = await Outbox.applyPendingToProjects(
      serverProjects,
      undefined,
      userB
    );
    expect(userBMergedProjects[0].status).toBe('IN_PROGRESS'); // NOT modified to 'COMPLETED' for User B!

    // 4. User B views material requests: User A's pending material request must NOT appear in User B's list
    const userBMergedMaterials = await Outbox.applyPendingToMaterialRequests(
      [],
      undefined,
      userB
    );
    expect(userBMergedMaterials).toHaveLength(0);

    // 5. User B runs processQueue with User B's user ID:
    const executedMutations: OutboxOperation[] = [];
    await Outbox.processQueue({
      currentUserId: userB,
      uploadBlob: async () => 'path',
      executeMutation: async (op) => {
        executedMutations.push(op);
      },
    });

    // User B must NOT execute or send User A's mutations!
    expect(executedMutations).toHaveLength(0);

    // 6. User A's operations remain safely parked in IndexedDB
    expect(await Outbox.getPendingCount()).toBe(2);
    expect(await Outbox.getPendingCount(userA)).toBe(2);

    // 7. User A returns and views projects / materials:
    const userAMergedProjects = await Outbox.applyPendingToProjects(
      serverProjects,
      undefined,
      userA
    );
    // User A's own pending mutation IS applied optimistically to User A's view
    expect(userAMergedProjects[0].status).toBe('COMPLETED');

    const userAMergedMaterials = await Outbox.applyPendingToMaterialRequests(
      [],
      undefined,
      userA
    );
    expect(userAMergedMaterials).toHaveLength(1);
    expect(userAMergedMaterials[0].id).toBe('mat-ali-1');

    // 8. User A runs processQueue: User A's operations are executed under User A's auth context!
    const executedByA: OutboxOperation[] = [];
    await Outbox.processQueue({
      currentUserId: userA,
      uploadBlob: async () => 'path',
      executeMutation: async (op) => {
        executedByA.push(op);
      },
    });
    expect(executedByA).toHaveLength(2);
    expect(executedByA.map((o) => o.id)).toEqual(
      expect.arrayContaining(['op-ali-proj', 'op-ali-mat'])
    );
  });

  it('Scenario 3: Operations with missing or invalid user IDs are never processed by the queue worker', async () => {
    const db = await openDb();

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(['pending_operations'], 'readwrite');
      const store = tx.objectStore('pending_operations');

      const opNoUser = {
        id: 'op-no-user',
        orderingKey: 'project:p-anonymous',
        userId: '' as any,
        type: 'PATCH_PROJECT',
        payload: { id: 'p-anonymous' },
        createdAt: 1000,
        retryCount: 0,
        nextRetryAt: 0,
      } as OutboxOperation;

      const opUndefinedUser = {
        id: 'op-undef-user',
        orderingKey: 'project:p-undef',
        userId: undefined as any,
        type: 'PATCH_PROJECT',
        payload: { id: 'p-undef' },
        createdAt: 1100,
        retryCount: 0,
        nextRetryAt: 0,
      } as OutboxOperation;

      store.put(opNoUser);
      store.put(opUndefinedUser);

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    const executed: OutboxOperation[] = [];
    await Outbox.processQueue({
      currentUserId: 'usr-authenticated',
      uploadBlob: async () => 'path',
      executeMutation: async (op) => {
        executed.push(op);
      },
    });

    // Zero operations with invalid/missing user IDs are processed
    expect(executed).toHaveLength(0);
  });

  it('Scenario 4: Account switching or logout cancels in-flight queue processing', async () => {
    const db = await openDb();

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(['pending_operations'], 'readwrite');
      const store = tx.objectStore('pending_operations');

      store.put({
        id: 'op-long-1',
        orderingKey: 'project:p-switch-1',
        userId: 'usr-switching-1',
        type: 'PATCH_PROJECT',
        payload: { id: 'p-switch-1' },
        createdAt: 100,
        retryCount: 0,
        nextRetryAt: 0,
      });

      store.put({
        id: 'op-long-2',
        orderingKey: 'project:p-switch-2',
        userId: 'usr-switching-1',
        type: 'PATCH_PROJECT',
        payload: { id: 'p-switch-2' },
        createdAt: 200,
        retryCount: 0,
        nextRetryAt: 0,
      });

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    const executed: OutboxOperation[] = [];
    const queuePromise = Outbox.processQueue({
      currentUserId: 'usr-switching-1',
      uploadBlob: async () => 'path',
      executeMutation: async (op) => {
        executed.push(op);
        // Simulate user logging out mid-flight
        Outbox.abortActiveProcessing();
      },
    });

    await queuePromise;

    // First mutation executed, but second mutation was aborted and NOT executed
    expect(executed).toHaveLength(1);
    expect(executed[0].id).toBe('op-long-1');

    // Second mutation remains safely stored in IndexedDB for legitimate later return
    const pending = await Outbox.getPendingOperations();
    expect(pending.some((p) => p.id === 'op-long-2')).toBe(true);
  });

  it('Scenario 5: User B cannot retry or delete User A failed operations', async () => {
    const userA = 'usr-ali';
    const userB = 'usr-reza';
    const db = await openDb();

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(['failed_operations'], 'readwrite');
      const store = tx.objectStore('failed_operations');

      store.put({
        id: 'failed-ali-op',
        orderingKey: 'material:mat-ali',
        userId: userA,
        type: 'CREATE_MATERIAL_REQUEST',
        payload: { id: 'mat-ali' },
        errorReason: 'FEATURE_NOT_IMPLEMENTED_ON_SERVER',
        failedAt: Date.now(),
        retryCount: 1,
        originalCreatedAt: 1000,
      });

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    // User B attempts to retry User A's operation
    await Outbox.retryFailedOperation('failed-ali-op', userB);

    // Operation must NOT be moved to pending queue by User B!
    expect(await Outbox.getPendingCount()).toBe(0);
    const failedOps = await Outbox.getFailedOperations();
    expect(failedOps).toHaveLength(1);
    expect(failedOps[0].id).toBe('failed-ali-op');

    // User B attempts to delete User A's operation
    await Outbox.deleteFailedOperation('failed-ali-op', userB);

    // Operation must still remain in failed store!
    const failedAfterDelete = await Outbox.getFailedOperations();
    expect(failedAfterDelete).toHaveLength(1);
    expect(failedAfterDelete[0].id).toBe('failed-ali-op');

    // User A successfully retries their own operation
    await Outbox.retryFailedOperation('failed-ali-op', userA);
    expect(await Outbox.getPendingCount()).toBe(1);

    // Unowned item (missing userId) cannot be retried or deleted when currentUserId is passed
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(['failed_operations'], 'readwrite');
      tx.objectStore('failed_operations').put({
        id: 'unowned-op',
        orderingKey: 'material:unowned',
        type: 'CREATE_MATERIAL_REQUEST',
        payload: { id: 'unowned' },
        errorReason: 'Unknown error',
        failedAt: Date.now(),
        retryCount: 1,
        originalCreatedAt: 1000,
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    await Outbox.retryFailedOperation('unowned-op', userB);
    await Outbox.deleteFailedOperation('unowned-op', userB);
    const failedUnowned = await Outbox.getFailedOperations();
    expect(failedUnowned.some((f) => f.id === 'unowned-op')).toBe(true);

    // Missing, empty or whitespace-only currentUserId rejects mutation completely
    await (Outbox.retryFailedOperation as any)('unowned-op');
    await Outbox.retryFailedOperation('unowned-op', '');
    await Outbox.retryFailedOperation('unowned-op', '   ');

    await (Outbox.deleteFailedOperation as any)('unowned-op');
    await Outbox.deleteFailedOperation('unowned-op', '');
    await Outbox.deleteFailedOperation('unowned-op', '   ');

    const failedStillIntact = await Outbox.getFailedOperations();
    expect(failedStillIntact.some((f) => f.id === 'unowned-op')).toBe(true);
  });
});
