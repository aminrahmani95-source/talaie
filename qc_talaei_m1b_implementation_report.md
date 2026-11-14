# QC Talaei M1-B1: Final Fail-Closed Outbox Hardening Implementation Report

## Executive Summary
This report documents the finalized, strictly bounded implementation of the **Fail-Closed Outbox Architecture (M1-B1)** for QC Talaei. All critical edge cases—including ambiguous dispatches, application crashes, IndexedDB transaction durability boundaries, post-commit acknowledgment failures, multi-tab concurrency, and legacy record recovery—have been hardened to fail closed.

---

## 1. Scope and Boundary Compliance
In strict adherence to instructions:
- **Modified source files:** ONLY `src/utils/offlineQueue.ts`
- **Modified / added tests:** ONLY `src/utils/__tests__/outboxEngineHardening.test.ts` (and minimal pre-approved test alignment in `src/utils/__tests__/outbox.test.ts`)
- **Zero changes to:** `App.tsx`, `supabase.ts`, domain logic, UI components, roles, permissions, migrations, SQL files (`complete_setup.sql`), package dependencies, or database schema.

---

## 2. Core Architecture Implementation Details

### 2.1 Durable Pre-Dispatch `IN_FLIGHT` State
- **Mechanism:** Before any server mutation dispatch (`handlers.executeMutation`), `op.executionState = 'IN_FLIGHT'` and `op.lastAttemptedAt = Date.now()` are durably committed to IndexedDB `STORE_PENDING`.
- **Durability Boundary:** The write awaits `tx.oncomplete`.
- **Fail-Closed Guarantee:** If the transaction errors, aborts, or persistence fails, `executeMutation` is **NEVER** called. The ordering key is immediately halted (`break`), preventing subsequent dependent operations from executing out of sequence.

### 2.2 Post-Commit Atomic Acknowledgment & Local Cleanup Isolation
- **Confirmed Server Success:** Once `handlers.executeMutation()` resolves without error, the server-side effect is confirmed.
- **Local Cleanup:**
  1. The operation is first persisted as `COMMITTED_LOCAL_ACK_PENDING` with `tx.oncomplete`.
  2. Local acknowledgment atomically deletes the operation from `STORE_PENDING` and its associated blobs from `STORE_UPLOADS` in a single multi-store transaction awaiting `tx.oncomplete`.
- **Failure Resilience:** If the local delete transaction aborts or errors (e.g. disk quota exhaustion):
  - The record remains durably stored as `COMMITTED_LOCAL_ACK_PENDING`.
  - It is **NEVER** converted into `UNKNOWN_OUTCOME` or re-dispatched to Supabase.
  - On subsequent processing cycles or application restarts, **ONLY LOCAL CLEANUP** is retried.
  - The affected ordering key is halted (`break`), preventing later operations from overtaking the committed mutation.

### 2.3 Comprehensive Startup Recovery (`performStartupRecovery`)
- **Exported Function:** `export async function performStartupRecovery(db: IDBDatabase, processingUserId: string): Promise<void>`.
- **User Isolation:** Strictly scoped to `processingUserId`; foreign user operations remain dormant.
- **State Handling Matrix:**
  1. `COMMITTED_LOCAL_ACK_PENDING`: Performs local atomic deletion from `STORE_PENDING` and `STORE_UPLOADS`. Never executes remote mutations.
  2. `UNKNOWN_OUTCOME` and `CONFLICT_HOLD`: Preserved in their held states; never altered or cleared.
  3. Abandoned `IN_FLIGHT`:
     - **Non-retry-safe operations** (`CREATE_PROJECT`, `PATCH_PROJECT`, `APPEND_PROJECT_EVALUATION`, `DELETE_PROJECT`, `CREATE_TICKET`, `PATCH_TICKET`, `UPDATE_SETTINGS`, `PATCH_MATERIAL_REQUEST`, `CREATE_MATERIAL_REQUEST`): Transitioned to `UNKNOWN_OUTCOME` with `unknownReason = 'ABANDONED_IN_FLIGHT_ON_RESTART'`, `nextRetryAt = 0` (permanently held pending manual resolution).
     - **Retry-safe operations** (`DELETE_TICKET`, `DELETE_MATERIAL_REQUEST`): Rescheduled as `QUEUED` with exponential backoff delay.
  4. **Legacy records without `executionState`:**
     - `retryCount === 0`: Transitioned to `QUEUED`.
     - `retryCount > 0` & non-retry-safe: Transitioned to `UNKNOWN_OUTCOME` (`LEGACY_UNCONFIRMED_ATTEMPT`) with `nextRetryAt = 0` (held).
     - `retryCount > 0` & retry-safe: Transitioned to `QUEUED` with backoff retry.

