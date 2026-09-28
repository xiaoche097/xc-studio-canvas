import { z } from 'zod';
import {
  agentWorkModeSchema,
  resolveAgentWorkMode,
  type AgentWorkMode,
} from './agent-mode';

export const harnessAgentModeSchema = agentWorkModeSchema;
export type HarnessAgentMode = AgentWorkMode;

const STORAGE_PREFIX = 'xcai:hermes-session:v1:';
const MAX_EVENTS = 320;
const KEEP_RECENT_EVENTS = 180;

export interface DurableHarnessEvent {
  seq: number;
  type: string;
  at: number;
  data: Record<string, unknown>;
}

interface DurableHarnessState {
  version: 1;
  sessionId: string;
  mode: HarnessAgentMode;
  nextSeq: number;
  summary: string;
  events: DurableHarnessEvent[];
  plan?: {
    title: string;
    items: Array<{ text: string; status: 'pending' | 'in_progress' | 'completed' }>;
    updatedAt: number;
  };
}

const planItemSchema = z.object({
  text: z.string().trim().min(1).max(500),
  status: z.enum(['pending', 'in_progress', 'completed']),
});

const persistedStateSchema = z.object({
  version: z.literal(1),
  sessionId: z.string(),
  mode: harnessAgentModeSchema,
  nextSeq: z.number().int().positive(),
  summary: z.string(),
  events: z.array(z.object({
    seq: z.number().int().positive(),
    type: z.string(),
    at: z.number(),
    data: z.record(z.string(), z.unknown()),
  })),
  plan: z.object({
    title: z.string(),
    items: z.array(planItemSchema),
    updatedAt: z.number(),
  }).optional(),
});

const cleanSessionId = (value: string): string => (
  value.trim().replace(/[^a-zA-Z0-9._:-]/g, '-').slice(0, 160) || 'anonymous'
);

const safeText = (value: unknown, limit = 1200): string => (
  String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, limit)
);

const summarizeEvents = (events: DurableHarnessEvent[]): string => {
  const lines = events
    .filter((event) => event.type === 'user/message' || event.type === 'assistant/message')
    .slice(-12)
    .map((event) => `${event.type === 'user/message' ? 'User' : 'Assistant'}: ${safeText(event.data.text, 320)}`)
    .filter((line) => !line.endsWith(': '));
  return lines.join('\n').slice(0, 4_800);
};

const initialState = (sessionId: string, mode: HarnessAgentMode): DurableHarnessState => ({
  version: 1,
  sessionId,
  mode,
  nextSeq: 1,
  summary: '',
  events: [],
});

/** Browser-side durable event log mirroring the replay-first Hermes session model. */
export class BrowserHarnessSession {
  private state: DurableHarnessState;
  private readonly storageKey: string;

  constructor(sessionId: string, requestedMode?: HarnessAgentMode) {
    const normalizedId = cleanSessionId(sessionId);
    this.storageKey = `${STORAGE_PREFIX}${normalizedId}`;
    this.state = this.load(normalizedId, requestedMode ?? 'craft');
    if (requestedMode && requestedMode !== this.state.mode) this.setMode(requestedMode);
  }

  private load(sessionId: string, fallbackMode: HarnessAgentMode): DurableHarnessState {
    if (typeof window === 'undefined') return initialState(sessionId, fallbackMode);
    try {
      const raw = window.localStorage.getItem(this.storageKey);
      if (!raw) return initialState(sessionId, fallbackMode);
      const stored = JSON.parse(raw);
      return persistedStateSchema.parse({
        ...stored,
        mode: resolveAgentWorkMode(stored?.mode) || fallbackMode,
      });
    } catch {
      return initialState(sessionId, fallbackMode);
    }
  }

  private persist(): void {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(this.storageKey, JSON.stringify(this.state));
    } catch {
      // The in-memory log remains authoritative for the current page lifetime.
    }
  }

  private compactIfNeeded(): void {
    if (this.state.events.length <= MAX_EVENTS) return;
    const removed = this.state.events.slice(0, -KEEP_RECENT_EVENTS);
    const nextSummary = summarizeEvents(removed);
    this.state.summary = [this.state.summary, nextSummary].filter(Boolean).join('\n').slice(-8_000);
    this.state.events = this.state.events.slice(-KEEP_RECENT_EVENTS);
    const compacted: DurableHarnessEvent = {
      seq: this.state.nextSeq++,
      type: 'context/compacted',
      at: Date.now(),
      data: { removedEvents: removed.length, summary: this.state.summary },
    };
    this.state.events.unshift(compacted);
  }

  get mode(): HarnessAgentMode {
    return this.state.mode;
  }

  get summary(): string {
    return this.state.summary;
  }

  get events(): readonly DurableHarnessEvent[] {
    return this.state.events;
  }

  get plan(): DurableHarnessState['plan'] {
    return this.state.plan;
  }

  setMode(mode: HarnessAgentMode): void {
    if (mode === this.state.mode) return;
    this.state.mode = mode;
    this.append('agent/mode', { mode });
  }

  updatePlan(input: unknown): DurableHarnessState['plan'] {
    const parsed = z.object({
      title: z.string().trim().min(1).max(200),
      items: z.array(planItemSchema).min(1).max(30),
    }).parse(input);
    this.state.plan = { ...parsed, updatedAt: Date.now() };
    this.append('todo/write', this.state.plan);
    return this.state.plan;
  }

  append(type: string, data: Record<string, unknown> = {}): DurableHarnessEvent {
    const event: DurableHarnessEvent = {
      seq: this.state.nextSeq++,
      type,
      at: Date.now(),
      data,
    };
    this.state.events.push(event);
    this.compactIfNeeded();
    this.persist();
    return event;
  }
}

export const resolveHarnessMode = (value: unknown): HarnessAgentMode | undefined => {
  return resolveAgentWorkMode(value);
};

/** Removes the durable browser event log associated with a deleted conversation. */
export const deleteBrowserHarnessSession = (sessionId: string): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(`${STORAGE_PREFIX}${cleanSessionId(sessionId)}`);
  } catch {
    // Project deletion remains authoritative when browser storage is unavailable.
  }
};
