import React, { useMemo } from 'react';
import { Brain, CheckCircle2, ChevronDown, Circle, Sparkles, Wrench, XCircle } from 'lucide-react';
import { z } from 'zod';

const harnessEventSchema = z.object({
  type: z.string(),
  step: z.number().int().positive().optional(),
  callId: z.string().optional(),
  name: z.string().optional(),
  success: z.boolean().optional(),
  text: z.string().optional(),
  reason: z.string().optional(),
}).passthrough();

const harnessStateSchema = z.object({
  type: z.literal('deepseek-harness'),
  version: z.number().optional(),
  provider: z.literal('deepseek'),
  model: z.string().optional(),
  mode: z.enum(['default', 'plan']).optional(),
  sessionEvents: z.number().int().nonnegative().optional(),
  steps: z.number().int().nonnegative(),
  stopReason: z.enum(['completed', 'max-steps']).optional(),
  events: z.array(harnessEventSchema),
}).passthrough();

interface DeepSeekHarnessTraceProps {
  workflowState: unknown;
}

const TOOL_LABELS: Record<string, string> = {
  updatePlan: '更新任务计划',
  generateImage: '生成图片',
  generateVideo: '生成视频',
  smartEdit: '智能编辑',
  generateCopy: '生成文案',
  extractText: '识别文字',
  analyzeRegion: '分析画面',
  touchEdit: '局部编辑',
};

/** Projects persisted Harness lifecycle events into a compact conversation trace. */
export const DeepSeekHarnessTrace: React.FC<DeepSeekHarnessTraceProps> = ({ workflowState }) => {
  const parsed = harnessStateSchema.safeParse(workflowState);
  const steps = useMemo(() => {
    if (!parsed.success) return [];
    return Array.from({ length: parsed.data.steps }, (_, offset) => {
      const step = offset + 1;
      const events = parsed.data.events.filter(event => event.step === step);
      const reasoning = events
        .filter(event => event.type === 'assistant/reasoning' && event.text)
        .map(event => event.text)
        .join('\n')
        .trim()
        .slice(0, 1_200);
      const calls = events.filter(event => event.type === 'tool/call' && event.callId && event.name);
      const results = new Map(
        events
          .filter(event => event.type === 'tool/result' && event.callId)
          .map(event => [event.callId, event] as const),
      );
      return { step, reasoning, calls, results };
    });
  }, [parsed.success, parsed.success ? parsed.data : null]);

  if (!parsed.success) return null;
  const state = parsed.data;
  const completed = state.stopReason !== 'max-steps';

  return (
    <div className="mx-1 mb-3 overflow-hidden rounded-xl border border-slate-200 bg-slate-50/70">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white/80 px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-950 text-white">
            <Sparkles size={14} />
          </div>
          <div className="min-w-0">
            <p className="truncate text-[12px] font-bold text-gray-900">XcAI</p>
            <p className="truncate font-mono text-[9px] text-gray-400">
              {state.model || 'deepseek'} · {state.mode === 'plan' ? '规划模式' : '执行模式'}
              {typeof state.sessionEvents === 'number' ? ` · ${state.sessionEvents} events` : ''}
            </p>
          </div>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-bold ${completed ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-700'}`}>
          {completed ? `${state.steps} 步完成` : `${state.steps} 步后停止`}
        </span>
      </div>

      <div className="space-y-1.5 p-2">
        {steps.map((item) => (
          <details key={item.step} className="group rounded-lg border border-slate-200 bg-white/90" open={item.step === state.steps}>
            <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 px-3 py-2 text-[11px] font-semibold text-gray-600">
              <Circle size={8} className="fill-slate-900 text-slate-900" />
              <span className="flex-1">步骤 {item.step}</span>
              <span className="text-[9px] font-medium text-gray-400">
                {item.calls.length > 0 ? `${item.calls.length} 个工具` : '思考与回复'}
              </span>
              <ChevronDown size={13} className="text-gray-400 transition-transform group-open:rotate-180" />
            </summary>
            <div className="space-y-2 border-t border-slate-100 px-3 py-2.5">
              {item.reasoning && (
                <details className="rounded-lg bg-gray-50 px-2.5 py-2">
                  <summary className="flex min-h-8 cursor-pointer list-none items-center gap-2 text-[10px] font-bold text-gray-500">
                    <Brain size={12} />
                    分析状态
                    <ChevronDown size={11} className="ml-auto" />
                  </summary>
                  <p className="mt-1.5 whitespace-pre-wrap break-words text-[10px] leading-4 text-gray-500">{item.reasoning}</p>
                </details>
              )}
              {item.calls.map(call => {
                const result = item.results.get(call.callId || '');
                const settled = result !== undefined;
                const succeeded = result?.success === true;
                return (
                  <div key={call.callId} className="flex min-h-9 items-center gap-2 rounded-lg border border-gray-100 bg-white px-2.5 py-2">
                    <Wrench size={12} className="shrink-0 text-slate-700" />
                    <span className="min-w-0 flex-1 truncate text-[10px] font-semibold text-gray-600">
                      {TOOL_LABELS[call.name || ''] || call.name}
                    </span>
                    {!settled ? <Circle size={12} className="text-gray-300" /> : succeeded
                      ? <CheckCircle2 size={13} className="text-emerald-500" />
                      : <XCircle size={13} className="text-red-500" />}
                  </div>
                );
              })}
              {!item.reasoning && item.calls.length === 0 && (
                <p className="text-[10px] text-gray-400">该步骤未产生可展示的内部内容。</p>
              )}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
};
