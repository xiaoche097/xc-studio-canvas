import { CLIPPER_ITEM_STORE, openWorkspaceDB } from './storage';

export interface PersistedClippedItem {
  id: string;
  title: string;
  url: string;
  originalUrl?: string;
  sourceUrl?: string;
  platform?: 'xiaohongshu' | 'instagram' | 'amazon' | 'taobao' | 'pinterest' | 'other';
  category?: string;
  timestamp: number;
}

export const loadClippedItems = async (): Promise<PersistedClippedItem[]> => {
  const db = await openWorkspaceDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(CLIPPER_ITEM_STORE, 'readonly');
    const request = transaction.objectStore(CLIPPER_ITEM_STORE).getAll();
    request.onsuccess = () => {
      const items = (request.result || []) as PersistedClippedItem[];
      resolve(items.sort((a, b) => b.timestamp - a.timestamp));
    };
    request.onerror = () => reject(request.error);
  });
};

export const replaceClippedItems = async (items: PersistedClippedItem[]): Promise<void> => {
  const db = await openWorkspaceDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(CLIPPER_ITEM_STORE, 'readwrite');
    const store = transaction.objectStore(CLIPPER_ITEM_STORE);
    store.clear();
    items.forEach((item) => store.put(item));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
};
