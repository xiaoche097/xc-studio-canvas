import { z } from 'zod';
import type { HarnessToolDefinition } from './tool-catalog';
import {
  DEEPSEEK_AUTO_MODEL,
  DEEPSEEK_FLASH_MODEL,
  selectDeepSeekModel,
  type DeepSeekRouteReason,
} from '../../deepseek-model-router';
import { buildDeepSeekProxyPayload } from '../../deepseek-proxy-payload';

const runtimeConfigSchema = z.object({
  model: z.string().min(1),
  reasoningEffort: z.enum(['off', 'low', 'high', 'max']).default('high'),
  maxTokens: z.number().int().positive().max(262_144).default(32_768),
  firstByteTimeoutMs: z.number().int().positive().max(180_000).default(45_000),
  idleTimeoutMs: z.number().int().positive().max(900_000).default(300_000),
});

export type DeepSeekRuntimeConfig = z.infer<typeof runtimeConfigSchema>;

export type DeepSeekContent = string | Array<
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }
>;

export interface DeepSeekMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: DeepSeekContent | null;
  reasoning_content?: string;
  tool_call_id?: string;
  tool_calls?: DeepSeekToolCall[];
}

export const deepSeekToolCallSchema = z.object({
  id: z.string().min(1),
  type: z.literal('function').default('function'),
  function: z.object({
    name: z.string().min(1),
    arguments: z.string(),
  }),
});

export type DeepSeekToolCall = z.infer<typeof deepSeekToolCallSchema>;

export type DeepSeekStreamEvent =
  | { type: 'model-route'; model: string; reason: DeepSeekRouteReason }
  | { type: 'reasoning-delta'; text: string }
  | { type: 'text-delta'; text: string }
  | { type: 'tool-call-delta'; index: number; name?: string; argumentsDelta: string }
  | { type: 'usage'; inputTokens: number; outputTokens: number; cacheReadTokens?: number; reasoningTokens?: number }
  | { type: 'finish'; reason: string };

export interface DeepSeekAssistantTurn {
  content: string;
  reasoningContent: string;
  toolCalls: DeepSeekToolCall[];
  finishReason: string;
  usage?: Extract<DeepSeekStreamEvent, { type: 'usage' }>;
  model: string;
  routeReason: DeepSeekRouteReason;
}

export const getDeepSeekRuntimeConfig = (): DeepSeekRuntimeConfig => {
  const raw = {
    model: DEEPSEEK_AUTO_MODEL,
    reasoningEffort: localStorage.getItem('deepseek_reasoning_effort') || 'high',
    maxTokens: Number.parseInt(localStorage.getItem('deepseek_max_tokens') || '32768', 10),
    firstByteTimeoutMs: Number.parseInt(localStorage.getItem('deepseek_first_byte_timeout_ms') || '45000', 10),
    idleTimeoutMs: Number.parseInt(localStorage.getItem('deepseek_stream_idle_timeout_ms') || '300000', 10),
  };
  return runtimeConfigSchema.parse(raw);
};

const parseProxyError = async (response: Response): Promise<Error> => {
  const raw = await response.text().catch(() => '');
  try {
    const parsed = JSON.parse(raw);
    return new Error(parsed?.error?.message || parsed?.error || `DeepSeek API error ${response.status}`);
  } catch {
    return new Error(raw || `DeepSeek API error ${response.status}`);
  }
};

async function* parseSse(stream: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let sawDone = false;

  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
      const events = buffer.split(/\r?\n\r?\n/);
      buffer = events.pop() || '';

      for (const event of events) {
        const data = event
          .split(/\r?\n/)
          .filter(line => line.startsWith('data:'))
          .map(line => line.slice(5).trimStart())
          .join('\n');
        if (!data) continue;
        yield data;
        if (data === '[DONE]') {
          sawDone = true;
          return;
        }
      }
      if (done) break;
    }
  } finally {
    reader.releaseLock();
  }

  if (!sawDone) throw new Error('DeepSeek SSE stream ended before [DONE].');
}

const createIdleSignal = (
  upstream: AbortSignal | undefined,
  firstByteTimeoutMs: number,
  idleTimeoutMs: number,
) => {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  const pulse = () => {
    clearTimeout(timer);
    timer = setTimeout(
      () => controller.abort(new Error('DeepSeek stream idle timeout.')),
      idleTimeoutMs,
    );
  };
  timer = setTimeout(
    () => controller.abort(new Error('DeepSeek first response byte timeout.')),
    firstByteTimeoutMs,
  );
  const signal = upstream ? AbortSignal.any([upstream, controller.signal]) : controller.signal;
  return { signal, pulse, dispose: () => clearTimeout(timer) };
};

