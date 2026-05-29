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

export interface ProjectSummary extends Project {
    assetCounts: {
        original: number;
        generated: number;
    };
    estimatedBytes: number;
}

export interface CacheStats {
    projectCount: number;
    estimatedProjectBytes: number;
    storageUsage?: number;
    storageQuota?: number;
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

    private estimateProjectBytes(project: Project): number {
        try {
            return new Blob([JSON.stringify(project)]).size;
        } catch {
            return JSON.stringify(project).length * 2;
        }
    }

    private toSummary(project: Project): ProjectSummary {
        return {
            ...project,
            assets: {
                original: [],
                generated: [],
            },
            assetCounts: {
                original: project.assets.original?.length || 0,
                generated: project.assets.generated.length,
            },
            estimatedBytes: this.estimateProjectBytes(project),
        };
    }

    async getAllProjects(): Promise<Project[]> {
        const db = await this.dbPromise;
        // Return sorted by date desc
        return (await db.getAllFromIndex(STORE_NAME, 'by-date')).reverse();
    }

    async getProjectSummaries(limit?: number): Promise<ProjectSummary[]> {
        const db = await this.dbPromise;
        const summaries: ProjectSummary[] = [];
        const tx = db.transaction(STORE_NAME, 'readonly');
        let cursor = await tx.store.index('by-date').openCursor(null, 'prev');

        while (cursor) {
            summaries.push(this.toSummary(cursor.value));
            if (limit && summaries.length >= limit) break;
            cursor = await cursor.continue();
        }

        await tx.done;
        return summaries;
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

    async deleteAllProjects(): Promise<void> {
        const db = await this.dbPromise;
        await db.clear(STORE_NAME);
    }

    async deleteProjectsOlderThan(cutoffTime: number): Promise<number> {
        const db = await this.dbPromise;
        const tx = db.transaction(STORE_NAME, 'readwrite');
        let deleted = 0;
        let cursor = await tx.store.index('by-date').openCursor(IDBKeyRange.upperBound(cutoffTime));

        while (cursor) {
            await cursor.delete();
            deleted += 1;
            cursor = await cursor.continue();
        }

        await tx.done;
        return deleted;
    }

    async keepLatestProjects(maxCount: number): Promise<number> {
        const db = await this.dbPromise;
        const tx = db.transaction(STORE_NAME, 'readwrite');
        let kept = 0;
        let deleted = 0;
        let cursor = await tx.store.index('by-date').openCursor(null, 'prev');

        while (cursor) {
            kept += 1;
            if (kept > maxCount) {
                await cursor.delete();
                deleted += 1;
            }
            cursor = await cursor.continue();
        }

        await tx.done;
        return deleted;
    }

    async getCacheStats(): Promise<CacheStats> {
        const summaries = await this.getProjectSummaries();
        const storage = await navigator.storage?.estimate?.().catch(() => undefined);

        return {
            projectCount: summaries.length,
            estimatedProjectBytes: summaries.reduce((sum, project) => sum + project.estimatedBytes, 0),
            storageUsage: storage?.usage,
            storageQuota: storage?.quota,
        };
    }
}

export const storageService = new StorageService();
