const VIRSE_PROTOCOL_VERSION = '2025-03-26';
const VIRSE_BASE_URLS = new Set(['https://api.virse.ai', 'https://dev.virse.ai']);
const ALLOWED_TOOLS = new Set([
  'get_account',
  'list_workspaces',
  'list_image_models',
  'generate_image',
  'get_asset_detail',
  'get_element',
  'upload_image',
  'get_upload_token',
]);

// Virse upload tokens are reusable for one hour and bound to the caller IP.
// Reusing them also avoids repeatedly hitting the token endpoint and its rate
// limit when a workflow uploads several reference images.
const uploadCredentialCache = new Map();
const UPLOAD_CREDENTIAL_TTL_MS = 55 * 60 * 1000;
let imgbbKeyCursor = 0;

const parseImgBbKeys = (value) => [...new Set(String(value || '')
  .split(/[\n,;]+/)
  .map((key) => key.trim())
  .filter(Boolean))];

const parseMcpResponse = (raw, contentType = '') => {
  if (!raw) return {};
  if (contentType.includes('text/event-stream')) {
    let lastMessage = {};
    for (const line of raw.split(/\r?\n/)) {
      if (!line.startsWith('data:')) continue;
      try {
        lastMessage = JSON.parse(line.slice(5).trim());
      } catch {
        // Ignore keep-alives and non-JSON SSE events.
      }
    }
    return lastMessage;
  }
  return JSON.parse(raw);
};

const normalizeBaseUrl = (value) => {
  const normalized = String(value || 'https://api.virse.ai').trim().replace(/\/+$/, '').replace(/\/mcp$/i, '');
  if (!VIRSE_BASE_URLS.has(normalized)) throw new Error('不支持的 Virse API 节点');
  return normalized;
};

const postMcp = async (baseUrl, body, apiKey, sessionId) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 65000);
  try {
    const headers = {
      Accept: 'application/json, text/event-stream;q=0.9',
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    };
    if (sessionId) headers['mcp-session-id'] = sessionId;

    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const raw = await response.text();
    if (!response.ok) {
      const error = new Error(raw || `Virse returned HTTP ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return {
      data: parseMcpResponse(raw, response.headers.get('content-type') || ''),
      sessionId: response.headers.get('mcp-session-id') || sessionId || '',
    };
  } finally {
    clearTimeout(timeout);
  }
};

const parseTextPayload = (texts) => {
  if (texts.length === 1) {
    try {
      return JSON.parse(texts[0]);
    } catch {
      return texts[0];
    }
  }
  return texts;
};

export const callVirseTool = async ({ apiKey, baseUrl, tool, args = {} }) => {
  if (typeof apiKey !== 'string' || !apiKey.trim()) throw new Error('缺少 Virse API Key');
  if (!ALLOWED_TOOLS.has(tool)) throw new Error('不支持的 Virse 工具');

  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const initialized = await postMcp(normalizedBaseUrl, {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: VIRSE_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: 'xcai-ai-studio', version: '1.0.0' },
    },
  }, apiKey.trim());

  if (initialized.data?.error) {
    throw new Error(initialized.data.error?.message || 'Virse MCP 初始化失败');
  }

  await postMcp(normalizedBaseUrl, {
    jsonrpc: '2.0',
    method: 'notifications/initialized',
    params: {},
  }, apiKey.trim(), initialized.sessionId);

  const called = await postMcp(normalizedBaseUrl, {
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: { name: tool, arguments: args },
  }, apiKey.trim(), initialized.sessionId);

  if (called.data?.error) {
    throw new Error(called.data.error?.message || `Virse ${tool} 调用失败`);
  }
  const result = called.data?.result || {};
  if (result.isError) {
    const message = result.content?.find((item) => item?.type === 'text')?.text;
    throw new Error(message || `Virse ${tool} 返回错误`);
  }
  const texts = (result.content || [])
    .filter((item) => item?.type === 'text' && typeof item.text === 'string')
    .map((item) => item.text);

  // MCP servers may return machine-readable output in structuredContent while
  // content only contains presentation blocks (or is completely empty).
  const structuredData = result.structuredContent ?? result.structured_content ?? result.data;
  const textData = parseTextPayload(texts);

  return {
    data: structuredData !== undefined ? structuredData : textData,
    content: result.content || [],
  };
};

const findFieldDeep = (value, fieldNames, depth = 0) => {
  if (depth > 6 || value == null) return undefined;
  if (typeof value === 'string') {
    try {
      return findFieldDeep(JSON.parse(value), fieldNames, depth + 1);
    } catch {
      return undefined;
    }
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findFieldDeep(item, fieldNames, depth + 1);
      if (found !== undefined) return found;
    }
    return undefined;
  }
  if (typeof value !== 'object') return undefined;
  for (const name of fieldNames) {
    if (value[name] !== undefined) return value[name];
  }
  for (const nested of Object.values(value)) {
    const found = findFieldDeep(nested, fieldNames, depth + 1);
    if (found !== undefined) return found;
  }
  return undefined;
};

const uploadCredentialsFrom = (value) => {
  const serialized = typeof value === 'string' ? value : JSON.stringify(value);
  const urls = [...serialized.matchAll(/https:\/\/[^\s"'`<>\\]+/gi)]
    .map((match) => match[0].replace(/[),.;]+$/, ''));
  const uploadUrl = findFieldDeep(value, ['upload_url', 'uploadUrl', 'upload_endpoint', 'uploadEndpoint', 'endpoint', 'url'])
    || urls.find((url) => /upload/i.test(url))
    || urls[0];
  const uploadToken = findFieldDeep(value, ['upload_token', 'uploadToken', 'token', 'access_token'])
    // A separator is required so "upload token generated" cannot become
    // token="generated".
    || serialized.match(/(?:upload[ _-]?token|access[ _-]?token|bearer|(?:^|\n)\s*token)\s*(?:\([^\r\n)]*\))?\s*(?:is|:|=)\s*["'`*]*([A-Za-z0-9._~+\/-]{16,})/im)?.[1]
    || serialized.match(/\b(eyJ[a-zA-Z0-9._-]{20,})\b/)?.[1];
  return { uploadUrl: String(uploadUrl || ''), uploadToken: String(uploadToken || '') };
};

