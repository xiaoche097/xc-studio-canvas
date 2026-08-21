import type { StateStorage } from 'zustand/middleware';

const isBrowser = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

export const isQuotaExceededError = (error: unknown): boolean => {
  const e = error as { name?: string; code?: number; message?: string } | null;
  if (!e) return false;
  if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') return true;
  if (e.code === 22 || e.code === 1014) return true;
  const msg = String(e.message || '').toLowerCase();
  return msg.includes('quota') && msg.includes('exceed');
};

export const safeLocalStorageSetItem = (key: string, value: string): boolean => {
  if (!isBrowser()) return false;
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch (error) {
    if (isQuotaExceededError(error)) {
      console.warn(`[storage] localStorage quota exceeded while writing key: ${key}`);
      return false;
    }
    console.warn(`[storage] localStorage write failed for key: ${key}`, error);
    return false;
  }
};

export const safeLocalStorageRemoveItem = (key: string): void => {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(key);
  } catch (error) {
    console.warn(`[storage] localStorage remove failed for key: ${key}`, error);
  }
};

export const safeLocalStorageStateStorage: StateStorage = {
  getItem: (key) => {
    if (!isBrowser()) return null;
    try {
      return window.localStorage.getItem(key);
    } catch (error) {
      console.warn(`[storage] localStorage read failed for key: ${key}`, error);
      return null;
    }
  },
  setItem: (key, value) => {
    safeLocalStorageSetItem(key, value);
  },
  removeItem: (key) => {
    safeLocalStorageRemoveItem(key);
  },
};
