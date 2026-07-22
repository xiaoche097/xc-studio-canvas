const fs = require('fs');
const path = require('path');

const base64Path = path.join(__dirname, '../public/official_model_2.base64.txt');
const targetPath = path.join(__dirname, '../Cyzx4/services/modelLibrary.ts');

const b64 = fs.readFileSync(base64Path, 'utf8').trim();

const content = `import { openDB, type DBSchema } from 'idb';

export interface ModelItem {
  id: string;
  name: string;
  isOfficial?: boolean;
  preview: string;
  base64?: string;
  mime?: string;
  prompt: string;
  createdAt: number;
  updatedAt: number;
}

interface ModelLibraryDB extends DBSchema {
  models: {
    key: string;
    value: ModelItem;
    indexes: { 'by-updated': number };
  };
}

const DB_NAME = 'skysper-model-library';
const STORE_NAME = 'models';

const OFFICIAL_MODEL_PROMPT = \`
You will create a "High-Precision Reference Chart" based on the attached character image that can be used for AI image generation or character consistency.
The purpose is not to create a character profile, but to produce visual material so that the same character can be stably reproduced in the future.

────────────────────
Most Important Rule
────────────────────
Treat the character in the attached image as the sole standard, ensuring that they appear as the same character in all panels.
Particularly, do not change: Face contour, Eye shape, Eyebrow shape, Nose bridge, Lip shape, Cheeks/chin, Skin color/texture, Hairstyle/color, Body type, Clothing impression, Overall atmosphere.

────────────────────
Art Style / Texture
────────────────────
Natural realistic photo, smartphone photo or natural studio reference photo.
Skin should retain natural pores and texture; prohibit doll-like skin or CG feel.

────────────────────
Labels and Language
────────────────────
Please use Chinese uniformly for the labels in the image.
\`.trim();

const OFFICIAL_BASE64 = '${b64}';

// 图2官方固定模特默认数据
export const OFFICIAL_MODELS: ModelItem[] = [
  {
    id: 'official-model-1',
    name: '官方固定模特 - 欧美风尚（图2）',
    isOfficial: true,
    preview: 'data:image/png;base64,' + OFFICIAL_BASE64,
    base64: OFFICIAL_BASE64,
    mime: 'image/png',
    prompt: OFFICIAL_MODEL_PROMPT,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
];

const dbPromise = openDB<ModelLibraryDB>(DB_NAME, 1, {
  upgrade(db) {
    const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
    store.createIndex('by-updated', 'updatedAt');
  },
});

export const modelLibrary = {
  async list(): Promise<ModelItem[]> {
    try {
      const db = await dbPromise;
      const customModels = (await db.getAllFromIndex(STORE_NAME, 'by-updated')).reverse();
      return [...OFFICIAL_MODELS, ...customModels];
    } catch {
      return [...OFFICIAL_MODELS];
    }
  },

  async save(model: ModelItem): Promise<void> {
    if (model.isOfficial) return;
    const db = await dbPromise;
    await db.put(STORE_NAME, model);
  },

  async remove(id: string): Promise<void> {
    const db = await dbPromise;
    await db.delete(STORE_NAME, id);
  },
};
`;

fs.writeFileSync(targetPath, content, 'utf8');
console.log('Successfully generated Cyzx4/services/modelLibrary.ts with embedded base64 preview!');
