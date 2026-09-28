import { EnhancedBaseAgent } from '../enhanced-base-agent';
import {
  PROMPT_OPTIMIZER_AGENT_INFO,
  PROMPT_OPTIMIZER_SYSTEM_PROMPT,
} from '../prompts/prompt-optimizer.prompt';
import type { AgentTask } from '../../../types/agent.types';
import { buildPromptOptimizerRequest, promptOptimizerModeSchema } from '../prompt-optimizer/roles';

export class PromptOptimizerAgent extends EnhancedBaseAgent {
  get agentInfo() {
    return PROMPT_OPTIMIZER_AGENT_INFO;
  }

  get systemPrompt() {
    return PROMPT_OPTIMIZER_SYSTEM_PROMPT;
  }

  get preferredSkills() {
    return [];
  }

  get maxConcurrency() {
    return 4;
  }

  async execute(task: AgentTask): Promise<AgentTask> {
    const metadata = task.input.metadata || {};
    const mode = promptOptimizerModeSchema.catch('auto').parse(
      metadata.promptOptimizerMode || metadata.skillData?.config?.promptOptimizerMode,
    );
    const referenceImageCount = Math.max(
      task.input.attachments?.filter((file) => file.type?.startsWith('image/')).length || 0,
      task.input.uploadedAttachments?.length || 0,
      metadata.multimodalContext?.referenceImageUrls?.length || 0,
      Number(metadata.referenceImageCount || 0),
    );
    const request = buildPromptOptimizerRequest({
      text: task.input.message,
      mode,
      referenceImageCount,
      isRevision: metadata.continuationContext?.isRevision === true,
    });

    return super.execute({
      ...task,
      input: {
        ...task.input,
        message: request.message,
        metadata: {
          ...metadata,
          promptOptimizerMode: mode,
          resolvedPromptOptimizerMode: request.role.id,
          disableTools: true,
          deepseekMaxSteps: 2,
        },
      },
    });
  }
}

export const promptOptimizerAgent = new PromptOptimizerAgent();
