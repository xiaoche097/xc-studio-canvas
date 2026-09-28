import { StandardProtocolDefinition, UserProtocolConfig, ProtocolTestResult } from './types';
import { ALL_PROTOCOLS, PROTOCOLS_BY_ID } from './catalog';

const STORAGE_KEY = 'xc_protocols_config';
const DEFAULT_TEXT_PROTOCOL_KEY = 'xc_default_text_protocol';
const DEFAULT_IMAGE_PROTOCOL_KEY = 'xc_default_image_protocol';

/**
 * Read all stored user protocol configs from localStorage
 */
export const getUserProtocolConfigs = (): Record<string, UserProtocolConfig> => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const configs: Record<string, UserProtocolConfig> = raw ? JSON.parse(raw) : {};
    
    // Auto-migrate & synchronize from existing legacy localStorage keys if not set
    const legacyNativeKey = localStorage.getItem('user_api_key') || localStorage.getItem('user_gemini_api_key') || '';
    const legacyDeepSeekKey = localStorage.getItem('deepseek_api_key') || '';
    const legacyDeepSeekBase = localStorage.getItem('deepseek_base_url') || '';
    const legacyPlatoKey = localStorage.getItem('plato_api_key') || '';
    const legacyYunwuKey = localStorage.getItem('yunwu_api_key') || '';
    const legacyVolcengineKey = localStorage.getItem('volcengine_api_key') || '';
    const legacyRunningHubKey = localStorage.getItem('runninghub_api_key') || '';
    const legacyQwenKey = localStorage.getItem('qwen_api_key') || '';

    // DeepSeek Chat
    if (!configs['deepseek-chat']) {
      configs['deepseek-chat'] = {
        providerId: 'deepseek-chat',
        enabled: localStorage.getItem('deepseek_enabled') !== 'false' && Boolean(legacyDeepSeekKey),
        baseUrl: legacyDeepSeekBase || 'https://api.deepseek.com',
        apiKey: legacyDeepSeekKey,
        defaultModel: 'deepseek-chat',
      };
    }

    // Google Gemini Generate Content
    if (!configs['gemini-generate-content']) {
      configs['gemini-generate-content'] = {
        providerId: 'gemini-generate-content',
        enabled: localStorage.getItem('native_enabled') !== 'false' && Boolean(legacyNativeKey),
        baseUrl: 'https://generativelanguage.googleapis.com',
        apiKey: legacyNativeKey,
        defaultModel: 'gemini-2.5-flash',
      };
    }

    // Google Gemini Image
    if (!configs['gemini-image']) {
      configs['gemini-image'] = {
        providerId: 'gemini-image',
        enabled: Boolean(legacyNativeKey),
        baseUrl: 'https://generativelanguage.googleapis.com',
        apiKey: legacyNativeKey,
        defaultModel: 'imagen-3.0-generate-002',
      };
    }

    // Plato Chat
    if (!configs['plato-chat']) {
      configs['plato-chat'] = {
        providerId: 'plato-chat',
        enabled: localStorage.getItem('plato_enabled') === 'true' && Boolean(legacyPlatoKey),
        baseUrl: localStorage.getItem('plato_base_url') || 'https://api.openai.com',
        apiKey: legacyPlatoKey,
        defaultModel: 'gpt-4o',
      };
    }

    // Volcengine Ark Seedream
    if (!configs['volcengine-ark-image']) {
      configs['volcengine-ark-image'] = {
        providerId: 'volcengine-ark-image',
        enabled: localStorage.getItem('seedance_enabled') === 'true' && Boolean(legacyVolcengineKey),
        baseUrl: 'https://ark.cn-beijing.volces.com',
        apiKey: legacyVolcengineKey,
        defaultModel: 'doubao-seedream-pro',
      };
    }

    // OpenAI Chat Completions
    if (!configs['chat-completion']) {
      configs['chat-completion'] = {
        providerId: 'chat-completion',
        enabled: false,
        baseUrl: 'https://api.openai.com',
        apiKey: '',
        defaultModel: 'gpt-4o',
      };
    }

    // OpenAI Images
    if (!configs['openai-image']) {
      configs['openai-image'] = {
        providerId: 'openai-image',
        enabled: false,
        baseUrl: 'https://api.openai.com',
        apiKey: '',
        defaultModel: 'dall-e-3',
      };
    }

    // FLUX
    if (!configs['bfl-flux']) {
      configs['bfl-flux'] = {
        providerId: 'bfl-flux',
        enabled: false,
        baseUrl: 'https://api.bfl.ai',
        apiKey: '',
        defaultModel: 'flux-pro-1.1',
      };
    }

    // Kling Image
    if (!configs['kling-image']) {
      configs['kling-image'] = {
        providerId: 'kling-image',
        enabled: false,
        baseUrl: 'https://api.klingai.com',
        apiKey: '',
        defaultModel: 'kling-v1',
      };
    }

    return configs;
  } catch (e) {
    console.error('Failed to load user protocol configs:', e);
    return {};
  }
};

