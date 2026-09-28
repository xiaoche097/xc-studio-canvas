import {
  SystemChannel,
  ChannelModel,
  RemoteFetchedModel,
  CapabilityType,
  TextModelParameters,
  ImageModelParameters,
  ResolutionGroup,
  AspectRatioItem
} from './channelTypes';
import { ALL_PROTOCOLS, PROTOCOLS_BY_ID } from './catalog';
import { ProtocolTestResult } from './types';

const CHANNELS_STORAGE_KEY = 'xc_system_channels';
const MODELS_STORAGE_KEY = 'xc_channel_models';

export const createDefault1KResolutions = (): ResolutionGroup => ({
  name: '1K',
  enabled: true,
  ratios: [
    { ratio: '1:1', resolution: '1024 × 1024', enabled: true },
    { ratio: '16:9', resolution: '1824 × 1024', enabled: true },
    { ratio: '9:16', resolution: '1024 × 1824', enabled: true },
    { ratio: '4:3', resolution: '1360 × 1024', enabled: true },
    { ratio: '3:4', resolution: '1024 × 1360', enabled: true },
    { ratio: '3:2', resolution: '1536 × 1024', enabled: true },
    { ratio: '2:3', resolution: '1024 × 1536', enabled: true },
    { ratio: '4:5', resolution: '1024 × 1280', enabled: true },
    { ratio: '5:4', resolution: '1280 × 1024', enabled: true },
    { ratio: '21:9', resolution: '2048 × 878', enabled: true },
  ],
});

export const createDefault2KResolutions = (): ResolutionGroup => ({
  name: '2K',
  enabled: false,
  ratios: [
    { ratio: '1:1', resolution: '2048 × 2048', enabled: true },
    { ratio: '16:9', resolution: '2752 × 1536', enabled: true },
    { ratio: '9:16', resolution: '1536 × 2752', enabled: true },
    { ratio: '4:3', resolution: '2304 × 1728', enabled: true },
    { ratio: '3:4', resolution: '1728 × 2304', enabled: true },
    { ratio: '3:2', resolution: '2496 × 1664', enabled: true },
    { ratio: '2:3', resolution: '1664 × 2496', enabled: true },
    { ratio: '4:5', resolution: '1792 × 2240', enabled: true },
    { ratio: '5:4', resolution: '2240 × 1792', enabled: true },
    { ratio: '21:9', resolution: '3136 × 1344', enabled: true },
  ],
});

export const createDefault4KResolutions = (): ResolutionGroup => ({
  name: '4K',
  enabled: false,
  ratios: [
    { ratio: '1:1', resolution: '2880 × 2880', enabled: true },
    { ratio: '16:9', resolution: '3840 × 2160', enabled: true },
    { ratio: '9:16', resolution: '2160 × 3840', enabled: true },
    { ratio: '4:3', resolution: '3264 × 2448', enabled: true },
    { ratio: '3:4', resolution: '2448 × 3264', enabled: true },
    { ratio: '3:2', resolution: '3504 × 2336', enabled: true },
    { ratio: '2:3', resolution: '2336 × 3504', enabled: true },
    { ratio: '4:5', resolution: '2560 × 3200', enabled: true },
    { ratio: '5:4', resolution: '3200 × 2560', enabled: true },
    { ratio: '21:9', resolution: '3936 × 1632', enabled: true },
  ],
});

export const getDefaultTextParameters = (protocolId: string = '', modelId: string = ''): TextModelParameters => {
  const lower = (protocolId + ' ' + modelId).toLowerCase();
  const isMultimodal = lower.includes('4o') || lower.includes('vision') || lower.includes('claude') || lower.includes('gemini') || lower.includes('vl') || lower.includes('image');
  
  let contextWindow = 128000;
  let maxOutput = 16384;
  let maxImages = 0;
  let maxImageSize = 0;
  let maxVideos = 0;
  let maxVideoSize = 0;

  if (lower.includes('claude')) {
    contextWindow = 200000;
    maxOutput = 8192;
    maxImages = 16;
    maxImageSize = 30;
  } else if (lower.includes('gemini')) {
    contextWindow = 1000000;
    maxOutput = 8192;
    maxImages = 16;
    maxImageSize = 30;
    maxVideos = 1;
    maxVideoSize = 100;
  } else if (lower.includes('deepseek')) {
    contextWindow = 128000;
    maxOutput = 16384;
    maxImages = 0;
    maxImageSize = 0;
  } else if (lower.includes('4o') || lower.includes('openai') || lower.includes('gpt')) {
    contextWindow = 128000;
    maxOutput = 16384;
    maxImages = isMultimodal ? 16 : 0;
    maxImageSize = isMultimodal ? 30 : 0;
  }

  return {
    contextWindowTokens: contextWindow,
    maxOutputTokens: maxOutput,
    maxReferenceImages: maxImages,
    maxImageSizeMb: maxImageSize,
    maxReferenceVideos: maxVideos,
    maxVideoSizeMb: maxVideoSize,
    maxPromptLength: 32000,
    enableSseStream: true,
  };
};

