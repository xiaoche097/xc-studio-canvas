/**
 * API 工具函数库
 * 用于消除重复代码，提供统一的API调用模式
 */

import { GoogleGenAI } from "@google/genai";
import { DEFAULT_XIAOCHE_BASE_URL } from "./xiaocheModels";

// ==================== 常量定义 ====================
export const API_TIMEOUT_MS = 90000; // 90秒超时
export const MAX_REF_IMAGES = 3;
export const MAX_UPLOAD_IMAGES = 10;
export const LEGACY_JIJING_BASE_URL = "https://api.jijing.ai";
export const DEFAULT_NO1_IMAGE_BASE_URL = "https://api.rcouyi.com";
export const DEFAULT_RIGHT_BASE_URL = "https://www.right.codes/draw";
export const DEFAULT_PLATO_BASE_URL = "https://api.apilio.ai";
export const NO1_IMAGE_NODES = [
    { name: "DCDN主站", url: "https://api.rcouyi.com" },
    { name: "美国芝加哥OVH线路", url: "https://us.rcouyi.com" },
    { name: "美国华盛顿OVH线路", url: "https://us-1.rcouyi.com" },
    { name: "中国香港", url: "https://hk-2.rcouyi.com" },
    { name: "美国洛杉矶OVH线路", url: "https://us-3.rcouyi.com" },
    { name: "新加坡OVH线路", url: "https://sgp.rcouyi.com" },
    { name: "日本软银线路", url: "https://jp.rcouyi.com" },
    { name: "美国阿什本OVH线路", url: "https://us-2.rcouyi.com" },
];

export const GEMINI_TEXT_MODELS = [
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite-preview',
] as const;

export const DEFAULT_TEXT_MODEL = GEMINI_TEXT_MODELS[0];
export const GEMINI_FLASH_LITE_PREVIEW_MODEL = 'gemini-3.1-flash-lite-preview';
export const YUNWU_GEMINI_FLASH_LITE_MODEL = 'gemini-3.1-flash-lite';
export const RIGHT_DEFAULT_IMAGE_MODEL = 'gpt-image-2-vip';
export const YUNWU_GEMINI_FLASH_ANALYSIS_FALLBACK_MODEL = 'gemini-3.5-flash';
export const YUNWU_ANALYSIS_FALLBACK_MODEL = YUNWU_GEMINI_FLASH_ANALYSIS_FALLBACK_MODEL;
export const ANALYSIS_PRIMARY_TIMEOUT_MS = 45000;
export const ANALYSIS_FALLBACK_TIMEOUT_MS = 60000;

export const getOrderedTextModels = (requestedModel?: string): string[] => {
    const primary = requestedModel || DEFAULT_TEXT_MODEL;
    const list = [...GEMINI_TEXT_MODELS] as string[];
    const index = list.indexOf(primary as any);
    if (index !== -1) {
        return [primary, ...list.filter((_, i) => i !== index)];
    }
    return [primary, ...list];
};

// ==================== 类型定义 ====================
export interface ApiConfig {
    apiKey: string;
    baseUrl?: string;
    isYunwu: boolean;
    isPlato: boolean;
    isJijing?: boolean;
    isRight?: boolean;
    isXiaoche?: boolean;
    apiVersion?: string;
    providerRetryCount?: number;
}

export interface GenerateContentParams {
    model: string;
    parts: any[];
    config?: any;
}

type RuntimeModelConfig = Pick<ApiConfig, 'isYunwu' | 'isPlato' | 'isRight' | 'isXiaoche'>;

const orderedNo1ImageUrls = (preferredUrl?: string | null): string[] => {
    const normalizedPreferred = !preferredUrl || preferredUrl === LEGACY_JIJING_BASE_URL
        ? DEFAULT_NO1_IMAGE_BASE_URL
        : preferredUrl;
    const urls = NO1_IMAGE_NODES.map(node => node.url);
    return [
        normalizedPreferred,
        ...urls.filter(url => url !== normalizedPreferred)
    ];
};

/**
 * 云雾中转站不使用 preview 后缀的 Flash Lite 模型 ID。
 * Plato 虽复用 Yunwu 兼容通道，但模型 ID 保持原样。
 */
