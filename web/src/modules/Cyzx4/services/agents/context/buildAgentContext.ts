import type { CanvasElement, ChatMessage } from '../../../types';
import type {
  ActiveAgentTask,
  AgentContextAsset,
  AgentContextMessage,
  GenerationPlan,
  LastAgentResult,
  ProductAnalysis,
} from '../../../stores/useAgentContextStore';

const MAX_MESSAGES = 20;
const MAX_CANVAS_ELEMENTS = 100;
const MAX_MESSAGE_CHARS = 12_000;

export interface BuildAgentContextInput {
  workspaceId: string;
  messages: Array<ChatMessage | AgentContextMessage>;
  assets: AgentContextAsset[];
  productAnalysis: ProductAnalysis | null;
  generationPlan: GenerationPlan | null;
  activeTask: ActiveAgentTask | null;
  lastAgentResult: LastAgentResult | null;
  canvasElements: CanvasElement[];
}

export interface AgentContext {
  workspace: { id: string };
  conversation: { messages: AgentContextMessage[] };
  assets: {
    items: AgentContextAsset[];
    byRole: Partial<Record<AgentContextAsset['role'], AgentContextAsset[]>>;
  };
  product: { analysis: ProductAnalysis | null };
  generation: {
    prompt: string;
    negativePrompt?: string;
    agentId?: GenerationPlan['agentId'];
    model?: string;
    aspectRatio?: string;
    imageSize?: string;
    count: number;
    status?: GenerationPlan['status'];
    referenceImageIds: string[];
    referenceAssets: AgentContextAsset[];
    updatedAt?: number;
  };
  activeTask: ActiveAgentTask | null;
  previousResult: LastAgentResult | null;
  canvas: {
    count: number;
    elements: Array<{
      id: string;
      type: string;
      url?: string;
      text?: string;
      prompt?: string;
      x: number;
      y: number;
      width: number;
      height: number;
      zIndex: number;
    }>;
  };
}

const normalizeMessage = (
  message: ChatMessage | AgentContextMessage,
): AgentContextMessage => {
  const content = 'content' in message && typeof message.content === 'string'
    ? message.content
    : 'text' in message && typeof message.text === 'string'
      ? message.text
      : '';
  const assetIds = 'assetIds' in message && Array.isArray(message.assetIds)
    ? message.assetIds
    : undefined;
  return {
    id: String(message.id),
    role: String(message.role || 'user'),
    content: content.trim().slice(0, MAX_MESSAGE_CHARS),
    timestamp: Number(message.timestamp || Date.now()),
    ...(assetIds?.length ? { assetIds } : {}),
  };
};

const groupAssetsByRole = (
  assets: AgentContextAsset[],
): AgentContext['assets']['byRole'] => assets.reduce<AgentContext['assets']['byRole']>(
  (result, asset) => {
    result[asset.role] = [...(result[asset.role] || []), asset];
    return result;
  },
  {},
);

export function buildAgentContext(input: BuildAgentContextInput): AgentContext {
  const messages = input.messages
    .slice(-MAX_MESSAGES)
    .map(normalizeMessage)
    .filter((message) => Boolean(message.content) || Boolean(message.assetIds?.length));
  const assets = input.assets.filter(
    (asset) => Boolean(asset.id && asset.url && asset.type && asset.role),
  );
  const referenceImageIds = Array.from(
    new Set(input.generationPlan?.referenceImageIds || []),
  );
  const assetMap = new Map(assets.map((asset) => [asset.id, asset]));
  const referenceAssets = referenceImageIds
    .map((id) => assetMap.get(id))
    .filter((asset): asset is AgentContextAsset => Boolean(asset))
    .filter((asset) => asset.type === 'image');
  const canvasElements = input.canvasElements
    .slice(-MAX_CANVAS_ELEMENTS)
    .map((element) => ({
      id: element.id,
      type: element.type,
      url: element.url || element.originalUrl,
      text: element.text,
      prompt: element.genPrompt || element.prompt,
      x: element.x,
      y: element.y,
      width: element.width,
      height: element.height,
      zIndex: element.zIndex,
    }));

  return {
    workspace: { id: input.workspaceId },
    conversation: { messages },
    assets: { items: assets, byRole: groupAssetsByRole(assets) },
    product: { analysis: input.productAnalysis },
    generation: {
      prompt: input.generationPlan?.prompt?.trim() || '',
      negativePrompt: input.generationPlan?.negativePrompt,
      agentId: input.generationPlan?.agentId,
      model: input.generationPlan?.model,
      aspectRatio: input.generationPlan?.aspectRatio,
      imageSize: input.generationPlan?.imageSize,
      count: Math.max(1, input.generationPlan?.count || 1),
      status: input.generationPlan?.status,
      referenceImageIds,
      referenceAssets,
      updatedAt: input.generationPlan?.updatedAt,
    },
    activeTask: input.activeTask,
    previousResult: input.lastAgentResult,
    canvas: { count: input.canvasElements.length, elements: canvasElements },
  };
}
