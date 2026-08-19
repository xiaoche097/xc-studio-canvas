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

const callVirse = async <T = unknown>(apiKey: string, baseUrl: string, tool: string, args: Record<string, unknown> = {}): Promise<T> => {
  const response = await fetch('/api/virse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey, baseUrl, tool, args }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || `Virse 连接失败（HTTP ${response.status}）`);
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
  // Poll for up to five minutes instead of failing after roughly two minutes.
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (options.signal?.aborted) throw new DOMException('Generation cancelled', 'AbortError');
    await new Promise((resolve) => setTimeout(resolve, 2500));
    const detail = await callVirse<unknown>(options.apiKey, options.baseUrl, 'get_asset_detail', {
      artifact_version_id: artifactVersionId,
    });
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

export const listVirseWorkspaces = async (apiKey: string, baseUrl: string): Promise<VirseWorkspace[]> => {
  const data = await callVirse<unknown>(apiKey, baseUrl, 'list_workspaces');
  const structured = deepCollectionFrom<Record<string, any>>(data, ['workspaces', 'spaces', 'items', 'data'])
    .map((workspace) => ({
      ...workspace,
      space_id: String(workspace.space_id || workspace.spaceId || workspace.id || ''),
      canvas_id: String(workspace.canvas_id || workspace.canvasId || workspace.canvas?.id || workspace.project_id || ''),
      name: workspace.name || workspace.space_name || workspace.title,
    }))
    .filter((workspace) => workspace.space_id && workspace.canvas_id);
  return structured.length > 0 ? structured : parseWorkspaceText(data);
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
