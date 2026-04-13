import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface ProjectMetadata {
    prompt?: string;
    params?: any;
    [key: string]: any;
}

export interface Project {
    id: string;
    type: 'SEAT_COVER' | 'MARKETING' | 'MODEL' | 'VIDEO' | 'ANALYSIS' | 'LAUNCH_PACKAGE' | 'FUSION' | 'RETOUCHING' | 'OTHER';
    createdAt: number;
    thumbnail: string; // Base64 or Blob URL
    assets: {
        original?: string[]; // Input images
        generated: string[]; // Output images
    };
    metadata: ProjectMetadata;
}

interface SkysperDB extends DBSchema {
    projects: {
        key: string;
        value: Project;
        indexes: { 'by-type': string; 'by-date': number };
    };
}

const DB_NAME = 'skysper-projects';
const STORE_NAME = 'projects';

class StorageService {
    private dbPromise: Promise<IDBPDatabase<SkysperDB>>;

    constructor() {
        this.dbPromise = openDB<SkysperDB>(DB_NAME, 1, {
            upgrade(db) {
                const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                store.createIndex('by-type', 'type');
                store.createIndex('by-date', 'createdAt');
            },
        });
    }

    async saveProject(project: Project): Promise<string> {
        const db = await this.dbPromise;
        await db.put(STORE_NAME, project);
        return project.id;
    }

    async getAllProjects(): Promise<Project[]> {
        const db = await this.dbPromise;
        // Return sorted by date desc
        return (await db.getAllFromIndex(STORE_NAME, 'by-date')).reverse();
    }

    async getProjectsByType(type: Project['type']): Promise<Project[]> {
        const db = await this.dbPromise;
        const results = await db.getAllFromIndex(STORE_NAME, 'by-type', type);
        // Sort in memory as IDB can only sort by the index used
        return results.sort((a, b) => b.createdAt - a.createdAt);
    }

    async getProject(id: string): Promise<Project | undefined> {
        const db = await this.dbPromise;
        return db.get(STORE_NAME, id);
    }

    async deleteProject(id: string): Promise<void> {
        const db = await this.dbPromise;
        await db.delete(STORE_NAME, id);
    }
}

export const storageService = new StorageService();
