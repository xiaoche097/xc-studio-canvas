import { isRateLimitError } from './requestErrors.ts';

export interface VirseWorkspace {
  space_id: string;
  canvas_id: string;
  name?: string;
  organization_name?: string;
}

export interface VirseImageModel {
  id: string;
  name?: string;
  provider?: string;
  max_resolution?: string;
}

export type VirseImageQuality = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

export const VIRSE_IMAGE_QUALITY_OPTIONS: ReadonlyArray<{ value: VirseImageQuality; label: string }> = [
  { value: 'low', label: '低' },
  { value: 'medium', label: '中' },
  { value: 'high', label: '高' },
  { value: 'xhigh', label: '超高' },
  { value: 'max', label: '极致' },
];

const VIRSE_IMAGE_QUALITY_STORAGE_KEY = 'virse_image_quality_by_model';
const VIRSE_IMAGE_QUALITY_MODELS = new Set([
  'gpt-image-2',
  'gpt-image-2.5-flare',
  'gpt-image-2.5-sunburst',
]);

const normalizeVirseImageModelId = (modelId: string) => (
  modelId.trim().toLowerCase().split('/').pop() || ''
);

export const supportsVirseImageQuality = (modelId: string): boolean => (
  VIRSE_IMAGE_QUALITY_MODELS.has(normalizeVirseImageModelId(modelId))
);

export const getVirseImageQuality = (modelId: string): VirseImageQuality => {
  if (typeof window === 'undefined') return 'high';
  try {
    const values = JSON.parse(localStorage.getItem(VIRSE_IMAGE_QUALITY_STORAGE_KEY) || '{}');
    const quality = values?.[normalizeVirseImageModelId(modelId)];
    return VIRSE_IMAGE_QUALITY_OPTIONS.some((option) => option.value === quality) ? quality : 'high';
  } catch {
    return 'high';
  }
};

export const setVirseImageQuality = (modelId: string, quality: VirseImageQuality): void => {
  if (typeof window === 'undefined' || !supportsVirseImageQuality(modelId)) return;
  let values: Record<string, VirseImageQuality> = {};
  try {
    values = JSON.parse(localStorage.getItem(VIRSE_IMAGE_QUALITY_STORAGE_KEY) || '{}');
  } catch {
    values = {};
  }
  values[normalizeVirseImageModelId(modelId)] = quality;
  localStorage.setItem(VIRSE_IMAGE_QUALITY_STORAGE_KEY, JSON.stringify(values));
};

const callVirse = async <T = unknown>(apiKey: string, baseUrl: string, tool: string, args: Record<string, unknown> = {}): Promise<T> => {
  const response = await fetch('/api/virse', {
    method: 'POST',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey, baseUrl, tool, args }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw Object.assign(new Error(payload?.error || `Virse 连接失败（HTTP ${response.status}）`), {
      status: response.status,
    });
  }
  return payload.data as T;
};

export const getVirseRawToolData = (apiKey: string, baseUrl: string, tool: 'get_account' | 'list_workspaces' | 'list_image_models') => (
  callVirse<unknown>(apiKey, baseUrl, tool)
);

const findStringField = (value: unknown, fields: string[], depth = 0): string => {
  if (depth > 7 || value == null) return '';
  if (typeof value === 'string') {
    const directMatch = fields.map((field) => (
      value.match(new RegExp(`${field}\\s*[:=]\\s*[^a-z0-9_-]*([a-z0-9_.-]+)`, 'i'))?.[1]
    )).find(Boolean);
    if (directMatch) return directMatch;
    try {
      return findStringField(JSON.parse(value), fields, depth + 1);
    } catch {
      return '';
    }
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findStringField(item, fields, depth + 1);
      if (found) return found;
    }
    return '';
  }
  if (typeof value !== 'object') return '';
  const objectValue = value as Record<string, unknown>;
  for (const field of fields) {
    if (typeof objectValue[field] === 'string') return objectValue[field] as string;
  }
  for (const nested of Object.values(objectValue)) {
    const found = findStringField(nested, fields, depth + 1);
    if (found) return found;
  }
  return '';
};

