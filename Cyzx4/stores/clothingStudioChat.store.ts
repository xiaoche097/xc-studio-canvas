import { create } from 'zustand';
import type { ClothingStep, Requirements, ModelGenOptions, ClothingAnalysis } from '../types/workflow.types';

export type WorkflowImageItem = {
  id: string;
  url: string;
  name?: string;
};

type ProgressState = {
  done: number;
  total: number;
  text?: string;
};

export type ClothingSessionState = {
  step: ClothingStep;
  productImages: WorkflowImageItem[];
  productAnchorUrl: string | null;
  analysis: ClothingAnalysis | null;
  modelImage: WorkflowImageItem | null;
  modelViews: WorkflowImageItem[];
  modelAnchorSheetUrl: string | null;
  modelCandidates: WorkflowImageItem[];
  requirements: Requirements;
  modelOptions: ModelGenOptions;
  results: Array<{ url: string; label?: string }>;
  failedItems: Array<{ index: number; prompt: string; label?: string }>;
  progress: ProgressState;
  isGenerating: boolean;
  abortController: AbortController | null;
};

interface ClothingStudioChatState {
  sessions: Record<string, ClothingSessionState>;
  activeSessionId: string;

  actions: {
    getSession: (sessionId: string) => ClothingSessionState;
    setActiveSession: (sessionId: string) => void;
    createSession: (sessionId: string) => void;
    deleteSession: (sessionId: string) => void;
    reset: (sessionId?: string) => void;
    setStep: (step: ClothingStep, sessionId?: string) => void;
    addProductImages: (images: WorkflowImageItem[], sessionId?: string) => void;
    setProductAnchorUrl: (url: string | null, sessionId?: string) => void;
    setAnalysis: (analysis: ClothingAnalysis | null, sessionId?: string) => void;
    setModelImage: (image: WorkflowImageItem | null, sessionId?: string) => void;
    setModelViews: (images: WorkflowImageItem[], sessionId?: string) => void;
    setModelAnchorSheetUrl: (url: string | null, sessionId?: string) => void;
    setModelCandidates: (images: WorkflowImageItem[], sessionId?: string) => void;
    setRequirements: (next: Partial<Requirements>, sessionId?: string) => void;
    setModelOptions: (next: Partial<ModelGenOptions>, sessionId?: string) => void;
    setProgress: (next: ProgressState, sessionId?: string) => void;
    setGenerating: (v: boolean, sessionId?: string) => void;
    setResults: (images: Array<{ url: string; label?: string }>, sessionId?: string) => void;
    setFailedItems: (items: Array<{ index: number; prompt: string; label?: string }>, sessionId?: string) => void;
    startAbortSession: (sessionId?: string) => AbortController;
    clearAbortSession: (sessionId?: string) => void;
    cancelGenerating: (sessionId?: string) => void;
  };
}

const DEFAULT_REQUIREMENTS: Requirements = {
  platform: 'taobao',
  description: '标准电商棚拍风格：主体清晰、颜色准确、背景干净，突出面料与版型细节。',
  targetLanguage: 'visual-only',
  aspectRatio: '3:4',
  clarity: '2K',
  count: 1,
  templateId: 'ecom_clean',
  styleTags: [],
  backgroundTags: [],
  cameraTags: [],
  focusTags: [],
  extraText: '',
};

const DEFAULT_MODEL_OPTIONS: ModelGenOptions = {
  gender: '不限',
  ageRange: '18-25岁',
  skinTone: '亚洲人',
  pose: '站立正面',
  expression: '自然微笑',
  hairstyle: '披肩直发',
  makeup: '日常淡妆',
  extra: '',
  count: 1,
};

const createEmptySession = (): ClothingSessionState => ({
  step: 'WAIT_PRODUCT',
  productImages: [],
  productAnchorUrl: null,
  analysis: null,
  modelImage: null,
  modelViews: [],
  modelAnchorSheetUrl: null,
  modelCandidates: [],
  requirements: { ...DEFAULT_REQUIREMENTS },
  modelOptions: { ...DEFAULT_MODEL_OPTIONS },
  results: [],
  failedItems: [],
  progress: { done: 0, total: 0, text: '' },
  isGenerating: false,
  abortController: null,
});

const getOrCreateSession = (
  sessions: Record<string, ClothingSessionState>,
  sessionId: string,
): ClothingSessionState => sessions[sessionId] || createEmptySession();

