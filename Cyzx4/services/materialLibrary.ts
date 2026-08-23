import { MATERIAL_LIBRARY_STORE, openWorkspaceDB } from './storage';
import { z } from 'zod';

export type MaterialKind = 'brand' | 'character' | 'product' | 'custom';

const materialFileSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.string().min(1),
  dataUrl: z.string().min(1),
  size: z.number().nonnegative().optional(),
});

const materialRecordSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['brand', 'character', 'product', 'custom']),
  name: z.string(),
  guide: z.string().default(''),
  files: z.array(materialFileSchema).default([]),
  logos: z.array(materialFileSchema).default([]),
  references: z.array(materialFileSchema).default([]),
  audio: z.array(materialFileSchema).default([]),
  videos: z.array(materialFileSchema).default([]),
  fontFiles: z.array(materialFileSchema).default([]),
  colors: z.array(z.string()).default([]),
  fonts: z.array(z.string()).default([]),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export type MaterialFile = z.infer<typeof materialFileSchema>;
export type MaterialRecord = z.infer<typeof materialRecordSchema>;

export const createMaterialDraft = (kind: MaterialKind): MaterialRecord => {
  const now = Date.now();
  return materialRecordSchema.parse({
    id: `material-${now}-${Math.random().toString(36).slice(2, 8)}`,
    kind,
    name: '未命名',
    guide: '',
    createdAt: now,
    updatedAt: now,
  });
};

const normalizeMaterial = (value: unknown): MaterialRecord | null => {
  const parsed = materialRecordSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
};

const requestResult = <T>(request: IDBRequest<T>): Promise<T> => new Promise((resolve, reject) => {
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

export const listMaterials = async (): Promise<MaterialRecord[]> => {
  const db = await openWorkspaceDB();
  const transaction = db.transaction(MATERIAL_LIBRARY_STORE, 'readonly');
  const records = await requestResult(transaction.objectStore(MATERIAL_LIBRARY_STORE).getAll()) as unknown[];
  return records
    .map(normalizeMaterial)
    .filter((record): record is MaterialRecord => Boolean(record))
    .sort((a, b) => b.updatedAt - a.updatedAt);
};

export const saveMaterial = async (material: MaterialRecord): Promise<void> => {
  const validated = materialRecordSchema.parse(material);
  const db = await openWorkspaceDB();
  const transaction = db.transaction(MATERIAL_LIBRARY_STORE, 'readwrite');
  await requestResult(transaction.objectStore(MATERIAL_LIBRARY_STORE).put(validated));
};

export const deleteMaterial = async (id: string): Promise<void> => {
  const db = await openWorkspaceDB();
  const transaction = db.transaction(MATERIAL_LIBRARY_STORE, 'readwrite');
  await requestResult(transaction.objectStore(MATERIAL_LIBRARY_STORE).delete(id));
};
