import { Project } from '../types';

export const DB_NAME = 'XcStudioDB';
export const STORE_NAME = 'projects';
export const TOPIC_SNAPSHOT_STORE = 'topic_snapshots';
export const TOPIC_MEMORY_ITEM_STORE = 'topic_memory_items';
export const TOPIC_ASSET_STORE = 'topic_assets';
const DB_VERSION = 3;

export const openWorkspaceDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      const tx = (event.target as IDBOpenDBRequest).transaction!;
      const oldVersion = event.oldVersion;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains(TOPIC_SNAPSHOT_STORE)) {
        db.createObjectStore(TOPIC_SNAPSHOT_STORE, { keyPath: 'memoryKey' });
      } else if (oldVersion < 3) {
        try {
          const store = tx.objectStore(TOPIC_SNAPSHOT_STORE);
          if (!store.indexNames.contains('memoryKey')) {
            store.createIndex('memoryKey', 'memoryKey', { unique: true });
          }
        } catch (e) { console.warn('Upgrade TOPIC_SNAPSHOT_STORE skipped:', e); }
      }

      if (!db.objectStoreNames.contains(TOPIC_MEMORY_ITEM_STORE)) {
        const store = db.createObjectStore(TOPIC_MEMORY_ITEM_STORE, { keyPath: 'id' });
        store.createIndex('memoryKey', 'memoryKey', { unique: false });
        store.createIndex('topicId', 'topicId', { unique: false });
        store.createIndex('type', 'type', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      } else if (oldVersion < 3) {
        try {
          const store = tx.objectStore(TOPIC_MEMORY_ITEM_STORE);
          if (!store.indexNames.contains('memoryKey')) {
            store.createIndex('memoryKey', 'memoryKey', { unique: false });
          }
        } catch (e) { console.warn('Upgrade TOPIC_MEMORY_ITEM_STORE skipped:', e); }
      }

      if (!db.objectStoreNames.contains(TOPIC_ASSET_STORE)) {
        const store = db.createObjectStore(TOPIC_ASSET_STORE, { keyPath: 'assetId' });
        store.createIndex('memoryKey', 'memoryKey', { unique: false });
        store.createIndex('topicId', 'topicId', { unique: false });
        store.createIndex('role', 'role', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      } else if (oldVersion < 3) {
        try {
          const store = tx.objectStore(TOPIC_ASSET_STORE);
          if (!store.indexNames.contains('memoryKey')) {
            store.createIndex('memoryKey', 'memoryKey', { unique: false });
          }
        } catch (e) { console.warn('Upgrade TOPIC_ASSET_STORE skipped:', e); }
      }
    };
  });
};

const openDB = openWorkspaceDB;

export const getProjects = async (): Promise<Project[]> => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();
      request.onsuccess = () => {
        const projects = request.result as Project[];
        // Sort by updatedAt descending
        projects.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        resolve(projects);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Failed to load projects', error);
    return [];
  }
};

export const getProject = async (id: string): Promise<Project | undefined> => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Failed to load project', error);
    return undefined;
  }
};

export const saveProject = async (project: Project): Promise<void> => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(project);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Failed to save project', error);
  }
};

export const deleteProject = async (id: string): Promise<void> => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Failed to delete project', error);
  }
};

// Helper to format date
export const formatDate = (date: number | Date): string => {
  const d = new Date(date);
  return d.toISOString().split('T')[0];
};
