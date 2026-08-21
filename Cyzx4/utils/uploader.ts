import { useImageHostStore } from '../stores/imageHost.store';
import { safeLocalStorageSetItem } from './safe-storage';

const DATA_URL_BASE64_PREFIX = /^data:image\/[a-zA-Z0-9.+-]+;base64,/;
const IMGBB_ROUND_ROBIN_KEY = 'image_host_poll_index_imgbb';
const CUSTOM_ROUND_ROBIN_KEY = 'image_host_poll_index_custom';

function splitApiKeys(raw: string): string[] {
  if (!raw) return [];
  return raw
    .split(/\r?\n/)
    .map((k) => k.trim())
    .filter(Boolean);
}

function getStartIndex(storageKey: string, total: number): number {
  if (total <= 0) return 0;
  const raw = localStorage.getItem(storageKey) || '0';
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed < 0) return 0;
  return parsed % total;
}

function setNextIndex(storageKey: string, nextIndex: number, total: number): void {
  if (total <= 0) return;
  safeLocalStorageSetItem(storageKey, String((nextIndex + total) % total));
}

async function parseJsonSafely(response: Response): Promise<any | null> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function resolveCommonImageUrl(payload: any): string | null {
  if (!payload || typeof payload !== 'object') return null;
  return payload?.data?.url
    || payload?.data?.display_url
    || payload?.data?.image?.url
    || payload?.result?.url
    || payload?.url
    || null;
}

async function uploadToImgbbWithKey(file: File, key: string): Promise<string> {
  const dataUrl = await fileToDataUrl(file);
  const pureBase64 = dataUrl.replace(DATA_URL_BASE64_PREFIX, '');
  if (!pureBase64) {
    throw new Error('图片编码失败，无法生成有效的 Base64 数据');
  }

  const formData = new FormData();
  formData.append('image', pureBase64);

  const response = await fetch(`https://api.imgbb.com/1/upload?key=${encodeURIComponent(key)}`, {
    method: 'POST',
    body: formData,
  });

  const payload = await parseJsonSafely(response);
  if (!response.ok || !payload?.success) {
    const message = payload?.error?.message || `ImgBB 上传失败 (${response.status})`;
    throw new Error(message);
  }

  const resultUrl =
    payload?.data?.image?.url ||
    payload?.data?.url ||
    payload?.data?.display_url;
  if (!resultUrl) {
    throw new Error('ImgBB 返回成功但未包含可用图片地址');
  }

  if (/^https?:\/\/ibb\.co\//i.test(resultUrl)) {
    const directUrl = payload?.data?.image?.url || payload?.data?.display_url;
    if (directUrl && /^https?:\/\//i.test(directUrl) && !/^https?:\/\/ibb\.co\//i.test(directUrl)) {
      return directUrl;
    }
    throw new Error('ImgBB 返回了页面链接而非图片直链');
  }

  return resultUrl;
}

async function uploadToCustomWithKey(file: File, apiKey: string): Promise<string> {
  const { customConfig } = useImageHostStore.getState();
  const {
    uploadUrl,
    method,
    fileParamName,
    apiKeyParamName,
    apiKeyHeaderName,
    responsePath,
  } = customConfig;

  if (!uploadUrl) throw new Error('未配置自定义图床上传地址');

  const formData = new FormData();
  formData.append(fileParamName || 'image', file);

  let url = uploadUrl;
  if (apiKeyParamName && apiKey) {
    const separator = url.includes('?') ? '&' : '?';
    url += `${separator}${encodeURIComponent(apiKeyParamName)}=${encodeURIComponent(apiKey)}`;
  }

  const headers: Record<string, string> = {};
  if (apiKeyHeaderName && apiKey) {
    headers[apiKeyHeaderName] = apiKey;
  }

  const response = await fetch(url, {
    method: method || 'POST',
    headers,
    body: formData,
  });

  const payload = await parseJsonSafely(response);
  if (!response.ok) {
    const message = payload?.message || payload?.error?.message || `自定义图床上传失败 (${response.status})`;
    throw new Error(message);
  }

  const fromPath = payload && responsePath ? resolvePath(payload, responsePath) : null;
  const urlResult = fromPath || resolveCommonImageUrl(payload);
  if (!urlResult) {
    throw new Error(`无法从响应中解析图片地址: ${responsePath || '未配置 responsePath'}`);
  }

  return urlResult;
}

/**
 * 统一上传函数，根据 Store 中的配置自动选择图床并上传
 * @param file 要上传的图片文件
 * @returns 返回上传后的公网 URL
 */
export async function uploadImage(file: File): Promise<string> {
  const { selectedProvider, imgbbKey, customConfig } = useImageHostStore.getState(); // cspell:disable-line

  if (selectedProvider === 'none') {
    // 如果未配置图床，则返回本地临时 Object URL 以保证基础预览，但 Agent 无法从公网访问此 URL
    return URL.createObjectURL(file);
  }

  if (selectedProvider === 'imgbb') { // cspell:disable-line
    const keys = splitApiKeys(imgbbKey);
    if (keys.length === 0) throw new Error('未配置 ImgBB API Key'); // cspell:disable-line

    const startIndex = getStartIndex(IMGBB_ROUND_ROBIN_KEY, keys.length);
    let lastError: Error | null = null;

    for (let i = 0; i < keys.length; i += 1) {
      const idx = (startIndex + i) % keys.length;
      try {
        const result = await uploadToImgbbWithKey(file, keys[idx]);
        setNextIndex(IMGBB_ROUND_ROBIN_KEY, idx + 1, keys.length);
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
      }
    }

    throw new Error(lastError?.message || 'ImgBB 上传失败：所有 Key 均不可用');
  }

  if (selectedProvider === 'custom') {
    if (!customConfig.uploadUrl) throw new Error('未配置自定义图床上传地址');

    const keys = splitApiKeys(customConfig.apiKey);
    if (keys.length === 0) {
      return uploadToCustomWithKey(file, '');
    }

    const startIndex = getStartIndex(CUSTOM_ROUND_ROBIN_KEY, keys.length);
    let lastError: Error | null = null;

    for (let i = 0; i < keys.length; i += 1) {
      const idx = (startIndex + i) % keys.length;
      try {
        const result = await uploadToCustomWithKey(file, keys[idx]);
        setNextIndex(CUSTOM_ROUND_ROBIN_KEY, idx + 1, keys.length);
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
      }
    }

    throw new Error(lastError?.message || '自定义图床上传失败：所有 Key 均不可用');
  }

  return URL.createObjectURL(file);
}

/**
 * 辅助函数：根据路径字符串（如 "data.url"）从对象中取值
 */
function resolvePath(obj: any, path: string) {
  return path.split('.').reduce((prev, curr) => {
    return prev ? prev[curr] : undefined;
  }, obj);
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('读取图片失败：FileReader 返回数据类型异常'));
      }
    };
    reader.onerror = () => {
      reject(new Error('读取图片失败：无法转换为 Base64'));
    };
    reader.readAsDataURL(file);
  });
}
