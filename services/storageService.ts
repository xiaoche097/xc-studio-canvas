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

export interface ProjectSummaryPage {
    projects: ProjectSummary[];
    hasMore: boolean;
    nextOffset: number;
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
const DEFAULT_PAGE_SIZE = 60;
const THUMBNAIL_SIZE = 480;
const THUMBNAIL_QUALITY = 0.72;
const PROJECT_AUTO_EXPIRE_MS = 30 * 60 * 1000;
const PROJECT_AUTO_CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
const AUTO_CLEANUP_USAGE_LIMIT_BYTES = 2 * 1024 * 1024 * 1024;
const AUTO_CLEANUP_KEEP_LATEST = 50;

class StorageService {
    private dbPromise: Promise<IDBPDatabase<SkysperDB>>;
    private autoCleanupPromise: Promise<number> | null = null;
    private expirationCleanupPromise: Promise<number> | null = null;
    private expirationCleanupTimer: ReturnType<typeof window.setInterval> | null = null;

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
        const projectToSave = {
            ...project,
            thumbnail: await this.createThumbnail(project.thumbnail || project.assets.generated[0]),
        };
        await db.put(STORE_NAME, projectToSave);
        void this.cleanupExpiredProjects();
        void this.autoCleanupIfNeeded();
        window.dispatchEvent(new CustomEvent('project-cache-updated'));
        return project.id;
    }

    startAutoExpirationCleanup(): void {
        if (typeof window === 'undefined' || this.expirationCleanupTimer) return;

        void this.cleanupExpiredProjects();
        this.expirationCleanupTimer = window.setInterval(() => {
            void this.cleanupExpiredProjects();
        }, PROJECT_AUTO_CLEANUP_INTERVAL_MS);
    }

    stopAutoExpirationCleanup(): void {
        if (!this.expirationCleanupTimer) return;
        window.clearInterval(this.expirationCleanupTimer);
        this.expirationCleanupTimer = null;
    }

    async cleanupExpiredProjects(): Promise<number> {
        if (this.expirationCleanupPromise) return this.expirationCleanupPromise;

        this.expirationCleanupPromise = (async () => {
            const cutoffTime = Date.now() - PROJECT_AUTO_EXPIRE_MS;
            const deleted = await this.deleteProjectsOlderThanInternal(cutoffTime);

            if (deleted > 0) {
                window.dispatchEvent(new CustomEvent('project-cache-auto-cleaned', {
                    detail: {
                        deleted,
                        reason: 'expired',
                        maxAgeMs: PROJECT_AUTO_EXPIRE_MS,
                    },
                }));
                window.dispatchEvent(new CustomEvent('project-cache-updated'));
            }

            return deleted;
        })().finally(() => {
            this.expirationCleanupPromise = null;
        });

        return this.expirationCleanupPromise;
    }

    private async getStorageUsageBytes(): Promise<number | undefined> {
        const storage = await navigator.storage?.estimate?.().catch(() => undefined);
        return storage?.usage;
    }

