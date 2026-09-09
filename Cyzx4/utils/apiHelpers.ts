/**
 * API 工具函数库
 * 用于消除重复代码，提供统一的API调用模式
 */

import { GoogleGenAI } from "@google/genai";
import { isRateLimitError } from "../../services/requestErrors";
import { DEFAULT_XIAOCHE_BASE_URL } from "./xiaocheModels";
import {
    DEFAULT_DEEPSEEK_BASE_URL,
    DEFAULT_DEEPSEEK_MODEL,
} from "../services/provider-config";
import {
    createDeepSeekCreativeClient,
    type CreativeVisionInput,
} from "./deepseekCreativeClient";

// ==================== 常量定义 ====================
export const API_TIMEOUT_MS = 90000; // 90秒超时
export const MAX_REF_IMAGES = 3;
export const MAX_UPLOAD_IMAGES = 10;
export const LEGACY_JIJING_BASE_URL = "https://api.jijing.ai";
export const DEFAULT_NO1_IMAGE_BASE_URL = "https://api.rcouyi.com";
export const DEFAULT_RUNNINGHUB_BASE_URL = "https://www.runninghub.cn";
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

export const TEXT_MODEL_POWER_MODE_STORAGE_KEY = 'xcai_text_model_power_mode';
export type TextModelPowerMode = 'low-power' | 'deep-thinking';

/**
 * Text-only model pools used across the site. Image, video, audio and TTS
 * model selection deliberately stays independent from this preference.
 */
export const DEEP_THINKING_TEXT_MODELS = [
    'gemini-3.6-flash',
    'gpt-5.6-sol',
] as const;

export const LOW_POWER_TEXT_MODELS = [
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite-preview',
    'gpt-5.6-luna',
] as const;

// Kept as a compatibility export for call sites that provide a default model.
// The actual request model is selected dynamically by getOrderedTextModels().
export const GEMINI_TEXT_MODELS = LOW_POWER_TEXT_MODELS;
export const DEFAULT_TEXT_MODEL = LOW_POWER_TEXT_MODELS[0];
export const GEMINI_FLASH_LITE_PREVIEW_MODEL = 'gemini-3.1-flash-lite-preview';
export const YUNWU_GEMINI_FLASH_LITE_MODEL = 'gemini-3.1-flash-lite';
export const RUNNINGHUB_DEFAULT_IMAGE_MODEL = 'gpt-image-2-vip';
export const YUNWU_GEMINI_FLASH_ANALYSIS_FALLBACK_MODEL = 'gemini-3.5-flash';
export const YUNWU_ANALYSIS_FALLBACK_MODEL = YUNWU_GEMINI_FLASH_ANALYSIS_FALLBACK_MODEL;
export const ANALYSIS_PRIMARY_TIMEOUT_MS = 45000;
export const ANALYSIS_FALLBACK_TIMEOUT_MS = 60000;
// DeepSeek creative analysis may include a separate image-description pass and
// reasoning. The generic 45s Gemini timeout is too short for that workflow.
export const DEEPSEEK_ANALYSIS_TIMEOUT_MS = 120000;
export const DEEPSEEK_ANALYSIS_FALLBACK_TIMEOUT_MS = 150000;

export const getTextModelPowerMode = (): TextModelPowerMode => {
    if (typeof window === 'undefined') return 'low-power';
    return localStorage.getItem(TEXT_MODEL_POWER_MODE_STORAGE_KEY) === 'deep-thinking'
        ? 'deep-thinking'
        : 'low-power';
};

export const setTextModelPowerMode = (mode: TextModelPowerMode): void => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(TEXT_MODEL_POWER_MODE_STORAGE_KEY, mode);
    window.dispatchEvent(new CustomEvent('text-model-power-mode-updated', { detail: { mode } }));
};

/**
 * Rotate the primary model for each text request, then retain the rest of the
 * active pool as automatic fallbacks. The requestedModel argument remains for
 * API compatibility; the global power mode intentionally takes precedence.
 */
