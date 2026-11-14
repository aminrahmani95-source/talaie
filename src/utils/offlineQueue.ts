// ==============================================================================
// گالری طلایی | لایه نوشتن یکپارچه و صف Outbox (Talaei Outbox Writing Layer v3)
// معماری تک‌مسیره: commit(op) -> ذخیره اتمیک در IndexedDB -> اعمال محلی -> ارسال به سرور
// ==============================================================================

import { Project, Ticket, SystemSettings, PersonnelEvaluation, MaterialRequest } from '../types';

export type OutboxMutationType =
  | 'CREATE_PROJECT'
  | 'PATCH_PROJECT'
  | 'APPEND_PROJECT_EVALUATION'
  | 'DELETE_PROJECT'
  | 'CREATE_TICKET'
  | 'PATCH_TICKET'
  | 'DELETE_TICKET'
  | 'UPDATE_SETTINGS'
  | 'CREATE_MATERIAL_REQUEST'
  | 'PATCH_MATERIAL_REQUEST'
  | 'DELETE_MATERIAL_REQUEST';

export interface OutboxMutation {
  type: OutboxMutationType;
  orderingKey: string; // e.g. "project:p-101", "ticket:t-101", "settings"
  payload: any;
}

export interface OutboxOperation {
  id: string;
  orderingKey: string;
  userId: string;
  type: OutboxMutationType;
  payload: any;
  createdAt: number;
  retryCount: number;
  nextRetryAt: number;
  lastError?: string;
}

export interface TargetPath {
  path: (string | number)[];
}

export interface PendingUpload {
  id: string;
  operationId: string;
  orderingKey: string;
  blob: Blob;
  fileName: string;
  mimeType: string;
  targets: TargetPath[];
  createdAt: number;
}

export interface FailedOperation {
  id: string;
  orderingKey: string;
  userId: string;
  type: OutboxMutationType;
  payload: any;
  errorReason: string;
  failedAt: number;
  retryCount: number;
  originalCreatedAt: number;
}

const DB_NAME = 'talaie_offline_db';
const DB_VERSION = 3;
const STORE_PENDING = 'pending_operations';
const STORE_UPLOADS = 'pending_uploads';
const STORE_FAILED = 'failed_operations';

let dbInstance: IDBDatabase | null = null;

export function closeDb(): void {
  if (dbInstance) {
    try {
      dbInstance.close();
    } catch {}
    dbInstance = null;
  }
}

let activeProcessingRunId = 0;
let cachedPendingCount = 0;
let cachedFailedCount = 0;
let isProcessing = false;

export function abortActiveProcessing(): void {
  activeProcessingRunId++;
  isProcessing = false;
}

export function resetProcessingStateForTesting(): void {
  activeProcessingRunId++;
  isProcessing = false;
  closeDb();
}
const pendingListeners = new Set<(count: number) => void>();
const failedListeners = new Set<(count: number) => void>();

export function openDb(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' && typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB در این محیط پشتیبانی نمی‌شود.'));
    }

    const idb = typeof window !== 'undefined' ? window.indexedDB : indexedDB;
    const request = idb.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: any) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_PENDING)) {
        db.createObjectStore(STORE_PENDING, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_UPLOADS)) {
        db.createObjectStore(STORE_UPLOADS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_FAILED)) {
        db.createObjectStore(STORE_FAILED, { keyPath: 'id' });
      }
    };

    request.onsuccess = (event: any) => {
      dbInstance = event.target.result;
      updateCountsInternal();
      resolve(dbInstance!);
    };

    request.onerror = (event: any) => {
      console.warn('خطا در باز کردن IndexedDB:', event.target.error);
      reject(event.target.error);
    };
  });
}

/**
 * Resets cached dbInstance (useful for tests)
 */
export function resetDbInstance() {
  dbInstance = null;
}

/**
 * Converts a base64 Data URL to a native browser Blob
 */
export function dataUrlToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(',');
  const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
  const bstr = atob(parts[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

/**
 * Error thrown on client-side validation failures or permanent rejection
 */
export class PermanentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PermanentError';
  }
}

/**
 * Error classification: Transient (retry indefinitely with backoff) vs Permanent
 * - Transient:
 *   - TypeError, AbortError, and network drop (based on message)
 *   - status 0 ONLY when the error is NOT a PostgrestError or PermanentError
 *   - HTTP status 408, 429, 5xx
 *   - 401, PGRST000-PGRST002, and PGRST301
 *   - 42501 ONLY without session
 * - Permanent:
 *   - PermanentError
 *   - Any PostgrestError that has a code and is not in the transient list (e.g. 42501 with session, P0001, 23505, 22P02, PGRST116)
 *   - Other 4xx HTTP statuses
 */
