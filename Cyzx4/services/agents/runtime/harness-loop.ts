import { z } from 'zod';
import {
  streamDeepSeekTurn,
  type DeepSeekContent,
  type DeepSeekMessage,
  type DeepSeekStreamEvent,
  type DeepSeekToolCall,
} from './deepseek-adapter';
import type { HarnessToolDefinition } from './tool-catalog';
import { BrowserHarnessSession, type HarnessAgentMode } from './harness-session';

const toolArgumentsSchema = z.record(z.string(), z.unknown());

export type HarnessLoopEvent =
  | { type: 'turn/start'; at: number }
  | { type: 'step/start'; step: number; at: number }
  | { type: 'assistant/reasoning'; step: number; text: string; at: number }
  | { type: 'assistant/message'; step: number; text: string; at: number }
  | { type: 'tool/call'; step: number; callId: string; name: string; arguments: Record<string, unknown>; at: number }
  | { type: 'tool/result'; step: number; callId: string; name: string; success: boolean; content: string; at: number }
  | { type: 'step/end'; step: number; reason: string; at: number }
  | { type: 'turn/end'; reason: 'completed' | 'max-steps' | 'aborted' | 'error'; at: number };

export interface HarnessToolExecution {
  call: DeepSeekToolCall;
  args: Record<string, unknown>;
  success: boolean;
  result?: unknown;
  error?: string;
}

export interface HarnessLoopResult {
  text: string;
  reasoning: string;
  steps: number;
  stopReason: 'completed' | 'max-steps';
  events: HarnessLoopEvent[];
  toolExecutions: HarnessToolExecution[];
  mode: HarnessAgentMode;
  sessionEvents: number;
}

const stringifyToolResult = (execution: HarnessToolExecution): string => {
  if (!execution.success) return `Error: ${execution.error || 'tool execution failed'}`;
  if (typeof execution.result === 'string') return execution.result;
  try {
    return JSON.stringify(execution.result ?? null);
  } catch {
    return String(execution.result ?? 'null');
  }
};