export const resolveRuntimeModelId = (
    modelId: string,
    config?: RuntimeModelConfig
): string => {
    const runtimeConfig = config || {
        isXiaoche:
            Boolean(localStorage.getItem("xiaoche_api_key")) &&
            localStorage.getItem("xiaoche_enabled") === "true",
        isYunwu:
            Boolean(localStorage.getItem("yunwu_api_key")) &&
            localStorage.getItem("yunwu_enabled") !== "false" &&
            !(
                Boolean(localStorage.getItem("plato_api_key")) &&
                localStorage.getItem("plato_enabled") !== "false"
            ) &&
            !(
                Boolean(localStorage.getItem("jijing_api_key")) &&
                localStorage.getItem("jijing_enabled") !== "false"
            ) &&
            !(
                Boolean(localStorage.getItem("right_api_key")) &&
                localStorage.getItem("right_enabled") !== "false"
            ) &&
            !(
                Boolean(localStorage.getItem("xiaoche_api_key")) &&
                localStorage.getItem("xiaoche_enabled") === "true"
            ),
        isPlato:
            (
                Boolean(localStorage.getItem("plato_api_key")) &&
                localStorage.getItem("plato_enabled") !== "false"
            ) ||
            (
                Boolean(localStorage.getItem("jijing_api_key")) &&
                localStorage.getItem("jijing_enabled") !== "false"
            ) ||
            (
                Boolean(localStorage.getItem("right_api_key")) &&
                localStorage.getItem("right_enabled") !== "false"
            ),
        isRight:
            Boolean(localStorage.getItem("right_api_key")) &&
            localStorage.getItem("right_enabled") !== "false",
    };
    if (runtimeConfig.isRight) {
        const rightImageModelMap: Record<string, string> = {
            'gemini-3.1-flash-image-preview': 'nano-banana-2',
            'gemini-3.1-flash-image': 'nano-banana-2',
            'gemini-3-pro-image-preview': 'nano-banana-pro',
            'gemini-3-pro-image': 'nano-banana-pro',
            'gpt-image-2': RIGHT_DEFAULT_IMAGE_MODEL,
            'gpt-image-2-all': RIGHT_DEFAULT_IMAGE_MODEL,
            'nanobanana2': 'nano-banana-2',
            'standard': 'nano-banana-2',
            'nanobananapro': 'nano-banana-pro',
            'pro': 'nano-banana-pro',
            'nano-banana': 'nano-banana',
            'nano-banana-2': 'nano-banana-2',
            'nano-banana-pro': 'nano-banana-pro',
        };
        return rightImageModelMap[modelId] || modelId;
    }
    if (
        runtimeConfig.isYunwu &&
        !runtimeConfig.isPlato &&
        modelId === GEMINI_FLASH_LITE_PREVIEW_MODEL
    ) {
        return YUNWU_GEMINI_FLASH_LITE_MODEL;
    }
    return modelId;
};

const isYunwuOnly = (config: RuntimeModelConfig): boolean => (
    config.isYunwu && !config.isPlato
);

const isFlashLiteAnalysisModel = (modelId: string): boolean => (
    modelId === GEMINI_FLASH_LITE_PREVIEW_MODEL ||
    modelId === YUNWU_GEMINI_FLASH_LITE_MODEL
);

export const shouldFallbackAnalysisModel = (error: any): boolean => {
    const message = (error?.message || error?.toString?.() || '').toLowerCase();
    const status = error?.status || error?.code;

    if (
        status === 401 ||
        status === 403 ||
        message.includes('api key') ||
        message.includes('permission') ||
        message.includes('unauthorized') ||
        message.includes('forbidden') ||
        message.includes('quota') ||
        message.includes('billing') ||
        message.includes('safety') ||
        message.includes('blocked')
    ) {
        return false;
    }

    return (
        status === 429 ||
        status === 500 ||
        status === 502 ||
        status === 503 ||
        status === 504 ||
        message.includes('timeout') ||
        message.includes('timed out') ||
        message.includes('overloaded') ||
        message.includes('rate') ||
        message.includes('empty response') ||
        message.includes('no response') ||
        message.includes('无可用渠道') ||
        message.includes('distributor') ||
        message.includes('channel') ||
        message.includes('unavailable')
    );
};

