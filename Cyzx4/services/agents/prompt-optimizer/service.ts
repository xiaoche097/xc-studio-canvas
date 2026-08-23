import { AgentTask } from '../../../types/agent.types';
import type { ProjectContext } from '../../../types/common';
import { executeAgentTask } from '../index';
import { safeExtractTextFromOptimizerOutput } from './output';
import type { PromptOptimizerMode } from './roles';

export type OptimizeResult =
  | { ok: true; optimizedText: string }
  | { ok: false; reason: string };

export async function optimizeUserText(
  rawText: string,
  context: ProjectContext,
  opts?: {
    timeoutMs?: number;
    requestId?: string;
    mode?: PromptOptimizerMode;
    referenceImageCount?: number;
    isRevision?: boolean;
  },
): Promise<OptimizeResult> {
  try {
    const task: AgentTask = {
      id: `opt-${Date.now()}`,
      agentId: 'prompt-optimizer',
      status: 'pending',
      input: {
        message: rawText,
        context,
        metadata: {
          internalCall: true,
          requestId: opts?.requestId,
          timeoutMs: opts?.timeoutMs ?? 2500,
          promptOptimizerMode: opts?.mode || 'auto',
          referenceImageCount: opts?.referenceImageCount || 0,
          continuationContext: opts?.isRevision ? { isRevision: true } : undefined,
        },
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const res = await executeAgentTask(task);
    const optimized = safeExtractTextFromOptimizerOutput(res.output);
    if (!optimized) return { ok: false, reason: 'empty_output' };

    return { ok: true, optimizedText: optimized.trim() };
  } catch (e: any) {
    return { ok: false, reason: e?.message ?? 'exception' };
  }
}