export const getOrderedTextModels = (_requestedModel?: string): string[] => {
    const mode = getTextModelPowerMode();
    const pool = mode === 'deep-thinking'
        ? [...DEEP_THINKING_TEXT_MODELS]
        : [...LOW_POWER_TEXT_MODELS];
    if (typeof window === 'undefined') return pool;

    const cursorKey = `xcai_text_model_rotation_${mode}`;
    const previousCursor = Number.parseInt(localStorage.getItem(cursorKey) || '-1', 10);
    const nextCursor = (Number.isFinite(previousCursor) ? previousCursor + 1 : 0) % pool.length;
    localStorage.setItem(cursorKey, String(nextCursor));
    return [...pool.slice(nextCursor), ...pool.slice(0, nextCursor)];
};

// ==================== 类型定义 ====================
export interface ApiConfig {
    apiKey: string;
    baseUrl?: string;
    model?: string;
    isDeepSeek?: boolean;
    isYunwu: boolean;
    isPlato: boolean;
    isJijing?: boolean;
    isRunningHub?: boolean;
    isXiaoche?: boolean;
    apiVersion?: string;
    providerRetryCount?: number;
}

export interface GenerateContentParams {
    model: string;
    parts: any[];
    config?: any;
}

type RuntimeModelConfig = Pick<ApiConfig, 'isYunwu' | 'isPlato' | 'isRunningHub' | 'isXiaoche' | 'isDeepSeek' | 'model'>;

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
    if (config?.isDeepSeek) return config.model || DEFAULT_DEEPSEEK_MODEL;
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
                Boolean(localStorage.getItem("runninghub_api_key")) &&
                localStorage.getItem("runninghub_enabled") !== "false"
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
                Boolean(localStorage.getItem("runninghub_api_key")) &&
                localStorage.getItem("runninghub_enabled") !== "false"
            ),
        isRunningHub:
            Boolean(localStorage.getItem("runninghub_api_key")) &&
            localStorage.getItem("runninghub_enabled") !== "false",
    };
    if (runtimeConfig.isRunningHub) {
        const runningHubImageModelMap: Record<string, string> = {
            'gemini-3.1-flash-image-preview': 'nano-banana-2',
            'gemini-3.1-flash-image': 'nano-banana-2',
            'gemini-3-pro-image-preview': 'nano-banana-pro',
            'gemini-3-pro-image': 'nano-banana-pro',
            'gpt-image-2': RUNNINGHUB_DEFAULT_IMAGE_MODEL,
            'gpt-image-2-all': RUNNINGHUB_DEFAULT_IMAGE_MODEL,
            'nanobanana2': 'nano-banana-2',
            'standard': 'nano-banana-2',
            'nanobananapro': 'nano-banana-pro',
            'pro': 'nano-banana-pro',
            'nano-banana': 'nano-banana',
            'nano-banana-2': 'nano-banana-2',
            'nano-banana-pro': 'nano-banana-pro',
        };
        return runningHubImageModelMap[modelId] || modelId;
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

    // A relay may not expose every model in a pool. Treat model availability
    // errors as a signal to use the next configured model, not as a hard stop.
    if (
        status === 404 ||
        message.includes('model not found') ||
        message.includes('model is not supported') ||
        message.includes('unsupported model') ||
        message.includes('unknown model') ||
        message.includes('does not exist')
    ) {
        return true;
    }

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
    const candidateModels = runtimeConfig.isDeepSeek
        ? [runtimeConfig.model || DEFAULT_DEEPSEEK_MODEL]
        : getOrderedTextModels(requestedModel);

    let lastError: any = null;

    for (let i = 0; i < candidateModels.length; i++) {
        const candidateModel = candidateModels[i];
        const primaryModel = resolveRuntimeModelId(candidateModel, runtimeConfig);
        const primaryRequest = { ...request, model: primaryModel };
        const timeoutMs = i === 0
            ? (options.timeoutMs || (runtimeConfig.isDeepSeek
                ? DEEPSEEK_ANALYSIS_TIMEOUT_MS
                : ANALYSIS_PRIMARY_TIMEOUT_MS))
            : (options.fallbackTimeoutMs || (runtimeConfig.isDeepSeek
                ? DEEPSEEK_ANALYSIS_FALLBACK_TIMEOUT_MS
                : ANALYSIS_FALLBACK_TIMEOUT_MS));

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
    const preferredTextProvider = includeImageOnlyProviders
        ? 'auto'
        : (localStorage.getItem('text_api_provider') || 'auto');
    const textProviderAllows = (provider: string) => (
        includeImageOnlyProviders
        || preferredTextProvider === 'auto'
        || preferredTextProvider === provider
    );

    // DeepSeek is a text/Agent provider only. Creative pages use it for
    // analysis and planning, while image/video generation remains on the
    // independently configured media provider.
    if (!includeImageOnlyProviders && textProviderAllows('deepseek')) {
        const deepSeekEnabled = localStorage.getItem('deepseek_enabled') !== 'false';
        const rawKeys = localStorage.getItem('deepseek_api_key') || '';
        const keys = rawKeys
            .split(/[,\n]/)
            .map((key) => key.trim())
            .filter((key) => key && !key.startsWith('#'));
        if (deepSeekEnabled && keys.length > 0) {
            const currentIndex = forceIndex === undefined
                ? 0
                : Math.abs(forceIndex) % keys.length;
            return {
                apiKey: keys[currentIndex],
                baseUrl: (localStorage.getItem('deepseek_base_url') || DEFAULT_DEEPSEEK_BASE_URL)
                    .trim()
                    .replace(/\/+$/, ''),
                model: localStorage.getItem('deepseek_model') || DEFAULT_DEEPSEEK_MODEL,
                isDeepSeek: true,
                isYunwu: false,
                isPlato: false,
                isJijing: false,
                isRunningHub: false,
                isXiaoche: false,
                keyCount: keys.length,
                currentIndex,
            };
        }
    }
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
            isRunningHub: false,
            isXiaoche: true,
            // Flow2API provides the unversioned Gemini compatibility route at /models/:generateContent.
            apiVersion: '',
            keyCount,
            currentIndex,
        };
    }

    // RunningHub API
    const runningHubKey = localStorage.getItem("runninghub_api_key");
    const runningHubBaseUrl = localStorage.getItem("runninghub_base_url");
    const runningHubEnabled = localStorage.getItem("runninghub_enabled") !== "false"
        && textProviderAllows('runninghub');

    if (runningHubKey && runningHubEnabled) {
        const keys = runningHubKey.split(/[,\n]/).map(k => k.trim()).filter(k => k !== "");
        if (keys.length === 0) {
            throw new Error("RunningHub API Key is empty. Please check Settings.");
        }
        const keyCount = keys.length;
        let activeKey = keys[0];
        let currentIndex = 0;

        if (keyCount > 1) {
            const lastIndexKey = "runninghub_api_key_last_index";
            if (forceIndex !== undefined) {
                currentIndex = forceIndex % keyCount;
            } else {
                const lastIndex = parseInt(localStorage.getItem(lastIndexKey) || "-1");
                currentIndex = (lastIndex + 1) % keyCount;
                localStorage.setItem(lastIndexKey, currentIndex.toString());
            }
            activeKey = keys[currentIndex];
            console.log(`[RunningHub API Rotation] Using key ${currentIndex + 1}/${keyCount}`);
        }

        return {
            apiKey: activeKey,
            baseUrl: runningHubBaseUrl || DEFAULT_RUNNINGHUB_BASE_URL,
            isYunwu: true,
            isPlato: true,
            isJijing: false,
            isRunningHub: true,
            apiVersion: 'v1',
            keyCount,
            currentIndex
        };
    }

    // 1. Jijing API
    const jijingKey = localStorage.getItem("jijing_api_key");
    const jijingBaseUrl = localStorage.getItem("jijing_base_url");
    const jijingEnabled = localStorage.getItem("jijing_enabled") !== "false"
        && textProviderAllows('jijing');

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
    const savedPlatoBaseUrl = localStorage.getItem("plato_base_url");
    const platoEnabled = localStorage.getItem("plato_enabled") !== "false"
        && textProviderAllows('plato');

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
            // The actual Plato Base URL is workspace-specific. Normalize a trailing API version
            // so downstream endpoint joins cannot accidentally produce /v1/v1/....
            baseUrl: (savedPlatoBaseUrl || DEFAULT_PLATO_BASE_URL)
                .trim()
                .replace(/\/+$/, '')
                .replace(/\/v1(?:beta)?$/i, ''),
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
    const yunwuEnabled = localStorage.getItem("yunwu_enabled") !== "false"
        && textProviderAllows('yunwu');

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
    const nativeEnabled = localStorage.getItem("native_enabled") !== "false"
        && textProviderAllows('native');

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

    if (!includeImageOnlyProviders && preferredTextProvider !== 'auto') {
        throw new Error(`Selected text/Agent provider "${preferredTextProvider}" is not enabled or has no API Key.`);
    }
    throw new Error("No active API configuration found. Please enable Xiaoche, RunningHub, No.1 Image, Plato, Yunwu or Native API in Settings.");
};