export async function generateContentWithAnalysisFallback<TClient extends {
    models: {
        generateContent: (request: any) => Promise<any>;
    };
}>(
    ai: TClient,
    request: any,
    options: {
        config?: RuntimeModelConfig;
        timeoutMs?: number;
        fallbackTimeoutMs?: number;
    } = {}
): Promise<any> {
    const runtimeConfig = options.config || getApiConfig();
    const requestedModel = request.model || DEFAULT_TEXT_MODEL;
    const candidateModels = getOrderedTextModels(requestedModel);

    let lastError: any = null;

    for (let i = 0; i < candidateModels.length; i++) {
        const candidateModel = candidateModels[i];
        const primaryModel = resolveRuntimeModelId(candidateModel, runtimeConfig);
        const primaryRequest = { ...request, model: primaryModel };
        const timeoutMs = i === 0
            ? (options.timeoutMs || ANALYSIS_PRIMARY_TIMEOUT_MS)
            : (options.fallbackTimeoutMs || ANALYSIS_FALLBACK_TIMEOUT_MS);

        try {
            const response = await executeWithTimeout(
                ai.models.generateContent(primaryRequest),
                {
                    timeoutMs,
                    timeoutMessage: `Analysis request timed out (${timeoutMs}ms) using model ${primaryModel}.`
                }
            );
            if (!response?.text && isYunwuOnly(runtimeConfig)) {
                throw new Error(`Empty response from text model ${primaryModel}.`);
            }
            if (i > 0) {
                console.info(`[TextModelFallback] Requested ${requestedModel} failed, retried and succeeded with ${primaryModel}`);
            }
            return response;
        } catch (error) {
            lastError = error;
            console.warn(
                `[TextModelFallback] Attempt ${i + 1}/${candidateModels.length} (${primaryModel}) failed:`,
                error?.message || error
            );

            if (isAbortError(error) || !shouldFallbackAnalysisModel(error)) {
                throw error;
            }
        }
    }

    throw lastError || new Error('All text analysis models failed after rotation.');
}

export interface TimeoutOptions {
    timeoutMs?: number;
    timeoutMessage?: string;
    signal?: AbortSignal;
}

export const createAbortError = (message = 'Generation cancelled') => {
    try {
        return new DOMException(message, 'AbortError');
    } catch {
        const error = new Error(message);
        (error as any).name = 'AbortError';
        return error;
    }
};

export const isAbortError = (error: unknown) => {
    return (error as any)?.name === 'AbortError' || /cancelled|canceled|aborted/i.test((error as any)?.message || '');
};

export const throwIfAborted = (signal?: AbortSignal) => {
    if (signal?.aborted) {
        throw createAbortError();
    }
};

// ==================== API 配置管理 ====================

/**
 * 获取 API 配置（优先级：Plato > Yunwu > Native > Env）
 * @param forceIndex 强制使用的 Key 索引（用于自动重试）
 */