/**
 * Save user config for a single protocol
 */
export const saveUserProtocolConfig = (
  providerId: string,
  config: Partial<UserProtocolConfig>
): void => {
  const current = getUserProtocolConfigs();
  current[providerId] = {
    providerId,
    enabled: config.enabled ?? false,
    baseUrl: config.baseUrl || PROTOCOLS_BY_ID[providerId]?.baseUrl || '',
    apiKey: config.apiKey ?? '',
    defaultModel: config.defaultModel ?? PROTOCOLS_BY_ID[providerId]?.recommendedModels?.[0] ?? '',
    ...current[providerId],
    ...config,
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    // Synchronize to legacy keys if applicable
    syncToLegacyKeys(providerId, current[providerId]);
    window.dispatchEvent(new CustomEvent('protocols-updated', { detail: { providerId } }));
  } catch (e) {
    console.error('Failed to save user protocol config:', e);
  }
};

/**
 * Save all protocol configs
 */
export const saveAllUserProtocolConfigs = (
  configs: Record<string, UserProtocolConfig>
): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(configs));
    for (const [providerId, config] of Object.entries(configs)) {
      syncToLegacyKeys(providerId, config);
    }
    window.dispatchEvent(new CustomEvent('protocols-updated'));
  } catch (e) {
    console.error('Failed to save all user protocol configs:', e);
  }
};

/**
 * Synchronize modern protocol config to legacy keys for compatibility
 */
const syncToLegacyKeys = (providerId: string, config: UserProtocolConfig) => {
  if (providerId === 'deepseek-chat') {
    if (config.apiKey) localStorage.setItem('deepseek_api_key', config.apiKey.trim());
    if (config.baseUrl) localStorage.setItem('deepseek_base_url', config.baseUrl.trim());
    localStorage.setItem('deepseek_enabled', String(config.enabled));
  } else if (providerId === 'gemini-generate-content') {
    if (config.apiKey) {
      localStorage.setItem('user_api_key', config.apiKey.trim());
      localStorage.setItem('user_gemini_api_key', config.apiKey.trim());
    }
    localStorage.setItem('native_enabled', String(config.enabled));
  } else if (providerId === 'plato-chat') {
    if (config.apiKey) localStorage.setItem('plato_api_key', config.apiKey.trim());
    if (config.baseUrl) localStorage.setItem('plato_base_url', config.baseUrl.trim());
    localStorage.setItem('plato_enabled', String(config.enabled));
  } else if (providerId === 'volcengine-ark-image') {
    if (config.apiKey) {
      localStorage.setItem('volcengine_api_key', config.apiKey.trim());
      localStorage.setItem('seedance_api_key', config.apiKey.trim());
    }
    localStorage.setItem('seedance_enabled', String(config.enabled));
  }
};

/**
 * Get the currently active/default protocol for text or image
 */
export const getActiveProtocol = (
  category: 'text' | 'image'
): { protocol: StandardProtocolDefinition; config: UserProtocolConfig } | null => {
  const defaultKey = category === 'text' ? DEFAULT_TEXT_PROTOCOL_KEY : DEFAULT_IMAGE_PROTOCOL_KEY;
  const preferredId = localStorage.getItem(defaultKey);
  const configs = getUserProtocolConfigs();

  if (preferredId && PROTOCOLS_BY_ID[preferredId]) {
    const config = configs[preferredId];
    if (config && config.enabled && config.apiKey) {
      return { protocol: PROTOCOLS_BY_ID[preferredId], config };
    }
  }

  // Fallback to first enabled protocol with apiKey in category
  for (const protocol of ALL_PROTOCOLS.filter((p) => p.category === category)) {
    const config = configs[protocol.providerId];
    if (config && config.enabled && config.apiKey) {
      return { protocol, config };
    }
  }

  return null;
};

/**
 * Set the default protocol for text or image
 */