const getUploadCredentials = async ({ apiKey, baseUrl, forceRefresh = false }) => {
  const cacheKey = `${normalizeBaseUrl(baseUrl)}\n${apiKey.trim()}`;
  const cached = uploadCredentialCache.get(cacheKey);
  if (!forceRefresh && cached && cached.expiresAt > Date.now()) {
    return { ...cached, cacheKey };
  }

  const tokenResult = await callVirseTool({ apiKey, baseUrl, tool: 'get_upload_token', args: {} });
  const credentials = uploadCredentialsFrom(tokenResult.data);
  if (!credentials.uploadUrl || !credentials.uploadToken) {
    throw new Error(`Virse 未返回可识别的上传地址或上传令牌。原始返回：${JSON.stringify(tokenResult.data).slice(0, 1200)}`);
  }
  const entry = { ...credentials, expiresAt: Date.now() + UPLOAD_CREDENTIAL_TTL_MS };
  uploadCredentialCache.set(cacheKey, entry);
  return { ...entry, cacheKey };
};

const uploadThroughImgBb = async ({
  apiKey,
  baseUrl,
  imgbbApiKey,
  cleanBase64,
  mimeType,
  filename,
  spaceId,
  canvasId,
  positionX,
  positionY,
}) => {
  const extension = mimeType.includes('jpeg') ? 'jpg' : mimeType.includes('webp') ? 'webp' : 'png';
  const safeFilename = String(filename || `reference.${extension}`)
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/\.+/g, '.');
  const bytes = Buffer.from(cleanBase64, 'base64');

  let response;
  let raw = '';

  try {
    const form = new FormData();
    form.append('image', new Blob([bytes], { type: mimeType }), safeFilename);
    form.append('name', safeFilename.replace(/\.[^.]+$/, ''));
    response = await fetch(`https://api.imgbb.com/1/upload?expiration=600&key=${encodeURIComponent(imgbbApiKey)}`, {
      method: 'POST',
      headers: { 'User-Agent': BROWSER_USER_AGENT },
      body: form,
      signal: AbortSignal.timeout(65000),
    });
    raw = await response.text();
  } catch {
    const form = new FormData();
    form.append('image', cleanBase64);
    form.append('name', safeFilename.replace(/\.[^.]+$/, ''));
    response = await fetch(`https://api.imgbb.com/1/upload?expiration=600&key=${encodeURIComponent(imgbbApiKey)}`, {
      method: 'POST',
      headers: { 'User-Agent': BROWSER_USER_AGENT },
      body: form,
      signal: AbortSignal.timeout(65000),
    });
    raw = await response.text();
  }

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    throw new Error(`ImgBB 上传响应非 JSON：${raw.slice(0, 300) || `HTTP ${response?.status}`}`);
  }
  const publicImageUrl = payload?.data?.image?.url || payload?.data?.url || payload?.data?.display_url;
  if (!response?.ok || !payload?.success || !publicImageUrl) {
    throw new Error(`ImgBB 上传失败：${payload?.error?.message || raw.slice(0, 300) || `HTTP ${response?.status}`}`);
  }

  try {
    return await callVirseTool({
      apiKey,
      baseUrl,
      tool: 'upload_image',
      args: {
        image_url: publicImageUrl,
        space_id: String(spaceId),
        canvas_id: String(canvasId),
        filename: safeFilename,
        position_x: Number(positionX) || 0,
        position_y: Number(positionY) || 0,
        size_width: 512,
        size_height: 512,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`图片已成功上传至 ImgBB 图床，但 Virse 导入图片失败：${message}`);
  }
};

const uploadThroughImgBbPool = async (options) => {
  const keys = parseImgBbKeys(options.imgbbApiKey);
  if (keys.length === 0) throw new Error('未填写 ImgBB API Key');
  const startIndex = imgbbKeyCursor % keys.length;
  imgbbKeyCursor = (imgbbKeyCursor + 1) % Number.MAX_SAFE_INTEGER;
  const failures = [];
  for (let offset = 0; offset < keys.length; offset += 1) {
    const keyIndex = (startIndex + offset) % keys.length;
    try {
      return await uploadThroughImgBb({ ...options, imgbbApiKey: keys[keyIndex] });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/图片已成功上传至 ImgBB/i.test(message)) throw error;
      failures.push(`Key ${keyIndex + 1}: ${message}`);
    }
  }
  throw new Error(`所有 ImgBB Key 均测试失败：${failures.join('；')}`);
};

