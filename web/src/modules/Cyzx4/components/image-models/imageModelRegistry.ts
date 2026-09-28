import type { VirseImageModel } from '../../../../services/virseService';
import type { ImageGenerationChannelId } from './imageGenerationChannels';

export type ImageModelProviderId =
  | 'google'
  | 'openai'
  | 'midjourney'
  | 'qwen'
  | 'flux'
  | 'bytedance'
  | 'ideogram'
  | 'virse';

export interface CreativeImageModel {
  id: string;
  name: string;
  provider: ImageModelProviderId;
  providerLabel: string;
  description: string;
  source: 'fallback' | 'remote';
  channelId?: ImageGenerationChannelId;
}

export interface ImageModelProvider {
  id: ImageModelProviderId;
  label: string;
  shortLabel: string;
  description: string;
}

export const PREFERRED_CREATIVE_IMAGE_MODELS_KEY = 'preferred_creative_image_models';
const LEGACY_PREFERRED_CREATIVE_IMAGE_MODEL_KEY = 'preferred_creative_image_model';
export const CREATIVE_IMAGE_MODEL_PREFERENCE_EVENT = 'creative-image-model-preference-updated';

export const getPreferredCreativeImageModelId = (channelId: ImageGenerationChannelId, fallback = '') => {
  if (typeof window === 'undefined') return fallback;
  try {
    const preferences = JSON.parse(localStorage.getItem(PREFERRED_CREATIVE_IMAGE_MODELS_KEY) || '{}');
    if (typeof preferences?.[channelId] === 'string' && preferences[channelId].trim()) {
      return preferences[channelId].trim();
    }
  } catch {
    // Ignore malformed legacy data and continue with migration fallback.
  }
  return localStorage.getItem(LEGACY_PREFERRED_CREATIVE_IMAGE_MODEL_KEY)?.trim() || fallback;
};

export const setPreferredCreativeImageModelId = (channelId: ImageGenerationChannelId, modelId: string) => {
  if (typeof window === 'undefined') return;
  let preferences: Record<string, string> = {};
  try {
    preferences = JSON.parse(localStorage.getItem(PREFERRED_CREATIVE_IMAGE_MODELS_KEY) || '{}');
  } catch {
    preferences = {};
  }
  preferences[channelId] = modelId;
  localStorage.setItem(PREFERRED_CREATIVE_IMAGE_MODELS_KEY, JSON.stringify(preferences));
  window.dispatchEvent(new CustomEvent(CREATIVE_IMAGE_MODEL_PREFERENCE_EVENT, { detail: { channelId, modelId } }));
};

export const IMAGE_MODEL_PROVIDERS: ImageModelProvider[] = [
  { id: 'google', label: 'Google', shortLabel: 'Google', description: 'Gemini / Nano Banana' },
  { id: 'openai', label: 'OpenAI', shortLabel: 'OpenAI', description: 'GPT Image' },
  { id: 'midjourney', label: 'Midjourney', shortLabel: 'MJ', description: 'MJ Imagine' },
  { id: 'qwen', label: '通义千问', shortLabel: 'Qwen', description: 'Qwen Image' },
  { id: 'flux', label: 'Black Forest Labs', shortLabel: 'FLUX', description: 'FLUX Image' },
  { id: 'bytedance', label: '火山 / 字节', shortLabel: '火山', description: 'Seedream / 豆包' },
  { id: 'ideogram', label: 'Ideogram', shortLabel: 'Ideogram', description: 'Ideogram Image' },
  { id: 'virse', label: '其他模型厂商', shortLabel: '其他', description: '当前通道返回的其他模型' },
];

export const BUILTIN_CREATIVE_IMAGE_MODELS: CreativeImageModel[] = [
  { id: 'gemini-3.1-flash-image-preview', name: 'Banana 2', provider: 'google', providerLabel: 'Google', description: '3.1 Flash', source: 'fallback' },
  { id: 'gemini-3-pro-image-preview', name: 'Banana Pro', provider: 'google', providerLabel: 'Google', description: '3.0 Pro', source: 'fallback' },
  { id: 'gpt-image-2', name: 'GPT Image 2', provider: 'openai', providerLabel: 'OpenAI', description: 'Ultra Quality', source: 'fallback' },
  { id: 'mj_imagine', name: 'Midjourney', provider: 'midjourney', providerLabel: 'Midjourney', description: 'MJ Imagine', source: 'fallback' },
  { id: 'qwen-image-3.0-pro', name: '千问 3.0 Pro', provider: 'qwen', providerLabel: 'Qwen', description: 'Qwen Image', source: 'fallback' },
];

const normalize = (value?: string) => (value || '').trim().toLowerCase();

export const resolveImageModelProvider = (model: Pick<VirseImageModel, 'id' | 'name' | 'provider'>): ImageModelProviderId => {
  const text = normalize(`${model.id} ${model.name || ''} ${model.provider || ''}`);
  if (/qwen|tongyi|通义|千问|alibaba/.test(text)) return 'qwen';
  if (/midjourney|mj[\s_.-]/.test(text)) return 'midjourney';
  if (/flux|bfl|black forest/.test(text)) return 'flux';
  if (/seedream|byte\s*dance|bytedance|volc|doubao|豆包|火山/.test(text)) return 'bytedance';
  if (/ideogram/.test(text)) return 'ideogram';
  if (/gpt[\s_.-]*image|openai/.test(text)) return 'openai';
  if (/gemini|nano[\s_.-]*banana|google/.test(text)) return 'google';
  return 'virse';
};

export const toCreativeRemoteModel = (model: VirseImageModel, channelId: ImageGenerationChannelId): CreativeImageModel => {
  const provider = resolveImageModelProvider(model);
  const providerMeta = IMAGE_MODEL_PROVIDERS.find((item) => item.id === provider);
  return {
    id: model.id,
    name: model.name || model.id,
    provider,
    providerLabel: model.provider || providerMeta?.label || 'Virse',
    description: [model.provider, model.max_resolution].filter(Boolean).join(' · ') || '通道实时模型',
    source: 'remote',
    channelId,
  };
};

export const buildCreativeImageModels = (
  remoteModels: VirseImageModel[],
  channelId: ImageGenerationChannelId,
): CreativeImageModel[] => {
  if (remoteModels.length > 0) return remoteModels.map((model) => toCreativeRemoteModel(model, channelId));
  return BUILTIN_CREATIVE_IMAGE_MODELS.map((model) => ({ ...model, channelId }));
};

export const getCreativeImageModel = (id: string, models = BUILTIN_CREATIVE_IMAGE_MODELS) => (
  models.find((model) => model.id === id)
  || models.find((model) => model.id === (id === 'nanobananapro' ? 'gemini-3-pro-image-preview' : id))
  || { id, name: id, provider: 'virse' as const, providerLabel: '其他', description: '自定义模型', source: 'fallback' as const }
);