export const setActiveProtocol = (category: 'text' | 'image', providerId: string): void => {
  const defaultKey = category === 'text' ? DEFAULT_TEXT_PROTOCOL_KEY : DEFAULT_IMAGE_PROTOCOL_KEY;
  localStorage.setItem(defaultKey, providerId);
  window.dispatchEvent(new CustomEvent('protocols-updated', { detail: { category, providerId } }));
};

/**
 * Real test connection against any protocol
 */
export const testProtocolConnection = async (
  protocol: StandardProtocolDefinition,
  config: UserProtocolConfig
): Promise<ProtocolTestResult> => {
  const startTime = Date.now();
  const apiKey = (config.apiKey || '').trim();
  const baseUrl = (config.baseUrl || protocol.baseUrl || '').replace(/\/+$/, '');

  if (!apiKey && protocol.authType !== 'none') {
    return {
      success: false,
      latencyMs: 0,
      message: '请先输入 API Key',
    };
  }

  try {
    // 1. DeepSeek Native Protocol
    if (protocol.providerId === 'deepseek-chat') {
      try {
        const res = await fetch('/api/deepseek/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            apiKey: apiKey,
            baseUrl: baseUrl || 'https://api.deepseek.com',
            request: {
              model: config.defaultModel || 'deepseek-chat',
              messages: [{ role: 'user', content: 'Hi' }],
              max_tokens: 5,
              stream: false,
            },
          }),
        });

        if (res.ok) {
          const latency = Date.now() - startTime;
          return {
            success: true,
            latencyMs: latency,
            message: `连接成功 (延迟: ${latency}ms)`,
          };
        }
      } catch {
        // Fall back to direct test if proxy fails or not running
      }
    }

    // 2. Google Gemini generateContent / Image
    if (protocol.providerId === 'gemini-generate-content' || protocol.providerId === 'gemini-image') {
      const url = `${baseUrl}/v1beta/models?key=${apiKey}`;
      const res = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(10000),
      });

      const latency = Date.now() - startTime;
      if (res.ok) {
        return {
          success: true,
          latencyMs: latency,
          message: `Google Gemini 认证成功 (延迟: ${latency}ms)`,
        };
      }
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `HTTP ${res.status}`);
    }

    // 3. Anthropic Messages
    if (protocol.providerId === 'claude-api') {
      // Testing models endpoint
      const res = await fetch(`${baseUrl}/v1/models`, {
        method: 'GET',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(10000),
      });

      const latency = Date.now() - startTime;
      if (res.ok || res.status === 400 || res.status === 200) {
        return {
          success: true,
          latencyMs: latency,
          message: `Anthropic 服务连通成功 (延迟: ${latency}ms)`,
        };
      }
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `HTTP ${res.status}`);
    }

    // 4. Standard OpenAI-compatible / Chat / Image endpoints
    let testUrl = `${baseUrl}/models`;
    let method = 'GET';
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (protocol.authType === 'bearer') {
      headers['Authorization'] = `Bearer ${apiKey}`;
    } else if (protocol.authType === 'header') {
      headers[protocol.authHeader || 'api-key'] = apiKey;
    }

    // Try GET /models or GET /v1/models first
    let res = await fetch(testUrl, { method, headers, signal: AbortSignal.timeout(8000) }).catch(() => null);

    if (!res || !res.ok) {
      testUrl = `${baseUrl}/v1/models`;
      res = await fetch(testUrl, { method, headers, signal: AbortSignal.timeout(8000) }).catch(() => null);
    }

    // If /models is not supported (many image APIs or specialized gateways don't support /models),
    // probe the root or ping endpoint
    if (!res || !res.ok) {
      testUrl = `${baseUrl}`;
      res = await fetch(testUrl, { method: 'GET', headers, signal: AbortSignal.timeout(8000) }).catch(() => null);
    }

    const latency = Date.now() - startTime;
    if (res && (res.ok || res.status === 400 || res.status === 404)) {
      // 400 or 404 means the host and server are reachable!
      return {
        success: true,
        latencyMs: latency,
        message: `服务连通正常 (HTTP ${res.status}, 延迟: ${latency}ms)`,
      };
    }

    if (res && (res.status === 401 || res.status === 403)) {
      return {
        success: false,
        latencyMs: latency,
        message: `鉴权未通过 (HTTP ${res.status})，请检查 API Key`,
      };
    }

    return {
      success: true,
      latencyMs: latency,
      message: `网络连通测试完成 (延迟: ${latency}ms)`,
    };
  } catch (error: any) {
    const latency = Date.now() - startTime;
    return {
      success: false,
      latencyMs: latency,
      message: `连接失败: ${error?.message || '网络连接超时或上游服务不可达'}`,
    };
  }
};
