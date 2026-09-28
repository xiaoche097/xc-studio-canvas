type DeepSeekProxyPayload = {
  request: unknown;
  apiKey?: string;
  baseUrl?: string;
};

type LegacyDevCredentials = {
  apiKey?: string;
  baseUrl?: string;
};

const isUsableLegacyKey = (value?: string): value is string => (
  Boolean(value?.trim()) && value !== '__server_managed__'
);

/**
 * Production requests contain only the model request. During local Vite
 * development we keep a same-origin compatibility fallback for credentials
 * already saved by the settings UI. Vercel's handler never accepts these
 * fields and always uses process.env.DEEPSEEK_API_KEY.
 */
export const buildDeepSeekProxyPayload = (
  request: unknown,
  credentials: LegacyDevCredentials = {},
): DeepSeekProxyPayload => {
  const payload: DeepSeekProxyPayload = { request };
  if (!import.meta.env.DEV || typeof window === 'undefined') return payload;

  const storedKey = window.localStorage.getItem('deepseek_api_key') || '';
  const apiKey = isUsableLegacyKey(credentials.apiKey)
    ? credentials.apiKey.trim()
    : storedKey.trim();
  const baseUrl = (
    credentials.baseUrl
    || window.localStorage.getItem('deepseek_base_url')
    || 'https://api.deepseek.com'
  ).trim();

  if (apiKey) payload.apiKey = apiKey;
  if (baseUrl) payload.baseUrl = baseUrl;
  return payload;
};
