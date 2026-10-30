// ==============================================================================
// گالری طلایی | صف آفلاین عملیات در IndexedDB (Offline Operations Queue v2)
// مدیریت ارسال مجدد تغییرات با آپلود ترتیبی Blobs، جداسازی خطای دائم و FIFO به تفکیک پروژه
// ==============================================================================

export type OfflineOperationType =
  | 'UPSERT_PROJECT'
  | 'PATCH_PROJECT'
  | 'DELETE_PROJECT'
  | 'UPSERT_TICKET'
  | 'DELETE_TICKET'
  | 'UPSERT_SETTINGS';

export interface OfflineOperation {
  id: string;
  type: OfflineOperationType;
  projectId: string | null;
  payload: any;
  createdAt: number;
  retryCount: number;
  lastError?: string;
}

export interface PendingUpload {
  id: string;
  operationId: string;
  projectId: string;
  field: string;
  index: number | null;
  blob: Blob;
  fileName: string;
  mimeType: string;
  createdAt: number;
}

export interface FailedOperation {
  id: string;
  type: OfflineOperationType;
  projectId: string | null;
  payload: any;
  errorReason: string;
  failedAt: number;
  retryCount: number;
}

const DB_NAME = 'talaie_offline_db';
const DB_VERSION = 2;
const STORE_PENDING = 'pending_operations';
const STORE_UPLOADS = 'pending_uploads';
const STORE_FAILED = 'failed_operations';

let dbInstance: IDBDatabase | null = null;
const pendingListeners = new Set<(count: number) => void>();
const failedListeners = new Set<(count: number) => void>();
let cachedPendingCount = 0;
let cachedFailedCount = 0;
let isProcessing = false;

