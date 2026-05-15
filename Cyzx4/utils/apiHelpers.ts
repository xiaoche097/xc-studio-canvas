/**
 * API 工具函数库
 * 用于消除重复代码，提供统一的API调用模式
 */

import { GoogleGenAI } from "@google/genai";

// ==================== 常量定义 ====================
export const API_TIMEOUT_MS = 90000; // 90秒超时
export const MAX_REF_IMAGES = 3;
export const MAX_UPLOAD_IMAGES = 10;

// ==================== 类型定义 ====================
export interface ApiConfig {
    apiKey: string;
    baseUrl?: string;
    isYunwu: boolean;
    isPlato: boolean;
    apiVersion?: string;
}

export interface GenerateContentParams {
    model: string;
    parts: any[];
    config?: any;
}

export interface TimeoutOptions {
    timeoutMs?: number;
    timeoutMessage?: string;
}

// ==================== API 配置管理 ====================

/**
 * 获取 API 配置（优先级：Plato > Yunwu > Native > Env）
 * @param forceIndex 强制使用的 Key 索引（用于自动重试）
 */
export const getApiConfig = (forceIndex?: number): ApiConfig & { keyCount: number, currentIndex: number } => {
    // 1. Plato API (柏拉图)
    const platoKey = localStorage.getItem("plato_api_key");
    const platoBaseUrl = localStorage.getItem("plato_base_url");
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
            baseUrl: platoBaseUrl || "https://api.bltcy.ai",
            isYunwu: true, // 柏拉图也使用标准的 OpenAI/Gemini 兼容中转格式，这里复用 isYunwu 逻辑
            isPlato: true,
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
            keyCount: 1,
            currentIndex: 0
        };
    }

    throw new Error("No active API configuration found. Please enable Plato, Yunwu or Native API in Settings.");
};

/**
 * 获取AI客户端实例
 */
export const getAiClient = (): GoogleGenAI => {
    const config = getApiConfig();

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
 * 获取当前激活的API信息（用于调试）
 */
export const getActiveApiInfo = (): { type: 'plato' | 'yunwu' | 'native' | 'env'; baseUrl?: string } => {
    try {
        const config = getApiConfig();
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
        timeoutMessage = `Request timed out (${timeoutMs}ms). The model might be overloaded.`
    } = options;

    return Promise.race([
        promise,
        new Promise<T>((_, reject) =>
            setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs)
        )
    ]);
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
