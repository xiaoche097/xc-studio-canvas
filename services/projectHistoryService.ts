import { Project, storageService } from './storageService';

type SaveGeneratedProjectInput = {
    type: Project['type'];
    generated: string[];
    original?: string[];
    prompt?: string;
    params?: Record<string, any>;
    thumbnail?: string;
};

export const saveGeneratedProject = async ({
    type,
    generated,
    original = [],
    prompt,
    params = {},
    thumbnail,
}: SaveGeneratedProjectInput): Promise<string | undefined> => {
    const validGenerated = generated.filter(Boolean);
    if (validGenerated.length === 0) return undefined;

    try {
        return await storageService.saveProject({
            id: `${type.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            type,
            createdAt: Date.now(),
            thumbnail: thumbnail || validGenerated[0],
            assets: {
                original: original.filter(Boolean),
                generated: validGenerated,
            },
            metadata: {
                prompt,
                params,
            },
        });
    } catch (error) {
        console.error('Failed to save generated project:', error);
        return undefined;
    }
};