export const getApiConfig = (
    forceIndex?: number,
    includeImageOnlyProviders = false
): ApiConfig & { keyCount: number, currentIndex: number } => {
    // Xiaoche relay: explicit opt-in and independent storage keys keep all existing providers unchanged.
    const xiaocheKey = localStorage.getItem("xiaoche_api_key");
    const xiaocheBaseUrl = localStorage.getItem("xiaoche_base_url");
    const xiaocheEnabled = localStorage.getItem("xiaoche_enabled") === "true";

    if (includeImageOnlyProviders && xiaocheKey && xiaocheEnabled) {
        const keys = xiaocheKey.split(/[,\n]/).map(k => k.trim()).filter(Boolean);
        if (keys.length === 0) {
            throw new Error("Xiaoche relay API Key is empty. Please check Settings.");
        }
        const keyCount = keys.length;
        let currentIndex = 0;
        if (keyCount > 1) {
            if (forceIndex !== undefined) {
                currentIndex = forceIndex % keyCount;
            } else {
                const lastIndexKey = "xiaoche_api_key_last_index";
                const lastIndex = parseInt(localStorage.getItem(lastIndexKey) || "-1");
                currentIndex = (lastIndex + 1) % keyCount;
                localStorage.setItem(lastIndexKey, currentIndex.toString());
            }
        }

        const configuredBaseUrl = (xiaocheBaseUrl || DEFAULT_XIAOCHE_BASE_URL).replace(/\/+$/, '');
        // Flow2API exposes OpenAI routes under /v1, but Gemini generateContent at /models or /v1beta/models.
        // The Google SDK receives the protocol root so it does not request the nonexistent /v1/models/... path.
        const geminiProtocolBaseUrl = configuredBaseUrl.replace(/\/v1$/i, '');

        return {
            apiKey: keys[currentIndex],
            baseUrl: geminiProtocolBaseUrl,
            isYunwu: true,
            isPlato: false,
            isJijing: false,
            isRight: false,
            isXiaoche: true,
            // Flow2API provides the unversioned Gemini compatibility route at /models/:generateContent.
            apiVersion: '',
            keyCount,
            currentIndex,
        };
    }

    // Right Code API
    const rightKey = localStorage.getItem("right_api_key");
    const rightBaseUrl = localStorage.getItem("right_base_url");
    const rightEnabled = localStorage.getItem("right_enabled") !== "false";

    if (rightKey && rightEnabled) {
        const keys = rightKey.split(/[,\n]/).map(k => k.trim()).filter(k => k !== "");
        if (keys.length === 0) {
            throw new Error("Right Code API Key is empty. Please check Settings.");
        }
        const keyCount = keys.length;
        let activeKey = keys[0];
        let currentIndex = 0;

        if (keyCount > 1) {
            const lastIndexKey = "right_api_key_last_index";
            if (forceIndex !== undefined) {
                currentIndex = forceIndex % keyCount;
            } else {
                const lastIndex = parseInt(localStorage.getItem(lastIndexKey) || "-1");
                currentIndex = (lastIndex + 1) % keyCount;
                localStorage.setItem(lastIndexKey, currentIndex.toString());
            }
            activeKey = keys[currentIndex];
            console.log(`[Right Code API Rotation] Using key ${currentIndex + 1}/${keyCount}`);
        }

        return {
            apiKey: activeKey,
            baseUrl: rightBaseUrl || DEFAULT_RIGHT_BASE_URL,
            isYunwu: true,
            isPlato: true,
            isJijing: false,
            isRight: true,
            apiVersion: 'v1',
            keyCount,
            currentIndex
        };
    }

    // 1. Jijing API
    const jijingKey = localStorage.getItem("jijing_api_key");
    const jijingBaseUrl = localStorage.getItem("jijing_base_url");
    const jijingEnabled = localStorage.getItem("jijing_enabled") !== "false";

    if (jijingKey && jijingEnabled) {
        const no1ImageBaseUrls = orderedNo1ImageUrls(jijingBaseUrl);
        const keys = jijingKey.split(/[,\n]/).map(k => k.trim()).filter(k => k !== "");
        if (keys.length === 0) {
            throw new Error("No.1 Image API Key is empty. Please check Settings.");
        }
        const keyCount = keys.length;
        const providerRetryCount = Math.max(keys.length, no1ImageBaseUrls.length);

        let activeKey = keys[0];
        let activeBaseUrl = no1ImageBaseUrls[0];
        let currentIndex = 0;

        if (providerRetryCount > 1) {
            if (forceIndex !== undefined) {
                currentIndex = forceIndex % providerRetryCount;
            }
            activeKey = keys[currentIndex % keyCount];
            activeBaseUrl = no1ImageBaseUrls[currentIndex % no1ImageBaseUrls.length];
            console.log(`[No.1 Image API Rotation] Using node ${activeBaseUrl} with key ${(currentIndex % keyCount) + 1}/${keyCount}`);
        }

        return {
            apiKey: activeKey,
            baseUrl: activeBaseUrl,
            isYunwu: true,
            isPlato: true,
            isJijing: true,
            apiVersion: 'v1beta',
            keyCount: providerRetryCount,
            providerRetryCount,
            currentIndex
        };
    }

    // 1. Plato API (柏拉图)
    const platoKey = localStorage.getItem("plato_api_key");
    const platoEnabled = localStorage.getItem("plato_enabled") !== "false";

    if (platoKey && platoEnabled) {
        const keys = platoKey.split(/[,\n]/).map(k => k.trim()).filter(k => k !== "");
        const keyCount = keys.length;
        
        let activeKey = keys[0];
        let currentIndex = 0;

        if (keyCount > 1) {
            const lastIndexKey = "plato_api_key_last_index";
            if (forceIndex !== undefined) {
                currentIndex = forceIndex % keyCount;
            } else {
                const lastIndex = parseInt(localStorage.getItem(lastIndexKey) || "-1");
                currentIndex = (lastIndex + 1) % keyCount;
                localStorage.setItem(lastIndexKey, currentIndex.toString());
            }
            activeKey = keys[currentIndex];
            console.log(`[Plato API Rotation] Using key ${currentIndex + 1}/${keyCount}`);
        }

        return {
            apiKey: activeKey,
            baseUrl: DEFAULT_PLATO_BASE_URL,
            isYunwu: true, // 柏拉图也使用标准的 OpenAI/Gemini 兼容中转格式，这里复用 isYunwu 逻辑
            isPlato: true,
            isJijing: false,
            apiVersion: 'v1beta', // 恢复 v1beta，因为部分中转站对 2k/4k 这种自定义模型 ID 仅在测试版路径开放
            keyCount,
            currentIndex
        };
    }

    // 2. Yunwu API
    const yunwuKey = localStorage.getItem("yunwu_api_key");
    const yunwuBaseUrl = localStorage.getItem("yunwu_base_url");
    const yunwuEnabled = localStorage.getItem("yunwu_enabled") !== "false";

    if (yunwuKey && yunwuEnabled) {
        // 多 Key 轮询逻辑
        const keys = yunwuKey.split(/[,\n]/).map(k => k.trim()).filter(k => k !== "");
        const keyCount = keys.length;
        
        let activeKey = keys[0];
        let currentIndex = 0;

        if (keyCount > 1) {
            const lastIndexKey = "yunwu_api_key_last_index";
            
            if (forceIndex !== undefined) {
                currentIndex = forceIndex % keyCount;
            } else {
                const lastIndex = parseInt(localStorage.getItem(lastIndexKey) || "-1");
                currentIndex = (lastIndex + 1) % keyCount;
                localStorage.setItem(lastIndexKey, currentIndex.toString());
            }
            
            activeKey = keys[currentIndex];
            console.log(`[Yunwu API Rotation] Using key ${currentIndex + 1}/${keyCount}`);
        }

        return {
            apiKey: activeKey,
            baseUrl: yunwuBaseUrl || "https://yunwu.ai",
            isYunwu: true,
            isPlato: false,
            isJijing: false,
            keyCount,
            currentIndex
        };
    }

    // 3. Native Gemini API
    const nativeKey = localStorage.getItem("user_api_key");
    const nativeEnabled = localStorage.getItem("native_enabled") !== "false";

    if (nativeKey && nativeEnabled) {
        return {
            apiKey: nativeKey,
            isYunwu: false,
            isPlato: false,
            isJijing: false,
            keyCount: 1,
            currentIndex: 0
        };
    }

    // 4. 环境变量
    const envKey = process.env.API_KEY;
    if (envKey) {
        return {
            apiKey: envKey,
            isYunwu: false,
            isPlato: false,
            isJijing: false,
            keyCount: 1,
            currentIndex: 0
        };
    }

    throw new Error("No active API configuration found. Please enable Xiaoche, Right Code, No.1 Image, Plato, Yunwu or Native API in Settings.");
};