const findVirseStatus = (value: unknown, depth = 0): string => {
  if (depth > 7 || value == null) return '';
  if (typeof value === 'string') {
    const normalized = value.replace(/\\n/g, '\n');
    const lineStatus = normalized.match(/(?:^|\n)\s*(?:status|state)\s*[:=]\s*["'`]*([a-z_-]+)/i)?.[1];
    if (lineStatus) return lineStatus.toLowerCase();
    try {
      return findVirseStatus(JSON.parse(value), depth + 1);
    } catch {
      return '';
    }
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const status = findVirseStatus(item, depth + 1);
      if (status) return status;
    }
    return '';
  }
  if (typeof value !== 'object') return '';
  const objectValue = value as Record<string, unknown>;
  for (const field of ['status', 'state']) {
    if (typeof objectValue[field] === 'string') return objectValue[field].toLowerCase();
  }
  for (const [key, nested] of Object.entries(objectValue)) {
    if (/prompt|instruction/i.test(key)) continue;
    const status = findVirseStatus(nested, depth + 1);
    if (status) return status;
  }
  return '';
};

const summarizeVirseFailure = (value: unknown, artifactVersionId: string, status: string) => {
  const message = findStringField(value, ['error_message', 'failure_reason', 'error', 'message'])
    .replace(/(?:\\n|\n)\s*prompt\s*:[\s\S]*$/i, '')
    .slice(0, 240);
  return [
    `artifact_version_id=${artifactVersionId}`,
    `status=${status || 'unknown'}`,
    message ? `message=${message}` : '',
  ].filter(Boolean).join(', ');
};

const collectOutputImageUrls = (
  value: unknown,
  preferred = new Set<string>(),
  fallback = new Set<string>(),
  path: string[] = [],
  depth = 0,
): string[] => {
  if (depth > 8 || value == null) return [...preferred, ...fallback];
  const pathText = path.join('.').toLowerCase();
  if (/prompt|instruction|input|source|reference|original/.test(pathText)) return [...preferred, ...fallback];

  if (typeof value === 'string') {
    try {
      collectOutputImageUrls(JSON.parse(value), preferred, fallback, path, depth + 1);
      return [...preferred, ...fallback];
    } catch {
      const normalized = value.replace(/\\n/g, '\n');
      const lines = normalized.split(/\r?\n/);
      lines.forEach((line, index) => {
        const context = `${lines[Math.max(0, index - 1)] || ''} ${line}`.toLowerCase();
        if (/prompt|input|source|reference|original/.test(context)) return;
        for (const match of line.matchAll(/https?:\/\/[^\s"'`<>]+/g)) {
          const url = match[0].replace(/[),.;]+$/, '');
          if (!/\.(?:png|jpe?g|webp|gif)(?:\?|$)/i.test(url) && !/image|artifact|asset|output|cdn|storage/i.test(url)) continue;
          if (/output|result|generated|final|image[_\s-]?url|download|artifact/.test(context)) preferred.add(url);
          else fallback.add(url);
        }
      });
      return [...preferred, ...fallback];
    }
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => collectOutputImageUrls(item, preferred, fallback, [...path, String(index)], depth + 1));
    return [...preferred, ...fallback];
  }

  if (typeof value === 'object') {
    Object.entries(value as Record<string, unknown>).forEach(([key, nested]) => {
      if (/prompt|instruction|input|source|reference|original/i.test(key)) return;
      collectOutputImageUrls(nested, preferred, fallback, [...path, key], depth + 1);
    });
  }
  return [...preferred, ...fallback];
};

const getVirseReferenceCanvasSize = (base64: string, mimeType: string): Promise<{ width: number; height: number }> => (
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const sourceWidth = image.naturalWidth;
      const sourceHeight = image.naturalHeight;
      if (!sourceWidth || !sourceHeight) {
        reject(new Error('Virse 无法读取参考图原始尺寸'));
        return;
      }
      const scale = 512 / Math.max(sourceWidth, sourceHeight);
      resolve({
        width: Math.max(1, Math.round(sourceWidth * scale)),
        height: Math.max(1, Math.round(sourceHeight * scale)),
      });
    };
    image.onerror = () => reject(new Error('Virse 无法解析参考图宽高比'));
    image.src = base64.startsWith('data:') ? base64 : `data:${mimeType};base64,${base64}`;
  })
);