const EMPTY_SESSION = createEmptySession();

const toId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const useClothingStudioChatStore = create<ClothingStudioChatState>((set, get) => ({
  sessions: {},
  activeSessionId: '',

  actions: {
    getSession: (sessionId: string) => {
      const state = get();
      return state.sessions[sessionId] || createEmptySession();
    },

    setActiveSession: (sessionId: string) => {
      set((state) => {
        const newSessions = { ...state.sessions };
        if (!newSessions[sessionId]) {
          newSessions[sessionId] = createEmptySession();
        }
        return {
          sessions: newSessions,
          activeSessionId: sessionId,
        };
      });
    },

    createSession: (sessionId: string) => {
      set((state) => ({
        sessions: {
          ...state.sessions,
          [sessionId]: createEmptySession(),
        },
      }));
    },

    deleteSession: (sessionId: string) => {
      set((state) => {
        const newSessions = { ...state.sessions };
        delete newSessions[sessionId];
        return {
          sessions: newSessions,
          activeSessionId: state.activeSessionId === sessionId ? '' : state.activeSessionId,
        };
      });
    },

    reset: (sessionId?: string) => {
      const targetId = sessionId || get().activeSessionId;
      if (!targetId) return;
      set((state) => ({
        sessions: {
          ...state.sessions,
          [targetId]: createEmptySession(),
        },
      }));
    },

    setStep: (step: ClothingStep, sessionId?: string) => {
      const targetId = sessionId || get().activeSessionId;
      if (!targetId) return;
      set((state) => {
        const session = getOrCreateSession(state.sessions, targetId);
        return {
          sessions: {
            ...state.sessions,
            [targetId]: { ...session, step },
          },
        };
      });
    },

    addProductImages: (images: WorkflowImageItem[], sessionId?: string) => {
      const targetId = sessionId || get().activeSessionId;
      if (!targetId) return;
      set((state) => {
        const session = state.sessions[targetId] || createEmptySession();
        const merged = [...session.productImages];
        for (const img of images) {
          if (merged.length >= 6) break;
          if (merged.some((p) => p.url === img.url)) continue;
          merged.push({ id: img.id || toId('product'), url: img.url, name: img.name });
        }
        return {
          sessions: {
            ...state.sessions,
            [targetId]: { ...session, productImages: merged },
          },
        };
      });
    },

    setProductAnchorUrl: (url: string | null, sessionId?: string) => {
      const targetId = sessionId || get().activeSessionId;
      if (!targetId) return;
      set((state) => {
        const session = getOrCreateSession(state.sessions, targetId);
        return {
          sessions: {
            ...state.sessions,
            [targetId]: { ...session, productAnchorUrl: url },
          },
        };
      });
    },

    setAnalysis: (analysis: ClothingAnalysis | null, sessionId?: string) => {
      const targetId = sessionId || get().activeSessionId;
      if (!targetId) return;
      set((state) => {
        const session = getOrCreateSession(state.sessions, targetId);
        return {
          sessions: {
            ...state.sessions,
            [targetId]: { ...session, analysis },
          },
        };
      });
    },

    setModelImage: (image: WorkflowImageItem | null, sessionId?: string) => {
      const targetId = sessionId || get().activeSessionId;
      if (!targetId) return;
      set((state) => {
        const session = getOrCreateSession(state.sessions, targetId);
        return {
          sessions: {
            ...state.sessions,
            [targetId]: {
              ...session,
              modelImage: image ? { ...image, id: image.id || toId('model') } : null,
            },
          },
        };
      });
    },

    setModelViews: (images: WorkflowImageItem[], sessionId?: string) => {
      const targetId = sessionId || get().activeSessionId;
      if (!targetId) return;
      set((state) => {
        const session = getOrCreateSession(state.sessions, targetId);
        return {
          sessions: {
            ...state.sessions,
            [targetId]: { ...session, modelViews: images },
          },
        };
      });
    },

    setModelAnchorSheetUrl: (url: string | null, sessionId?: string) => {
      const targetId = sessionId || get().activeSessionId;
      if (!targetId) return;
      set((state) => {
        const session = getOrCreateSession(state.sessions, targetId);
        return {
          sessions: {
            ...state.sessions,
            [targetId]: { ...session, modelAnchorSheetUrl: url },
          },
        };
      });
    },

    setModelCandidates: (images: WorkflowImageItem[], sessionId?: string) => {
      const targetId = sessionId || get().activeSessionId;
      if (!targetId) return;
      set((state) => {
        const session = getOrCreateSession(state.sessions, targetId);
        return {
          sessions: {
            ...state.sessions,
            [targetId]: { ...session, modelCandidates: images },
          },
        };
      });
    },

    setRequirements: (next: Partial<Requirements>, sessionId?: string) => {
      const targetId = sessionId || get().activeSessionId;
      if (!targetId) return;
      set((state) => {
        const session = state.sessions[targetId] || createEmptySession();
        return {
          sessions: {
            ...state.sessions,
            [targetId]: { ...session, requirements: { ...session.requirements, ...next } },
          },
        };
      });
    },

    setModelOptions: (next: Partial<ModelGenOptions>, sessionId?: string) => {
      const targetId = sessionId || get().activeSessionId;
      if (!targetId) return;
      set((state) => {
        const session = state.sessions[targetId] || createEmptySession();
        return {
          sessions: {
            ...state.sessions,
            [targetId]: { ...session, modelOptions: { ...session.modelOptions, ...next } },
          },
        };
      });
    },

    setProgress: (next: ProgressState, sessionId?: string) => {
      const targetId = sessionId || get().activeSessionId;
      if (!targetId) return;
      set((state) => {
        const session = getOrCreateSession(state.sessions, targetId);
        return {
          sessions: {
            ...state.sessions,
            [targetId]: { ...session, progress: next },
          },
        };
      });
    },

    setGenerating: (v: boolean, sessionId?: string) => {
      const targetId = sessionId || get().activeSessionId;
      if (!targetId) return;
      set((state) => {
        const session = getOrCreateSession(state.sessions, targetId);
        return {
          sessions: {
            ...state.sessions,
            [targetId]: { ...session, isGenerating: v },
          },
        };
      });
    },

    setResults: (images: Array<{ url: string; label?: string }>, sessionId?: string) => {
      const targetId = sessionId || get().activeSessionId;
      if (!targetId) return;
      set((state) => {
        const session = getOrCreateSession(state.sessions, targetId);
        return {
          sessions: {
            ...state.sessions,
            [targetId]: { ...session, results: images },
          },
        };
      });
    },

    setFailedItems: (items: Array<{ index: number; prompt: string; label?: string }>, sessionId?: string) => {
      const targetId = sessionId || get().activeSessionId;
      if (!targetId) return;
      set((state) => {
        const session = getOrCreateSession(state.sessions, targetId);
        return {
          sessions: {
            ...state.sessions,
            [targetId]: { ...session, failedItems: items },
          },
        };
      });
    },

    startAbortSession: (sessionId?: string) => {
      const targetId = sessionId || get().activeSessionId;
      if (!targetId) throw new Error('No active session');
      const state = get();
      const session = state.sessions[targetId] || createEmptySession();
      const prev = session.abortController;
      if (prev) prev.abort();
      const ctrl = new AbortController();
      set((state) => ({
        sessions: {
          ...state.sessions,
          [targetId]: { ...session, abortController: ctrl },
        },
      }));
      return ctrl;
    },

    clearAbortSession: (sessionId?: string) => {
      const targetId = sessionId || get().activeSessionId;
      if (!targetId) return;
      set((state) => {
        const session = getOrCreateSession(state.sessions, targetId);
        return {
          sessions: {
            ...state.sessions,
            [targetId]: { ...session, abortController: null },
          },
        };
      });
    },

    cancelGenerating: (sessionId?: string) => {
      const targetId = sessionId || get().activeSessionId;
      if (!targetId) return;
      const state = get();
      const session = state.sessions[targetId];
      if (!session) return;
      const ctrl = session.abortController;
      if (ctrl) ctrl.abort();
      set((state) => ({
        sessions: {
          ...state.sessions,
          [targetId]: { ...session, isGenerating: false, abortController: null },
        },
      }));
    },
  },
}));

export const useClothingState = (): ClothingSessionState => {
  const sessions = useClothingStudioChatStore((s) => s.sessions);
  const activeSessionId = useClothingStudioChatStore((s) => s.activeSessionId);
  return sessions[activeSessionId] || EMPTY_SESSION;
};

export const clothingActions = useClothingStudioChatStore.getState().actions;