export const getDefaultImageParameters = (protocolId: string = '', modelId: string = ''): ImageModelParameters => {
  return {
    maxReferenceImages: 16,
    maxImageSizeMb: 30,
    supportMaskEdit: true,
    maxPromptLength: 32000,
    dimensionMode: 'size',
    resolutions: [
      createDefault1KResolutions(),
      createDefault2KResolutions(),
      createDefault4KResolutions(),
    ],
    defaultOutputDimension: '自动',
    allowCustomDimension: true,
    batchCount: 15,
    quality: {
      enabled: true,
      supportedValues: ['auto', 'low', 'medium', 'high'],
      defaultValue: 'auto',
    },
    transparentBackground: {
      enabled: true,
      defaultValue: false,
    },
    responseFormatB64: true,
    outputFormatPng: true,
  };
};

/**
 * 渠道知名厂商预置常用模型映射（用于拉取/备选导入）
 */
const KNOWN_VENDOR_PRESETS: Record<string, Array<{ id: string; name: string; capability: CapabilityType; protocolId: string }>> = {
  yingce: [
    { id: 'gpt-image-2', name: 'gpt-image-2', capability: 'image', protocolId: 'openai-image' },
    { id: 'gpt-image-1', name: 'gpt-image-1', capability: 'image', protocolId: 'openai-image' },
    { id: 'gpt-4o', name: 'gpt-4o', capability: 'text', protocolId: 'chat-completion' },
  ],
  deepseek: [
    { id: 'deepseek-chat', name: 'DeepSeek Chat (V3)', capability: 'text', protocolId: 'deepseek-chat' },
    { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner (R1)', capability: 'text', protocolId: 'deepseek-chat' },
  ],
  openai: [
    { id: 'gpt-image-2', name: 'gpt-image-2 (影策绘图)', capability: 'image', protocolId: 'openai-image' },
    { id: 'gpt-4o', name: 'GPT-4o (Omni)', capability: 'text', protocolId: 'chat-completion' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', capability: 'text', protocolId: 'chat-completion' },
    { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', capability: 'text', protocolId: 'chat-completion' },
    { id: 'o1-preview', name: 'o1 Reasoning Preview', capability: 'text', protocolId: 'chat-completion' },
    { id: 'o1-mini', name: 'o1 Mini', capability: 'text', protocolId: 'chat-completion' },
    { id: 'dall-e-3', name: 'DALL·E 3 High Quality', capability: 'image', protocolId: 'openai-image' },
  ],
  anthropic: [
    { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet v2', capability: 'text', protocolId: 'anthropic-messages' },
    { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', capability: 'text', protocolId: 'anthropic-messages' },
    { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', capability: 'text', protocolId: 'anthropic-messages' },
  ],
  gemini: [
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', capability: 'text', protocolId: 'gemini-generate-content' },
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', capability: 'text', protocolId: 'gemini-generate-content' },
    { id: 'imagen-3.0-generate-002', name: 'Imagen 3.0 Ultra', capability: 'image', protocolId: 'gemini-image' },
  ],
  qwen: [
    { id: 'qwen-max', name: '通义千问 Qwen-Max', capability: 'text', protocolId: 'dashscope-chat' },
    { id: 'qwen-plus', name: '通义千问 Qwen-Plus', capability: 'text', protocolId: 'dashscope-chat' },
    { id: 'qwen-turbo', name: '通义千问 Qwen-Turbo', capability: 'text', protocolId: 'dashscope-chat' },
    { id: 'wanx-v1', name: '通义万相 Wanx 图像生成', capability: 'image', protocolId: 'dashscope-image' },
  ],
};

/**
 * 辅助推断模型的能力与默认协议
 */
export const guessModelCapabilityAndProtocol = (modelId: string, channel: SystemChannel): { capability: CapabilityType; protocolId: string } => {
  const lowerId = modelId.toLowerCase();
  const lowerName = channel.name.toLowerCase();
  const lowerBase = channel.baseUrl.toLowerCase();

  // 1. 判断是否为图像模型
  if (
    lowerId.includes('dall-e') ||
    lowerId.includes('image') ||
    lowerId.includes('flux') ||
    lowerId.includes('midjourney') ||
    lowerId.includes('stable-diffusion') ||
    lowerId.includes('sd-') ||
    lowerId.includes('sdxl') ||
    lowerId.includes('wanx') ||
    lowerId.includes('seedream')
  ) {
    if (lowerId.includes('flux') || lowerBase.includes('blackforest') || lowerBase.includes('bfl')) {
      return { capability: 'image', protocolId: 'bfl-flux' };
    }
    if (lowerId.includes('seedream') || lowerBase.includes('volces')) {
      return { capability: 'image', protocolId: 'volcengine-ark-image' };
    }
    if (lowerId.includes('wanx') || lowerBase.includes('dashscope')) {
      return { capability: 'image', protocolId: 'dashscope-image' };
    }
    if (lowerId.includes('imagen') || lowerBase.includes('googleapis')) {
      return { capability: 'image', protocolId: 'gemini-image' };
    }
    return { capability: 'image', protocolId: 'openai-image' };
  }

  // 2. 视频模型
  if (lowerId.includes('video') || lowerId.includes('sora') || lowerId.includes('kling') || lowerId.includes('runway')) {
    return { capability: 'video', protocolId: 'chat-completion' };
  }

  // 3. 文本模型协议推断
  if (lowerName.includes('deepseek') || lowerBase.includes('deepseek')) {
    return { capability: 'text', protocolId: 'deepseek-chat' };
  }
  if (lowerName.includes('anthropic') || lowerName.includes('claude') || lowerBase.includes('anthropic')) {
    return { capability: 'text', protocolId: 'anthropic-messages' };
  }
  if (lowerName.includes('gemini') || lowerBase.includes('generativelanguage.googleapis')) {
    return { capability: 'text', protocolId: 'gemini-generate-content' };
  }
  if (lowerName.includes('qwen') || lowerName.includes('ali') || lowerBase.includes('dashscope')) {
    return { capability: 'text', protocolId: 'dashscope-chat' };
  }
  if (lowerName.includes('bedrock') || lowerBase.includes('bedrock')) {
    return { capability: 'text', protocolId: 'aws-bedrock-converse' };
  }
  if (lowerName.includes('atlas') || lowerBase.includes('atlas')) {
    return { capability: 'text', protocolId: 'atlas-cloud-chat' };
  }
  if (lowerName.includes('antigravity') || lowerBase.includes('antigravity')) {
    return { capability: 'text', protocolId: 'antigravity-chat' };
  }

  // 默认使用 OpenAI 兼容协议
  return { capability: 'text', protocolId: 'chat-completion' };
};

/**
 * 获取所有系统渠道
 */
export const getSystemChannels = (): SystemChannel[] => {
  try {
    const raw = localStorage.getItem(CHANNELS_STORAGE_KEY);
    if (raw) {
      const parsed: SystemChannel[] = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        // Filter out old auto-generated mock channels if user didn't create them
        const cleaned = parsed.filter(c => c.id !== 'channel-deepseek' && c.id !== 'channel-yingce');
        if (cleaned.length !== parsed.length) {
          localStorage.setItem(CHANNELS_STORAGE_KEY, JSON.stringify(cleaned));
        }
        return cleaned;
      }
    }
  } catch (e) {
    console.error('Failed to parse system channels from storage:', e);
  }

  // 默认没有任何渠道，需要用户自己加入
  return [];
};

/**
 * 保存单个系统渠道
 */
export const saveSystemChannel = (channel: SystemChannel): void => {
  const channels = getSystemChannels();
  const index = channels.findIndex((c) => c.id === channel.id);
  const updatedChannel = {
    ...channel,
    updatedAt: Date.now(),
  };

  let newChannels: SystemChannel[];
  if (index >= 0) {
    newChannels = [...channels];
    newChannels[index] = updatedChannel;
  } else {
    newChannels = [...channels, updatedChannel];
  }

  localStorage.setItem(CHANNELS_STORAGE_KEY, JSON.stringify(newChannels));

  // 同步关联旧的 deepseek 存储字段以保持全局兼容
  if (channel.name.toLowerCase().includes('deepseek') || channel.baseUrl.includes('deepseek')) {
    localStorage.setItem('deepseek_api_key', channel.apiKey);
    localStorage.setItem('deepseek_base_url', channel.baseUrl);
    localStorage.setItem('deepseek_enabled', String(channel.enabled));
    window.dispatchEvent(new Event('api-settings-updated'));
  }
};

/**
 * 删除系统渠道
 */
export const deleteSystemChannel = (channelId: string): void => {
  const channels = getSystemChannels().filter((c) => c.id !== channelId);
  localStorage.setItem(CHANNELS_STORAGE_KEY, JSON.stringify(channels));

  // 同时清除属于该渠道的模型
  const models = getChannelModels().filter((m) => m.channelId !== channelId);
  localStorage.setItem(MODELS_STORAGE_KEY, JSON.stringify(models));
};

/**
 * 获取渠道下的模型列表（若未传 channelId 则返回全部）
 */
export const getChannelModels = (channelId?: string): ChannelModel[] => {
  let allModels: ChannelModel[] = [];
  try {
    const raw = localStorage.getItem(MODELS_STORAGE_KEY);
    if (raw) {
      const parsed: ChannelModel[] = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        // Filter out old auto-generated mock models
        const cleaned = parsed.filter(m => m.id !== 'model-ds-flash' && m.id !== 'model-ds-v4-pro');
        if (cleaned.length !== parsed.length) {
          localStorage.setItem(MODELS_STORAGE_KEY, JSON.stringify(cleaned));
        }
        allModels = cleaned;
      }
    }
  } catch (e) {
    console.error('Failed to get channel models:', e);
  }

  if (channelId) {
    return allModels.filter((m) => m.channelId === channelId);
  }
  return allModels;
};

/**
 * 保存单个渠道模型
 */
export const saveChannelModel = (model: ChannelModel): void => {
  const models = getChannelModels();
  const index = models.findIndex((m) => m.id === model.id);
  const updatedModel = {
    ...model,
    updatedAt: Date.now(),
  };

  let newModels: ChannelModel[];
  if (index >= 0) {
    newModels = [...models];
    newModels[index] = updatedModel;
  } else {
    newModels = [...models, updatedModel];
  }

  localStorage.setItem(MODELS_STORAGE_KEY, JSON.stringify(newModels));
  window.dispatchEvent(new CustomEvent('channel-models-updated', { detail: { channelId: model.channelId } }));
};

/**
 * 批量保存/导入渠道模型
 */
export const batchSaveChannelModels = (newModelsToSave: ChannelModel[]): void => {
  const currentModels = getChannelModels();
  const modelMap = new Map<string, ChannelModel>();
  currentModels.forEach((m) => modelMap.set(m.id, m));

  newModelsToSave.forEach((m) => {
    modelMap.set(m.id, {
      ...m,
      updatedAt: Date.now(),
    });
  });

  const merged = Array.from(modelMap.values());
  localStorage.setItem(MODELS_STORAGE_KEY, JSON.stringify(merged));
  window.dispatchEvent(new CustomEvent('channel-models-updated'));
};

/**
 * 删除渠道模型
 */
export const deleteChannelModel = (modelId: string): void => {
  const models = getChannelModels().filter((m) => m.id !== modelId);
  localStorage.setItem(MODELS_STORAGE_KEY, JSON.stringify(models));
  window.dispatchEvent(new CustomEvent('channel-models-updated'));
};

/**
 * 从渠道上游拉取模型列表
 */
export const fetchModelsFromChannel = async (channel: SystemChannel): Promise<{
  success: boolean;
  models: RemoteFetchedModel[];
  message: string;
  isFallbackPreset?: boolean;
}> => {
  const baseUrl = channel.baseUrl.replace(/\/+$/, '');
  const apiKey = channel.apiKey.trim();

  // 整理 Headers
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }
  // 加入用户自定义 Header
  if (Array.isArray(channel.customHeaders)) {
    channel.customHeaders.forEach((h) => {
      if (h.key && h.value) headers[h.key] = h.value;
    });
  }

  // 尝试尝试标准 /models 或 /v1/models 路径
  const testEndpoints = [
    baseUrl.endsWith('/v1') ? `${baseUrl}/models` : `${baseUrl}/v1/models`,
    `${baseUrl}/models`,
  ];

  let rawModelList: any[] = [];
  let fetchError: any = null;

  for (const endpoint of testEndpoints) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const resp = await fetch(endpoint, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (resp.ok) {
        const json = await resp.json();
        if (json && Array.isArray(json.data)) {
          rawModelList = json.data;
          break;
        } else if (Array.isArray(json.models)) {
          rawModelList = json.models;
          break;
        } else if (Array.isArray(json)) {
          rawModelList = json;
          break;
        }
      }
    } catch (e: any) {
      fetchError = e;
    }
  }

  // 如果成功拉取到了
  if (rawModelList.length > 0) {
    const fetched: RemoteFetchedModel[] = rawModelList.map((item) => {
      const modelId = typeof item === 'string' ? item : item.id || item.name || '';
      const inferred = guessModelCapabilityAndProtocol(modelId, channel);
      return {
        id: modelId,
        name: typeof item === 'object' && item.name ? item.name : modelId,
        capability: inferred.capability,
        recommendedProtocolId: inferred.protocolId,
        selected: true,
      };
    });

    return {
      success: true,
      models: fetched,
      message: `成功从上游 ${baseUrl} 获取 ${fetched.length} 个模型`,
      isFallbackPreset: false,
    };
  }

  // 如果因 CORS 跨域限制或接口未提供，按知名厂商自动匹配预置库，确保用户无缝配置
  const lowerName = channel.name.toLowerCase();
  const lowerBase = channel.baseUrl.toLowerCase();

  let matchedVendor = '';
  if (lowerName.includes('影策') || lowerName.includes('yingce')) matchedVendor = 'yingce';
  else if (lowerName.includes('deepseek') || lowerBase.includes('deepseek')) matchedVendor = 'deepseek';
  else if (lowerName.includes('openai') || lowerBase.includes('openai')) matchedVendor = 'openai';
  else if (lowerName.includes('anthropic') || lowerName.includes('claude') || lowerBase.includes('anthropic')) matchedVendor = 'anthropic';
  else if (lowerName.includes('gemini') || lowerBase.includes('google')) matchedVendor = 'gemini';
  else if (lowerName.includes('qwen') || lowerName.includes('ali') || lowerBase.includes('dashscope')) matchedVendor = 'qwen';

  if (matchedVendor && KNOWN_VENDOR_PRESETS[matchedVendor]) {
    const presets = KNOWN_VENDOR_PRESETS[matchedVendor].map((p) => ({
      id: p.id,
      name: p.name,
      capability: p.capability,
      recommendedProtocolId: p.protocolId,
      selected: true,
    }));

    return {
      success: true,
      models: presets,
      message: `上游未响应或跨域（${fetchError?.message || 'CORS'}），已为您自动匹配并加载 [${channel.name}] 官方标准模型库！`,
      isFallbackPreset: true,
    };
  }

  // 通用备选
  return {
    success: false,
    models: [
      {
        id: 'default-chat-model',
        name: `${channel.name} 默认对话模型`,
        capability: 'text',
        recommendedProtocolId: 'chat-completion',
        selected: true,
      }
    ],
    message: `未能从 ${baseUrl} 拉取到模型：${fetchError?.message || '请求超时或跨域限制'}。已提供默认模板，请核对。`,
    isFallbackPreset: true,
  };
};

/**
 * 测试某个渠道下的模型调用连通性
 */
export const testChannelModelConnection = async (
  channel: SystemChannel,
  model: ChannelModel
): Promise<ProtocolTestResult> => {
  const startTime = Date.now();
  const protocol = PROTOCOLS_BY_ID[model.protocolId];

  if (!channel.baseUrl) {
    return {
      success: false,
      latencyMs: 0,
      message: '测试失败：渠道 Base URL 不能为空',
    };
  }

  const endpoint = `${channel.baseUrl.replace(/\/+$/, '')}${protocol?.createPath || '/v1/chat/completions'}`;
  const apiKey = channel.apiKey.trim();

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (apiKey) {
      if (protocol?.authType === 'anthropic') {
        headers['x-api-key'] = apiKey;
        headers['anthropic-version'] = '2023-06-01';
      } else {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }
    }
    if (Array.isArray(channel.customHeaders)) {
      channel.customHeaders.forEach((h) => {
        if (h.key && h.value) headers[h.key] = h.value;
      });
    }

    // 构建最小探测载荷
    let body: any = {
      model: model.upstreamModelId || model.modelId,
    };

    if (model.capability === 'image') {
      body.prompt = 'a tiny test ping dot';
      body.n = 1;
      body.size = '256x256';
    } else {
      body.messages = [{ role: 'user', content: 'hi' }];
      body.max_tokens = 5;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(endpoint, {
      method: protocol?.createMethod || 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const latencyMs = Date.now() - startTime;

    if (res.ok) {
      return {
        success: true,
        latencyMs,
        message: `模型 ${model.displayName || model.modelId} 协议连接成功！耗时: ${latencyMs}ms`,
      };
    } else {
      const errText = await res.text();
      return {
        success: false,
        latencyMs,
        message: `HTTP ${res.status}: ${errText.slice(0, 180)}`,
      };
    }
  } catch (e: any) {
    const latencyMs = Date.now() - startTime;
    return {
      success: false,
      latencyMs,
      message: `网络或跨域错误: ${e?.message || '连接超时'}`,
    };
  }
};
