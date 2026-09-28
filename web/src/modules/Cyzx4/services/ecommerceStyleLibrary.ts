import { openDB, type DBSchema } from 'idb';
import type { EcommerceCustomStyle } from '../types/ecommerceHero.types';

interface EcommerceStyleDB extends DBSchema {
  styles: {
    key: string;
    value: EcommerceCustomStyle;
    indexes: { 'by-updated': number };
  };
}

const DB_NAME = 'skysper-ecommerce-styles';
const STORE_NAME = 'styles';

const dbPromise = openDB<EcommerceStyleDB>(DB_NAME, 1, {
  upgrade(db) {
    const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
    store.createIndex('by-updated', 'updatedAt');
  },
});

export const ecommerceStyleLibrary = {
  async list(): Promise<EcommerceCustomStyle[]> {
    const db = await dbPromise;
    return (await db.getAllFromIndex(STORE_NAME, 'by-updated')).reverse();
  },

  async save(style: EcommerceCustomStyle): Promise<void> {
    const db = await dbPromise;
    await db.put(STORE_NAME, style);
  },

  async remove(id: string): Promise<void> {
    const db = await dbPromise;
    await db.delete(STORE_NAME, id);
  },
};