export function isTransientError(err: any, hasSession: boolean = true): boolean {
  if (!err) return false;

  // 1. PermanentError is ALWAYS permanent
  if (err instanceof PermanentError || err?.name === 'PermanentError') {
    return false;
  }

  const name = String(err?.name || '');
  const code = typeof err?.code === 'string' ? err.code.trim() : '';
  // Convert status or statusCode (string/number) to number (e.g. StorageApiError statusCode: '409')
  const rawStatus =
    err?.status !== undefined && err?.status !== null && err?.status !== '' && err?.status !== 0
      ? err.status
      : (err?.statusCode ?? err?.status ?? -1);
  const status = Number(rawStatus);
  const msg = String(err?.message || '').toLowerCase();

  // StorageUnknownError is ALWAYS transient (thrown on network drops in Supabase Storage)
  if (name === 'StorageUnknownError' || name === 'StorageVectorsUnknownError') {
    return true;
  }

  // Any error that has no database code (or empty code) and status is 0, undefined, or -1 is transient
  // (e.g. Safari "Load failed" PostgrestError with code: '', status: 0 / undefined)
  if (!code && (status <= 0 || isNaN(status))) {
    return true;
  }

  // Determine whether this error is a PostgrestError or has a database code
  const isPostgrest =
    name === 'PostgrestError' ||
    Boolean(code) ||
    (typeof err === 'object' && ('details' in err || 'hint' in err));

  // If this error has a Postgrest/database error code:
  if (code) {
    // Transient codes:
    if (code === 'PGRST000' || code === 'PGRST001' || code === 'PGRST002' || code === 'PGRST301') {
      return true;
    }
    // 42501 (RLS violation) is transient ONLY if session is missing/expired
    if (code === '42501') {
      return !hasSession;
    }
    // All other database codes (P0001, 23505, 22P02, PGRST116, etc.) are permanent!
    return false;
  }

  // If it's a PostgrestError without a code:
  if (isPostgrest) {
    if (status === 408 || status === 429 || (status >= 500 && status < 600)) {
      return true;
    }
    if (status === 401) {
      return true;
    }
    if (status >= 400 && status < 500) {
      return false;
    }
  }

  // 2. HTTP status codes
  if (status === 408 || status === 429 || (status >= 500 && status < 600)) {
    return true;
  }
  if (status === 401) {
    return true;
  }
  if (status >= 400 && status < 500) {
    return false;
  }

  // 3. TypeError, AbortError, and network messages
  if (name === 'TypeError' || name === 'AbortError') {
    return true;
  }
  if (
    msg.includes('load failed') ||
    msg.includes('network') ||
    msg.includes('fetch') ||
    msg.includes('timeout') ||
    msg.includes('aborted') ||
    msg.includes('offline') ||
    msg.includes('connection')
  ) {
    return true;
  }

  // 4. status 0 ONLY when the error is NOT a PostgrestError or PermanentError
  if (status === 0 && !isPostgrest) {
    return true;
  }

  return false;
}

export function isPermanentError(err: any, hasSession: boolean = true): boolean {
  return !isTransientError(err, hasSession);
}

/**
 * Exponential backoff: 15s, 30s, 60s, 120s, 240s, 480s, up to max 15 minutes (900s)
 */
export function getNextBackoffDelay(retryCount: number): number {
  const base = 15 * 1000;
  const delay = base * Math.pow(2, retryCount);
  const maxDelay = 15 * 60 * 1000;
  return Math.min(delay, maxDelay);
}

/**
 * Extracts and deduplicates base64 images from payload.
 * Identical images (e.g. afterPhotos and completionPhotos referencing the same data URL)
 * are uploaded only once, and mapped to all target paths.
 */
export function extractUploadsAndDeduplicate(
  payload: any,
  operationId: string,
  orderingKey: string
): { cleanPayload: any; uploads: PendingUpload[] } {
  const cleanPayload = JSON.parse(JSON.stringify(payload));
  const uploadsMap = new Map<string, PendingUpload>();

  function walk(obj: any, currentPath: (string | number)[]) {
    if (!obj || typeof obj !== 'object') return;

    for (const [key, value] of Object.entries(obj)) {
      const path = [...currentPath, key];
      if (typeof value === 'string' && value.startsWith('data:')) {
        const isSignature = path.includes('customerSignature');
        const mimeType = isSignature ? 'image/png' : 'image/jpeg';
        const ext = isSignature ? 'png' : 'jpg';

        if (!uploadsMap.has(value)) {
          const uuid = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
          const fileName = isSignature ? `signature-${uuid}.png` : `${uuid}.${ext}`;
          const blob = dataUrlToBlob(value);

          uploadsMap.set(value, {
            id: `${operationId}-upload-${uploadsMap.size}`,
            operationId,
            orderingKey,
            blob,
            fileName,
            mimeType,
            targets: [{ path }],
            createdAt: Date.now(),
          });
        } else {
          // Deduplicate: same file data encountered again, add another target path!
          uploadsMap.get(value)!.targets.push({ path });
        }
        obj[key] = '';
      } else if (typeof value === 'object') {
        walk(value, path);
      }
    }
  }

  walk(cleanPayload, []);
  return { cleanPayload, uploads: Array.from(uploadsMap.values()) };
}

