import { MATERIAL_LIBRARY_STORE, openWorkspaceDB } from './storage';

export type MaterialKind = 'brand' | 'character' | 'product' | 'custom';

export interface MaterialFile {
  id: string;
  name: string;
  type: string;
  dataUrl: string;
}

export interface MaterialRecord {
  id: string;
  kind: MaterialKind;
  name: string;
  guide: string;
  files: MaterialFile[];
  logos: MaterialFile[];
  references: MaterialFile[];
  colors: string[];
  fonts: string[];
  createdAt: number;
  updatedAt: number;
}

const requestResult = <T>(request: IDBRequest<T>): Promise<T> => new Promise((resolve, reject) => {
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

export const listMaterials = async (): Promise<MaterialRecord[]> => {
  const db = await openWorkspaceDB();
  const transaction = db.transaction(MATERIAL_LIBRARY_STORE, 'readonly');
  const records = await requestResult(transaction.objectStore(MATERIAL_LIBRARY_STORE).getAll()) as MaterialRecord[];
  return records.sort((a, b) => b.updatedAt - a.updatedAt);
};

export const saveMaterial = async (material: MaterialRecord): Promise<void> => {
  const db = await openWorkspaceDB();
  const transaction = db.transaction(MATERIAL_LIBRARY_STORE, 'readwrite');
  await requestResult(transaction.objectStore(MATERIAL_LIBRARY_STORE).put(material));
};

export const deleteMaterial = async (id: string): Promise<void> => {
  const db = await openWorkspaceDB();
  const transaction = db.transaction(MATERIAL_LIBRARY_STORE, 'readwrite');
  await requestResult(transaction.objectStore(MATERIAL_LIBRARY_STORE).delete(id));
};