export const uploadVirseReference = async (options: {
  apiKey: string;
  baseUrl: string;
  spaceId: string;
  canvasId: string;
  base64: string;
  mimeType: string;
  index: number;
  imageHostProvider?: string;
  imgbbApiKey?: string;
  freeimageApiKey?: string;
}): Promise<string> => {
  const canvasSize = await getVirseReferenceCanvasSize(options.base64, options.mimeType);
  const response = await fetch('/api/virse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      operation: 'upload_base64',
      apiKey: options.apiKey,
      baseUrl: options.baseUrl,
      spaceId: options.spaceId,
      canvasId: options.canvasId,
      base64: options.base64,
      mimeType: options.mimeType,
      imageHostProvider: options.imageHostProvider || '',
      imgbbApiKey: options.imgbbApiKey || '',
      freeimageApiKey: options.freeimageApiKey || '',
      filename: `reference-${options.index + 1}.${options.mimeType.includes('jpeg') ? 'jpg' : options.mimeType.includes('webp') ? 'webp' : 'png'}`,
      positionX: options.index * 540,
      positionY: 0,
      sizeWidth: canvasSize.width,
      sizeHeight: canvasSize.height,
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || `Virse 参考图上传失败（HTTP ${response.status}）`);
  const assetId = findStringField(payload?.data, ['asset_id', 'assetId', 'image_asset_id', 'id']);
  if (!assetId) throw new Error(`Virse 已接收参考图，但返回中没有 asset_id：${JSON.stringify(payload?.data).slice(0, 500)}`);
  return assetId;
};

export const generateVirseImage = async (options: {
  apiKey: string;
  baseUrl: string;
  spaceId: string;
  canvasId: string;
  model: string;
  prompt: string;
  aspectRatio: string;
  resolution: string;
  assetIds?: string[];
  numImages?: number;
  signal?: AbortSignal;
  onStatus?: (status: 'submitting' | 'polling' | 'processing') => void;
}): Promise<string[]> => {
  options.onStatus?.('submitting');
  const [ratioWidth, ratioHeight] = options.aspectRatio.split(':').map(Number);
  const landscape = ratioWidth >= ratioHeight;
  const sizeWidth = landscape ? 512 : Math.max(128, Math.round(512 * ratioWidth / ratioHeight));
  const sizeHeight = landscape ? Math.max(128, Math.round(512 * ratioHeight / ratioWidth)) : 512;
  const generated = await callVirse<unknown>(options.apiKey, options.baseUrl, 'generate_image', {
    prompt: options.prompt,
    model: options.model,
    space_id: options.spaceId,
    canvas_id: options.canvasId,
    position_x: 0,
    position_y: 600,
    aspect_ratio: options.aspectRatio,
    resolution: options.resolution,
    quality: supportsVirseImageQuality(options.model) ? getVirseImageQuality(options.model) : undefined,
    num_images: options.numImages || 1,
    asset_id: options.assetIds && options.assetIds.length > 0 ? options.assetIds : undefined,
    size_width: sizeWidth,
    size_height: sizeHeight,
  });

  const artifactVersionId = findStringField(generated, ['artifact_version_id', 'artifactVersionId']);
  const initialStatus = findVirseStatus(generated);
  if (!artifactVersionId) {
    const immediateUrls = collectOutputImageUrls(generated);
    if (immediateUrls.length > 0) return immediateUrls;
    throw new Error(`Virse 已接受生成请求，但未返回 artifact_version_id：${JSON.stringify(generated).slice(0, 700)}`);
  }
  if (/^(completed|complete|succeeded|success|ready|done)$/.test(initialStatus)) {
    const immediateUrls = collectOutputImageUrls(generated);
    if (immediateUrls.length > 0) return immediateUrls;
  }

  options.onStatus?.('polling');
  // Virse may keep complex image edits in processing for several minutes.
  // Keep polling the accepted task through short upstream outages. Never submit
  // a replacement generation just because a read of its status failed.
  const deadline = Date.now() + 5 * 60 * 1000;
  let readFailures = 0;
  for (let attempt = 0; attempt < 60 && Date.now() < deadline; attempt += 1) {
    if (options.signal?.aborted) throw new DOMException('Generation cancelled', 'AbortError');
    await new Promise((resolve) => setTimeout(resolve, Math.min(5000 * 2 ** readFailures, 30000)));
    if (options.signal?.aborted) throw new DOMException('Generation cancelled', 'AbortError');
    if (Date.now() >= deadline) break;
    let detail: unknown;
    try {
      detail = await callVirse<unknown>(options.apiKey, options.baseUrl, 'get_asset_detail', {
        artifact_version_id: artifactVersionId,
      });
      readFailures = 0;
    } catch (error) {
      const failure = error as Error & { status?: number };
      const transient = isRateLimitError(failure) || [502, 503, 504].includes(failure.status || 0);
      if (transient && ++readFailures <= 3) continue;
      throw Object.assign(new Error(`Virse 任务已提交，但查询状态失败；请到所选画布查看，避免重复生成：${failure.message}`), {
        artifactVersionId,
        status: failure.status,
      });
    }
    const status = findVirseStatus(detail);
    if (/^(failed|failure|error|cancelled|canceled|rejected)$/.test(status)) {
      throw new Error(`Virse 图片生成失败：${summarizeVirseFailure(detail, artifactVersionId, status)}`);
    }
    if (/^(queued|pending|processing|running|submitted|generating|in_progress)$/.test(status)) {
      options.onStatus?.('processing');
      continue;
    }
    const urls = collectOutputImageUrls(detail);
    if (urls.length > 0) return urls;
    options.onStatus?.('processing');
  }
  throw new Error('Virse 图片生成超时，请到所选 Virse 画布查看任务状态');
};