/**
 * Applies a target path update onto an object
 */
export function setNestedValue(obj: any, path: (string | number)[], value: any) {
  let curr = obj;
  for (let i = 0; i < path.length - 1; i++) {
    const k = path[i];
    if (!curr[k]) return;
    curr = curr[k];
  }
  if (curr && path.length > 0) {
    curr[path[path.length - 1]] = value;
  }
}

/**
 * Computes difference between original project and updated project.
 * Excludes empty strings, unchanged primitives, and unchanged arrays/objects.
 */
export function computeProjectDiff(original: Project, updated: Partial<Project>): Partial<Project> {
  const diff: Partial<Project> = {};
  for (const [key, newVal] of Object.entries(updated)) {
    if (key === 'id' || key === 'createdAt' || key === '__fromCache') continue;
    const oldVal = (original as any)[key];

    // Do not include empty strings in patch
    if (newVal === '') continue;

    // Check equality for arrays
    if (Array.isArray(newVal)) {
      if (Array.isArray(oldVal) && JSON.stringify(newVal) === JSON.stringify(oldVal)) {
        continue;
      }
      diff[key as keyof Project] = newVal as any;
      continue;
    }

    // Check equality for objects
    if (newVal && typeof newVal === 'object') {
      if (oldVal && typeof oldVal === 'object' && JSON.stringify(newVal) === JSON.stringify(oldVal)) {
        continue;
      }
      diff[key as keyof Project] = newVal as any;
      continue;
    }

    // Primitives
    if (newVal !== oldVal) {
      diff[key as keyof Project] = newVal as any;
    }
  }
  return diff;
}

async function updateCountsInternal(): Promise<{ pending: number; failed: number }> {
  try {
    const db = await openDb();

    const pendingCount = await new Promise<number>((resolve, reject) => {
      const tx = db.transaction(STORE_PENDING, 'readonly');
      const store = tx.objectStore(STORE_PENDING);
      const req = store.count();
      req.onsuccess = () => resolve(req.result || 0);
      req.onerror = () => reject(req.error);
    });

    const failedCount = await new Promise<number>((resolve, reject) => {
      const tx = db.transaction(STORE_FAILED, 'readonly');
      const store = tx.objectStore(STORE_FAILED);
      const req = store.count();
      req.onsuccess = () => resolve(req.result || 0);
      req.onerror = () => reject(req.error);
    });

    cachedPendingCount = pendingCount;
    cachedFailedCount = failedCount;

    pendingListeners.forEach((fn) => fn(pendingCount));
    failedListeners.forEach((fn) => fn(failedCount));

    return { pending: pendingCount, failed: failedCount };
  } catch (err) {
    return { pending: cachedPendingCount, failed: cachedFailedCount };
  }
}

let lastOpTimestamp = 0;
function getUniqueTimestamp(): number {
  const now = Date.now();
  lastOpTimestamp = Math.max(now, lastOpTimestamp + 1);
  return lastOpTimestamp;
}

