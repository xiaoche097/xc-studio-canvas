import { safeLocalStorageSetItem } from '../utils/safe-storage';

export type ProviderConfig = {
  id: string;
  name?: string;
  baseUrl?: string;
  apiKey?: string;
  model?: string;
};

type HomepageTextProvider = 'auto' | 'deepseek' | 'runninghub' | 'plato' | 'yunwu' | 'native';

const DEFAULT_RUNNINGHUB_BASE_URL = 'https://www.runninghub.cn';
const DEFAULT_PLATO_BASE_URL = 'https://api.apilio.ai';
const DEFAULT_YUNWU_BASE_URL = 'https://yunwu.ai';
const GOOGLE_BASE_URL = 'https://generativelanguage.googleapis.com';
export const DEFAULT_DEEPSEEK_BASE_URL = 'https://api.deepseek.com';
export const DEFAULT_DEEPSEEK_MODEL = 'auto';

const normalizeDeepSeekBaseUrl = (value: string): string => (
  (value || DEFAULT_DEEPSEEK_BASE_URL).trim().replace(/\/+$/, '')
);

const normalizeProxyBaseUrl = (value: string, fallback: string): string => (
  (value || fallback)
    .trim()
    .replace(/\/+$/, '')
    // services/gemini.ts appends the OpenAI-compatible /v1 route itself.
    .replace(/\/v1$/i, '')
);

const readHomepageProvider = (provider: Exclude<HomepageTextProvider, 'auto'>): ProviderConfig => {
  if (provider === 'deepseek') {
    return {
      id: 'deepseek',
      name: 'DeepSeek 原生 API',
      baseUrl: normalizeDeepSeekBaseUrl(localStorage.getItem('deepseek_base_url') || ''),
      apiKey: localStorage.getItem('deepseek_api_key') || '',
      model: localStorage.getItem('deepseek_model') || DEFAULT_DEEPSEEK_MODEL,
    };
  }

  if (provider === 'runninghub') {
    return {
      id: 'runninghub',
      name: 'RunningHub',
      baseUrl: normalizeProxyBaseUrl(
        localStorage.getItem('runninghub_base_url') || '',
        DEFAULT_RUNNINGHUB_BASE_URL,
      ),
      apiKey: localStorage.getItem('runninghub_api_key') || '',
    };
  }

  if (provider === 'plato') {
    return {
      id: 'plato',
      name: '柏拉图',
      baseUrl: normalizeProxyBaseUrl(
        localStorage.getItem('plato_base_url') || '',
        DEFAULT_PLATO_BASE_URL,
      ),
      apiKey: localStorage.getItem('plato_api_key') || '',
    };
  }

  if (provider === 'yunwu') {
    return {
      id: 'yunwu',
      name: '云雾',
      baseUrl: normalizeProxyBaseUrl(
        localStorage.getItem('yunwu_base_url') || '',
        DEFAULT_YUNWU_BASE_URL,
      ),
      apiKey: localStorage.getItem('yunwu_api_key') || '',
    };
  }

  return {
    id: 'gemini',
    name: 'Google Gemini 原生 API',
    baseUrl: GOOGLE_BASE_URL,
    apiKey:
      localStorage.getItem('user_api_key')
      || localStorage.getItem('user_gemini_api_key')
      || localStorage.getItem('gemini_api_key')
      || '',
  };
};

const isHomepageProviderEnabled = (provider: Exclude<HomepageTextProvider, 'auto'>): boolean => {
  if (provider === 'native') {
    return localStorage.getItem('native_enabled') !== 'false';
  }
  return localStorage.getItem(`${provider}_enabled`) !== 'false';
};

const hasApiKey = (config: ProviderConfig): boolean => Boolean(
  (config.apiKey || '')
    .split(/[\n,]/)
    .map((key) => key.trim())
    .find((key) => key && !key.startsWith('#')),
);

/**
 * Resolve the text/Agent provider from the global settings shown on Home.
 *
 * Media routing remains independent: Virse/Nano Banana and other image/video
 * providers are selected by geminiService/apiHelpers. This adapter prevents the
 * legacy Cyzx4 Agent stack from silently falling back to its old `api_provider`
 * setting and bypassing the global `text_api_provider` choice.
 */