### 2.4 Multi-Tab Synchronization via Exclusive Web Lock
- **Coordination Lock:** Wrapped in `navigator.locks.request('talaie_outbox_master_lock', { ifAvailable: true }, async (lock) => ...)`.
- **Coverage:** Coordinates **BOTH** startup recovery and queue processing under the single exclusive master lock.
- **Contention Behavior:** If another tab or worker holds the lock, `lock === null` is returned; the calling tab immediately yields without dispatching mutations or performing duplicate recoveries.
- **Fail-Closed Fallback:** If the Web Locks API is unavailable (`typeof navigator === 'undefined' || !navigator.locks || typeof navigator.locks.request !== 'function'`), the engine logs a warning and returns immediately, preventing unsafe multi-tab concurrency.

### 2.5 Strict IndexedDB Durability Boundary
- Every mutating IndexedDB operation is wrapped in a Promise listening to:
  ```typescript
  tx.oncomplete = () => { if (reqDone) resolve(); };
  tx.onerror = () => reject(tx.error);
  tx.onabort = () => reject(tx.error || new DOMException('Transaction aborted', 'AbortError'));
  ```
- No write or delete is assumed durable based solely on `IDBRequest.onsuccess`.
- Blob deletions in `STORE_UPLOADS` are explicitly completed in the multi-store transaction awaiting `tx.oncomplete`.

### 2.6 Retry Classifier Matrix
Strictly 2 retry-safe operations; all other 9 operations return `false`:
| OutboxMutationType | Retry-Safe | Idempotency / Server Side-Effect Audit |
| :--- | :---: | :--- |
| `DELETE_TICKET` | **true** | Primary key table delete; repeat on deleted row is a no-op |
| `DELETE_MATERIAL_REQUEST` | **true** | Primary key table delete; repeat on deleted row is a no-op |
| `CREATE_MATERIAL_REQUEST` | **false** | Disabled per P0-1; payload difference / foreign violation ambiguity |
| `CREATE_PROJECT` | **false** | Direct insert without conflict target; repeat throws SQL 23505 |
| `PATCH_PROJECT` | **false** | State transition validation; repeat throws exception |
| `APPEND_PROJECT_EVALUATION`| **false** | Blind JSON array append; repeat duplicates evaluations |
| `DELETE_PROJECT` | **false** | Throws exception if row already removed |
| `CREATE_TICKET` | **false** | Clobbers concurrent technician/admin ticket updates |
| `PATCH_TICKET` | **false** | Unversioned read-modify-write clobbers concurrent edits |
| `UPDATE_SETTINGS` | **false** | Blind upsert clobbers concurrent admin configuration changes |
| `PATCH_MATERIAL_REQUEST` | **false** | Status validation throws on repeated status transition |

---

## 3. Verification & Test Suite Results

### 3.1 Hardening Test Suite (`outboxEngineHardening.test.ts`)
Total: **35 tests**, all passing:
- **Scenarios 1-13:** Ownership isolation, in-flight leases, watchdog alerts, session epoch invalidation, snapshot conflict holds, classifier matrix (9 non-retry-safe mutation assertions).
- **Scenarios 14-18:** P0-2 decouple verified server success, local cleanup retry, repeated failures holding `COMMITTED_LOCAL_ACK_PENDING`, clean purge, ordering-key blocking.
- **Scenario 19 (Fail-Closed):** Pre-dispatch `IN_FLIGHT` persistence failure halts ordering key and guarantees server mutation is **never** dispatched (`dispatchCount === 0`).
- **Scenario 20 (Fail-Closed):** Transaction abort during local acknowledgment retains `COMMITTED_LOCAL_ACK_PENDING`, never converts to `UNKNOWN_OUTCOME`, and never redispatches on subsequent runs.
- **Scenario 21 (Startup Recovery):** Abandoned `IN_FLIGHT` non-retry-safe operations become `UNKNOWN_OUTCOME` with `nextRetryAt = 0` (held).
- **Scenario 22 (Startup Recovery):** Abandoned `IN_FLIGHT` retry-safe operations (`DELETE_TICKET`) schedule backoff retry.
- **Scenario 23 (Startup Recovery):** Legacy unversioned records without `executionState`: `retryCount === 0` becomes `QUEUED`, `retryCount > 0` non-retry-safe becomes `UNKNOWN_OUTCOME` (`LEGACY_UNCONFIRMED_ATTEMPT`) held.
- **Scenario 24 (Startup Recovery):** `COMMITTED_LOCAL_ACK_PENDING` on startup recovery executes local cleanup only and never dispatches to server.
- **Scenario 25 (Multi-Tab):** Exclusive master Web Lock prevents concurrent recovery or queue processing across tabs when lock is held.
- **Scenario 26 (Durability):** Post-commit atomic acknowledgment awaits `tx.oncomplete` on `[STORE_PENDING, STORE_UPLOADS]`.
- **Scenario 27 (Fail-Closed):** Absence of Web Locks API halts `processQueue` immediately without dispatching any mutations.

### 3.2 Full Repository Test Suite
```
 Test Files  27 passed (27)
      Tests  360 passed (360)
   Duration  1.22s
```

### 3.3 Production Build Verification
```
> tsc -b && vite build
✓ 2037 modules transformed.
dist/index.html                           2.37 kB
dist/assets/index-BLFg9sq4.js           657.33 kB
✓ built in 554ms
```
Zero TypeScript or bundling errors.
