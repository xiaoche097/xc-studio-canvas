import { VideoGenerationMode } from '../types';

export interface ExternalVideoOptions {
    aspectRatio?: string;
    count?: number;
    generationMode?: VideoGenerationMode;
    resolution?: string;
    duration?: number;
    generateAudio?: boolean;
}

export interface ExternalVideoResult {
    uri: string;
    uris: string[];
    videoMetadata?: any;
}

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const trimSlash = (value: string) => value.replace(/\/+$/, '');

const requiredSetting = (key: string, label: string) => {
    const value = localStorage.getItem(key)?.trim();
    if (!value) throw new Error(`请先在设置中配置 ${label}`);
    return value;
};

const responseError = async (response: Response) => {
    let detail = '';
    try {
        const body = await response.json();
        detail = body?.error?.message || body?.message || body?.msg || JSON.stringify(body);
    } catch {
        detail = await response.text();
    }
    return new Error(`视频服务请求失败 (${response.status})${detail ? `：${detail}` : ''}`);
};

const fetchJson = async (url: string, init: RequestInit) => {
    const response = await fetch(url, init);
    if (!response.ok) throw await responseError(response);
    return response.json();
};

const extractTaskId = (payload: any) => (
    payload?.id || payload?.task_id || payload?.taskId || payload?.output?.task_id || payload?.data?.id
);

const extractVideoUrl = (payload: any): string | undefined => (
    payload?.content?.video_url ||
    payload?.content?.videoUrl ||
    payload?.output?.video_url ||
    payload?.output?.videoUrl ||
    payload?.output?.video_url_list?.[0] ||
    payload?.data?.video_url ||
    payload?.result?.video_url ||
    payload?.video_url
);

const pollTask = async (load: () => Promise<any>, timeoutMs = 15 * 60 * 1000) => {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
        const task = await load();
        const status = String(
            task?.status || task?.task_status || task?.output?.task_status || task?.data?.status || ''
        ).toLowerCase();
        if (['succeeded', 'success', 'completed', 'done'].includes(status)) return task;
        if (['failed', 'error', 'cancelled', 'canceled'].includes(status)) {
            throw new Error(
                task?.error?.message || task?.message || task?.output?.message || task?.data?.message || '视频生成任务失败'
            );
        }
        await wait(5000);
    }
    throw new Error('视频生成超时，请稍后在服务商控制台检查任务状态');
};

const makeImageContent = (url: string, role?: string) => ({
    type: 'image_url',
    image_url: { url },
    ...(role ? { role } : {})
});

export const generateSeedanceVideo = async (
    prompt: string,
    model: string,
    options: ExternalVideoOptions,
    inputImage?: string | null,
    referenceImages?: string[],
    referenceVideos?: string[],
    referenceAudios?: string[]
): Promise<ExternalVideoResult> => {
    if (localStorage.getItem('seedance_enabled') === 'false') {
        throw new Error('火山引擎 Seedance 尚未启用，请先在模型配置中开启');
    }
    const apiKey =
        localStorage.getItem('volcengine_api_key')?.trim() ||
        requiredSetting('seedance_api_key', '火山方舟 API Key');
    const baseUrl = 'https://ark.cn-beijing.volces.com/api/v3';
    const headers = { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' };
    const references = (referenceImages?.length ? referenceImages : (inputImage ? [inputImage] : [])).filter(Boolean);
    const content: any[] = [{ type: 'text', text: prompt }];

    if (options.generationMode === 'FIRST_LAST_FRAME' && references.length >= 2) {
        content.push(makeImageContent(references[0], 'first_frame'));
        content.push(makeImageContent(references[references.length - 1], 'last_frame'));
    } else {
        references.slice(0, 9).forEach(url => content.push(makeImageContent(url)));
    }
    referenceVideos?.slice(0, 3).forEach(url => content.push({
        type: 'video_url',
        video_url: { url }
    }));
    referenceAudios?.slice(0, 3).forEach(url => content.push({
        type: 'audio_url',
        audio_url: { url }
    }));

    const createOne = async () => {
        const created = await fetchJson(`${baseUrl}/contents/generations/tasks`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                model,
                content,
                ...(options.aspectRatio ? { ratio: options.aspectRatio } : {}),
                resolution: options.resolution || '1080p',
                duration: Math.max(4, Math.min(15, options.duration || 5)),
                generate_audio: options.generateAudio !== false,
                watermark: false
            })
        });
        const taskId = extractTaskId(created);
        if (!taskId) throw new Error('Seedance 未返回任务 ID，请检查 Base URL 与模型 ID');
        const completed = await pollTask(() => fetchJson(
            `${baseUrl}/contents/generations/tasks/${encodeURIComponent(taskId)}`,
            { headers }
        ));
        const uri = extractVideoUrl(completed);
        if (!uri) throw new Error('Seedance 任务已完成，但响应中没有视频地址');
        return { uri, metadata: completed };
    };

    const results = await Promise.all(
        Array.from({ length: Math.max(1, Math.min(4, options.count || 1)) }, createOne)
    );
    return { uri: results[0].uri, uris: results.map(item => item.uri), videoMetadata: results[0].metadata };
};

export const generateWanVideo = async (
    prompt: string,
    options: ExternalVideoOptions,
    inputImage?: string | null
): Promise<ExternalVideoResult> => {
    const apiKey = requiredSetting('wan_api_key', 'Wan API Key');
    const baseUrl = trimSlash(localStorage.getItem('wan_base_url')?.trim() || 'https://dashscope.aliyuncs.com/api/v1');
    const model = localStorage.getItem('wan_model')?.trim() || (inputImage ? 'wan2.1-i2v-turbo' : 'wan2.1-t2v-turbo');
    const headers = {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-DashScope-Async': 'enable'
    };
    const sizeByRatio: Record<string, string> = {
        '16:9': '1280*720', '9:16': '720*1280', '1:1': '960*960', '4:3': '960*720', '3:4': '720*960'
    };

    const createOne = async () => {
        const created = await fetchJson(`${baseUrl}/services/aigc/video-generation/video-synthesis`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                model,
                input: { prompt, ...(inputImage ? { img_url: inputImage } : {}) },
                parameters: {
                    ...(options.aspectRatio ? { size: sizeByRatio[options.aspectRatio] || '1280*720' } : {}),
                    duration: options.duration || 5,
                    prompt_extend: true
                }
            })
        });
        const taskId = extractTaskId(created);
        if (!taskId) throw new Error('Wan 未返回任务 ID，请检查 Base URL 与模型 ID');
        const completed = await pollTask(() => fetchJson(
            `${baseUrl}/tasks/${encodeURIComponent(taskId)}`,
            { headers: { Authorization: `Bearer ${apiKey}` } }
        ));
        const uri = extractVideoUrl(completed);
        if (!uri) throw new Error('Wan 任务已完成，但响应中没有视频地址');
        return { uri, metadata: completed };
    };

    const results = await Promise.all(
        Array.from({ length: Math.max(1, Math.min(4, options.count || 1)) }, createOne)
    );
    return { uri: results[0].uri, uris: results.map(item => item.uri), videoMetadata: results[0].metadata };
};