export const getProviderConfig = (): ProviderConfig => {
  const savedPreference = localStorage.getItem('text_api_provider');
  const preferred: HomepageTextProvider = (
    savedPreference === 'deepseek'
    || savedPreference === 'runninghub'
    || savedPreference === 'plato'
    || savedPreference === 'yunwu'
    || savedPreference === 'native'
  ) ? savedPreference : 'auto';

  if (preferred !== 'auto') {
    // Keep the user's explicit Home selection authoritative. Missing/disabled
    // credentials must surface as a configuration error instead of falling
    // through to an unrelated relay.
    const selected = readHomepageProvider(preferred);
    return isHomepageProviderEnabled(preferred)
      ? selected
      : { ...selected, apiKey: '' };
  }

  // Match the priority used by the Home text/Agent configuration.
  const automaticOrder: Array<Exclude<HomepageTextProvider, 'auto'>> = [
    'deepseek',
    'runninghub',
    'plato',
    'yunwu',
    'native',
  ];

  for (const provider of automaticOrder) {
    const config = readHomepageProvider(provider);
    if (isHomepageProviderEnabled(provider) && hasApiKey(config)) {
      return config;
    }
  }

  return {
    id: 'unconfigured',
    name: '首页文本 / Agent 服务',
    apiKey: '',
  };
};

const readStoredProvider = (providerId: string): ProviderConfig | null => {
  try {
    const providers = JSON.parse(localStorage.getItem('api_providers') || '[]');
    if (!Array.isArray(providers)) return null;
    const provider = providers.find(item => item?.id === providerId && item.id !== 'deepseek');
    if (!provider) return null;
    return {
      id: provider.id,
      name: provider.name,
      baseUrl: normalizeProxyBaseUrl(provider.baseUrl || '', provider.id === 'gemini' ? GOOGLE_BASE_URL : ''),
      apiKey: provider.apiKey || '',
      model: provider.defaultModel,
    };
  } catch {
    return null;
  }
};

/**
 * Media credentials are intentionally independent from the Agent/text provider.
 * Selecting DeepSeek must never redirect Gemini/Nano Banana/Veo requests to the
 * DeepSeek endpoint.
 */
export const getMediaProviderConfig = (): ProviderConfig => {
  const savedMediaProvider = localStorage.getItem('media_api_provider');
  const savedApiProvider = localStorage.getItem('api_provider');
  const preferredId = savedMediaProvider
    || (savedApiProvider && savedApiProvider !== 'deepseek' ? savedApiProvider : '');
  if (preferredId) {
    const stored = readStoredProvider(preferredId);
    if (stored && hasApiKey(stored)) return stored;
  }

  const legacyOrder: Array<Exclude<HomepageTextProvider, 'auto' | 'deepseek'>> = [
    'runninghub',
    'plato',
    'yunwu',
    'native',
  ];
  for (const provider of legacyOrder) {
    const config = readHomepageProvider(provider);
    if (isHomepageProviderEnabled(provider) && hasApiKey(config)) return config;
  }

  return { id: 'unconfigured-media', name: '图片 / 视频服务', apiKey: '' };
};

export const getApiKey = (
  all: boolean = false,
  purpose: 'text' | 'media' = 'text',
): string | string[] => {
  const config = purpose === 'media' ? getMediaProviderConfig() : getProviderConfig();
  const rawKeys = config.apiKey || '';

  if (rawKeys) {
    const keys = rawKeys
      .split(/[\n,]/)
      .map((key) => key.trim())
      .filter((key) => key && !key.startsWith('#'));

    if (keys.length > 0) {
      if (all) return keys;

      const storageKey = `api_poll_index_${config.id}`;
      let currentIndex = Number.parseInt(localStorage.getItem(storageKey) || '0', 10);
      if (!Number.isFinite(currentIndex) || currentIndex >= keys.length) currentIndex = 0;
      const selectedKey = keys[currentIndex];
      safeLocalStorageSetItem(storageKey, ((currentIndex + 1) % keys.length).toString());
      return selectedKey;
    }
  }

  return all ? [] : '';
};