const parsePossibleJson = (value: unknown): unknown => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    const firstObject = trimmed.indexOf('{');
    const lastObject = trimmed.lastIndexOf('}');
    const firstArray = trimmed.indexOf('[');
    const lastArray = trimmed.lastIndexOf(']');
    const candidates = [
      firstObject >= 0 && lastObject > firstObject ? trimmed.slice(firstObject, lastObject + 1) : '',
      firstArray >= 0 && lastArray > firstArray ? trimmed.slice(firstArray, lastArray + 1) : '',
    ].filter(Boolean);
    for (const candidate of candidates) {
      try {
        return JSON.parse(candidate);
      } catch {
        // Continue with the human-readable response parser below.
      }
    }
    return value;
  }
};

const deepCollectionFrom = <T>(value: unknown, keys: string[], depth = 0): T[] => {
  const parsed = parsePossibleJson(value);
  if (Array.isArray(parsed)) return parsed as T[];
  if (!parsed || typeof parsed !== 'object' || depth > 5) return [];
  const objectValue = parsed as Record<string, unknown>;
  for (const key of keys) {
    const collection = parsePossibleJson(objectValue[key]);
    if (Array.isArray(collection)) return collection as T[];
  }
  for (const nested of Object.values(objectValue)) {
    const collection = deepCollectionFrom<T>(nested, keys, depth + 1);
    if (collection.length > 0) return collection;
  }
  return [];
};

const fieldFromText = (block: string, field: string): string => {
  const pattern = new RegExp(`${field}\\s*[:=]\\s*[^a-z0-9_-]*([a-z0-9_.-]+)`, 'i');
  return block.match(pattern)?.[1]?.trim() || '';
};