const testImgBbKeys = async (value) => {
  const keys = parseImgBbKeys(value);
  if (keys.length === 0) throw new Error('请至少填写一个 ImgBB API Key');
  const testImage = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9WlS8AAAAASUVORK5CYII=';
  const results = [];
  for (let index = 0; index < keys.length; index += 1) {
    try {
      const form = new FormData();
      form.append('image', testImage);
      form.append('name', 'xcai-connection-test');
      const response = await fetch(`https://api.imgbb.com/1/upload?expiration=60&key=${encodeURIComponent(keys[index])}`, {
        method: 'POST',
        headers: { 'User-Agent': BROWSER_USER_AGENT },
        body: form,
        signal: AbortSignal.timeout(20000),
      });
      const payload = await response.json().catch(() => ({}));
      results.push({ index: index + 1, ok: response.ok && payload?.success === true, error: payload?.error?.message || '' });
    } catch (error) {
      results.push({ index: index + 1, ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  }
  const valid = results.filter((item) => item.ok).length;
  return { data: { total: keys.length, valid, invalid: keys.length - valid, results } };
};

const BROWSER_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

let freeimageKeyCursor = 0;

const parseFreeImageKeys = (value) => [...new Set(String(value || '')
  .split(/[\n,;]+/)
  .map((key) => key.trim())
  .filter(Boolean))];

const uploadThroughFreeImage = async ({
  apiKey,
  baseUrl,
  freeimageApiKey,
  cleanBase64,
  mimeType,
  filename,
  spaceId,
  canvasId,
  positionX,
  positionY,
}) => {
  const extension = mimeType.includes('jpeg') ? 'jpg' : mimeType.includes('webp') ? 'webp' : 'png';
  const safeFilename = String(filename || `reference.${extension}`)
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/\.+/g, '.');
  const bytes = Buffer.from(cleanBase64, 'base64');

  let response;
  let raw = '';

  try {
    const form = new FormData();
    form.append('key', freeimageApiKey);
    form.append('action', 'upload');
    form.append('source', new Blob([bytes], { type: mimeType }), safeFilename);
    form.append('format', 'json');

    response = await fetch('https://freeimage.host/api/1/upload', {
      method: 'POST',
      headers: { 'User-Agent': BROWSER_USER_AGENT },
      body: form,
      signal: AbortSignal.timeout(65000),
    });
    raw = await response.text();
  } catch {
    const form = new FormData();
    form.append('key', freeimageApiKey);
    form.append('action', 'upload');
    form.append('source', cleanBase64);
    form.append('format', 'json');

    response = await fetch('https://freeimage.host/api/1/upload', {
      method: 'POST',
      headers: { 'User-Agent': BROWSER_USER_AGENT },
      body: form,
      signal: AbortSignal.timeout(65000),
    });
    raw = await response.text();
  }

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    throw new Error(`FreeImage.host 上传响应非 JSON：${raw.slice(0, 300) || `HTTP ${response?.status}`}`);
  }
  const publicImageUrl = payload?.image?.url || payload?.image?.display_url || payload?.data?.url;
  const isSuccess = response?.ok && (payload?.status_code === 200 || payload?.success?.code === 200 || Boolean(publicImageUrl));
  if (!isSuccess || !publicImageUrl) {
    throw new Error(`FreeImage.host 上传失败：${payload?.error?.message || raw.slice(0, 300) || `HTTP ${response?.status}`}`);
  }

  try {
    return await callVirseTool({
      apiKey,
      baseUrl,
      tool: 'upload_image',
      args: {
        image_url: publicImageUrl,
        space_id: String(spaceId),
        canvas_id: String(canvasId),
        filename: safeFilename,
        position_x: Number(positionX) || 0,
        position_y: Number(positionY) || 0,
        size_width: 512,
        size_height: 512,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`图片已成功上传至 FreeImage.host 图床，但 Virse 导入图片失败：${message}`);
  }
};

const uploadThroughFreeImagePool = async (options) => {
  const keys = parseFreeImageKeys(options.freeimageApiKey);
  if (keys.length === 0) throw new Error('未填写 FreeImage.host API Key');
  const startIndex = freeimageKeyCursor % keys.length;
  freeimageKeyCursor = (freeimageKeyCursor + 1) % Number.MAX_SAFE_INTEGER;
  const failures = [];
  for (let offset = 0; offset < keys.length; offset += 1) {
    const keyIndex = (startIndex + offset) % keys.length;
    try {
      return await uploadThroughFreeImage({ ...options, freeimageApiKey: keys[keyIndex] });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/图片已成功上传至 FreeImage\.host/i.test(message)) throw error;
      failures.push(`Key ${keyIndex + 1}: ${message}`);
    }
  }
  throw new Error(`所有 FreeImage.host Key 均测试失败：${failures.join('；')}`);
};

const testFreeImageKeys = async (value) => {
  const keys = parseFreeImageKeys(value);
  if (keys.length === 0) throw new Error('请至少填写一个 FreeImage.host API Key');
  const testImage = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9WlS8AAAAASUVORK5CYII=';
  const results = [];
  for (let index = 0; index < keys.length; index += 1) {
    try {
      const form = new FormData();
      form.append('key', keys[index]);
      form.append('action', 'upload');
      form.append('source', testImage);
      form.append('format', 'json');
      const response = await fetch('https://freeimage.host/api/1/upload', {
        method: 'POST',
        headers: { 'User-Agent': BROWSER_USER_AGENT },
        body: form,
        signal: AbortSignal.timeout(20000),
      });
      const payload = await response.json().catch(() => ({}));
      const ok = response.ok && (payload?.status_code === 200 || payload?.success?.code === 200 || Boolean(payload?.image?.url));
      results.push({ index: index + 1, ok, error: payload?.error?.message || '' });
    } catch (error) {
      results.push({ index: index + 1, ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  }
  const valid = results.filter((item) => item.ok).length;
  return { data: { total: keys.length, valid, invalid: keys.length - valid, results } };
};

export const uploadVirseBase64 = async ({
  apiKey,
  baseUrl,
  spaceId,
  canvasId,
  base64,
  mimeType = 'image/png',
  filename = 'reference.png',
  positionX = 0,
  positionY = 0,
  imageHostProvider = '',
  imgbbApiKey = '',
  freeimageApiKey = '',
}) => {
  if (!spaceId || !canvasId) throw new Error('缺少 Virse 工作区或画布 ID');
  if (!base64) throw new Error('缺少要上传的参考图片');

  const cleanBase64 = String(base64).replace(/^data:[^;]+;base64,/, '').replace(/\s/g, '');
  const resolvedFreeImageApiKey = String(freeimageApiKey || process.env.FREEIMAGE_API_KEY || '').trim();
  const resolvedImgbbApiKey = String(imgbbApiKey || process.env.IMGBB_API_KEY || '').trim();

  const preferredProvider = imageHostProvider || (resolvedFreeImageApiKey ? 'freeimage' : resolvedImgbbApiKey ? 'imgbb' : '');

  if (preferredProvider === 'freeimage' && resolvedFreeImageApiKey) {
    try {
      return await uploadThroughFreeImagePool({
        apiKey, baseUrl, freeimageApiKey: resolvedFreeImageApiKey, cleanBase64, mimeType, filename, spaceId, canvasId, positionX, positionY,
      });
    } catch (err) {
      if (resolvedImgbbApiKey) {
        try {
          return await uploadThroughImgBbPool({
            apiKey, baseUrl, imgbbApiKey: resolvedImgbbApiKey, cleanBase64, mimeType, filename, spaceId, canvasId, positionX, positionY,
          });
        } catch (imgbbErr) {
          throw new Error(`FreeImage.host 上传失败：${err.message}\nImgBB 备用上传也失败：${imgbbErr.message}`);
        }
      }
      throw err;
    }
  } else if (preferredProvider === 'imgbb' && resolvedImgbbApiKey) {
    try {
      return await uploadThroughImgBbPool({
        apiKey, baseUrl, imgbbApiKey: resolvedImgbbApiKey, cleanBase64, mimeType, filename, spaceId, canvasId, positionX, positionY,
      });
    } catch (err) {
      if (resolvedFreeImageApiKey) {
        try {
          return await uploadThroughFreeImagePool({
            apiKey, baseUrl, freeimageApiKey: resolvedFreeImageApiKey, cleanBase64, mimeType, filename, spaceId, canvasId, positionX, positionY,
          });
        } catch (freeErr) {
          throw new Error(`ImgBB 上传失败：${err.message}\nFreeImage.host 备用上传也失败：${freeErr.message}`);
        }
      }
      throw err;
    }
  }

  // Attempt Virse Native Direct Upload if no image bed keys are configured
  let nativeError = '';
  try {
    const { uploadUrl, uploadToken, cacheKey } = await getUploadCredentials({ apiKey, baseUrl });
    const bytes = Buffer.from(cleanBase64, 'base64');
    const createForm = () => {
      const form = new FormData();
      form.append('file', new Blob([bytes], { type: mimeType }), filename);
      form.append('space_id', String(spaceId));
      form.append('canvas_id', String(canvasId));
      form.append('position_x', String(positionX));
      form.append('position_y', String(positionY));
      form.append('size_width', '512');
      form.append('size_height', '512');
      return form;
    };

    const credentials = [...new Set([uploadToken, apiKey.trim()].filter(Boolean))];
    let response;
    let raw = '';
    for (let index = 0; index < credentials.length; index += 1) {
      response = await fetch(uploadUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${credentials[index]}`, 'User-Agent': BROWSER_USER_AGENT },
        body: createForm(),
        signal: AbortSignal.timeout(65000),
      });
      raw = await response.text();
      const isAuthFailure = response.status === 401
        || response.status === 403
        || /valid api key|upload token|required|unauthori[sz]ed/i.test(raw);
      if (response.ok || !isAuthFailure || index === credentials.length - 1) break;
    }
    if (!response?.ok && (response?.status === 401 || response?.status === 403 || /valid api key|upload token|required|unauthori[sz]ed/i.test(raw))) {
      uploadCredentialCache.delete(cacheKey);
    }
    if (response?.ok) {
      try {
        return { data: JSON.parse(raw) };
      } catch {
        return { data: raw };
      }
    }
    nativeError = raw || `HTTP ${response?.status || 502} (Direct Native Upload Failed)`;
  } catch (err) {
    nativeError = err instanceof Error ? err.message : String(err);
  }

  // Fallback to ANY available image bed key if native upload failed
  if (resolvedFreeImageApiKey) {
    try {
      return await uploadThroughFreeImagePool({
        apiKey, baseUrl, freeimageApiKey: resolvedFreeImageApiKey, cleanBase64, mimeType, filename, spaceId, canvasId, positionX, positionY,
      });
    } catch (fallbackErr) {
      throw new Error(`Virse 原生上传失败（${nativeError}）\nFreeImage.host 备用上传也失败：${fallbackErr.message}`);
    }
  }

  if (resolvedImgbbApiKey) {
    try {
      return await uploadThroughImgBbPool({
        apiKey, baseUrl, imgbbApiKey: resolvedImgbbApiKey, cleanBase64, mimeType, filename, spaceId, canvasId, positionX, positionY,
      });
    } catch (fallbackErr) {
      throw new Error(`Virse 原生上传失败（${nativeError}）\nImgBB 备用上传也失败：${fallbackErr.message}`);
    }
  }

  throw new Error(`Virse 原生参考图上传服务失败（${nativeError}）。\n【提示】Virse 官方原生上传服务当前不可用，请在右侧「全局设置 -> 图床服务」中配置并保存 FreeImage.host 或 ImgBB 的 API Key 即可成功上传。`);
};

export const executeVirseRequest = async (body) => {
  if (body?.operation === 'test_imgbb') return testImgBbKeys(body?.imgbbApiKey);
  if (body?.operation === 'test_freeimage') return testFreeImageKeys(body?.freeimageApiKey);
  if (body?.operation === 'upload_base64') return uploadVirseBase64(body);
  return callVirseTool(body || {});
};
