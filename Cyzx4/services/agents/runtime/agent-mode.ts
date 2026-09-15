import { z } from 'zod';

export const agentWorkModeSchema = z.enum(['craft', 'plan', 'ask']);
export type AgentWorkMode = z.infer<typeof agentWorkModeSchema>;

export const AGENT_MODE_STORAGE_KEY = 'xcai_agent_mode';
export const AGENT_MODE_CHANGE_EVENT = 'xcai:agent-mode-change';

export const resolveAgentWorkMode = (value: unknown): AgentWorkMode | undefined => {
  if (value === 'default') return 'craft';
  if (value === 'chat') return 'ask';
  const parsed = agentWorkModeSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
};

export const readStoredAgentWorkMode = (): AgentWorkMode => {
  if (typeof window === 'undefined') return 'craft';
  return resolveAgentWorkMode(window.localStorage.getItem(AGENT_MODE_STORAGE_KEY)) || 'craft';
};

export const persistAgentWorkMode = (mode: AgentWorkMode, announce = true): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(AGENT_MODE_STORAGE_KEY, mode);
  } catch {
    // The in-memory UI state remains authoritative for this page lifetime.
  }
  if (announce) {
    window.dispatchEvent(new CustomEvent(AGENT_MODE_CHANGE_EVENT, { detail: { mode } }));
  }
};

export const subscribeAgentWorkMode = (listener: (mode: AgentWorkMode) => void): (() => void) => {
  if (typeof window === 'undefined') return () => undefined;
  const handleModeChange = (event: Event) => {
    const mode = resolveAgentWorkMode((event as CustomEvent<{ mode?: unknown }>).detail?.mode);
    if (mode) listener(mode);
  };
  const handleStorage = (event: StorageEvent) => {
    if (event.key !== AGENT_MODE_STORAGE_KEY) return;
    const mode = resolveAgentWorkMode(event.newValue);
    if (mode) listener(mode);
  };
  window.addEventListener(AGENT_MODE_CHANGE_EVENT, handleModeChange);
  window.addEventListener('storage', handleStorage);
  return () => {
    window.removeEventListener(AGENT_MODE_CHANGE_EVENT, handleModeChange);
    window.removeEventListener('storage', handleStorage);
  };
};

/**
 * Only high-confidence, affirmative commands may leave Plan/Ask automatically.
 * Questions such as “可以怎么做？” deliberately do not match.
 */
export const hasExplicitCraftIntent = (message: string): boolean => {
  const normalized = String(message || '').trim();
  if (!normalized || /(?:吗|么|呢|如何|怎么|是否|能不能|可不可以)[？?]?$/u.test(normalized)) return false;

  return [
    /(?:我觉得)?(?:已经)?(?:没问题|确认(?:没问题)?)[了，,。!！\s]*(?:可以)?(?:开始)?(?:做|制作|生成|执行)(?:了|吧)?/u,
    /^(?:好|好的|行|可以|没问题|确认)?[，,。!！\s]*(?:开始|开做)(?:执行|制作|生成|做)?(?:吧|了)?[。!！\s]*$/u,
    /^(?:好|好的|行|可以|没问题|确认)?[，,。!！\s]*(?:帮我做|帮我制作|帮我生成|执行吧|生成吧|制作吧|做吧|继续执行|继续做|继续制作|继续生成)[。!！\s]*$/u,
    /^(?:好|好的|行|可以|没问题|确认)?[，,。!！\s]*(?:按|照)(?:这个|上述|刚才的?|该)?(?:方案|计划|思路|方向)(?:来|做|制作|生成|执行)?(?:吧|了)?[。!！\s]*$/u,
    /^(?:好|好的|行|可以|没问题|确认)?[，,。!！\s]*(?:就这样(?:做|制作|生成|执行)|可以(?:开始)?(?:做|制作|生成|执行))(?:吧|了)?[。!！\s]*$/u,
    /^(?:ok(?:ay)?[,!\s]*)?(?:go ahead|proceed|start|execute|make it|build it)(?: now)?[.!\s]*$/i,
  ].some((pattern) => pattern.test(normalized));
};

export const resolveTurnAgentMode = (
  requestedMode: unknown,
  message: string,
): { mode: AgentWorkMode; transitionedFrom?: 'plan' | 'ask' } => {
  const current = resolveAgentWorkMode(requestedMode) || 'craft';
  if (current !== 'craft' && hasExplicitCraftIntent(message)) {
    return { mode: 'craft', transitionedFrom: current };
  }
  return { mode: current };
};