const parseWorkspaceText = (value: unknown): VirseWorkspace[] => {
  if (typeof value !== 'string') return [];
  const normalized = value.replace(/\\n/g, '\n');
  const bracketRows = normalized.split(/\r?\n/).map((line, index): VirseWorkspace | null => {
    const match = line.match(/^\s*\[([^\]]+)\]\s+(.+?)\s+—\s+.*?canvas_id:\s*([^\s,]+)/i);
    if (!match) return null;
    const org = line.match(/(?:^|,\s*)org:\s*(.+?)(?:\s*\([^)]*\))?\s*$/i)?.[1]?.trim();
    return {
      space_id: match[1].trim(),
      canvas_id: match[3].trim(),
      name: match[2].trim() || `Virse 工作区 ${index + 1}`,
      organization_name: org,
    };
  }).filter((workspace): workspace is VirseWorkspace => Boolean(workspace));
  if (bracketRows.length > 0) return bracketRows;

  const spaceMatches = [...normalized.matchAll(/(?:["'`*]{0,2}space_id["'`*]{0,2})\s*[:=]\s*["'`]*([^\s,|"'`]+)/gi)];
  return spaceMatches.map((match, index) => {
    const start = match.index || 0;
    const nextStart = spaceMatches[index + 1]?.index ?? normalized.length;
    const block = normalized.slice(Math.max(0, start - 160), nextStart);
    const canvasId = fieldFromText(block, 'canvas_id');
    const nameMatch = block.match(/(?:name|workspace_name|space_name)\s*[:=]\s*["'`]*([^\n,|"'`]+)/i);
    return {
      space_id: match[1],
      canvas_id: canvasId,
      name: nameMatch?.[1]?.trim() || `Virse 工作区 ${index + 1}`,
    };
  }).filter((workspace) => workspace.space_id && workspace.canvas_id);
};

const looksLikeModelId = (value: string): boolean => (
  value.length >= 3 &&
  /[a-z]/i.test(value) &&
  !/^https?:/i.test(value) &&
  !/^\d+(?:\.\d+)?[kK]?$/.test(value) &&
  !/^\d+:\d+$/.test(value)
);

const parseModelText = (value: unknown): VirseImageModel[] => {
  if (typeof value !== 'string') return [];
  const ids = new Set<string>();
  const models: VirseImageModel[] = [];
  const addModel = (id: string, name?: string) => {
    const cleanId = id.trim().replace(/^[`*'"-]+|[`*'",]+$/g, '');
    if (!looksLikeModelId(cleanId) || ids.has(cleanId)) return;
    ids.add(cleanId);
    models.push({ id: cleanId, name: name?.trim() || cleanId });
  };

  for (const line of value.replace(/\\n/g, '\n').split(/\r?\n/)) {
    const bracketModel = line.match(/^\s*\[([^\]]+)\]\s+(.+?)\s{2,}\((.+)\)\s*$/);
    if (bracketModel) {
      const cleanId = bracketModel[1].trim();
      if (looksLikeModelId(cleanId) && !ids.has(cleanId)) {
        ids.add(cleanId);
        models.push({ id: cleanId, name: bracketModel[2].trim(), provider: bracketModel[3].trim() });
      }
      continue;
    }
    const explicitId = line.match(/(?:model_id|model id|id)\s*[:=]\s*[`'"*]*([^\s,|`'"*]+)/i)?.[1];
    if (explicitId) {
      const displayName = line.match(/(?:display_name|name)\s*[:=]\s*[`'"*]*([^,|`'"*]+)/i)?.[1];
      addModel(explicitId, displayName);
      continue;
    }
    const backticks = [...line.matchAll(/`([^`]+)`/g)].map((match) => match[1]);
    const likelyBacktickId = backticks.find((candidate) => looksLikeModelId(candidate) && /[-_.]/.test(candidate));
    if (likelyBacktickId) {
      const label = line.replace(/\|/g, ' ').replace(/`[^`]+`/g, '').replace(/^\s*[-*#]+\s*/, '').trim();
      addModel(likelyBacktickId, label || likelyBacktickId);
      continue;
    }
    const bulletId = line.match(/^\s*[-*]\s+([a-z][a-z0-9_.-]{2,})\b/i)?.[1];
    if (bulletId && /[-_.]/.test(bulletId)) addModel(bulletId);
  }
  return models;
};

export const getVirseAccount = (apiKey: string, baseUrl: string) => callVirse<Record<string, any>>(apiKey, baseUrl, 'get_account');

// Never fall back to the first canvas: that can send a job to an unrelated project.
export const findVirseWorkspace = (workspaces: VirseWorkspace[], spaceId: string, canvasId: string) => (
  workspaces.find((workspace) => workspace.space_id === spaceId && workspace.canvas_id === canvasId)
);

export const getVirseWorkspaceDiagnostic = async (apiKey: string, baseUrl: string) => {
  const read = async (body: Record<string, unknown>) => {
    const response = await fetch('/api/virse', {
      method: 'POST', cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey, baseUrl, ...body }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
    return payload;
  };
  const results = await Promise.allSettled([
    read({ tool: 'list_workspaces', args: {} }),
    read({ operation: 'list_tools' }),
  ]);
  const values = results.map((result) => result.status === 'fulfilled'
    ? result.value : { error: String(result.reason?.message || result.reason) });
  // Diagnostics need the list and tool schemas, never the API key or account profile.
  return JSON.stringify({ endpoint: baseUrl, checked_at: new Date().toISOString(),
    workspaces: values[0], tools: values[1] }, null, 2).split(apiKey).join('[REDACTED]');
};

const isDeletedWorkspace = (value: Record<string, any>): boolean => {
  const flagged = (flag: unknown) => flag === true || flag === 1 || flag === 'true' || flag === '1';
  return ['deleted', 'is_deleted', 'isDeleted', 'trashed', 'is_trashed', 'isTrashed'].some((key) => flagged(value[key]))
    || Boolean(value.deleted_at || value.deletedAt || value.trashed_at || value.trashedAt)
    || /^(deleted|trashed)$/i.test(String(value.status || ''))
    || Boolean(value.canvas && typeof value.canvas === 'object' && isDeletedWorkspace(value.canvas));
};

const canvasUnavailableMessage = (message: string): boolean => {
  // Inspect only the error/summary line, never text inside canvas elements.
  const line = message.trim().split(/\r?\n/, 1)[0];
  return /^(?:error\s*:\s*)?(?:(?:canvas|workspace|space)\b.{0,160}\b(?:not found|does not exist|deleted|access denied|permission denied)|(?:no access|access denied|permission denied|not authorized|not permitted)\b.{0,100}\b(?:canvas|workspace|space)|invalid[_ ](?:canvas|space)[_ ]id\b)/i.test(line)
    || /^(?:错误[：:]\s*)?(?:画布|工作区).{0,100}(?:不存在|已删除|无访问权限)/.test(line);
};

export const isVirseCanvasAvailable = async (apiKey: string, baseUrl: string, canvasId: string): Promise<boolean> => {
  let data: unknown;
  try {
    data = await callVirse<unknown>(apiKey, baseUrl, 'get_canvas', { canvas_id: canvasId });
  } catch (error) {
    if (error instanceof Error && canvasUnavailableMessage(error.message)) return false;
    throw error;
  }
  if (typeof data === 'string') {
    if (canvasUnavailableMessage(data)) return false;
    if (!data.trim() || /^(?:error|failed)\s*:/i.test(data.trim())) throw new Error('Virse 画布校验失败，请重试');
  } else if (data && typeof data === 'object' && !Array.isArray(data)) {
    const result = data as Record<string, any>;
    if (isDeletedWorkspace(result)) return false;
    const code = String(result.error_code || result.code || '').toUpperCase();
    if (/^(?:CANVAS|SPACE|WORKSPACE)_(?:NOT_FOUND|DELETED|ACCESS_DENIED|PERMISSION_DENIED)$/.test(code)) return false;
    const message = String(result.error?.message || result.error || result.message || '');
    if (canvasUnavailableMessage(message)) return false;
    if (result.error || result.success === false || result.status === 0 || result.status === 'error') {
      throw new Error(message || 'Virse 画布校验失败，请重试');
    }
    if (Object.keys(result).length === 0) throw new Error('Virse 未返回画布校验结果，请重试');
  } else if (!Array.isArray(data)) {
    throw new Error('Virse 未返回画布校验结果，请重试');
  }
  // An existing canvas with zero elements is valid.
  return true;
};

export const listVirseWorkspaces = async (apiKey: string, baseUrl: string): Promise<VirseWorkspace[]> => {
  const data = await callVirse<unknown>(apiKey, baseUrl, 'list_workspaces');
  const rows = deepCollectionFrom<Record<string, any>>(data, ['workspaces', 'spaces', 'items', 'data']);
  const structured = rows
    .filter((workspace) => workspace && typeof workspace === 'object' && !isDeletedWorkspace(workspace))
    .map((workspace) => ({
      ...workspace,
      space_id: String(workspace.space_id || workspace.spaceId || workspace.id || ''),
      canvas_id: String(workspace.canvas_id || workspace.canvasId || workspace.canvas?.id || workspace.project_id || ''),
      name: workspace.name || workspace.space_name || workspace.title,
    }))
    .filter((workspace) => workspace.space_id && workspace.canvas_id);
  // An all-deleted structured list must remain empty, including JSON text payloads.
  const workspaces = rows.length > 0 ? structured : parseWorkspaceText(data);
  const unique = workspaces.filter((workspace, index) => workspaces.findIndex((other) => (
    other.space_id === workspace.space_id && other.canvas_id === workspace.canvas_id
  )) === index);
  const available: boolean[] = [];
  // Bound concurrency and preserve the server's order. Every sync rechecks every
  // canvas, since list_workspaces can retain deleted Spaces without a marker.
  for (let index = 0; index < unique.length; index += 3) {
    available.push(...await Promise.all(unique.slice(index, index + 3).map(async (workspace) => {
      try {
        return await isVirseCanvasAvailable(apiKey, baseUrl, workspace.canvas_id);
      } catch (error) {
        const reason = error instanceof Error ? error.message : '查询失败';
        throw new Error(`无法核实画布「${workspace.name || workspace.canvas_id}」：${reason}。请重新测试并同步。`);
      }
    })));
  }
  return unique.filter((_, index) => available[index]);
};

export const listVirseImageModels = async (apiKey: string, baseUrl: string): Promise<VirseImageModel[]> => {
  const data = await callVirse<unknown>(apiKey, baseUrl, 'list_image_models');
  const rawModels = deepCollectionFrom<Record<string, any>>(data, ['models', 'image_models', 'items', 'data']);
  const structured = rawModels.map((model) => ({
    ...model,
    id: String(model.id || model.model_id || model.slug || model.name || ''),
    name: model.name || model.display_name || model.id || model.model_id,
  })).filter((model) => model.id);
  return structured.length > 0 ? structured : parseModelText(data);
};