/** Image generation can opt into image-only relays without hijacking text/analysis calls. */
export const getImageApiConfig = (forceIndex?: number) => getApiConfig(forceIndex, true);

/** Video generation uses the same media relay priority as image generation. */
export const getVideoApiConfig = (forceIndex?: number) => getApiConfig(forceIndex, true);

/**
 * 获取AI客户端实例
 */
const toRunningHubBaseUrl = (baseUrl?: string): string => {
    return (baseUrl || DEFAULT_RUNNINGHUB_BASE_URL).replace(/\/$/, "");
};

const normalizeRunningHubContent = (parts: any[]): string | any[] => {
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

const normalizeRunningHubMessages = (request: any): any[] => {
    const messages: any[] = [];
    const systemInstruction = request?.config?.systemInstruction || request?.systemInstruction;
    if (systemInstruction) {
        const systemParts = Array.isArray(systemInstruction?.parts)
            ? systemInstruction.parts
            : [{ text: typeof systemInstruction === 'string' ? systemInstruction : systemInstruction.text || String(systemInstruction) }];
        messages.push({
            role: 'system',
            content: normalizeRunningHubContent(systemParts)
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
            content: normalizeRunningHubContent(parts)
        });
    });

    if (messages.length === 0) {
        messages.push({ role: 'user', content: '' });
    }
    return messages;
};