function openDb(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB در این مرورگر پشتیبانی نمی‌شود.'));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

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
 * Determines whether an error is permanent (validation, RLS, 4xx) vs transient network error
 */
export function isPermanentError(err: any): boolean {
  if (!err) return false;
  const status = Number(err.status || err.statusCode || 0);

  // 4xx client errors (excluding 408 Request Timeout or 429 Too Many Requests)
  if (status >= 400 && status < 500 && status !== 408 && status !== 429) {
    return true;
  }

  const code = String(err.code || '');
  // Postgres constraint / syntax / RLS error codes (e.g. 42501, 23514, 23503, PGRST)
  if (code.startsWith('42') || code.startsWith('23') || code.startsWith('PGRST')) {
    return true;
  }

  const msg = String(err.message || '').toLowerCase();
  if (
    msg.includes('رشته خالی') ||
    msg.includes('یافت نشد') ||
    msg.includes('دسترسی غیرمجاز') ||
    msg.includes('unauthorized') ||
    msg.includes('forbidden') ||
    msg.includes('not found') ||
    msg.includes('invalid') ||
    msg.includes('violates')
  ) {
    return true;
  }

  return false;
}

async function updateCountsInternal(): Promise<{ pending: number; failed: number }> {
  try {
    const db = await openDb();

    // Count pending
    const pendingCount = await new Promise<number>((resolve, reject) => {
      const tx = db.transaction(STORE_PENDING, 'readonly');
      const store = tx.objectStore(STORE_PENDING);
      const req = store.count();
      req.onsuccess = () => resolve(req.result || 0);
      req.onerror = () => reject(req.error);
    });

    // Count failed
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
    console.warn('Failed to update offline queue counts:', err);
    return { pending: cachedPendingCount, failed: cachedFailedCount };
  }
}

export const OfflineQueue = {
  /**
   * Adds an operation to the offline queue without stripping base64 images/signatures.
   * Extracts un-uploaded photos and signatures to the pending_uploads store as native Blobs.
   */
  async enqueue(
    type: OfflineOperationType,
    payload: any,
    explicitProjectId?: string
  ): Promise<void> {
    const db = await openDb();
    const opId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const projectId =
      explicitProjectId ||
      (payload && typeof payload === 'object' ? payload.id || payload.projectId || null : null);

    const uploadsToStore: PendingUpload[] = [];
    const payloadCopy = JSON.parse(JSON.stringify(payload));

    // Extract customer signature if base64 data URL
    if (
      payloadCopy &&
      typeof payloadCopy.customerSignature === 'string' &&
      payloadCopy.customerSignature.startsWith('data:')
    ) {
      try {
        const blob = dataUrlToBlob(payloadCopy.customerSignature);
        const uuid = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
        uploadsToStore.push({
          id: `${opId}-sig`,
          operationId: opId,
          projectId: projectId || 'unknown',
          field: 'customerSignature',
          index: null,
          blob,
          fileName: `signature-${uuid}.png`,
          mimeType: 'image/png',
          createdAt: Date.now(),
        });
      } catch (err) {
        console.warn('Failed to convert customer signature dataUrl to Blob:', err);
      }
    }

    // Extract photos in arrays if base64 data URL
    const photoFields = ['beforePhotos', 'afterPhotos', 'completionPhotos'];
    for (const field of photoFields) {
      if (Array.isArray(payloadCopy[field])) {
        payloadCopy[field].forEach((photoUrl: string, idx: number) => {
          if (typeof photoUrl === 'string' && photoUrl.startsWith('data:')) {
            try {
              const blob = dataUrlToBlob(photoUrl);
              const uuid = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
              uploadsToStore.push({
                id: `${opId}-${field}-${idx}`,
                operationId: opId,
                projectId: projectId || 'unknown',
                field,
                index: idx,
                blob,
                fileName: `${uuid}.jpg`,
                mimeType: 'image/jpeg',
                createdAt: Date.now(),
              });
            } catch (err) {
              console.warn(`Failed to convert ${field}[${idx}] dataUrl to Blob:`, err);
            }
          }
        });
      }
    }

    // Extract proposal images
    if (Array.isArray(payloadCopy.proposalImages)) {
      payloadCopy.proposalImages.forEach((img: any, idx: number) => {
        if (img && typeof img.url === 'string' && img.url.startsWith('data:')) {
          try {
            const blob = dataUrlToBlob(img.url);
            const uuid = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
            uploadsToStore.push({
              id: `${opId}-proposalImages-${idx}`,
              operationId: opId,
              projectId: projectId || 'unknown',
              field: 'proposalImages',
              index: idx,
              blob,
              fileName: `${uuid}.jpg`,
              mimeType: 'image/jpeg',
              createdAt: Date.now(),
            });
          } catch (err) {
            console.warn(`Failed to convert proposalImages[${idx}] dataUrl to Blob:`, err);
          }
        }
      });
    }

    const op: OfflineOperation = {
      id: opId,
      type,
      projectId,
      payload: payloadCopy,
      createdAt: Date.now(),
      retryCount: 0,
    };

    // Save op and pending uploads in an atomic transaction
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORE_PENDING, STORE_UPLOADS], 'readwrite');
      const opStore = tx.objectStore(STORE_PENDING);
      const uploadStore = tx.objectStore(STORE_UPLOADS);

      opStore.put(op);
      for (const u of uploadsToStore) {
        uploadStore.put(u);
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    await updateCountsInternal();
  },

  async getPendingCount(): Promise<number> {
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

  async getFailedCount(): Promise<number> {
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

  async getFailedOperations(): Promise<FailedOperation[]> {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_FAILED, 'readonly');
      const store = tx.objectStore(STORE_FAILED);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  },

  async retryFailedOperation(id: string): Promise<void> {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORE_FAILED, STORE_PENDING], 'readwrite');
      const failedStore = tx.objectStore(STORE_FAILED);
      const pendingStore = tx.objectStore(STORE_PENDING);

      const getReq = failedStore.get(id);
      getReq.onsuccess = () => {
        const item: FailedOperation | undefined = getReq.result;
        if (item) {
          failedStore.delete(id);
          const restoredOp: OfflineOperation = {
            id: item.id,
            type: item.type,
            projectId: item.projectId,
            payload: item.payload,
            createdAt: Date.now(),
            retryCount: 0,
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

  async deleteFailedOperation(id: string): Promise<void> {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORE_FAILED, STORE_UPLOADS], 'readwrite');
      const failedStore = tx.objectStore(STORE_FAILED);
      const uploadsStore = tx.objectStore(STORE_UPLOADS);

      failedStore.delete(id);

      // Clean up any remaining uploads linked to this op
      const reqAll = uploadsStore.getAll();
      reqAll.onsuccess = () => {
        const uploads: PendingUpload[] = reqAll.result || [];
        for (const u of uploads) {
          if (u.operationId === id) {
            uploadsStore.delete(u.id);
          }
        }
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    await updateCountsInternal();
  },

  /**
   * Processes pending operations in FIFO order per project.
   * Uploads Blobs first, replaces data URLs with storage paths, then executes the operation.
   * Permanent errors or max retries are moved to failed_operations and do not block other projects.
   */
  async processQueue(handlers: {
    uploadBlob: (upload: PendingUpload) => Promise<string>;
    executeOp: (op: OfflineOperation) => Promise<void>;
  }): Promise<void> {
    if (isProcessing) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;

    isProcessing = true;
    try {
      const db = await openDb();

      // 1. Fetch all pending operations
      const operations: OfflineOperation[] = await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_PENDING, 'readonly');
        const store = tx.objectStore(STORE_PENDING);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });

      if (operations.length === 0) {
        return;
      }

      // Sort chronologically (FIFO)
      operations.sort((a, b) => a.createdAt - b.createdAt);

      // Fetch all pending uploads
      const allUploads: PendingUpload[] = await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_UPLOADS, 'readonly');
        const store = tx.objectStore(STORE_UPLOADS);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });

      // Projects blocked by transient network failure in this cycle (preserves FIFO per project)
      const blockedProjectIds = new Set<string>();

      for (const op of operations) {
        if (op.projectId && blockedProjectIds.has(op.projectId)) {
          // Skip subsequent operations on this same project to maintain strict project FIFO
          continue;
        }

        try {
          // A. Process uploads belonging to this operation first
          const opUploads = allUploads.filter((u) => u.operationId === op.id);
          for (const u of opUploads) {
            const storagePath = await handlers.uploadBlob(u);

            // Replace data URL with uploaded storage path in payload
            if (u.field === 'customerSignature') {
              op.payload.customerSignature = storagePath;
            } else if (u.field === 'proposalImages' && u.index !== null) {
              if (op.payload.proposalImages?.[u.index]) {
                op.payload.proposalImages[u.index].url = storagePath;
              }
            } else if (u.index !== null && Array.isArray(op.payload[u.field])) {
              op.payload[u.field][u.index] = storagePath;
            }

            // Remove processed upload record from IndexedDB
            await new Promise<void>((resolve, reject) => {
              const tx = db.transaction(STORE_UPLOADS, 'readwrite');
              const store = tx.objectStore(STORE_UPLOADS);
              const delReq = store.delete(u.id);
              delReq.onsuccess = () => resolve();
              delReq.onerror = () => reject(delReq.error);
            });
          }

          // B. Execute the actual DB operation (patch/upsert/delete)
          await handlers.executeOp(op);

          // C. Delete successfully processed operation from IndexedDB
          await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(STORE_PENDING, 'readwrite');
            const store = tx.objectStore(STORE_PENDING);
            const delReq = store.delete(op.id);
            delReq.onsuccess = () => resolve();
            delReq.onerror = () => reject(delReq.error);
          });
        } catch (err: any) {
          const isPerm = isPermanentError(err) || op.retryCount >= 4;

          if (isPerm) {
            console.warn(`Permanent failure or max retries on offline op ${op.type} (${op.id}):`, err);
            // Move to failed_operations store so it never stalls the queue
            await new Promise<void>((resolve, reject) => {
              const tx = db.transaction([STORE_PENDING, STORE_FAILED], 'readwrite');
              const pStore = tx.objectStore(STORE_PENDING);
              const fStore = tx.objectStore(STORE_FAILED);

              pStore.delete(op.id);
              const failedItem: FailedOperation = {
                id: op.id,
                type: op.type,
                projectId: op.projectId,
                payload: op.payload,
                errorReason: err?.message || String(err),
                failedAt: Date.now(),
                retryCount: op.retryCount + 1,
              };
              fStore.put(failedItem);

              tx.oncomplete = () => resolve();
              tx.onerror = () => reject(tx.error);
            });
          } else {
            console.warn(`Transient network failure on offline op ${op.type} (${op.id}), will retry:`, err);
            // Increment retry count
            op.retryCount++;
            op.lastError = err?.message || String(err);
            await new Promise<void>((resolve, reject) => {
              const tx = db.transaction(STORE_PENDING, 'readwrite');
              const store = tx.objectStore(STORE_PENDING);
              const putReq = store.put(op);
              putReq.onsuccess = () => resolve();
              putReq.onerror = () => reject(putReq.error);
            });

            // Block subsequent operations on this specific project
            if (op.projectId) {
              blockedProjectIds.add(op.projectId);
            }
          }
        }
      }
    } catch (err) {
      console.warn('Error running processQueue:', err);
    } finally {
      isProcessing = false;
      await updateCountsInternal();
    }
  },
};

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
