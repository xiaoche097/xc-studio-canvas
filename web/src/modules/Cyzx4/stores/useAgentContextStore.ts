import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { AgentType, TaskStatus } from '../types/agent.types';
import { safeLocalStorageStateStorage } from '../utils/safe-storage';

export type AgentIntent =
  | 'NEW_TASK'
  | 'UPDATE_CURRENT_PLAN'
  | 'EXECUTE_CURRENT_PLAN'
  | 'REGENERATE';

export type AgentAssetRole =
  | 'product'
  | 'model'
  | 'scene'
  | 'style'
  | 'reference'
  | 'result';

export type AgentAssetType = 'image' | 'video' | 'text';

export interface AgentContextMessage {
  id: string;
  role: string;
  content: string;
  timestamp: number;
  assetIds?: string[];
}

export interface AgentContextAsset {
  id: string;
  role: AgentAssetRole;
  type: AgentAssetType;
  name: string;
  url: string;
  analysis?: unknown;
  createdAt?: number;
}

export interface ProductAnalysis {
  category?: string;
  title?: string;
  summary?: string;
  features?: string[];
  colors?: string[];
  materials?: string[];
  audience?: string[];
  constraints?: string[];
  raw?: unknown;
}

export interface GenerationPlan {
  prompt: string;
  negativePrompt?: string;
  agentId?: AgentType;
  model?: string;
  aspectRatio?: string;
  imageSize?: string;
  count?: number;
  referenceImageIds: string[];
  status?: 'draft' | 'approved' | 'executing' | 'completed';
  updatedAt: number;
}

export interface ActiveAgentTask {
  id: string;
  agentId?: AgentType;
  intent: AgentIntent;
  message: string;
  status: TaskStatus;
  updatedAt: number;
}

export interface LastAgentResult {
  taskId: string;
  agentId?: AgentType;
  status: TaskStatus;
  message: string;
  assetIds: string[];
  imageUrls: string[];
  updatedAt: number;
}

interface AgentContextData {
  workspaceId: string | null;
  messages: AgentContextMessage[];
  assets: AgentContextAsset[];
  productAnalysis: ProductAnalysis | null;
  generationPlan: GenerationPlan | null;
  activeTask: ActiveAgentTask | null;
  lastAgentResult: LastAgentResult | null;
}

interface AgentContextActions {
  setWorkspaceId: (workspaceId: string | null) => void;
  setMessages: (messages: AgentContextMessage[]) => void;
  addMessage: (message: AgentContextMessage) => void;
  setAssets: (assets: AgentContextAsset[]) => void;
  addAsset: (asset: AgentContextAsset) => void;
  setProductAnalysis: (analysis: ProductAnalysis | null) => void;
  setGenerationPlan: (plan: GenerationPlan | null) => void;
  setActiveTask: (task: ActiveAgentTask | null) => void;
  setLastAgentResult: (result: LastAgentResult | null) => void;
  resetContext: () => void;
}

export type AgentContextStore = AgentContextData & AgentContextActions;

const MAX_PERSISTED_MESSAGES = 100;
const MAX_PERSISTED_ASSETS = 100;

const isPersistableAssetUrl = (url: string): boolean => (
  /^https?:\/\//i.test(url) || url.startsWith('/')
);

const createEmptyContext = (): AgentContextData => ({
  workspaceId: null,
  messages: [],
  assets: [],
  productAnalysis: null,
  generationPlan: null,
  activeTask: null,
  lastAgentResult: null,
});

export const useAgentContextStore = create<AgentContextStore>()(
  persist(
    (set) => ({
      ...createEmptyContext(),

      setWorkspaceId: (workspaceId) => set((state) => {
        if (state.workspaceId === workspaceId) return { workspaceId };
        return { ...createEmptyContext(), workspaceId };
      }),

      setMessages: (messages) => set({
        messages: messages.slice(-MAX_PERSISTED_MESSAGES),
      }),

      addMessage: (message) => set((state) => ({
        messages: [...state.messages, message].slice(-MAX_PERSISTED_MESSAGES),
      })),

      setAssets: (assets) => set({
        assets: assets.slice(-MAX_PERSISTED_ASSETS),
      }),

      addAsset: (asset) => set((state) => {
        const existingIndex = state.assets.findIndex(
          (item) => item.id === asset.id || item.url === asset.url,
        );
        if (existingIndex < 0) {
          return {
            assets: [...state.assets, asset].slice(-MAX_PERSISTED_ASSETS),
          };
        }
        const assets = [...state.assets];
        assets[existingIndex] = { ...assets[existingIndex], ...asset };
        return { assets: assets.slice(-MAX_PERSISTED_ASSETS) };
      }),

      setProductAnalysis: (productAnalysis) => set({ productAnalysis }),
      setGenerationPlan: (generationPlan) => set({ generationPlan }),
      setActiveTask: (activeTask) => set({ activeTask }),
      setLastAgentResult: (lastAgentResult) => set({ lastAgentResult }),
      resetContext: () => set(createEmptyContext()),
    }),
    {
      name: 'xcai-agent-context-v1',
      version: 1,
      storage: createJSONStorage(() => safeLocalStorageStateStorage),
      partialize: (state) => ({
        workspaceId: state.workspaceId,
        messages: state.messages,
        // Keep data:/blob: payloads in memory only; persisting them can exhaust
        // localStorage and blob URLs cannot survive a page reload anyway.
        assets: state.assets.filter((asset) => isPersistableAssetUrl(asset.url)),
        productAnalysis: state.productAnalysis,
        generationPlan: state.generationPlan,
        activeTask: state.activeTask,
        lastAgentResult: state.lastAgentResult
          ? {
              ...state.lastAgentResult,
              imageUrls: state.lastAgentResult.imageUrls.filter(isPersistableAssetUrl),
            }
          : null,
      }),
    },
  ),
);