    private async autoCleanupIfNeeded(): Promise<number> {
        if (this.autoCleanupPromise) return this.autoCleanupPromise;

        this.autoCleanupPromise = (async () => {
            const stats = await this.getProjectCountAndEstimatedBytes();
            const storageUsage = await this.getStorageUsageBytes();
            const usage = storageUsage ?? stats.estimatedBytes;

            if (usage < AUTO_CLEANUP_USAGE_LIMIT_BYTES || stats.count <= AUTO_CLEANUP_KEEP_LATEST) {
                return 0;
            }

            const deleted = await this.keepLatestProjects(AUTO_CLEANUP_KEEP_LATEST);
            if (deleted > 0) {
                window.dispatchEvent(new CustomEvent('project-cache-auto-cleaned', {
                    detail: {
                        deleted,
                        limitBytes: AUTO_CLEANUP_USAGE_LIMIT_BYTES,
                        keepLatest: AUTO_CLEANUP_KEEP_LATEST,
                        usageBytes: usage,
                    },
                }));
                window.dispatchEvent(new CustomEvent('project-cache-updated'));
            }
            return deleted;
        })().finally(() => {
            this.autoCleanupPromise = null;
        });

        return this.autoCleanupPromise;
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
            estimatedBytes: 0,
        };
    }

    private async createThumbnail(imageUrl?: string): Promise<string> {
        if (!imageUrl || typeof window === 'undefined') return imageUrl || '';
        if (!imageUrl.startsWith('data:image/') && !imageUrl.startsWith('blob:')) return imageUrl;

        try {
            const img = await new Promise<HTMLImageElement>((resolve, reject) => {
                const image = new Image();
                image.onload = () => resolve(image);
                image.onerror = reject;
                image.src = imageUrl;
            });

            const scale = Math.min(1, THUMBNAIL_SIZE / Math.max(img.width, img.height));
            const width = Math.max(1, Math.round(img.width * scale));
            const height = Math.max(1, Math.round(img.height * scale));
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) return imageUrl;
            ctx.drawImage(img, 0, 0, width, height);
            return canvas.toDataURL('image/webp', THUMBNAIL_QUALITY);
        } catch {
            return imageUrl;
        }
    }

    async getAllProjects(): Promise<Project[]> {
        const db = await this.dbPromise;
        // Return sorted by date desc
        return (await db.getAllFromIndex(STORE_NAME, 'by-date')).reverse();
    }

    async getProjectSummaryPage(options: {
        limit?: number;
        offset?: number;
        type?: Project['type'] | 'ALL';
        query?: string;
    } = {}): Promise<ProjectSummaryPage> {
        const db = await this.dbPromise;
        const summaries: ProjectSummary[] = [];
        const limit = options.limit || DEFAULT_PAGE_SIZE;
        const offset = options.offset || 0;
        const type = options.type && options.type !== 'ALL' ? options.type : undefined;
        const query = options.query?.trim().toLowerCase();
        const tx = db.transaction(STORE_NAME, 'readonly');
        let cursor = await tx.store.index('by-date').openCursor(null, 'prev');
        let matched = 0;
        let hasMore = false;

        while (cursor) {
            const project = cursor.value;
            const matchesType = !type || project.type === type;
            const matchesQuery = !query ||
                project.id.toLowerCase().includes(query) ||
                project.metadata.prompt?.toLowerCase().includes(query) ||
                JSON.stringify(project.metadata.params || {}).toLowerCase().includes(query);

            if (matchesType && matchesQuery) {
                if (matched >= offset && summaries.length < limit) {
                    summaries.push(this.toSummary(project));
                } else if (matched >= offset + limit) {
                    hasMore = true;
                    break;
                }
                matched += 1;
            }
            cursor = await cursor.continue();
        }

        await tx.done;
        return {
            projects: summaries,
            hasMore,
            nextOffset: offset + summaries.length,
        };
    }

    async getProjectSummaries(limit?: number): Promise<ProjectSummary[]> {
        const page = await this.getProjectSummaryPage({ limit });
        return page.projects;
    }

    async getProjectCountAndEstimatedBytes(): Promise<{ count: number; estimatedBytes: number }> {
        const db = await this.dbPromise;
        const tx = db.transaction(STORE_NAME, 'readonly');
        let cursor = await tx.store.openCursor();
        let count = 0;
        let estimatedBytes = 0;

        while (cursor) {
            count += 1;
            estimatedBytes += this.estimateProjectBytes(cursor.value);
            cursor = await cursor.continue();
        }

        await tx.done;
        return { count, estimatedBytes };
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
        window.dispatchEvent(new CustomEvent('project-cache-updated'));
    }

    async deleteAllProjects(): Promise<void> {
        const db = await this.dbPromise;
        await db.clear(STORE_NAME);
        window.dispatchEvent(new CustomEvent('project-cache-updated'));
    }

    private async deleteProjectsOlderThanInternal(cutoffTime: number): Promise<number> {
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

    async deleteProjectsOlderThan(cutoffTime: number): Promise<number> {
        return this.deleteProjectsOlderThanInternal(cutoffTime);
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
        const stats = await this.getProjectCountAndEstimatedBytes();
        const storage = await navigator.storage?.estimate?.().catch(() => undefined);

        return {
            projectCount: stats.count,
            estimatedProjectBytes: stats.estimatedBytes,
            storageUsage: storage?.usage,
            storageQuota: storage?.quota,
        };
    }
}

export const storageService = new StorageService();
