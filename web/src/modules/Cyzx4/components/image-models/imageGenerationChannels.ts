export type ImageGenerationChannelId =
  | 'virse'
  | 'xiaoche'
  | 'runninghub'
  | 'jijing'
  | 'plato'
  | 'yunwu'
  | 'native'
  | 'env';

export interface ImageGenerationChannel {
  id: ImageGenerationChannelId;
  label: string;
  baseUrl?: string;
  apiKey?: string;
  configured: boolean;
}

const firstKey = (value: string | null) => (
  (value || '').split(/[,\n]/).map((item) => item.trim()).find(Boolean) || ''
);

const enabledUnlessFalse = (key: string) => localStorage.getItem(key) !== 'false';

/** Keep this order aligned with the real image routing in getImageApiConfig(). */
export const resolveActiveImageGenerationChannel = (): ImageGenerationChannel => {
  if (typeof window === 'undefined') return { id: 'env', label: '环境默认通道', configured: true };

  if (localStorage.getItem('virse_enabled') === 'true') {
    const apiKey = firstKey(localStorage.getItem('virse_api_key'));
    return {
      id: 'virse',
      label: 'Virse 创意平台',
      baseUrl: localStorage.getItem('virse_base_url') || 'https://api.virse.ai',
      apiKey,
      configured: Boolean(apiKey),
    };
  }

  const candidates: Array<ImageGenerationChannel & { enabled: boolean }> = [
    {
      id: 'xiaoche', label: '小彻中转',
      baseUrl: localStorage.getItem('xiaoche_base_url') || '',
      apiKey: firstKey(localStorage.getItem('xiaoche_api_key')),
      configured: false,
      enabled: localStorage.getItem('xiaoche_enabled') === 'true',
    },
    {
      id: 'runninghub', label: 'RunningHub API 中转站',
      baseUrl: localStorage.getItem('runninghub_base_url') || 'https://www.runninghub.cn',
      apiKey: firstKey(localStorage.getItem('runninghub_api_key')),
      configured: false,
      enabled: enabledUnlessFalse('runninghub_enabled'),
    },
    {
      id: 'jijing', label: 'No.1 Image API',
      baseUrl: localStorage.getItem('jijing_base_url') || '',
      apiKey: firstKey(localStorage.getItem('jijing_api_key')),
      configured: false,
      enabled: enabledUnlessFalse('jijing_enabled'),
    },
    {
      id: 'plato', label: '柏拉图 API 中转站',
      baseUrl: localStorage.getItem('plato_base_url') || 'https://api.apilio.ai',
      apiKey: firstKey(localStorage.getItem('plato_api_key')),
      configured: false,
      enabled: enabledUnlessFalse('plato_enabled'),
    },
    {
      id: 'yunwu', label: '云雾 API 中转站',
      baseUrl: localStorage.getItem('yunwu_base_url') || 'https://yunwu.ai',
      apiKey: firstKey(localStorage.getItem('yunwu_api_key')),
      configured: false,
      enabled: enabledUnlessFalse('yunwu_enabled'),
    },
    {
      id: 'native', label: 'Google Gemini 原生 API',
      baseUrl: 'https://generativelanguage.googleapis.com',
      apiKey: firstKey(localStorage.getItem('user_api_key')),
      configured: false,
      enabled: enabledUnlessFalse('native_enabled'),
    },
  ];

  const active = candidates.find((item) => item.enabled && Boolean(item.apiKey));
  if (!active) return { id: 'env', label: '环境默认通道', configured: true };
  return { ...active, configured: true };
};

export const channelModelCacheKey = (channelId: ImageGenerationChannelId) => (
  channelId === 'virse' ? 'virse_image_models_cache' : `creative_image_models_cache_${channelId}`
);