/** Image generation can opt into image-only relays without hijacking text/analysis calls. */
export const getImageApiConfig = (forceIndex?: number) => getApiConfig(forceIndex, true);

/** Video generation uses the same media relay priority as image generation. */
export const getVideoApiConfig = (forceIndex?: number) => getApiConfig(forceIndex, true);

/**
 * 获取AI客户端实例
 */
const toRightCodeBaseUrl = (baseUrl?: string): string => {
    return (baseUrl || DEFAULT_RIGHT_BASE_URL).replace(/\/$/, "");
};

const normalizeRightCodeContent = (parts: any[]): string | any[] => {
    const content: any[] = [];

    parts.forEach(part => {
        if (!part) return;
        if (typeof part.text === 'string' && part.text.length > 0) {
            content.push({ type: 'text', text: part.text });
            return;
        }

        const inlineData = part.inlineData || part.inline_data;
        if (inlineData?.data) {
            const mimeType = inlineData.mimeType || inlineData.mime_type || 'image/png';
            const dataUrl = String(inlineData.data).startsWith('data:')
                ? inlineData.data
                : `data:${mimeType};base64,${inlineData.data}`;
            content.push({
                type: 'image_url',
                image_url: { url: dataUrl }
            });
            return;
        }

        const fileData = part.fileData || part.file_data;
        const fileUri = fileData?.fileUri || fileData?.file_uri || fileData?.uri;
        if (typeof fileUri === 'string' && fileUri.length > 0) {
            content.push({
                type: 'image_url',
                image_url: { url: fileUri }
            });
        }
    });

    if (content.length === 1 && content[0].type === 'text') {
        return content[0].text;
    }
    return content;
};

