// ==============================================================================
// گالری طلایی | صف آفلاین عملیات در IndexedDB (Offline Operations Queue)
// مدیریت ارسال مجدد تغییرات در زمان قطعی شبکه یا خطای سرور بدون عکس‌های base64
// ==============================================================================

export type OfflineOperationType =
  | 'UPSERT_PROJECT'
  | 'DELETE_PROJECT'
  | 'UPSERT_TICKET'
  | 'DELETE_TICKET'
  | 'UPSERT_SETTINGS';

export interface OfflineOperation {
  id: string;
  type: OfflineOperationType;
  payload: any;
  createdAt: number;
  retryCount: number;
}

const DB_NAME = 'talaie_offline_db';
const DB_VERSION = 1;
const STORE_NAME = 'pending_operations';

let dbInstance: IDBDatabase | null = null;
const countListeners = new Set<(count: number) => void>();
let cachedCount = 0;
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
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = (event: any) => {
      dbInstance = event.target.result;
      updatePendingCountInternal();
      resolve(dbInstance!);
    };

    request.onerror = (event: any) => {
      console.warn('خطا در باز کردن IndexedDB:', event.target.error);
      reject(event.target.error);
    };
  });
}

/**
 * Sanitizes project payload to ensure no heavy base64 strings are stored in offline queue
 */
function sanitizePayload(type: OfflineOperationType, payload: any): any {
  if (type === 'UPSERT_PROJECT' && payload && typeof payload === 'object') {
    const clean = { ...payload };
    delete clean.__fromCache;

    // Remove any base64 photo data from the offline queue payload
    if (Array.isArray(clean.proposalImages)) {
      clean.proposalImages = clean.proposalImages.map((img: any) => ({
        ...img,
        url: img.url?.startsWith('data:') ? '' : img.url,
      }));
    }
    if (Array.isArray(clean.beforePhotos)) {
      clean.beforePhotos = clean.beforePhotos.map((p: any) => (p?.startsWith('data:') ? '' : p));
    }
    if (Array.isArray(clean.afterPhotos)) {
      clean.afterPhotos = clean.afterPhotos.map((p: any) => (p?.startsWith('data:') ? '' : p));
    }
    if (Array.isArray(clean.completionPhotos)) {
      clean.completionPhotos = clean.completionPhotos.map((p: any) => (p?.startsWith('data:') ? '' : p));
    }
    if (clean.customerSignature && clean.customerSignature.startsWith('data:')) {
      clean.customerSignature = '';
    }
    return clean;
  }
  return payload;
}

async function updatePendingCountInternal(): Promise<number> {
  try {
    const db = await openDb();
    const count = await new Promise<number>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.count();
      req.onsuccess = () => resolve(req.result || 0);
      req.onerror = () => reject(req.error);
    });

    cachedCount = count;
    countListeners.forEach((fn) => fn(count));
    return count;
  } catch (err) {
    console.warn('Failed to count pending operations:', err);
    return cachedCount;
  }
}

export const OfflineQueue = {
  /**
   * Adds an operation to the offline queue
   */
  async enqueue(type: OfflineOperationType, payload: any): Promise<void> {
    const db = await openDb();
    const op: OfflineOperation = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      type,
      payload: sanitizePayload(type, payload),
      createdAt: Date.now(),
      retryCount: 0,
    };

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(op);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });

    await updatePendingCountInternal();
  },

  /**
   * Returns current number of pending offline operations
   */
  async getPendingCount(): Promise<number> {
    return updatePendingCountInternal();
  },

  /**
   * Subscribes to changes in pending queue count
   */
  subscribePendingCount(callback: (count: number) => void): () => void {
    countListeners.add(callback);
    callback(cachedCount);
    updatePendingCountInternal();
    return () => {
      countListeners.delete(callback);
    };
  },

  /**
   * Processes all pending operations in sequential FIFO order
   */
  async processQueue(
    executor: (op: OfflineOperation) => Promise<boolean>
  ): Promise<void> {
    if (isProcessing) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;

    isProcessing = true;
    try {
      const db = await openDb();
      const operations: OfflineOperation[] = await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });

      if (operations.length === 0) {
        isProcessing = false;
        return;
      }

      // Sort chronologically (FIFO)
      operations.sort((a, b) => a.createdAt - b.createdAt);

      for (const op of operations) {
        try {
          const success = await executor(op);
          if (success) {
            // Delete processed item from IndexedDB
            await new Promise<void>((resolve, reject) => {
              const tx = db.transaction(STORE_NAME, 'readwrite');
              const store = tx.objectStore(STORE_NAME);
              const req = store.delete(op.id);
              req.onsuccess = () => resolve();
              req.onerror = () => reject(req.error);
            });
            await updatePendingCountInternal();
          } else {
            // Stop batch if an item fails, preserving strict FIFO ordering
            break;
          }
        } catch (err) {
          console.warn(`Offline op ${op.type} failed, will retry:`, err);
          break;
        }
      }
    } catch (err) {
      console.warn('Error processing offline queue:', err);
    } finally {
      isProcessing = false;
      await updatePendingCountInternal();
    }
  },
};

// Automatic retry setup on 'online' event and every 30 seconds
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    window.dispatchEvent(new CustomEvent('talaie-trigger-offline-sync'));
  });

  setInterval(() => {
    if (navigator.onLine && cachedCount > 0) {
      window.dispatchEvent(new CustomEvent('talaie-trigger-offline-sync'));
    }
  }, 30000);
}