export const runHarnessLoop = async (options: {
  sessionId: string;
  mode?: HarnessAgentMode;
  systemPrompt: string;
  userContent: DeepSeekContent;
  history?: DeepSeekMessage[];
  tools: HarnessToolDefinition[];
  maxSteps?: number;
  maxRequestRetries?: number;
  signal?: AbortSignal;
  executeTools: (calls: Array<{ call: DeepSeekToolCall; args: Record<string, unknown> }>) => Promise<HarnessToolExecution[]>;
  onEvent?: (event: HarnessLoopEvent | DeepSeekStreamEvent) => void;
}): Promise<HarnessLoopResult> => {
  const session = new BrowserHarnessSession(options.sessionId, options.mode);
  const events: HarnessLoopEvent[] = [];
  const toolExecutions: HarnessToolExecution[] = [];
  const emit = (event: HarnessLoopEvent) => {
    events.push(event);
    options.onEvent?.(event);
  };
  const messages: DeepSeekMessage[] = [
    { role: 'system', content: options.systemPrompt },
    ...(options.history || []),
    { role: 'user', content: options.userContent },
  ];
  const maxSteps = Math.max(1, Math.min(options.maxSteps || 8, 16));
  const maxRequestRetries = Math.max(0, Math.min(options.maxRequestRetries ?? 2, 4));
  let finalText = '';
  let allReasoning = '';
  emit({ type: 'turn/start', at: Date.now() });
  session.append('turn/start', { mode: session.mode });
  session.append('request/header', {
    mode: session.mode,
    toolNames: options.tools.map((tool) => tool.function.name),
  });
  session.append('user/message', {
    text: typeof options.userContent === 'string'
      ? options.userContent.slice(0, 4_000)
      : options.userContent.find((block) => block.type === 'text')?.text.slice(0, 4_000) || '',
  });

  try {
    for (let step = 1; step <= maxSteps; step += 1) {
      if (options.signal?.aborted) throw options.signal.reason || new DOMException('Aborted', 'AbortError');
      emit({ type: 'step/start', step, at: Date.now() });
      session.append('step/start', { step });
      let streamedText = '';
      let streamedReasoning = '';
      let turn: Awaited<ReturnType<typeof streamDeepSeekTurn>> | undefined;
      for (let attempt = 0; attempt <= maxRequestRetries; attempt += 1) {
        try {
          turn = await streamDeepSeekTurn({
            messages,
            tools: options.tools,
            signal: options.signal,
            onEvent: event => {
              if (event.type === 'text-delta') streamedText += event.text;
              if (event.type === 'reasoning-delta') streamedReasoning += event.text;
              options.onEvent?.(event);
            },
          });
          break;
        } catch (error) {
          session.append('agent/request-error', {
            step,
            attempt: attempt + 1,
            message: error instanceof Error ? error.message.slice(0, 800) : String(error).slice(0, 800),
          });
          if (attempt >= maxRequestRetries || options.signal?.aborted) throw error;
          await new Promise<void>((resolve, reject) => {
            const timer = setTimeout(resolve, Math.min(4000, 500 * (2 ** attempt)));
            options.signal?.addEventListener('abort', () => {
              clearTimeout(timer);
              reject(options.signal?.reason || new DOMException('Aborted', 'AbortError'));
            }, { once: true });
          });
        }
      }
      if (!turn) throw new Error('Model request completed without a response.');
      finalText = turn.content || finalText;
      allReasoning += turn.reasoningContent;
      if (streamedReasoning || turn.reasoningContent) {
        emit({ type: 'assistant/reasoning', step, text: turn.reasoningContent || streamedReasoning, at: Date.now() });
      }
      if (streamedText || turn.content) {
        emit({ type: 'assistant/message', step, text: turn.content || streamedText, at: Date.now() });
        session.append('assistant/message', { step, text: (turn.content || streamedText).slice(0, 4_000) });
      }

      messages.push({
        role: 'assistant',
        content: turn.content || null,
        ...(turn.reasoningContent ? { reasoning_content: turn.reasoningContent } : {}),
        ...(turn.toolCalls.length > 0 ? { tool_calls: turn.toolCalls } : {}),
      });

      if (turn.toolCalls.length === 0) {
        emit({ type: 'step/end', step, reason: turn.finishReason || 'stop', at: Date.now() });
        emit({ type: 'turn/end', reason: 'completed', at: Date.now() });
        session.append('step/end', { step, reason: turn.finishReason || 'stop' });
        session.append('turn/end', { reason: 'completed' });
        return { text: finalText, reasoning: allReasoning, steps: step, stopReason: 'completed', events, toolExecutions, mode: session.mode, sessionEvents: session.events.length };
      }

      const prepared: Array<{ call: DeepSeekToolCall; args: Record<string, unknown> }> = [];
      for (const call of turn.toolCalls) {
        let args: Record<string, unknown>;
        try {
          args = toolArgumentsSchema.parse(JSON.parse(call.function.arguments || '{}'));
        } catch (error) {
          const failed: HarnessToolExecution = {
            call,
            args: {},
            success: false,
            error: `Invalid tool arguments: ${error instanceof Error ? error.message : String(error)}`,
          };
          toolExecutions.push(failed);
          const content = stringifyToolResult(failed);
          emit({ type: 'tool/result', step, callId: call.id, name: call.function.name, success: false, content, at: Date.now() });
          messages.push({ role: 'tool', tool_call_id: call.id, content });
          continue;
        }
        prepared.push({ call, args });
        emit({ type: 'tool/call', step, callId: call.id, name: call.function.name, arguments: args, at: Date.now() });
        session.append('tool/call', { step, callId: call.id, name: call.function.name });
      }

      if (prepared.length > 0) {
        const executed = await options.executeTools(prepared);
        for (const execution of executed) {
          toolExecutions.push(execution);
          const content = stringifyToolResult(execution);
          emit({
            type: 'tool/result',
            step,
            callId: execution.call.id,
            name: execution.call.function.name,
            success: execution.success,
            content,
            at: Date.now(),
          });
          messages.push({ role: 'tool', tool_call_id: execution.call.id, content });
          session.append('tool/result', {
            step,
            callId: execution.call.id,
            name: execution.call.function.name,
            success: execution.success,
            content: content.slice(0, 2_000),
          });
        }
      }
      emit({ type: 'step/end', step, reason: 'tool-calls', at: Date.now() });
      session.append('step/end', { step, reason: 'tool-calls' });
    }

    emit({ type: 'turn/end', reason: 'max-steps', at: Date.now() });
    session.append('turn/end', { reason: 'max-steps' });
    return {
      text: finalText || '已达到本轮最大执行步数，当前工具结果已保留。',
      reasoning: allReasoning,
      steps: maxSteps,
      stopReason: 'max-steps',
      events,
      toolExecutions,
      mode: session.mode,
      sessionEvents: session.events.length,
    };
  } catch (error) {
    const aborted = options.signal?.aborted || (error as any)?.name === 'AbortError';
    emit({ type: 'turn/end', reason: aborted ? 'aborted' : 'error', at: Date.now() });
    session.append('turn/end', {
      reason: aborted ? 'aborted' : 'error',
      message: error instanceof Error ? error.message.slice(0, 800) : String(error).slice(0, 800),
    });
    throw error;
  }
};