const normalizeRightCodeMessages = (request: any): any[] => {
    const messages: any[] = [];
    const systemInstruction = request?.config?.systemInstruction || request?.systemInstruction;
    if (systemInstruction) {
        const systemParts = Array.isArray(systemInstruction?.parts)
            ? systemInstruction.parts
            : [{ text: typeof systemInstruction === 'string' ? systemInstruction : systemInstruction.text || String(systemInstruction) }];
        messages.push({
            role: 'system',
            content: normalizeRightCodeContent(systemParts)
        });
    }

    const rawContents = Array.isArray(request?.contents)
        ? request.contents
        : request?.contents
            ? [request.contents]
            : [];

    rawContents.forEach((content: any) => {
        const parts = Array.isArray(content?.parts)
            ? content.parts
            : Array.isArray(content)
                ? content
                : [];
        if (parts.length === 0) return;
        messages.push({
            role: content?.role === 'model' ? 'assistant' : (content?.role || 'user'),
            content: normalizeRightCodeContent(parts)
        });
    });

    if (messages.length === 0) {
        messages.push({ role: 'user', content: '' });
    }
    return messages;
};

const createRightCodeChatClient = (config: ApiConfig) => {
    return {
        models: {
            generateContent: async (request: any) => {
                const endpoint = `${toRightCodeBaseUrl(config.baseUrl)}/v1/chat/completions`;
                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${config.apiKey}`,
                    },
                    body: JSON.stringify({
                        model: resolveRuntimeModelId(request.model, config),
                        stream: false,
                        messages: normalizeRightCodeMessages(request),
                    }),
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    const error = new Error(`Right Code Chat API Error ${response.status}: ${errorText}`);
                    (error as any).status = response.status;
                    throw error;
                }

                const data = await response.json();
                const text = data?.choices?.[0]?.message?.content || '';
                return {
                    text,
                    candidates: [{
                        content: { parts: [{ text }] },
                        finishReason: data?.choices?.[0]?.finish_reason,
                    }],
                    usageMetadata: data?.usage,
                };
            }
        }
    } as unknown as GoogleGenAI;
};

export const getAiClient = (): GoogleGenAI => {
    const config = getApiConfig();

    if (config.isRight) {
        return createRightCodeChatClient(config);
    }

    if (config.isYunwu && config.baseUrl) {
        return new GoogleGenAI({
            apiKey: config.apiKey,
            httpOptions: {
                baseUrl: config.baseUrl,
                headers: {
                    Authorization: `Bearer ${config.apiKey}`
                }
            },
            apiVersion: config.apiVersion as any // 透传配置中的 apiVersion
        });
    }

    return new GoogleGenAI({ 
        apiKey: config.apiKey,
        apiVersion: config.apiVersion as any
    });
};

/**
 * Image-only client selection. Xiaoche intentionally has higher priority here,
 * while getAiClient() keeps using the normal text/analysis provider order.
 */
export const getImageAiClient = (): {
    ai: GoogleGenAI;
    config: ApiConfig & { keyCount: number; currentIndex: number };
} => {
    const config = getImageApiConfig();
    const ai = config.isRight
        ? createRightCodeChatClient(config)
        : config.isYunwu && config.baseUrl
            ? new GoogleGenAI({
                apiKey: config.apiKey,
                httpOptions: {
                    baseUrl: config.baseUrl,
                    headers: { Authorization: `Bearer ${config.apiKey}` }
                },
                apiVersion: config.apiVersion as any
            })
            : new GoogleGenAI({
                apiKey: config.apiKey,
                apiVersion: config.apiVersion as any
            });

    return { ai, config };
};

/**
 * 获取当前激活的API信息（用于调试）
 */
export const getActiveApiInfo = (): { type: 'xiaoche' | 'right' | 'jijing' | 'plato' | 'yunwu' | 'native' | 'env'; baseUrl?: string } => {
    try {
        const config = getImageApiConfig();
        if (config.isXiaoche) {
            return { type: 'xiaoche', baseUrl: config.baseUrl };
        }
        if (localStorage.getItem("right_api_key") && (localStorage.getItem("right_enabled") !== "false")) {
            return { type: 'right', baseUrl: config.baseUrl };
        }
        if (localStorage.getItem("jijing_api_key") && (localStorage.getItem("jijing_enabled") !== "false")) {
            return { type: 'jijing', baseUrl: config.baseUrl };
        }
        if (localStorage.getItem("plato_api_key") && (localStorage.getItem("plato_enabled") !== "false")) {
            return { type: 'plato', baseUrl: config.baseUrl };
        }
        if (config.isYunwu) {
            return { type: 'yunwu', baseUrl: config.baseUrl };
        }
        const nativeKey = localStorage.getItem("user_api_key");
        return { type: nativeKey ? 'native' : 'env' };
    } catch {
        return { type: 'env' };
    }
};

// ==================== 超时处理 ====================

/**
 * 带超时的Promise执行器
 * 用于替代重复的Promise.race代码
 */
export async function executeWithTimeout<T>(
    promise: Promise<T>,
    options: TimeoutOptions = {}
): Promise<T> {
    const {
        timeoutMs = API_TIMEOUT_MS,
        timeoutMessage = `Request timed out (${timeoutMs}ms). The model might be overloaded.`,
        signal
    } = options;

    throwIfAborted(signal);

    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let abortHandler: (() => void) | undefined;

    const timeoutPromise = new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
    });

    const abortPromise = signal
        ? new Promise<T>((_, reject) => {
            abortHandler = () => reject(createAbortError());
            signal.addEventListener('abort', abortHandler, { once: true });
        })
        : undefined;

    try {
        return await Promise.race([
        promise,
        timeoutPromise,
        ...(abortPromise ? [abortPromise] : [])
    ]);
    } finally {
        if (timeoutId) clearTimeout(timeoutId);
        if (signal && abortHandler) signal.removeEventListener('abort', abortHandler);
    }
}

// ==================== 图像处理 ====================

/**
 * Blob转Base64
 */
export const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            if (reader.error) {
                reject(new Error(`File reading failed: ${reader.error.message}`));
                return;
            }

            const base64String = reader.result as string;
            if (!base64String) {
                reject(new Error("File read result is empty"));
                return;
            }

            const parts = base64String.split(",");
            if (parts.length < 2) {
                reject(new Error("Invalid data URL format"));
                return;
            }

            resolve(parts[1]);
        };
        reader.onerror = () => {
            reject(new Error(`File reading error: ${reader.error?.message || "Unknown error"}`));
        };
        reader.readAsDataURL(blob);
    });
};

/**
 * 图片压缩
 */
export const compressImage = async (
    file: File,
    maxWidth: number = 2048,
    quality: number = 0.95
): Promise<{ base64: string; mime: string }> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                let width = img.width;
                let height = img.height;

                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    reject(new Error("Canvas context failed"));
                    return;
                }
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, width, height);
                ctx.drawImage(img, 0, 0, width, height);

                const mime = 'image/jpeg';
                const base64Url = canvas.toDataURL(mime, quality);
                const data = base64Url.split(',')[1];

                resolve({ base64: data, mime });
            };
            img.onerror = (e) => reject(e);
        };
        reader.onerror = (e) => reject(e);
    });
};

// ==================== 错误处理 ====================

/**
 * 获取用户友好的错误提示
 * 用于将技术错误转换为易懂的提示信息
 */
export function getErrorMessage(error: any): string {
    const errorMsg = error?.message || error?.toString() || '';
    const errorStatus = error?.status;
    
    // 安全策略拦截 (高优先级)
    if (errorMsg.includes('safety') || errorMsg.includes('blocked by safety') || errorMsg.includes('SAFETY')) {
        return `⚠️ 安全策略拦截\n${errorMsg}\n\n[建议] 画面中可能包含过于敏感的内容（如内衣/裸露），大模型底层存在不可关闭的安全过滤。请尝试在“高级参数”中切换模型（如 GPT Image 2）或减少画面敏感度。`;
    }

    // 未返回任何图片 (具体原因提示)
    if (errorMsg.includes('未返回任何图片')) {
        return `⚠️ 操作失败\n模型未返回任何结果。可能原因：\n1. 4K 高分辨率请求超时或被代理节点拒绝（请尝试切换到 2K）。\n2. 画面中包含内衣/泳装等内容，虽然我们已放开设置，但模型底层仍可能执行强制拦截。`;
    }

    // 路径/模型不支持错误 (Critical)
    if (error.isPathError || errorMsg.includes('invalid_request') || errorMsg.includes('API 路径')) {
        return `🚫 模型访问受限\n${errorMsg}`;
    }

    // 后端负载错误 (New)
    if (errorMsg.includes('system_cpu_overloaded') || errorMsg.includes('model is overloaded')) {
        return '🚀 模型后端繁忙\n当前使用的 API 节点负载过高，建议在“高级参数”中尝试更换模型（如 Banana Pro 或 GPT Image 2）。';
    }

    // API Key 相关错误
    if (errorStatus === 403 || errorMsg.includes('403') || errorMsg.includes('permission') || errorMsg.includes('API key')) {
        return '❌ API Key 未配置或已过期\n请到设置中检查您的 API Key 配置';
    }

    // 超时错误
    if (errorMsg.includes('timeout') || errorMsg.includes('timed out')) {
        return '⏱️ 请求超时\n可能是网络问题或图片太大，请检查网络后重试';
    }

    // 配额/余额错误
    if (errorMsg.includes('quota') || errorMsg.includes('exceeded') || errorMsg.includes('limit')) {
        return '💳 API 配额已用完\n请检查您的账户余额或等待配额重置';
    }

    // 请求频率限制
    if (errorMsg.includes('rate') || errorMsg.includes('too many requests')) {
        return '🚦 请求过快\n请等待几秒后重试';
    }

    // 网络连接错误
    if (errorMsg.includes('network') || errorMsg.includes('fetch') || errorMsg.includes('ECONNREFUSED')) {
        return '📡 网络连接失败\n请检查您的网络连接';
    }

    // JSON 解析错误
    if (errorMsg.includes('JSON') || errorMsg.includes('parse')) {
        return '⚠️ 响应数据格式错误\n可能是服务器问题，请重试';
    }

    // 图片处理错误
    if (
        errorMsg.includes('canvas') ||
        errorMsg.includes('File reading') ||
        errorMsg.includes('data URL') ||
        errorMsg.includes('mime') ||
        errorMsg.includes('unsupported image format') ||
        errorMsg.includes('Invalid image') ||
        errorMsg.includes('图片格式')
    ) {
        return '🖼️ 图片处理失败\n请检查图片格式是否正确（支持 JPG、PNG）';
    }

    // 默认错误
    return `⚠️ 操作失败\n${errorMsg || '未知错误，请重试'}`;
}

// ==================== Base64 转换工具 ====================

/**
 * Base64转Uint8Array（用于音频处理）
 */
export function base64ToUint8Array(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

/**
 * Float32转16位PCM
 */
export function floatTo16BitPCM(
    output: DataView,
    offset: number,
    input: Float32Array,
): void {
    for (let i = 0; i < input.length; i++, offset += 2) {
        const s = Math.max(-1, Math.min(1, input[i]));
        output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
}

/**
 * 解码音频���据
 */
export const decodeAudioData = async (
    base64String: string,
    audioCtx: AudioContext,
): Promise<AudioBuffer> => {
    const bytes = base64ToUint8Array(base64String);
    const int16Data = new Int16Array(bytes.buffer);
    const float32Data = new Float32Array(int16Data.length);

    for (let i = 0; i < int16Data.length; i++) {
        float32Data[i] = int16Data[i] / 32768.0;
    }

    const buffer = audioCtx.createBuffer(1, float32Data.length, 24000);
    buffer.getChannelData(0).set(float32Data);
    return buffer;
};