const createRunningHubChatClient = (config: ApiConfig) => {
    return {
        models: {
            generateContent: async (request: any) => {
                const endpoint = `${toRunningHubBaseUrl(config.baseUrl)}/v1/chat/completions`;
                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${config.apiKey}`,
                    },
                    body: JSON.stringify({
                        model: resolveRuntimeModelId(request.model, config),
                        stream: false,
                        messages: normalizeRunningHubMessages(request),
                    }),
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    const error = new Error(`RunningHub Chat API Error ${response.status}: ${errorText}`);
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

const describeImagesForDeepSeek = async ({
    images,
    taskText,
}: CreativeVisionInput): Promise<string> => {
    const { ai, config } = getImageAiClient();
    const parts: any[] = [];
    images.forEach((image, index) => {
        parts.push({ text: `IMAGE ${index + 1}（保持此编号，不要合并或重排）` });
        parts.push({
            inlineData: {
                mimeType: image.mimeType,
                data: image.base64,
            },
        });
    });
    parts.push({
        text: [
            '你是 XcAI 的视觉读取代理，只负责把图片中可观察到的事实转换为文字，供 DeepSeek 完成后续创作分析。',
            '按 IMAGE 1、IMAGE 2……分别描述，不得猜测看不到的品牌参数、价格、材质成分或人物身份。',
            '重点记录：主体身份与数量、外观结构、颜色材质、文字与 Logo、构图、镜头、姿态、场景、光线、空间关系，以及必须保持不变的细节。',
            '如果图片承担不同角色（产品图、模特图、场景图、风格图），只根据图片前后的标签与可见证据说明其作用。',
            `本次创作任务摘要：${taskText.slice(0, 5000)}`,
            '输出紧凑的中文分图描述，不执行创作任务，不生成最终方案。',
        ].join('\n'),
    });

    const preferredModels = getOrderedTextModels()
        .filter((model) => model.toLowerCase().includes('gemini'));
    const candidateModels = Array.from(new Set([
        ...preferredModels,
        GEMINI_FLASH_LITE_PREVIEW_MODEL,
        YUNWU_GEMINI_FLASH_LITE_MODEL,
    ]));
    let lastError: unknown;
    for (const candidate of candidateModels) {
        const model = resolveRuntimeModelId(candidate, config);
        try {
            const response = await executeWithTimeout(
                ai.models.generateContent({ model, contents: { parts } }),
                {
                    timeoutMs: ANALYSIS_FALLBACK_TIMEOUT_MS,
                    timeoutMessage: `Vision proxy timed out using ${model}.`,
                },
            );
            const text = String(response?.text || '').trim();
            if (text) return text;
            lastError = new Error(`Vision proxy returned empty output using ${model}.`);
        } catch (error) {
            lastError = error;
            if (!shouldFallbackAnalysisModel(error)) break;
        }
    }
    throw lastError instanceof Error
        ? lastError
        : new Error('No visual analysis provider could read the creative reference images.');
};

export const getAiClient = (): GoogleGenAI => {
    const config = getApiConfig();

    if (config.isDeepSeek) {
        const configuredMaxTokens = Number.parseInt(
            localStorage.getItem('deepseek_max_tokens') || '8192',
            10,
        );
        return createDeepSeekCreativeClient({
            apiKey: config.apiKey,
            baseUrl: config.baseUrl || DEFAULT_DEEPSEEK_BASE_URL,
            model: config.model || DEFAULT_DEEPSEEK_MODEL,
            reasoningEffort: (() => {
                const saved = localStorage.getItem('deepseek_reasoning_effort');
                return saved === 'off' || saved === 'low' || saved === 'max' ? saved : 'high';
            })(),
            maxTokens: Number.isFinite(configuredMaxTokens) && configuredMaxTokens > 0
                ? configuredMaxTokens
                : 8_192,
        }, describeImagesForDeepSeek) as unknown as GoogleGenAI;
    }

    if (config.isRunningHub) {
        return createRunningHubChatClient(config);
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
    const ai = config.isRunningHub
        ? createRunningHubChatClient(config)
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
export const getActiveApiInfo = (): { type: 'virse' | 'xiaoche' | 'runninghub' | 'jijing' | 'plato' | 'yunwu' | 'native' | 'env'; baseUrl?: string } => {
    try {
        if (localStorage.getItem('virse_enabled') === 'true') {
            return { type: 'virse', baseUrl: localStorage.getItem('virse_base_url') || 'https://api.virse.ai' };
        }
        const config = getImageApiConfig();
        if (config.isXiaoche) {
            return { type: 'xiaoche', baseUrl: config.baseUrl };
        }
        if (localStorage.getItem("runninghub_api_key") && (localStorage.getItem("runninghub_enabled") !== "false")) {
            return { type: 'runninghub', baseUrl: config.baseUrl };
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

    // Keep image-hosting diagnostics intact. Otherwise an upstream 429 inside
    // the detailed message is reduced to the generic "too many requests" tip.
    if (/imgbb|图床|图片已上传到/i.test(errorMsg)) {
        return `🖼️ 图床上传链路失败\n${errorMsg}`;
    }
    
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

    // 配额/余额不足错误 (高优先级：防止云雾 API 返回 403 时被误判为未配置 API Key)
    if (/insufficient[_\s-]?quota|user quota is not enough|quota (?:is )?(?:exhausted|exceeded)|(?:account|billing|credit) balance (?:is )?(?:insufficient|empty|exhausted)|insufficient (?:balance|credit)|credits? exhausted|resource[_\s-]?exhausted|usage limit exceeded/i.test(errorMsg)) {
        const virseActive = typeof localStorage !== 'undefined'
            && localStorage.getItem('virse_enabled') === 'true';
        if (/千问|qwen/i.test(errorMsg)) {
            return `💳 千问图片 API 额度/配额不足\n[千问返回]: ${errorMsg}\n千问是独立图片通道，不受 Virse 开关影响，请检查千问 API 账户额度。`;
        }
        if (virseActive || /\bvirse\b/i.test(errorMsg)) {
            return `💳 Virse 图片通道额度/配额不足\n[Virse 返回]: ${errorMsg}\n请在 Virse 检查账户额度、工作区配额和所选图片模型状态。Virse 已开启，本次请求不会回落到云雾。`;
        }
        return `💳 当前图片 API 账户额度/余额不足\n[上游返回]: ${errorMsg}\n请检查当前启用的图片服务账户与配额。`;
    }

    // API Key 相关错误 (403/401 且非额度问题)
    if (errorStatus === 403 || errorStatus === 401 || errorMsg.includes('403') || errorMsg.includes('permission') || errorMsg.includes('API key') || errorMsg.includes('invalid_api_key')) {
        return '❌ API Key 未配置或已失效\n请检查您的 API Key 是否正确填写或已被禁用。';
    }

    // Keep accepted-task diagnostics visible so users do not resubmit a running job.
    if (errorMsg.includes('Virse 任务已提交')) {
        return `⚠️ 状态查询暂时失败\n${errorMsg}`;
    }

    // 请求频率限制
    if (isRateLimitError({ status: errorStatus, message: errorMsg })) {
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
