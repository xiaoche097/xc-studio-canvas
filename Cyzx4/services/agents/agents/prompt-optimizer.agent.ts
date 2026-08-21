import { EnhancedBaseAgent } from '../enhanced-base-agent';
import {
  PROMPT_OPTIMIZER_AGENT_INFO,
  PROMPT_OPTIMIZER_SYSTEM_PROMPT,
} from '../prompts/prompt-optimizer.prompt';

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
}

export const promptOptimizerAgent = new PromptOptimizerAgent();
