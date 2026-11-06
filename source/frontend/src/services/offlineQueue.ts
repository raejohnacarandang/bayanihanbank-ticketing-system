/**
 * Offline mutation queue with IndexedDB persistence and background sync.
 * 
 * Stores failed network requests and replays them when connectivity returns.
 */

export interface QueuedMutation {
  id: string;
  type: 'updateBranchHealth' | 'createTicket' | 'updateTicket' | 'updateBranch' | 'deleteBranch' | 'createUser' | 'updateUser' | 'deleteUser' | 'addComment' | 'assignTicket' | 'updateTicketStatus' | 'updateCategory' | 'createCategory' | 'deleteCategory' | 'updateStaffAssignments' | 'markNotificationRead' | 'markAllNotificationsRead' | 'resetToDefaults';
  payload: unknown;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
}

const DB_NAME = 'bb_offline_queue';
const STORE_NAME = 'mutations';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('type', 'type', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
}

export async function enqueueMutation(
  type: QueuedMutation['type'],
  payload: unknown,
  maxRetries = 5
): Promise<string> {
  const db = await openDB();
  const mutation: QueuedMutation = {
    id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    type,
    payload,
    timestamp: Date.now(),
    retryCount: 0,
    maxRetries,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.add(mutation);
    req.onsuccess = () => resolve(mutation.id);
    req.onerror = () => reject(req.error);
  });
}

export async function getPendingMutations(): Promise<QueuedMutation[]> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result.sort((a, b) => a.timestamp - b.timestamp));
    req.onerror = () => reject(req.error);
  });
}

export async function removeMutation(id: string): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function incrementRetryCount(id: string): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const mutation = getReq.result;
      if (mutation) {
        mutation.retryCount++;
        const putReq = store.put(mutation);
        putReq.onsuccess = () => resolve();
        putReq.onerror = () => reject(putReq.error);
      } else {
        resolve();
      }
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

export async function clearQueue(): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getQueueSize(): Promise<number> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

let syncInProgress = false;
let syncInterval: number | null = null;

type MutationExecutor = (mutation: QueuedMutation) => Promise<void>;

export function startSyncProcessor(
  executor: MutationExecutor,
  intervalMs = 30000
): () => void {
  if (syncInterval) clearInterval(syncInterval);

  const processQueue = async () => {
    if (syncInProgress || !navigator.onLine) return;
    syncInProgress = true;

    try {
      const mutations = await getPendingMutations();
      for (const mutation of mutations) {
        if (!navigator.onLine) break;

        try {
          await executor(mutation);
          await removeMutation(mutation.id);
        } catch (err) {
          console.error(`Mutation ${mutation.id} failed:`, err);
          await incrementRetryCount(mutation.id);
          const updated = await getPendingMutations();
          const m = updated.find((x) => x.id === mutation.id);
          if (m && m.retryCount >= m.maxRetries) {
            await removeMutation(mutation.id);
            console.warn(`Mutation ${mutation.id} exceeded max retries, discarded`);
          }
        }
      }
    } finally {
      syncInProgress = false;
    }
  };

  // Initial run
  processQueue();

  // Periodic sync
  syncInterval = window.setInterval(processQueue, intervalMs);

  // Also sync when coming online
  window.addEventListener('online', processQueue);

  return () => {
    if (syncInterval) clearInterval(syncInterval);
    window.removeEventListener('online', processQueue);
  };
}

export function stopSyncProcessor(): void {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
}

export function isOnline(): boolean {
  return navigator.onLine;
}