export const Outbox = {
  /**
   * Single unified entry point for all writes in the app:
   * 1. Saves operation and its uploads into IndexedDB in a single transaction.
   * 2. After IndexedDB write succeeds, applies optimistic local update.
   * 3. Triggers queue processing immediately.
   */
  async commit(
    mutation: OutboxMutation,
    userId: string,
    onOptimisticApply?: () => void
  ): Promise<void> {
    if (!userId) {
      throw new Error('برای انجام عملیات، ابتدا وارد حساب کاربری شوید.');
    }

    const db = await openDb();
    const opId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    // Extract any base64 images and deduplicate identical ones
    const { cleanPayload, uploads } = extractUploadsAndDeduplicate(
      mutation.payload,
      opId,
      mutation.orderingKey
    );

    const op: OutboxOperation = {
      id: opId,
      orderingKey: mutation.orderingKey,
      userId,
      type: mutation.type,
      payload: cleanPayload,
      createdAt: getUniqueTimestamp(),
      retryCount: 0,
      nextRetryAt: 0,
    };

    // Step 1: Save operation and uploads atomically to IndexedDB
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORE_PENDING, STORE_UPLOADS], 'readwrite');
      const opStore = tx.objectStore(STORE_PENDING);
      const uploadStore = tx.objectStore(STORE_UPLOADS);

      opStore.put(op);
      for (const u of uploads) {
        uploadStore.put(u);
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('تراکنش ذخیره‌سازی لغو شد.'));
    });

    await updateCountsInternal();

    // Step 2: Only after Step 1 succeeds, execute optimistic local state update
    if (onOptimisticApply) {
      onOptimisticApply();
    }

    // Step 3: Trigger queue processing immediately (non-blocking)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('talaie-trigger-offline-sync'));
    }
  },

  async getPendingCount(userId?: string): Promise<number> {
    if (userId) {
      const ops = await this.getPendingOperations(userId);
      return ops.length;
    }
    const { pending } = await updateCountsInternal();
    return pending;
  },

  subscribePendingCount(callback: (count: number) => void): () => void {
    pendingListeners.add(callback);
    callback(cachedPendingCount);
    updateCountsInternal();
    return () => {
      pendingListeners.delete(callback);
    };
  },

  async getFailedCount(userId?: string): Promise<number> {
    if (userId) {
      const ops = await this.getFailedOperations(userId);
      return ops.length;
    }
    const { failed } = await updateCountsInternal();
    return failed;
  },

  subscribeFailedCount(callback: (count: number) => void): () => void {
    failedListeners.add(callback);
    callback(cachedFailedCount);
    updateCountsInternal();
    return () => {
      failedListeners.delete(callback);
    };
  },

  async getFailedOperations(userId?: string): Promise<FailedOperation[]> {
    const db = await openDb();
    const ops = await new Promise<FailedOperation[]>((resolve, reject) => {
      const tx = db.transaction(STORE_FAILED, 'readonly');
      const store = tx.objectStore(STORE_FAILED);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
    if (userId) {
      return ops.filter((op) => op.userId === userId);
    }
    return ops;
  },

  async getPendingOperations(userId?: string): Promise<OutboxOperation[]> {
    const db = await openDb();
    const ops = await new Promise<OutboxOperation[]>((resolve, reject) => {
      const tx = db.transaction(STORE_PENDING, 'readonly');
      const store = tx.objectStore(STORE_PENDING);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
    if (userId) {
      return ops.filter((op) => op.userId === userId);
    }
    return ops;
  },

  /**
   * Destructively purges all Outbox stores (pending, failed, uploads)
   * MUST only be called during a confirmed, destructive application reset.
   */
  async purgeAll(): Promise<void> {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORE_PENDING, STORE_FAILED, STORE_UPLOADS], 'readwrite');
      tx.objectStore(STORE_PENDING).clear();
      tx.objectStore(STORE_FAILED).clear();
      tx.objectStore(STORE_UPLOADS).clear();

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('خطا در پاک‌سازی صف‌های آفلاین'));
    });
    await updateCountsInternal();
  },

  async retryFailedOperation(id: string, currentUserId: string): Promise<void> {
    if (!currentUserId || typeof currentUserId !== 'string' || currentUserId.trim() === '') {
      return;
    }
    const cleanUserId = currentUserId.trim();

    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORE_FAILED, STORE_PENDING], 'readwrite');
      const failedStore = tx.objectStore(STORE_FAILED);
      const pendingStore = tx.objectStore(STORE_PENDING);

      const getReq = failedStore.get(id);
      getReq.onsuccess = () => {
        const item: FailedOperation | undefined = getReq.result;
        if (item) {
          if (!item.userId || item.userId !== cleanUserId) {
            // Cannot retry another user's failed operation or unowned item
            return;
          }
          failedStore.delete(id);
          // Preserve original createdAt to maintain FIFO ordering!
          const restoredOp: OutboxOperation = {
            id: item.id,
            orderingKey: item.orderingKey,
            userId: item.userId,
            type: item.type,
            payload: item.payload,
            createdAt: item.originalCreatedAt || Date.now(),
            retryCount: 0,
            nextRetryAt: 0,
          };
          pendingStore.put(restoredOp);
        }
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    await updateCountsInternal();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('talaie-trigger-offline-sync'));
    }
  },

  async deleteFailedOperation(id: string, currentUserId: string): Promise<void> {
    if (!currentUserId || typeof currentUserId !== 'string' || currentUserId.trim() === '') {
      return;
    }
    const cleanUserId = currentUserId.trim();

    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORE_FAILED, STORE_UPLOADS], 'readwrite');
      const failedStore = tx.objectStore(STORE_FAILED);
      const uploadsStore = tx.objectStore(STORE_UPLOADS);

      const getReq = failedStore.get(id);
      getReq.onsuccess = () => {
        const item: FailedOperation | undefined = getReq.result;
        if (item) {
          if (!item.userId || item.userId !== cleanUserId) {
            // Cannot delete another user's failed operation or unowned item
            return;
          }
          failedStore.delete(id);

          const reqAll = uploadsStore.getAll();
          reqAll.onsuccess = () => {
            const uploads: PendingUpload[] = reqAll.result || [];
            for (const u of uploads) {
              if (u.operationId === id) {
                uploadsStore.delete(u.id);
              }
            }
          };
        }
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    await updateCountsInternal();
  },

  /**
   * بازیابی ایمن و بازگرداندن عملیات‌های متریال متوقف‌شده در صف خطای دائم
   * که صرفاً به دلیل عدم پیاده‌سازی جداول سرور متوقف شده بودند.
   * 
   * اصول تضمین‌شده:
   * ۱. احراز هویت اجباری: targetUserId الزامی است و ورودی خالی/نامعتبر هیچ تغییری در دیتابیس ایجاد نمی‌کند.
   * ۲. تفکیک دقیق: صرفاً عملیات‌های متریال با خطای FEATURE_NOT_IMPLEMENTED_ON_SERVER انتخاب می‌شوند.
   * ۳. حفظ خطاهای دائمی نامرتبط: خطاهای دیگر (مانند ۴۰۴، نقض قوانین پروژه یا RLS) در STORE_FAILED دست‌نخورده باقی می‌مانند.
   * ۴. صیانت از ترتیب زمانی (FIFO): زمان اولیه (originalCreatedAt) حفظ می‌شود تا وابستگی‌ها و تقدم عملیات رعایت شوند.
   * ۵. ممانعت قطعی از تکرار: شناسه‌های موجود در STORE_PENDING بررسی شده و عملیات تکراری ایجاد نمی‌شود.
   * ۶. تراکنش اتمیک: حذف از STORE_FAILED و ثبت در STORE_PENDING در یک تراکنش واحد انجام می‌گیرد.
   */
  async requeueUnsupportedMaterialOperations(targetUserId: string): Promise<{
    requeuedCount: number;
    requeuedIds: string[];
  }> {
    if (!targetUserId || typeof targetUserId !== 'string' || targetUserId.trim() === '') {
      return { requeuedCount: 0, requeuedIds: [] };
    }
    const cleanTargetUserId = targetUserId.trim();

    const db = await openDb();
    const requeuedIds: string[] = [];

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORE_FAILED, STORE_PENDING], 'readwrite');
      const failedStore = tx.objectStore(STORE_FAILED);
      const pendingStore = tx.objectStore(STORE_PENDING);

      const reqFailed = failedStore.getAll();
      const reqPending = pendingStore.getAll();

      let failedList: FailedOperation[] = [];
      let pendingList: OutboxOperation[] = [];
      let loadedCount = 0;

      const checkBothLoaded = () => {
        loadedCount++;
        if (loadedCount < 2) return;

        const pendingIds = new Set(pendingList.map((p) => p.id));

        for (const item of failedList) {
          if (!item.userId || item.userId !== cleanTargetUserId) {
            continue;
          }

          const isMaterialOp =
            (item.orderingKey && item.orderingKey.startsWith('material:')) ||
            item.type === 'CREATE_MATERIAL_REQUEST' ||
            item.type === 'PATCH_MATERIAL_REQUEST' ||
            item.type === 'DELETE_MATERIAL_REQUEST';

          const isServerNotImplementedError =
            item.errorReason.includes('FEATURE_NOT_IMPLEMENTED_ON_SERVER') ||
            item.errorReason.includes('همگام‌سازی ابری متریال هنوز در سرور فعال نشده است') ||
            item.errorReason.includes('در انتظار مایگریشن');

          if (isMaterialOp && isServerNotImplementedError) {
            if (!pendingIds.has(item.id)) {
              failedStore.delete(item.id);
              const restoredOp: OutboxOperation = {
                id: item.id,
                orderingKey: item.orderingKey,
                userId: item.userId,
                type: item.type,
                payload: item.payload,
                createdAt: item.originalCreatedAt || Date.now(),
                retryCount: 0,
                nextRetryAt: 0,
              };
              pendingStore.put(restoredOp);
              requeuedIds.push(item.id);
              pendingIds.add(item.id);
            }
          }
        }
      };

      reqFailed.onsuccess = () => {
        failedList = reqFailed.result || [];
        checkBothLoaded();
      };
      reqPending.onsuccess = () => {
        pendingList = reqPending.result || [];
        checkBothLoaded();
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    await updateCountsInternal();
    if (requeuedIds.length > 0 && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('talaie-trigger-offline-sync'));
    }

    return { requeuedCount: requeuedIds.length, requeuedIds };
  },

  /**
   * Applies all pending operations in the Outbox on top of server projects
   * so unsent in-flight changes never flicker or disappear from the screen.
   */
  async applyPendingToProjects(
    serverProjects: Project[],
    pendingOps?: OutboxOperation[],
    currentUserId?: string
  ): Promise<Project[]> {
    const ops = pendingOps || (await Outbox.getPendingOperations(currentUserId));
    const result = [...serverProjects];
    const projectOps = ops
      .filter((op) => op.orderingKey.startsWith('project:') && (!currentUserId || op.userId === currentUserId))
      .sort((a, b) => a.createdAt - b.createdAt);

    for (const op of projectOps) {
      if (op.type === 'CREATE_PROJECT') {
        const p = op.payload?.project || op.payload;
        if (p && p.id) {
          const idx = result.findIndex((x) => x.id === p.id);
          if (idx >= 0) {
            result[idx] = { ...result[idx], ...p };
          } else {
            result.unshift(p);
          }
        }
      } else if (op.type === 'PATCH_PROJECT') {
        const id = op.payload?.id;
        const patch = op.payload?.patch || op.payload;
        if (id && patch) {
          const idx = result.findIndex((x) => x.id === id);
          if (idx >= 0) {
            // _auditReason فقط برای تاریخچه‌ی سرور است و نباید روی خود پروژه بماند
            const { _auditReason: _ignored, ...rest } = patch as Record<string, unknown>;
            result[idx] = { ...result[idx], ...(rest as Partial<Project>) };
          }
        }
      } else if (op.type === 'APPEND_PROJECT_EVALUATION') {
        const id = op.payload?.id;
        const evaluation = op.payload?.evaluation;
        if (id && evaluation) {
          const idx = result.findIndex((x) => x.id === id);
          if (idx >= 0) {
            const evals = [...(result[idx].evaluations || []), evaluation];
            result[idx] = { ...result[idx], evaluations: evals };
          }
        }
      } else if (op.type === 'DELETE_PROJECT') {
        const id = op.payload?.id || op.payload;
        if (id) {
          const idx = result.findIndex((x) => x.id === id);
          if (idx >= 0) {
            result.splice(idx, 1);
          }
        }
      }
    }

    return result;
  },

  /**
   * Applies all pending operations in the Outbox on top of server tickets
   */
  async applyPendingToTickets(
    serverTickets: Ticket[],
    pendingOps?: OutboxOperation[],
    currentUserId?: string
  ): Promise<Ticket[]> {
    const ops = pendingOps || (await Outbox.getPendingOperations(currentUserId));
    const result = [...serverTickets];
    const ticketOps = ops
      .filter((op) => op.orderingKey.startsWith('ticket:') && (!currentUserId || op.userId === currentUserId))
      .sort((a, b) => a.createdAt - b.createdAt);

    for (const op of ticketOps) {
      if (op.type === 'CREATE_TICKET') {
        const t = op.payload?.ticket || op.payload;
        if (t && t.id) {
          const idx = result.findIndex((x) => x.id === t.id);
          if (idx >= 0) {
            result[idx] = { ...result[idx], ...t };
          } else {
            result.unshift(t);
          }
        }
      } else if (op.type === 'PATCH_TICKET') {
        const id = op.payload?.id;
        const patch = op.payload?.patch || op.payload;
        if (id && patch) {
          const idx = result.findIndex((x) => x.id === id);
          if (idx >= 0) {
            result[idx] = { ...result[idx], ...patch };
          }
        }
      } else if (op.type === 'DELETE_TICKET') {
        const id = op.payload?.id || op.payload;
        if (id) {
          const idx = result.findIndex((x) => x.id === id);
          if (idx >= 0) {
            result.splice(idx, 1);
          }
        }
      }
    }

    return result;
  },

  /**
   * Applies all pending and un-synced operations in the Outbox on top of material requests
   */
  async applyPendingToMaterialRequests(
    serverRequests: MaterialRequest[],
    pendingOps?: Array<OutboxOperation | FailedOperation>,
    currentUserId?: string
  ): Promise<MaterialRequest[]> {
    let ops: Array<OutboxOperation | FailedOperation> = [];
    if (pendingOps) {
      ops = pendingOps;
    } else {
      const [pending, failed] = await Promise.all([
        Outbox.getPendingOperations(currentUserId),
        Outbox.getFailedOperations(currentUserId),
      ]);
      ops = [...pending, ...failed];
    }

    const result = [...serverRequests];
    const matOps = ops
      .filter(
        (op) =>
          op.orderingKey &&
          op.orderingKey.startsWith('material:') &&
          (!currentUserId || op.userId === currentUserId)
      )
      .sort((a, b) => {
        const timeA = (a as any).createdAt ?? (a as any).originalCreatedAt ?? 0;
        const timeB = (b as any).createdAt ?? (b as any).originalCreatedAt ?? 0;
        return timeA - timeB;
      });

    for (const op of matOps) {
      if (op.type === 'CREATE_MATERIAL_REQUEST') {
        const r = op.payload?.request || op.payload;
        if (r && r.id) {
          const idx = result.findIndex((x) => x.id === r.id);
          if (idx >= 0) {
            result[idx] = { ...result[idx], ...r };
          } else {
            result.unshift(r);
          }
        }
      } else if (op.type === 'PATCH_MATERIAL_REQUEST') {
        const id = op.payload?.id;
        const patch = op.payload?.patch || op.payload;
        if (id && patch) {
          const idx = result.findIndex((x) => x.id === id);
          if (idx >= 0) {
            result[idx] = { ...result[idx], ...patch };
          }
        }
      } else if (op.type === 'DELETE_MATERIAL_REQUEST') {
        const id = op.payload?.id || op.payload;
        if (id) {
          const idx = result.findIndex((x) => x.id === id);
          if (idx >= 0) {
            result.splice(idx, 1);
          }
        }
      }
    }

    return result;
  },

  /**
   * Applies pending settings update
   */
  async applyPendingToSettings(
    serverSettings: SystemSettings,
    pendingOps?: OutboxOperation[]
  ): Promise<SystemSettings> {
    const ops = pendingOps || (await Outbox.getPendingOperations());
    let result = { ...serverSettings };
    const settingsOps = ops
      .filter((op) => op.orderingKey === 'settings')
      .sort((a, b) => a.createdAt - b.createdAt);

    for (const op of settingsOps) {
      if (op.type === 'UPDATE_SETTINGS') {
        const s = op.payload?.settings || op.payload;
        if (s) {
          result = { ...result, ...s };
        }
      }
    }

    return result;
  },

  /**
   * Outbox processor:
   * - Different orderingKeys run in parallel.
   * - Same orderingKey runs in strict FIFO sequential order.
   * - A failed operation stops ONLY its own orderingKey.
   * - User B does NOT send User A's operations.
   * - Atomic transaction updates payload and removes upload records.
   */
  async processQueue(handlers: {
    currentUserId: string;
    uploadBlob: (upload: PendingUpload) => Promise<string>;
    executeMutation: (op: OutboxOperation) => Promise<void>;
    refreshSession?: () => Promise<boolean>;
    hasSession?: () => boolean;
  }): Promise<void> {
    if (isProcessing) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
    if (!handlers.currentUserId) return;

    const currentRunId = ++activeProcessingRunId;
    isProcessing = true;
    try {
      const db = await openDb();

      // 1. Fetch all pending operations
      const operations: OutboxOperation[] = await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_PENDING, 'readonly');
        const store = tx.objectStore(STORE_PENDING);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });

      if (operations.length === 0 || activeProcessingRunId !== currentRunId) return;

      // 2. Fetch all failed operations to know blocked ordering keys
      const failedList: FailedOperation[] = await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_FAILED, 'readonly');
        const store = tx.objectStore(STORE_FAILED);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });

      if (activeProcessingRunId !== currentRunId) return;

      const blockedKeys = new Set<string>(failedList.map((f) => f.orderingKey));

      // 3. Group operations by orderingKey
      const opsByKey = new Map<string, OutboxOperation[]>();
      for (const op of operations) {
        if (!opsByKey.has(op.orderingKey)) {
          opsByKey.set(op.orderingKey, []);
        }
        opsByKey.get(op.orderingKey)!.push(op);
      }

      // 4. Fetch all pending uploads
      const allUploads: PendingUpload[] = await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_UPLOADS, 'readonly');
        const store = tx.objectStore(STORE_UPLOADS);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });

      if (activeProcessingRunId !== currentRunId) return;

      // 5. Process different orderingKeys concurrently in parallel!
      const keyPromises: Promise<void>[] = [];

      for (const [key, ops] of opsByKey.entries()) {
        // If this key has a failed operation, block subsequent ops on this key only!
        if (blockedKeys.has(key)) {
          continue;
        }

        // Sort chronologically (FIFO on this key)
        ops.sort((a, b) => a.createdAt - b.createdAt);

        const processKeyOps = async () => {
          for (const op of ops) {
            // Check cancellation on account switch or logout
            if (activeProcessingRunId !== currentRunId) return;
            if (handlers.hasSession && !handlers.hasSession()) return;

            // User ownership check: strictly require a valid, matching user ID
            if (
              !op.userId ||
              typeof op.userId !== 'string' ||
              op.userId.trim() === '' ||
              op.userId !== handlers.currentUserId
            ) {
              break;
            }

            // Exponential backoff check: skip if within backoff period
            if (op.nextRetryAt && Date.now() < op.nextRetryAt) {
              break;
            }

            try {
              // A. Upload pending files for this operation
              const opUploads = allUploads.filter((u) => u.operationId === op.id);
              for (const u of opUploads) {
                if (activeProcessingRunId !== currentRunId) return;
                const storagePath = await handlers.uploadBlob(u);
                if (activeProcessingRunId !== currentRunId) return;

                // Update payload targets
                for (const t of u.targets) {
                  setNestedValue(op.payload, t.path, storagePath);
                }

                // In a single atomic IndexedDB transaction:
                // Save updated op.payload and delete upload record!
                await new Promise<void>((resolve, reject) => {
                  const tx = db.transaction([STORE_PENDING, STORE_UPLOADS], 'readwrite');
                  const pStore = tx.objectStore(STORE_PENDING);
                  const uStore = tx.objectStore(STORE_UPLOADS);

                  pStore.put(op);
                  uStore.delete(u.id);

                  tx.oncomplete = () => resolve();
                  tx.onerror = () => reject(tx.error);
                });
              }

              if (activeProcessingRunId !== currentRunId) return;

              // B. Execute server mutation
              await handlers.executeMutation(op);

              if (activeProcessingRunId !== currentRunId) return;

              // C. On success, remove from pending_operations
              await new Promise<void>((resolve, reject) => {
                const tx = db.transaction(STORE_PENDING, 'readwrite');
                const pStore = tx.objectStore(STORE_PENDING);
                const reqDel = pStore.delete(op.id);
                reqDel.onsuccess = () => resolve();
                reqDel.onerror = () => reject(reqDel.error);
              });
            } catch (err: any) {
              if (activeProcessingRunId !== currentRunId) return;
              const hasSession = handlers.hasSession ? handlers.hasSession() : true;
              const isTransient = isTransientError(err, hasSession);

              if (isTransient) {
                // If 42501 due to empty session, attempt refresh once
                if (err.code === '42501' && handlers.refreshSession) {
                  try {
                    const refreshed = await handlers.refreshSession();
                    if (refreshed && activeProcessingRunId === currentRunId) {
                      // Session refreshed, continue loop to retry immediately
                      continue;
                    }
                  } catch {}
                }

                // Transient network / timeout error: does NOT count toward 5-retry limit!
                // Apply exponential backoff: 15s, 30s, 1m, 2m, 4m, 8m, max 15m.
                op.retryCount++;
                op.nextRetryAt = Date.now() + getNextBackoffDelay(op.retryCount);
                op.lastError = err?.message || String(err);

                await new Promise<void>((resolve, reject) => {
                  const tx = db.transaction(STORE_PENDING, 'readwrite');
                  const pStore = tx.objectStore(STORE_PENDING);
                  const pReq = pStore.put(op);
                  pReq.onsuccess = () => resolve();
                  pReq.onerror = () => reject(pReq.error);
                });

                // Stop further processing for this specific key during backoff
                break;
              } else {
                // Permanent failure: move to failed_operations, stop subsequent ops on this key!
                await new Promise<void>((resolve, reject) => {
                  const tx = db.transaction([STORE_PENDING, STORE_FAILED], 'readwrite');
                  const pStore = tx.objectStore(STORE_PENDING);
                  const fStore = tx.objectStore(STORE_FAILED);

                  pStore.delete(op.id);
                  let errorReason = err?.message || String(err);
                  if (
                    errorReason.includes('پروژه مورد نظر یافت نشد') ||
                    errorReason.toLowerCase().includes('not found') ||
                    errorReason.includes('این پروژه توسط مدیر تغییر کرده یا حذف شده است') ||
                    (errorReason.includes('انتقال وضعیت') && errorReason.includes('مجاز نیست'))
                  ) {
                    errorReason = 'این پروژه توسط مدیر تغییر کرده یا حذف شده است';
                  }

                  const failedOp: FailedOperation = {
                    id: op.id,
                    orderingKey: op.orderingKey,
                    userId: op.userId,
                    type: op.type,
                    payload: op.payload,
                    errorReason,
                    failedAt: Date.now(),
                    retryCount: op.retryCount + 1,
                    originalCreatedAt: op.createdAt,
                  };
                  fStore.put(failedOp);

                  tx.oncomplete = () => resolve();
                  tx.onerror = () => reject(tx.error);
                });

                // This key now has a failed operation, block subsequent ops on this key!
                blockedKeys.add(key);
                break;
              }
            }
          }
        };

        keyPromises.push(processKeyOps());
      }

      await Promise.allSettled(keyPromises);
    } catch (err) {
      console.warn('Outbox processQueue error:', err);
    } finally {
      if (activeProcessingRunId === currentRunId) {
        isProcessing = false;
      }
      await updateCountsInternal();
    }
  },

  abortActiveProcessing,
};

// Aliases for backwards compatibility
export const OfflineQueue = Outbox;
export type OfflineOperation = OutboxOperation;
export type OfflineOperationType = OutboxMutationType;

// Automatic retry setup on 'online' event and every 30 seconds
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    window.dispatchEvent(new CustomEvent('talaie-trigger-offline-sync'));
  });

  setInterval(() => {
    if (navigator.onLine && cachedPendingCount > 0) {
      window.dispatchEvent(new CustomEvent('talaie-trigger-offline-sync'));
    }
  }, 30000);
}