export const streamDeepSeekTurn = async (options: {
  messages: DeepSeekMessage[];
  tools: HarnessToolDefinition[];
  signal?: AbortSignal;
  onEvent?: (event: DeepSeekStreamEvent) => void;
}): Promise<DeepSeekAssistantTurn> => {
  const config = getDeepSeekRuntimeConfig();
  const hasImages = options.messages.some((message) => (
    Array.isArray(message.content)
    && message.content.some((part) => part.type === 'image_url')
  ));
  const routingText = options.messages.filter((message) => message.role === 'user').map((message) => (
    typeof message.content === 'string'
      ? message.content
      : (message.content || []).filter((part) => part.type === 'text').map((part) => part.text).join('\n')
  )).join('\n');
  const route = selectDeepSeekModel({
    hasImages,
    hasTools: options.tools.length > 0,
    text: routingText,
  });
  options.onEvent?.({ type: 'model-route', model: route.model, reason: route.reason });
  const watchdog = createIdleSignal(options.signal, config.firstByteTimeoutMs, config.idleTimeoutMs);
  const request: Record<string, unknown> = {
    model: route.model,
    messages: options.messages,
    stream: true,
    stream_options: { include_usage: true },
    max_tokens: config.maxTokens,
  };
  if (options.tools.length > 0) {
    request.tools = options.tools;
    request.tool_choice = 'auto';
  }
  if (config.reasoningEffort === 'off') {
    request.thinking = { type: 'disabled' };
  } else {
    request.reasoning_effort = config.reasoningEffort;
  }

  let response: Response;
  try {
    response = await fetch('/api/deepseek/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildDeepSeekProxyPayload(request)),
      signal: watchdog.signal,
    });
  } catch (error) {
    watchdog.dispose();
    if (watchdog.signal.aborted) throw watchdog.signal.reason || error;
    throw error;
  }

  if (!response.ok) {
    watchdog.dispose();
    throw await parseProxyError(response);
  }
  if (!response.body) {
    watchdog.dispose();
    throw new Error('DeepSeek API returned no response body.');
  }

  let content = '';
  let reasoningContent = '';
  let finishReason = 'stop';
  let usage: DeepSeekAssistantTurn['usage'];
  const toolCalls = new Map<number, { id: string; name: string; arguments: string }>();

  try {
    for await (const payload of parseSse(response.body)) {
      watchdog.pulse();
      if (payload === '[DONE]') break;
      let chunk: any;
      try {
        chunk = JSON.parse(payload);
      } catch {
        throw new Error(`Malformed DeepSeek SSE payload: ${payload.slice(0, 120)}`);
      }

      for (const choice of chunk.choices || []) {
        const delta = choice.delta || {};
        if (typeof delta.reasoning_content === 'string' && delta.reasoning_content) {
          reasoningContent += delta.reasoning_content;
          options.onEvent?.({ type: 'reasoning-delta', text: delta.reasoning_content });
        }
        if (typeof delta.content === 'string' && delta.content) {
          content += delta.content;
          options.onEvent?.({ type: 'text-delta', text: delta.content });
        }
        for (const incoming of delta.tool_calls || []) {
          const index = Number.isInteger(incoming.index) ? incoming.index : toolCalls.size;
          const current = toolCalls.get(index) || { id: '', name: '', arguments: '' };
          if (typeof incoming.id === 'string') current.id = incoming.id;
          if (typeof incoming.function?.name === 'string' && incoming.function.name) {
            current.name = incoming.function.name;
          }
          const argumentsDelta = typeof incoming.function?.arguments === 'string'
            ? incoming.function.arguments
            : '';
          current.arguments += argumentsDelta;
          toolCalls.set(index, current);
          options.onEvent?.({
            type: 'tool-call-delta',
            index,
            ...(current.name ? { name: current.name } : {}),
            argumentsDelta,
          });
        }
        if (typeof choice.finish_reason === 'string') finishReason = choice.finish_reason;
      }

      if (chunk.usage) {
        const cacheReadTokens = chunk.usage.prompt_cache_hit_tokens
          ?? chunk.usage.prompt_tokens_details?.cached_tokens;
        const reasoningTokens = chunk.usage.completion_tokens_details?.reasoning_tokens;
        usage = {
          type: 'usage',
          inputTokens: Math.max(0, Number(chunk.usage.prompt_tokens || 0) - Number(cacheReadTokens || 0)),
          outputTokens: Number(chunk.usage.completion_tokens || 0),
          ...(cacheReadTokens != null ? { cacheReadTokens: Number(cacheReadTokens) } : {}),
          ...(reasoningTokens != null ? { reasoningTokens: Number(reasoningTokens) } : {}),
        };
        options.onEvent?.(usage);
      }
    }
  } finally {
    watchdog.dispose();
  }

  const parsedToolCalls = Array.from(toolCalls.entries())
    .sort(([a], [b]) => a - b)
    .map(([index, call]) => deepSeekToolCallSchema.parse({
      id: call.id || `deepseek-call-${index}-${Date.now()}`,
      type: 'function',
      function: { name: call.name, arguments: call.arguments || '{}' },
    }));
  options.onEvent?.({ type: 'finish', reason: finishReason });

  if (!content && !reasoningContent && parsedToolCalls.length === 0) {
    throw new Error('DeepSeek returned an empty response.');
  }
  return {
    content,
    reasoningContent,
    toolCalls: parsedToolCalls,
    finishReason,
    usage,
    model: route.model,
    routeReason: route.reason,
  };
};

export const testDeepSeekConnection = async (input?: {
  baseUrl?: string;
  apiKey?: string;
}): Promise<string> => {
  const config = runtimeConfigSchema.parse({
    model: DEEPSEEK_FLASH_MODEL,
    reasoningEffort: 'off',
    maxTokens: 32,
    firstByteTimeoutMs: 30_000,
    idleTimeoutMs: 30_000,
  });
  const response = await fetch('/api/deepseek/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildDeepSeekProxyPayload({
        model: DEEPSEEK_FLASH_MODEL,
        messages: [{ role: 'user', content: 'Reply with OK only.' }],
        stream: false,
        max_tokens: 32,
        thinking: { type: 'disabled' },
      }, input)),
  });
  if (!response.ok) throw await parseProxyError(response);
  const data = await response.json();
  return String(data?.choices?.[0]?.message?.content || '').trim();
};
